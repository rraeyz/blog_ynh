'use server'

import bcrypt from 'bcryptjs'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { clientIp, endSession, recordFailure, requireAdmin, startSession, tooManyFailures } from '@/lib/auth'
import { getSettings } from '@/lib/state'
import { parseSourceUrl } from '@/lib/arxiv'
import { addPaperFromUrl, hidePapers, readSource } from '@/lib/papers'
import { autoFeature, featurePost, writePost } from '@/lib/writer'
import { coverMissing, generateCover, removeImage } from '@/lib/images'
import { createWeeklyDigest, digestBody, sendDigest } from '@/lib/newsletter'
import { CATEGORIES } from '@/lib/topics'
import { isLevel } from '@/lib/levels'
import { addLesson, addSeries, lessonTask, planSeries, requestLesson, seedStarterSeries, writeLesson } from '@/lib/lessons'
import { astroDigestTask, dailyTask, isJobRunning, runExclusive, weeklyTask } from '@/lib/jobs'
import { skyTask } from '@/lib/sky'
import { PROVIDERS } from '@/lib/ai'

// Her işlem sonunda sayfaya kısa bir mesajla dönülür (?mesaj=...)
function back(path: string, message: string): never {
  revalidatePath('/', 'layout')
  redirect(`${path}${path.includes('?') ? '&' : '?'}mesaj=${encodeURIComponent(message)}`)
}

const text = (form: FormData, name: string) => String(form.get(name) ?? '').trim()
// Listedeki düğmenin geldiği sayfa (Pager.tsx BackTo); yalnızca panelin liste adresleri: başka bir adrese yönlendirilemesin
const returnTo = (form: FormData, fallback: string) => {
  const value = text(form, 'back')
  return /^\/admin\/(makaleler|yazilar)(\?[\w=&%.+-]*)?$/.test(value) ? value : fallback
}
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
  redirect('/admin/ayarlar?bolum=yapay-zeka&mesaj=' + encodeURIComponent('Kurulum tamam. Yapay zekâ ve Künye ayarlarını doldur.'))
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
  if (!(await bcrypt.compare(String(form.get('current') ?? ''), settings.passwordHash))) back('/admin/ayarlar?bolum=guvenlik', 'Mevcut şifre hatalı')
  const password = String(form.get('password') ?? '')
  if (password.length < 10) back('/admin/ayarlar?bolum=guvenlik', 'Yeni şifre en az 10 karakter olmalı')
  const passwordHash = await bcrypt.hash(password, 12)
  await prisma.settings.update({ where: { id: 1 }, data: { passwordHash } })
  await startSession(passwordHash) // diğer oturumlar kapanır, bu açık kalır
  back('/admin/ayarlar?bolum=guvenlik', 'Şifre değişti')
}

// --- Ayarlar ---

const intIn = (value: string, min: number, max: number, fallback: number) => {
  const n = Number(value)
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback
}

// Ayarlar sekmeli: her sekme yalnızca kendi alanlarını gönderir ve kaydeder (diğer sekmelerin ayarları değişmez)
const SETTINGS_SECTIONS: Record<string, string[]> = {
  site: ['siteTitle', 'siteDescription', 'siteUrl'],
  'yapay-zeka': ['aiProvider', 'aiModel', 'aiApiKey', 'aiBaseUrl', 'imageApiKey', 'monthlyTokenLimit'],
  haberler: ['readMode', 'maxInputChars', 'interests', 'postsPerDay', 'postsMinPerDay', 'scoreThreshold', 'scoreExceptional', 'spacePerDay', 'spaceNormalPerDay', 'spaceImportantScore', 'spaceMaxPerDay', 'fullTextReplace', 'fullTextPromote', 'dailyHour', 'autoPublish', 'autoFeature', 'featureScore', 'imageModel', 'skyEnabled'],
  egitim: ['lessonModel', 'lessonHelperModel', 'lessonWeekdays', 'lessonAutoPublish'],
  bulten: ['kunyeUrl', 'kunyeToken', 'newsletterTag', 'digestWeekday', 'autoNewsletter', 'astroDigest', 'astroDigestWeekday'],
}

