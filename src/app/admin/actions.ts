'use server'

import bcrypt from 'bcryptjs'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { clientIp, endSession, recordFailure, requireAdmin, startSession, tooManyFailures } from '@/lib/auth'
import { getSettings } from '@/lib/state'
import { parseSourceUrl } from '@/lib/arxiv'
import { addPaperFromUrl, readSource } from '@/lib/papers'
import { writePost } from '@/lib/writer'
import { createWeeklyDigest, digestBody, sendDigest } from '@/lib/newsletter'
import { dailyTask, isJobRunning, runExclusive, weeklyTask } from '@/lib/jobs'
import { PROVIDERS } from '@/lib/ai'

// Her işlem sonunda sayfaya kısa bir mesajla dönülür (?mesaj=...)
function back(path: string, message: string): never {
  revalidatePath('/', 'layout')
  redirect(`${path}${path.includes('?') ? '&' : '?'}mesaj=${encodeURIComponent(message)}`)
}

const text = (form: FormData, name: string) => String(form.get(name) ?? '').trim()
const id = (form: FormData) => {
  const value = Number(form.get('id'))
  if (!Number.isInteger(value)) throw new Error('Geçersiz istek')
  return value
}
const errorText = (error: unknown) => String((error as Error)?.message || error).slice(0, 200)

// Uzun süren işler (yapay zekâ çağrıları) arka planda çalışır; isteği nginx zaman aşımına sokmasın
function inBackground(path: string, name: string, task: () => Promise<string>, started: string): never {
  if (isJobRunning()) back(path, 'Başka bir iş sürüyor; bitince tekrar dene (günlüğe bak)')
  void runExclusive(name, task)
  back(path, started)
}

// --- Giriş ve kurulum ---

export async function setupAction(form: FormData) {
  const settings = await getSettings()
  if (settings.passwordHash) back('/admin/giris', 'Kurulum zaten tamamlanmış')
  const token = process.env.SETUP_TOKEN
  if (token && text(form, 'setupToken') !== token) back('/admin/giris', 'Kurulum anahtarı hatalı')
  const password = String(form.get('password') ?? '')
  if (password.length < 10) back('/admin/giris', 'Şifre en az 10 karakter olmalı')
  if (password !== String(form.get('password2') ?? '')) back('/admin/giris', 'Şifreler aynı değil')
  const passwordHash = await bcrypt.hash(password, 12)
  const proto = headers().get('x-forwarded-proto')?.split(',')[0].trim() || 'http'
  const host = headers().get('x-forwarded-host') || headers().get('host') || ''
  await prisma.settings.update({ where: { id: 1 }, data: { passwordHash, siteUrl: settings.siteUrl || (host ? `${proto}://${host}` : '') } })
  await startSession(passwordHash)
  redirect('/admin/ayarlar?mesaj=' + encodeURIComponent('Kurulum tamam. Yapay zekâ ve Künye ayarlarını doldur.'))
}

export async function loginAction(form: FormData) {
  const ip = clientIp()
  if (tooManyFailures(ip)) back('/admin/giris', 'Çok fazla hatalı deneme; 15 dakika sonra tekrar dene')
  const settings = await getSettings()
  const ok = !!settings.passwordHash && (await bcrypt.compare(String(form.get('password') ?? ''), settings.passwordHash))
  if (!ok) {
    recordFailure(ip)
    back('/admin/giris', 'Şifre hatalı')
  }
  await startSession(settings.passwordHash)
  redirect('/admin')
}

export async function logoutAction() {
  endSession()
  redirect('/admin/giris')
}

export async function changePasswordAction(form: FormData) {
  await requireAdmin()
  const settings = await getSettings()
  if (!(await bcrypt.compare(String(form.get('current') ?? ''), settings.passwordHash))) back('/admin/ayarlar', 'Mevcut şifre hatalı')
  const password = String(form.get('password') ?? '')
  if (password.length < 10) back('/admin/ayarlar', 'Yeni şifre en az 10 karakter olmalı')
  const passwordHash = await bcrypt.hash(password, 12)
  await prisma.settings.update({ where: { id: 1 }, data: { passwordHash } })
  await startSession(passwordHash) // diğer oturumlar kapanır, bu açık kalır
  back('/admin/ayarlar', 'Şifre değişti')
}

// --- Ayarlar ---

const intIn = (value: string, min: number, max: number, fallback: number) => {
  const n = Number(value)
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback
}

