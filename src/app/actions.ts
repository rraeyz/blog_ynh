'use server'

import { clientIp } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getSettings } from '@/lib/state'
import { canSubscribe, subscribeToKunye } from '@/lib/newsletter'

export type SubscribeState = { ok: boolean; message: string } | null

// Ziyaretçi başına, form başına sınır (Künye'ye istekler hep bu sunucunun IP'sinden gider, ziyaretçiyi burada sınırlarız)
const attempts = new Map<string, number[]>()
function limited(ip: string): boolean {
  // Bellek sınırsız büyümesin (çok sayıda farklı IP'den gelen bot)
  if (attempts.size > 10_000) attempts.clear()
  const recent = (attempts.get(ip) ?? []).filter((time) => Date.now() - time < 60 * 60_000)
  attempts.set(ip, [...recent, Date.now()])
  return recent.length >= 5
}

export async function subscribeAction(_previous: SubscribeState, form: FormData): Promise<SubscribeState> {
  // Botlar görünmeyen alanı da doldurur: başarılı gibi yanıt ver, hiçbir şey yapma
  if (String(form.get('website') ?? '')) return { ok: true, message: 'Teşekkürler!' }
  const email = String(form.get('email') ?? '').trim().slice(0, 254)
  const name = String(form.get('name') ?? '').trim().slice(0, 100)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: 'Geçerli bir e-posta adresi gir.' }
  if (limited(`abone:${clientIp()}`)) return { ok: false, message: 'Çok fazla deneme; biraz sonra tekrar dene.' }
  const settings = await getSettings()
  if (!canSubscribe(settings)) return { ok: false, message: 'Bülten şu an kapalı.' }
  return subscribeToKunye(email, name, settings)
}

// Okur ders önerisi: yalnızca kaydedilir (yapay zekâ çalışmaz); panelde değerlendirilir
const MAX_PENDING = 500 // bot seli veritabanını doldurmasın
export async function suggestAction(_previous: SubscribeState, form: FormData): Promise<SubscribeState> {
  if (String(form.get('website') ?? '')) return { ok: true, message: 'Teşekkürler!' }
  const title = String(form.get('title') ?? '').trim().slice(0, 200)
  const detail = String(form.get('detail') ?? '').trim().slice(0, 1000)
  if (title.length < 3) return { ok: false, message: 'Hangi konuyu öğrenmek istediğini yaz.' }
  if (limited(`oneri:${clientIp()}`)) return { ok: false, message: 'Çok fazla deneme; biraz sonra tekrar dene.' }
  if ((await prisma.suggestion.count()) >= MAX_PENDING) return { ok: false, message: 'Şu an öneri alınamıyor; daha sonra tekrar dene.' }
  await prisma.suggestion.create({ data: { title, detail } })
  return { ok: true, message: 'Önerin alındı, teşekkürler! Değerlendirip müfredata uygunsa ekleyeceğiz.' }
}

// Okurun derste bildirdiği hata: yalnızca kaydedilir; panelde dersin yanında görünür
const MAX_REPORTS = 1000
export async function reportAction(_previous: SubscribeState, form: FormData): Promise<SubscribeState> {
  if (String(form.get('website') ?? '')) return { ok: true, message: 'Teşekkürler!' }
  const note = String(form.get('note') ?? '').trim().slice(0, 1000)
  const lessonId = Number(form.get('lessonId')) || 0
  if (note.length < 5) return { ok: false, message: 'Neyin yanlış ya da anlaşılmaz olduğunu kısaca yaz.' }
  if (limited(`bildirim:${clientIp()}`)) return { ok: false, message: 'Çok fazla deneme; biraz sonra tekrar dene.' }
  if (!(await prisma.lesson.count({ where: { id: lessonId, status: 'published' } }))) return { ok: false, message: 'Ders bulunamadı.' }
  if ((await prisma.lessonReport.count()) >= MAX_REPORTS) return { ok: false, message: 'Şu an bildirim alınamıyor; daha sonra tekrar dene.' }
  await prisma.lessonReport.create({ data: { lessonId, note } })
  return { ok: true, message: 'Bildirimin alındı, teşekkürler! Ders gözden geçirilecek.' }
}
