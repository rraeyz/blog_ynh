'use server'

import { clientIp } from '@/lib/auth'
import { getSettings } from '@/lib/state'
import { canSubscribe, subscribeToKunye } from '@/lib/newsletter'

export type SubscribeState = { ok: boolean; message: string } | null

// Ziyaretçi başına sınır (Künye'ye istekler hep bu sunucunun IP'sinden gider, ziyaretçiyi burada sınırlarız)
const attempts = new Map<string, number[]>()
function limited(ip: string): boolean {
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
  if (limited(clientIp())) return { ok: false, message: 'Çok fazla deneme; biraz sonra tekrar dene.' }
  const settings = await getSettings()
  if (!canSubscribe(settings)) return { ok: false, message: 'Bülten şu an kapalı.' }
  return subscribeToKunye(email, name, settings)
}