export async function saveSettingsAction(form: FormData) {
  await requireAdmin()
  const current = await getSettings()
  const provider = PROVIDERS[text(form, 'aiProvider')] ? text(form, 'aiProvider') : current.aiProvider
  const url = (value: string) => (value === '' || /^https?:\/\/[^\s]+$/i.test(value) ? value.replace(/\/+$/, '') : null)
  const siteUrl = url(text(form, 'siteUrl'))
  const kunyeUrl = url(text(form, 'kunyeUrl'))
  const aiBaseUrl = url(text(form, 'aiBaseUrl'))
  if (siteUrl === null || kunyeUrl === null || aiBaseUrl === null) back('/admin/ayarlar', 'Adresler http:// ya da https:// ile başlamalı')
  await prisma.settings.update({
    where: { id: 1 },
    data: {
      siteTitle: text(form, 'siteTitle').slice(0, 100) || current.siteTitle,
      siteDescription: text(form, 'siteDescription').slice(0, 300),
      siteUrl,
      aiProvider: provider,
      aiModel: text(form, 'aiModel').slice(0, 200),
      // Boş bırakılan gizli alanlar değişmez (sayfada gösterilmiyorlar)
      aiApiKey: text(form, 'aiApiKey') || (form.get('aiApiKeyClear') ? '' : current.aiApiKey),
      aiBaseUrl,
      readMode: text(form, 'readMode') === 'full' ? 'full' : 'abstract',
      maxInputChars: intIn(text(form, 'maxInputChars'), 500, 400_000, current.maxInputChars),
      postsPerDay: intIn(text(form, 'postsPerDay'), 0, 20, current.postsPerDay),
      dailyHour: intIn(text(form, 'dailyHour'), 0, 23, current.dailyHour),
      interests: text(form, 'interests').slice(0, 1000),
      monthlyTokenLimit: intIn(text(form, 'monthlyTokenLimit'), 0, 1_000_000_000, current.monthlyTokenLimit),
      autoPublish: form.get('autoPublish') === 'on',
      autoNewsletter: form.get('autoNewsletter') === 'on',
      digestWeekday: intIn(text(form, 'digestWeekday'), 0, 6, current.digestWeekday),
      kunyeUrl,
      kunyeToken: text(form, 'kunyeToken') || (form.get('kunyeTokenClear') ? '' : current.kunyeToken),
      newsletterTag: text(form, 'newsletterTag').slice(0, 50),
    },
  })
  back('/admin/ayarlar', 'Ayarlar kaydedildi')
}

// --- Kaynaklar ---

export async function addSourceAction(form: FormData) {
  await requireAdmin()
  const url = text(form, 'url')
  if (parseSourceUrl(url)?.kind === 'paper') back('/admin/kaynaklar', 'Bu tek bir makalenin linki; onu Makaleler sayfasından ekle')
  if (await prisma.source.findUnique({ where: { url } })) back('/admin/kaynaklar', 'Bu kaynak zaten ekli')
  // Eklemeden önce bir kez okunur: çalışmayan adres listeye girmesin
  let message: string
  try {
    const papers = await readSource(url)
    await prisma.source.create({ data: { url } })
    message = `Eklendi (şu an ${papers.length} makale görünüyor; ilk taramada alınır)`
  } catch (error) {
    message = errorText(error)
  }
  back('/admin/kaynaklar', message)
}

export async function toggleSourceAction(form: FormData) {
  await requireAdmin()
  const source = await prisma.source.findUniqueOrThrow({ where: { id: id(form) } })
  await prisma.source.update({ where: { id: source.id }, data: { enabled: !source.enabled } })
  back('/admin/kaynaklar', source.enabled ? 'Kaynak durduruldu' : 'Kaynak açıldı')
}

export async function deleteSourceAction(form: FormData) {
  await requireAdmin()
  await prisma.source.deleteMany({ where: { id: id(form) } })
  back('/admin/kaynaklar', 'Kaynak silindi')
}

// --- Makaleler ---

export async function addPaperAction(form: FormData) {
  await requireAdmin()
  let message: string
  try {
    const paper = await addPaperFromUrl(text(form, 'url'))
    message = `Eklendi: ${paper.title}`
  } catch (error) {
    message = errorText(error)
  }
  back('/admin/makaleler', message)
}

