import { lookup } from 'node:dns/promises'
import { isIP, isIPv4 } from 'node:net'

// Dışarıdan gelen linkler (besleme öğesi, yapay zekâ çıktısı) sunucunun kendi ağına gidemesin (SSRF): container
// sunucu ağında çalışıyor, 127.0.0.1'de Künye ve YunoHost var. Testlerin sahte sunucusu için BLOG_ALLOW_PRIVATE_URLS=1
export function isPrivateIp(ip: string): boolean {
  if (isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number)
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)
  }
  const v = ip.toLowerCase()
  if (v.startsWith('::ffff:')) return isPrivateIp(v.slice(7))
  return v === '::' || v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80')
}

async function assertPublic(url: URL) {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Yalnızca http(s) adresleri okunur')
  if (process.env.BLOG_ALLOW_PRIVATE_URLS === '1') return
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address)
  if (addresses.length === 0 || addresses.some(isPrivateIp)) throw new Error(`${url.hostname} iç ağ adresine çıkıyor, okunmadı`)
}

// fetch gibi; ama her yönlendirmede hedefi yeniden denetler (en fazla 5 yönlendirme)
export async function safeFetch(input: string, init: RequestInit = {}): Promise<Response> {
  let url = new URL(input)
  for (let hop = 0; hop < 6; hop++) {
    await assertPublic(url)
    const response = await fetch(url, { ...init, redirect: 'manual' })
    const next = response.headers.get('location')
    if (response.status < 300 || response.status >= 400 || !next) return response
    await response.body?.cancel()
    url = new URL(next, url)
  }
  throw new Error('Çok fazla yönlendirme')
}
