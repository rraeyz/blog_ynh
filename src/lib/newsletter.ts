import { prisma } from '@/lib/prisma'
import type { Settings } from '@/lib/state'

// Bülten metni Künye'nin e-posta biçiminde: **kalın**, [link](url), satır sonları
export function digestBody(posts: Array<{ title: string; excerpt: string; slug: string }>, siteUrl: string): string {
  const base = siteUrl.replace(/\/+$/, '')
  // Kısa gelişme + detay linki: okur hepsine göz gezdirir, merak ettiğine tıklar
  const items = posts.map((post) => `**${post.title}**\n${post.excerpt}\n[Detaylar →](${base}/yazi/${post.slug})`)
  const intro = posts.length === 1 ? 'Önemli bir gelişme var:' : `Bu haftanın ${posts.length} gelişmesi; merak ettiğinin detayı bir tık uzakta:`
  return [intro, ...items, `Tüm gelişmeler: ${base}`].join('\n\n')
}

// Son 7 günde yayımlanan yazılardan taslak bülten (yazı yoksa null)
export async function createWeeklyDigest(settings: Settings) {
  const posts = await prisma.post.findMany({
    where: { status: 'published', publishedAt: { gte: new Date(Date.now() - 7 * 24 * 3600_000) } },
    orderBy: { publishedAt: 'desc' },
  })
  if (posts.length === 0) return null
  const date = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })
  return prisma.digest.create({ data: { subject: `${settings.siteTitle} · ${date} haftası`, body: digestBody(posts, settings.siteUrl) } })
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
    console.error('Künye abonelik hatası:', response.status, data.error)
  } catch (error) {
    console.error('Künye abonelik hatası:', error)
  }
  return { ok: false, message: 'Şu an abone olunamıyor, biraz sonra tekrar dene.' }
}

// Künye'ye "iki dakika sonra gönder" diye planlar; Künye dakikada bir bakıp abonelere yollar
export async function sendDigest(id: number, settings: Settings): Promise<void> {
  const digest = await prisma.digest.findUniqueOrThrow({ where: { id } })
  if (digest.status === 'sent') throw new Error('Bu bülten zaten gönderildi')
  const kunyeUrl = settings.kunyeUrl.trim().replace(/\/+$/, '')
  if (!kunyeUrl || !settings.kunyeToken.trim()) throw new Error('Ayarlar → Künye bölümünde adres ve API anahtarı girilmemiş')
  let status = 'sent'
  let result = ''
  try {
    const response = await fetch(`${kunyeUrl}/api/admin/scheduled-newsletters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.kunyeToken.trim()}` },
      body: JSON.stringify({ subject: digest.subject, message: digest.body, sendAt: new Date(Date.now() + 120_000).toISOString(), tag: settings.newsletterTag }),
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