export async function saveSettingsAction(form: FormData) {
  await requireAdmin()
  const section = text(form, 'section')
  const fields = Object.hasOwn(SETTINGS_SECTIONS, section) ? SETTINGS_SECTIONS[section] : null
  if (!fields) throw new Error('Geçersiz istek')
  const path = `/admin/ayarlar?bolum=${section}`
  const current = await getSettings()
  const url = (name: string) => {
    const value = text(form, name)
    if (value !== '' && !/^https?:\/\/[^\s]+$/i.test(value)) back(path, 'Adresler http:// ya da https:// ile başlamalı')
    return value.replace(/\/+$/, '')
  }
  // Boş bırakılan gizli alanlar değişmez (sayfada gösterilmiyorlar)
  const secret = (name: 'aiApiKey' | 'kunyeToken' | 'imageApiKey') => text(form, name) || (form.get(`${name}Clear`) ? '' : current[name])
  const checked = (name: string) => form.get(name) === 'on'
  // Puan alanı "6,5" ya da "6.5" → onda bir tam sayı (65)
  const score = (name: 'scoreThreshold' | 'scoreExceptional' | 'spaceImportantScore' | 'featureScore') => intIn(String(Math.round(Number(text(form, name).replace(',', '.')) * 10)), 10, 100, current[name])
  const parse: Record<string, () => unknown> = {
    siteTitle: () => text(form, 'siteTitle').slice(0, 100) || current.siteTitle,
    siteDescription: () => text(form, 'siteDescription').slice(0, 300),
    siteUrl: () => url('siteUrl'),
    aiProvider: () => (PROVIDERS[text(form, 'aiProvider')] ? text(form, 'aiProvider') : current.aiProvider),
    aiModel: () => text(form, 'aiModel').slice(0, 200),
    aiApiKey: () => secret('aiApiKey'),
    aiBaseUrl: () => url('aiBaseUrl'),
    imageApiKey: () => secret('imageApiKey'),
    monthlyTokenLimit: () => intIn(text(form, 'monthlyTokenLimit'), 0, 1_000_000_000, current.monthlyTokenLimit),
    readMode: () => (text(form, 'readMode') === 'full' ? 'full' : 'abstract'),
    maxInputChars: () => intIn(text(form, 'maxInputChars'), 500, 400_000, current.maxInputChars),
    interests: () => text(form, 'interests').slice(0, 1000),
    postsPerDay: () => intIn(text(form, 'postsPerDay'), 0, 15, current.postsPerDay),
    postsMinPerDay: () => intIn(text(form, 'postsMinPerDay'), 0, 15, current.postsMinPerDay),
    scoreThreshold: () => score('scoreThreshold'),
    scoreExceptional: () => score('scoreExceptional'),
    spacePerDay: () => intIn(text(form, 'spacePerDay'), 0, 15, current.spacePerDay),
    spaceNormalPerDay: () => intIn(text(form, 'spaceNormalPerDay'), 0, 15, current.spaceNormalPerDay),
    spaceImportantScore: () => score('spaceImportantScore'),
    spaceMaxPerDay: () => intIn(text(form, 'spaceMaxPerDay'), 0, 15, current.spaceMaxPerDay),
    fullTextReplace: () => intIn(text(form, 'fullTextReplace'), 0, 15, current.fullTextReplace),
    fullTextPromote: () => intIn(text(form, 'fullTextPromote'), 0, 15, current.fullTextPromote),
    dailyHour: () => intIn(text(form, 'dailyHour'), 0, 23, current.dailyHour),
    autoPublish: () => checked('autoPublish'),
    autoFeature: () => checked('autoFeature'),
    featureScore: () => score('featureScore'),
    imageModel: () => text(form, 'imageModel').slice(0, 200) || current.imageModel,
    skyEnabled: () => checked('skyEnabled'),
    lessonModel: () => text(form, 'lessonModel').slice(0, 200) || current.lessonModel,
    lessonHelperModel: () => text(form, 'lessonHelperModel').slice(0, 200) || current.lessonHelperModel,
    lessonWeekdays: () => form.getAll('lessonDay').map(String).filter((d) => /^[0-6]$/.test(d)).join(','),
    lessonAutoPublish: () => checked('lessonAutoPublish'),
    kunyeUrl: () => url('kunyeUrl'),
    kunyeToken: () => secret('kunyeToken'),
    newsletterTag: () => text(form, 'newsletterTag').slice(0, 50),
    digestWeekday: () => intIn(text(form, 'digestWeekday'), 0, 6, current.digestWeekday),
    autoNewsletter: () => checked('autoNewsletter'),
    astroDigest: () => checked('astroDigest'),
    astroDigestWeekday: () => intIn(text(form, 'astroDigestWeekday'), 0, 6, current.astroDigestWeekday),
  }
  await prisma.settings.update({ where: { id: 1 }, data: Object.fromEntries(fields.map((field) => [field, parse[field]()])) })
  back(path, 'Ayarlar kaydedildi')
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
  inBackground(returnTo(form, '/admin/makaleler'), 'Yazı üretimi', async () => {
    const post = await writePost(paperId, settings, false)
    return `"${post.title}" taslak olarak hazır`
  }, 'Yazı arka planda hazırlanıyor; bitince Yazılar\'da taslak olarak görünür')
}

