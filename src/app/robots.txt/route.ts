import { getSettings } from '@/lib/state'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const settings = await getSettings()
  const base = (settings.siteUrl || new URL(request.url).origin).replace(/\/+$/, '')
  // Yalnızca site haritasını gösterir; panel ve arama sayfası kendi "noindex" etiketleriyle dizin dışında
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
