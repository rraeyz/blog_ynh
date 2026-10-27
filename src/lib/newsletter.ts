import { prisma } from '@/lib/prisma'
import { logJob, type Settings } from '@/lib/state'
import { topicLabel } from '@/lib/topics'
import { upcomingSky } from '@/lib/sky'
import type { SkyEvent } from '@/lib/text'

// Bültene en fazla bu kadar yazı girer; fazlası varsa öne çıkanlar ve önem puanı yüksek olanlar seçilir
export const DIGEST_MAX = 7

type DigestPost = { title: string; excerpt: string; slug: string; category: string; paper?: { topic: string } | null }

// Yapay zekâ çıktısı e-postaya HTML olarak girer (Künye ham HTML'e izin veriyor): önce kaçışlanır.
// Köşeli parantez Künye'nin [metin](link) biçimini bozmasın diye normal paranteze döner
const escapeMail = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\[/g, '(').replace(/\]/g, ')').replace(/\s+/g, ' ').trim()

// Bülten metni Künye'nin e-posta biçiminde: paragraflar boş satırla, **kalın**, [link](url) ve ham HTML.
// Her gelişme numaralı ve konusu renkli; okur hepsine göz gezdirir, merak ettiğine tıklar.
// Dersler ve gökyüzü sonda küçük bölümler (detayını isteyen tıklar)
type DigestExtras = { lessons?: Array<{ title: string; path: string }>; sky?: SkyEvent[]; intro?: string }
const heading = (text: string) => `<span style="color:#8b5cf6;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase">${text}</span>`
const skyDate = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'short', timeZone: 'UTC' })

export function digestBody(posts: DigestPost[], siteUrl: string, total = posts.length, { lessons = [], sky = [], intro }: DigestExtras = {}): string {
  const base = siteUrl.replace(/\/+$/, '')
  const items = posts.map((post, i) => {
    const url = `${base}/yazi/${post.slug}`
    const topic = post.category || post.paper?.topic
    const label = `${posts.length > 1 ? `${i + 1}${topic ? ' · ' : ''}` : ''}${topic ? topicLabel(topic) : ''}`
    return [
      label && heading(label),
      `**[${escapeMail(post.title)}](${url})**`,
      post.excerpt && escapeMail(post.excerpt),
      `[Devamını oku →](${url})`,
    ].filter(Boolean).join('\n')
  })
  const opening = intro ?? (posts.length === 1
    ? 'Önemli bir gelişme var:'
    : total > posts.length
      ? `Bu hafta ${total} gelişme vardı; en dikkat çekici ${posts.length} tanesi:`
      : `Bu haftanın ${posts.length} gelişmesi; merak ettiğinin detayı bir tık uzakta:`)
  const lessonLine = lessons.length
    ? [heading(`Bu haftanın ${lessons.length > 1 ? 'dersleri' : 'dersi'}`), ...lessons.map((l) => `[${escapeMail(l.title)}](${base}${l.path})`)].join('\n')
    : ''
  const skyLine = sky.length
    ? [heading('Bu hafta gökyüzünde'), ...sky.map((e) => `**${skyDate(e.date)}${e.time ? ` ${e.time}` : ''}** · ${escapeMail(e.title)}`), `[Nasıl gözlenir →](${base}/gokyuzu)`].join('\n')
    : ''
  return [opening, ...items, lessonLine, skyLine, `<a href="${base}" class="cta-button">Bütün gelişmeleri sitede oku</a>`].filter(Boolean).join('\n\n')
}

const weekAgo = () => new Date(Date.now() - 7 * 24 * 3600_000)
const recentLessons = async () =>
  (await prisma.lesson.findMany({ where: { status: 'published', publishedAt: { gte: weekAgo() } }, orderBy: { publishedAt: 'asc' }, include: { series: { select: { slug: true } } } }))
    .map((l) => ({ title: l.title, path: `/egitim/${l.series.slug}/${l.slug}` }))
const skyEvents = async (settings: Settings, limit: number) => (settings.skyEnabled ? (await upcomingSky(limit))?.events ?? [] : [])
const dateLabel = () => new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })

// Son 7 günde yayımlanan yazılardan taslak bülten (yazı yoksa null): önce öne çıkanlar, sonra önem puanı
export async function createWeeklyDigest(settings: Settings) {
  const posts = await prisma.post.findMany({
    where: { status: 'published', publishedAt: { gte: weekAgo() } },
    orderBy: [{ featuredAt: { sort: 'desc', nulls: 'last' } }, { importance: 'desc' }, { publishedAt: 'desc' }],
    include: { paper: { select: { topic: true } } },
  })
  if (posts.length === 0) return null
  const chosen = posts.slice(0, DIGEST_MAX)
  // Gönderen adı zaten blogun adı (sendDigest); konu satırı en önemli gelişmeyle merak uyandırır
  const subject = `${dateLabel()} haftası: ${chosen[0].title}${posts.length > 1 ? ` ve ${posts.length - 1} gelişme daha` : ''}`
  const body = digestBody(chosen, settings.siteUrl, posts.length, { lessons: await recentLessons(), sky: await skyEvents(settings, 3) })
  return prisma.digest.create({ data: { subject: subject.slice(0, 300), body } })
}