export async function skipPaperAction(form: FormData) {
  await requireAdmin()
  await prisma.paper.update({ where: { id: id(form) }, data: { status: 'skipped' } })
  back(returnTo(form, '/admin/makaleler'), 'Atlandı')
}

const PAPER_TAB = (status: string) => `/admin/makaleler?durum=${status}`

export async function deletePaperAction(form: FormData) {
  await requireAdmin()
  const status = text(form, 'status')
  await hidePapers(status, id(form))
  back(returnTo(form, PAPER_TAB(status)), 'Silindi')
}

// Sekmedekilerin hepsi: Bekliyor ve Hata atlanır, Atlandı silinir
export async function bulkPapersAction(form: FormData) {
  await requireAdmin()
  const status = text(form, 'status')
  if (status === 'skipped') back(PAPER_TAB(status), `${(await hidePapers('skipped')).count} makale silindi`)
  if (status !== 'new' && status !== 'failed') throw new Error('Geçersiz istek')
  const { count } = await prisma.paper.updateMany({ where: { status }, data: { status: 'skipped', error: '' } })
  back(PAPER_TAB(status), `${count} makale atlandı`)
}

// --- Yazılar ---

export async function savePostAction(form: FormData) {
  await requireAdmin()
  const postId = id(form)
  const title = text(form, 'title')
  const body = text(form, 'body')
  if (!title || !body) back(`/admin/yazilar/${postId}`, 'Başlık ve gövde boş olamaz')
  const highlights = text(form, 'highlights').split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 5).join('\n')
  const category = CATEGORIES[text(form, 'category')] ? text(form, 'category') : ''
  await prisma.post.update({ where: { id: postId }, data: { title: title.slice(0, 300), excerpt: text(form, 'excerpt').slice(0, 500), highlights, body, category } })
  back(`/admin/yazilar/${postId}`, 'Kaydedildi')
}

export async function publishPostAction(form: FormData) {
  await requireAdmin()
  const post = await prisma.post.findUniqueOrThrow({ where: { id: id(form) } })
  const publish = post.status !== 'published'
  await prisma.post.update({ where: { id: post.id }, data: { status: publish ? 'published' : 'draft', publishedAt: publish ? post.publishedAt ?? new Date() : post.publishedAt, featuredAt: publish ? post.featuredAt : null } })
  if (publish && !post.featuredAt) await autoFeature(post, await getSettings())
  back(`/admin/yazilar/${post.id}`, publish ? 'Yayımlandı' : 'Yayından kaldırıldı')
}

export async function coverMissingAction() {
  await requireAdmin()
  const settings = await getSettings()
  if (!settings.imageApiKey.trim()) back('/admin/yazilar', 'Önce Ayarlar → Yapay zekâ bölümüne OpenRouter anahtarını gir')
  inBackground('/admin/yazilar', 'Eksik kapaklar', () => coverMissing(settings), 'Kapaklar çiziliyor; sonuç Genel → İş günlüğünde')
}

// Temsili kapak (OpenRouter); arka planda, sonuç günlükte
export async function coverPostAction(form: FormData) {
  await requireAdmin()
  const postId = id(form)
  const settings = await getSettings()
  if (!settings.imageApiKey.trim()) back(`/admin/yazilar/${postId}`, 'Önce Ayarlar → Yapay zekâ bölümüne OpenRouter anahtarını gir')
  inBackground(`/admin/yazilar/${postId}`, 'Görsel üretimi', async () => `Görsel hazır: ${await generateCover(postId, settings)}`, 'Görsel üretiliyor; bir dakika sonra sayfayı yenile')
}

export async function featurePostAction(form: FormData) {
  await requireAdmin()
  const post = await prisma.post.findUniqueOrThrow({ where: { id: id(form) } })
  const path = returnTo(form, `/admin/yazilar/${post.id}`)
  if (post.featuredAt) {
    await prisma.post.update({ where: { id: post.id }, data: { featuredAt: null } })
    back(path, 'Öne çıkanlardan kaldırıldı')
  }
  if (post.status !== 'published') back(path, 'Önce yazıyı yayımla')
  const dropped = await featurePost(post.id)
  back(path, dropped ? `Öne çıkarıldı; "${dropped}" öne çıkanlardan düştü` : 'Öne çıkarıldı')
}