export async function writePaperAction(form: FormData) {
  await requireAdmin()
  const paperId = id(form)
  const settings = await getSettings()
  inBackground('/admin/makaleler', 'Yazı üretimi', async () => {
    const post = await writePost(paperId, settings, false)
    return `"${post.title}" taslak olarak hazır`
  }, 'Yazı arka planda hazırlanıyor; bitince Yazılar\'da taslak olarak görünür')
}

export async function skipPaperAction(form: FormData) {
  await requireAdmin()
  await prisma.paper.update({ where: { id: id(form) }, data: { status: 'skipped' } })
  back('/admin/makaleler', 'Atlandı')
}

// --- Yazılar ---

export async function savePostAction(form: FormData) {
  await requireAdmin()
  const postId = id(form)
  const title = text(form, 'title')
  const body = text(form, 'body')
  if (!title || !body) back(`/admin/yazilar/${postId}`, 'Başlık ve gövde boş olamaz')
  await prisma.post.update({ where: { id: postId }, data: { title: title.slice(0, 300), excerpt: text(form, 'excerpt').slice(0, 500), body } })
  back(`/admin/yazilar/${postId}`, 'Kaydedildi')
}

export async function publishPostAction(form: FormData) {
  await requireAdmin()
  const post = await prisma.post.findUniqueOrThrow({ where: { id: id(form) } })
  const publish = post.status !== 'published'
  await prisma.post.update({ where: { id: post.id }, data: { status: publish ? 'published' : 'draft', publishedAt: publish ? post.publishedAt ?? new Date() : post.publishedAt } })
  back(`/admin/yazilar/${post.id}`, publish ? 'Yayımlandı' : 'Yayından kaldırıldı')
}

export async function deletePostAction(form: FormData) {
  await requireAdmin()
  await prisma.post.deleteMany({ where: { id: id(form) } })
  back('/admin/yazilar', 'Yazı silindi')
}

// Önemli bir yazıyı haftayı beklemeden abonelere gönder: tek yazılık bülten taslağı açılır
export async function postToDigestAction(form: FormData) {
  await requireAdmin()
  const post = await prisma.post.findUniqueOrThrow({ where: { id: id(form) } })
  if (post.status !== 'published') back(`/admin/yazilar/${post.id}`, 'Önce yazıyı yayımla')
  const settings = await getSettings()
  const digest = await prisma.digest.create({ data: { subject: post.title, body: digestBody([post], settings.siteUrl) } })
  back(`/admin/bultenler/${digest.id}`, 'Bülten taslağı hazır; kontrol edip gönder')
}

// --- Bültenler ---

export async function createDigestAction() {
  await requireAdmin()
  const digest = await createWeeklyDigest(await getSettings())
  if (!digest) back('/admin/bultenler', 'Son 7 günde yayımlanan yazı yok')
  back(`/admin/bultenler/${digest.id}`, 'Bülten taslağı hazır')
}

export async function saveDigestAction(form: FormData) {
  await requireAdmin()
  const digestId = id(form)
  const subject = text(form, 'subject')
  const body = text(form, 'body')
  if (!subject || !body) back(`/admin/bultenler/${digestId}`, 'Konu ve metin boş olamaz')
  await prisma.digest.updateMany({ where: { id: digestId, status: { not: 'sent' } }, data: { subject: subject.slice(0, 300), body } })
  back(`/admin/bultenler/${digestId}`, 'Kaydedildi')
}

export async function sendDigestAction(form: FormData) {
  await requireAdmin()
  const digestId = id(form)
  let message = 'Künye\'de planlandı; iki dakika içinde abonelere gider'
  try {
    await sendDigest(digestId, await getSettings())
  } catch (error) {
    message = `Gönderilemedi: ${errorText(error)}`
  }
  back(`/admin/bultenler/${digestId}`, message)
}

export async function deleteDigestAction(form: FormData) {
  await requireAdmin()
  await prisma.digest.deleteMany({ where: { id: id(form) } })
  back('/admin/bultenler', 'Bülten silindi')
}

// --- Elle çalıştırma ---

export async function runDailyAction() {
  await requireAdmin()
  inBackground('/admin', 'Günlük iş (elle)', dailyTask, 'Günlük iş arka planda başladı; sonuç aşağıdaki günlükte görünür')
}

export async function runWeeklyAction() {
  await requireAdmin()
  inBackground('/admin', 'Haftalık bülten (elle)', weeklyTask, 'Haftalık bülten hazırlanıyor; sonuç aşağıdaki günlükte görünür')
}