// Haftanın astronomi özeti (derse hazırlık): son 7 günün uzay ve fizik yazıları, yeni dersler ve haftanın gökyüzü.
// Hiçbiri yoksa null
export async function createAstroDigest(settings: Settings) {
  const posts = await prisma.post.findMany({
    where: { status: 'published', category: { in: ['uzay', 'fizik'] }, publishedAt: { gte: weekAgo() } },
    orderBy: [{ importance: 'desc' }, { publishedAt: 'desc' }],
    include: { paper: { select: { topic: true } } },
  })
  const [lessons, sky] = [await recentLessons(), await skyEvents(settings, 10)]
  if (posts.length === 0 && lessons.length === 0 && sky.length === 0) return null
  const chosen = posts.slice(0, 10)
  const intro = posts.length
    ? `Haftanın astronomi ve fizik gündemi: ${posts.length} gelişme${posts.length > chosen.length ? `, en önemli ${chosen.length} tanesi` : ''}. Derse girmeden önce bir göz at:`
    : 'Bu hafta öne çıkan bir astronomi haberi yok; yeni dersler ve gökyüzü aşağıda:'
  const subject = `Haftanın astronomi özeti · ${dateLabel()}${chosen[0] ? `: ${chosen[0].title}` : ''}`
  return prisma.digest.create({ data: { subject: subject.slice(0, 300), body: digestBody(chosen, settings.siteUrl, posts.length, { lessons, sky, intro }) } })
}

export const canSubscribe = (settings: Settings) => !!settings.kunyeUrl.trim() && !!settings.kunyeToken.trim()

// Sitedeki abonelik kutusu: kayıt ve (açıksa) onay e-postası Künye'de. Abone, bülten etiketiyle
// (boşsa "Blog") işaretlenir. Dönen metin ziyaretçiye gösterilir
export async function subscribeToKunye(email: string, name: string, settings: Settings): Promise<{ ok: boolean; message: string }> {
  try {
    const response = await fetch(`${settings.kunyeUrl.trim().replace(/\/+$/, '')}/api/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.kunyeToken.trim()}` },
      body: JSON.stringify({ email, name, tag: settings.newsletterTag || 'Blog' }),
      signal: AbortSignal.timeout(20_000),
    })
    const data = await response.json().catch(() => ({}))
    if (response.ok && typeof data.message === 'string') return { ok: true, message: data.message }
    if (response.status === 400 && typeof data.error === 'string') return { ok: false, message: data.error }
    // Ziyaretçiye ayrıntı gösterilmez; sebep panelin iş günlüğünde görünür
    await logJob(`Abonelik başarısız: Künye yanıtı ${response.status}${data.error ? ` (${String(data.error).slice(0, 120)})` : ''}`)
  } catch (error) {
    const cause = (error as { cause?: { code?: string } })?.cause?.code
    await logJob(`Abonelik başarısız: Künye'ye ulaşılamadı (${cause || String((error as Error).message || error).slice(0, 120)})`)
  }
  return { ok: false, message: 'Şu an abone olunamıyor, biraz sonra tekrar dene.' }
}

// Künye'ye "iki dakika sonra gönder" diye planlar; Künye dakikada bir bakıp abonelere yollar
export async function sendDigest(id: number, settings: Settings): Promise<void> {
  const digest = await prisma.digest.findUniqueOrThrow({ where: { id } })
  if (digest.status === 'sent') throw new Error('Bu bülten zaten gönderildi')
  const kunyeUrl = settings.kunyeUrl.trim().replace(/\/+$/, '')
  if (!kunyeUrl || !settings.kunyeToken.trim()) throw new Error('Ayarlar → Bülten bölümünde adres ve API anahtarı girilmemiş')
  let status = 'sent'
  let result = ''
  try {
    const response = await fetch(`${kunyeUrl}/api/admin/scheduled-newsletters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.kunyeToken.trim()}` },
      // fromName: gelen kutusunda Künye'nin "Destek" adı yerine blogun adı görünür
      body: JSON.stringify({ subject: digest.subject, message: digest.body, sendAt: new Date(Date.now() + 120_000).toISOString(), tag: settings.newsletterTag, fromName: settings.siteTitle }),
      signal: AbortSignal.timeout(30_000),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(response.status === 401 ? 'Künye API anahtarı geçersiz' : data.error || `Künye yanıtı ${response.status}`)
    result = 'Künye\'de planlandı, iki dakika içinde abonelere gider'
  } catch (error) {
    status = 'failed'
    result = String((error as Error).message || error).slice(0, 300)
  }
  await prisma.digest.update({ where: { id }, data: { status, result, sentAt: status === 'sent' ? new Date() : null } })
  if (status === 'failed') throw new Error(result)
}