// Eski biçimde yazılmış (ya da beğenilmeyen) yazıyı aynı makaleden yeniden yazdırır; adresi ve yayın durumu değişmez
export async function rewritePostAction(form: FormData) {
  await requireAdmin()
  const post = await prisma.post.findUniqueOrThrow({ where: { id: id(form) } })
  if (!post.paperId) back(`/admin/yazilar/${post.id}`, 'Bu yazının kaynak makalesi yok, yeniden yazılamaz')
  const settings = await getSettings()
  inBackground(`/admin/yazilar/${post.id}`, 'Yeniden yazım', async () => {
    const updated = await writePost(post.paperId!, settings, false, post.id)
    return `"${updated.title}" yeniden yazıldı`
  }, 'Yeniden yazılıyor; bir dakika sonra sayfayı yenile (sonuç Genel → İş günlüğü\'nde)')
}

export async function deletePostAction(form: FormData) {
  await requireAdmin()
  const post = await prisma.post.findUnique({ where: { id: id(form) }, select: { id: true, image: true } })
  if (post) await prisma.post.delete({ where: { id: post.id } }).then(() => removeImage(post.image))
  back(returnTo(form, '/admin/yazilar'), 'Yazı silindi')
}

// Yayındakiler toplu silinmez (okurların linkleri kırılır); onlar tek tek silinir
export async function deleteDraftsAction() {
  await requireAdmin()
  const drafts = await prisma.post.findMany({ where: { status: 'draft' }, select: { image: true } })
  const { count } = await prisma.post.deleteMany({ where: { status: 'draft' } })
  await Promise.all(drafts.map((post) => removeImage(post.image)))
  back('/admin/yazilar', `${count} taslak silindi`)
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

export async function runAstroDigestAction() {
  await requireAdmin()
  inBackground('/admin', 'Astronomi özeti (elle)', astroDigestTask, 'Haftanın astronomi özeti hazırlanıyor; sonuç aşağıdaki günlükte görünür')
}

export async function runSkyAction() {
  await requireAdmin()
  const settings = await getSettings()
  if (!settings.imageApiKey.trim()) back('/admin', 'Önce Ayarlar → Yapay zekâ bölümüne OpenRouter anahtarını gir')
  inBackground('/admin', 'Gökyüzü takvimi (elle)', () => skyTask(settings), 'Gökyüzü takvimi araştırılıyor; bir iki dakika sürer')
}

// --- Eğitim ---

const lessonPath = (lessonId: number) => `/admin/egitim/ders/${lessonId}`
const seriesPath = (seriesId: number) => `/admin/egitim/seri/${seriesId}`
const sourceList = (value: string) => value.split('\n').map((l) => l.trim()).filter((l) => /^https?:\/\/\S+$/.test(l)).slice(0, 5).join('\n')

export async function runLessonAction() {
  await requireAdmin()
  const settings = await getSettings()
  if (!settings.imageApiKey.trim()) back('/admin/egitim', 'Önce Ayarlar → Yapay zekâ bölümüne OpenRouter anahtarını gir (dersler de onu kullanır)')
  inBackground('/admin/egitim', 'Ders', () => lessonTask(settings), 'Sıradaki ders araştırılıp yazılıyor; birkaç dakika sürer (sonuç Genel → İş günlüğünde)')
}

export async function seedSeriesAction() {
  await requireAdmin()
  if ((await prisma.series.count()) > 0) back('/admin/egitim', 'Müfredat zaten var')
  await seedStarterSeries()
  back('/admin/egitim', 'Başlangıç müfredatı eklendi')
}

export async function requestLessonAction(form: FormData) {
  await requireAdmin()
  const title = text(form, 'title').slice(0, 200)
  if (!title) back('/admin/egitim', 'Ders başlığı gir')
  await requestLesson(title, text(form, 'scope').slice(0, 1000), sourceList(text(form, 'sourceUrls')))
  back('/admin/egitim', 'İstek sıranın en önüne eklendi')
}

export async function addSeriesAction(form: FormData) {
  await requireAdmin()
  const title = text(form, 'title').slice(0, 200)
  if (!title) back('/admin/egitim', 'Seri adı gir')
  const series = await addSeries(title, text(form, 'summary').slice(0, 1000))
  back(seriesPath(series.id), 'Seri eklendi; ders listesi sırası gelince çıkarılır (ya da şimdi çıkar)')
}

export async function saveSeriesAction(form: FormData) {
  await requireAdmin()
  const seriesId = id(form)
  const title = text(form, 'title').slice(0, 200)
  if (!title) back(seriesPath(seriesId), 'Seri adı boş olamaz')
  await prisma.series.update({ where: { id: seriesId }, data: { title, summary: text(form, 'summary').slice(0, 1000), position: Number.parseInt(text(form, 'position'), 10) || 0 } })
  back(seriesPath(seriesId), 'Kaydedildi')
}

export async function deleteSeriesAction(form: FormData) {
  await requireAdmin()
  await prisma.series.deleteMany({ where: { id: id(form) } })
  back('/admin/egitim', 'Seri ve dersleri silindi')
}

export async function planSeriesAction(form: FormData) {
  await requireAdmin()
  const seriesId = id(form)
  if (await prisma.lesson.count({ where: { seriesId } })) back(seriesPath(seriesId), 'Bu serinin dersleri zaten var')
  const settings = await getSettings()
  inBackground(seriesPath(seriesId), 'Seri planı', async () => `${await planSeries(seriesId, settings)} ders planlandı`, 'Ders listesi araştırılıp çıkarılıyor; bir dakika sonra yenile')
}

export async function addLessonAction(form: FormData) {
  await requireAdmin()
  const seriesId = id(form)
  const title = text(form, 'title').slice(0, 200)
  if (!title) back(seriesPath(seriesId), 'Ders başlığı gir')
  const level = text(form, 'level')
  await addLesson(seriesId, title, text(form, 'scope').slice(0, 1000), sourceList(text(form, 'sourceUrls')), undefined, isLevel(level) ? level : 'kapsamli')
  await prisma.series.update({ where: { id: seriesId }, data: { planned: true } })
  back(seriesPath(seriesId), 'Ders eklendi')
}

export async function saveLessonAction(form: FormData) {
  await requireAdmin()
  const lessonId = id(form)
  const title = text(form, 'title').slice(0, 200)
  if (!title) back(lessonPath(lessonId), 'Başlık boş olamaz')
  await prisma.lesson.update({
    where: { id: lessonId },
    data: {
      title,
      position: Number.parseInt(text(form, 'position'), 10) || 0,
      scope: text(form, 'scope').slice(0, 1000),
      sourceUrls: sourceList(text(form, 'sourceUrls')),
      excerpt: text(form, 'excerpt').slice(0, 500),
      body: text(form, 'body'),
      ...(isLevel(text(form, 'level')) ? { level: text(form, 'level') } : {}),
    },
  })
  back(lessonPath(lessonId), 'Kaydedildi')
}

export async function publishLessonAction(form: FormData) {
  await requireAdmin()
  const lesson = await prisma.lesson.findUniqueOrThrow({ where: { id: id(form) } })
  if (lesson.status !== 'published' && !lesson.body.trim()) back(lessonPath(lesson.id), 'Ders henüz yazılmadı')
  const publish = lesson.status !== 'published'
  await prisma.lesson.update({ where: { id: lesson.id }, data: { status: publish ? 'published' : 'draft', publishedAt: publish ? lesson.publishedAt ?? new Date() : lesson.publishedAt } })
  back(lessonPath(lesson.id), publish ? 'Yayımlandı' : 'Yayından kaldırıldı')
}

export async function rewriteLessonAction(form: FormData) {
  await requireAdmin()
  const lessonId = id(form)
  const settings = await getSettings()
  if (!settings.imageApiKey.trim()) back(lessonPath(lessonId), 'Önce Ayarlar → Yapay zekâ bölümüne OpenRouter anahtarını gir')
  inBackground(lessonPath(lessonId), 'Ders', async () => `"${(await writeLesson(lessonId, settings)).title}" yazıldı (taslak)`, 'Ders araştırılıp yazılıyor; birkaç dakika sonra yenile')
}

// Hata alan ders yeniden sıraya girer
export async function retryLessonAction(form: FormData) {
  await requireAdmin()
  await prisma.lesson.updateMany({ where: { id: id(form), status: 'failed' }, data: { status: 'planned', error: '' } })
  back('/admin/egitim', 'Ders yeniden sıraya alındı')
}

export async function deleteLessonAction(form: FormData) {
  await requireAdmin()
  const lesson = await prisma.lesson.findUnique({ where: { id: id(form) }, select: { seriesId: true } })
  await prisma.lesson.deleteMany({ where: { id: id(form) } })
  back(lesson ? seriesPath(lesson.seriesId) : '/admin/egitim', 'Ders silindi')
}
