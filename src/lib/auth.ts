import crypto from 'crypto'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSettings, getState, setState } from '@/lib/state'

// Tek yönetici, şifreyle giriş. Oturum çerezi: "bitiş.şifreSürümü.imza" (HMAC-SHA256).
// Şifre değişince şifre sürümü değişir ve eski oturumlar geçersiz olur.
const COOKIE = 'blog-session'
const MAX_AGE = 7 * 24 * 3600

async function secret(): Promise<string> {
  const existing = await getState('sessionSecret')
  if (existing) return existing
  const created = crypto.randomBytes(32).toString('hex')
  await setState('sessionSecret', created)
  return created
}

const passwordVersion = (hash: string) => crypto.createHash('sha256').update(hash).digest('hex').slice(0, 16)
const sign = (payload: string, key: string) => crypto.createHmac('sha256', key).update(payload).digest('hex')

export async function isAdmin(): Promise<boolean> {
  const value = cookies().get(COOKIE)?.value
  if (!value) return false
  const [expires, version, signature] = value.split('.')
  if (!expires || !version || !signature || Number(expires) < Date.now()) return false
  const settings = await getSettings()
  if (!settings.passwordHash || version !== passwordVersion(settings.passwordHash)) return false
  const expected = sign(`${expires}.${version}`, await secret())
  return expected.length === signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect('/admin/giris')
}

export async function startSession(passwordHash: string): Promise<void> {
  const payload = `${Date.now() + MAX_AGE * 1000}.${passwordVersion(passwordHash)}`
  // nginx arkasında HTTPS → Secure; doğrudan http://sunucu:3000 erişiminde çerez yine kaydedilebilsin
  const isHttps = headers().get('x-forwarded-proto')?.split(',')[0].trim() === 'https'
  cookies().set(COOKIE, `${payload}.${sign(payload, await secret())}`, { httpOnly: true, secure: isHttps, sameSite: 'lax', path: '/', maxAge: MAX_AGE })
}

export function endSession(): void {
  cookies().delete(COOKIE)
}

// Basit giriş sınırı: IP başına 15 dakikada 10 hatalı deneme
const failures = new Map<string, number[]>()
export function clientIp(): string {
  return headers().get('x-real-ip') || headers().get('x-forwarded-for')?.split(',')[0].trim() || 'yerel'
}
export function tooManyFailures(ip: string): boolean {
  const recent = (failures.get(ip) ?? []).filter((time) => Date.now() - time < 15 * 60_000)
  failures.set(ip, recent)
  return recent.length >= 10
}
export function recordFailure(ip: string): void {
  failures.set(ip, [...(failures.get(ip) ?? []), Date.now()])
}
