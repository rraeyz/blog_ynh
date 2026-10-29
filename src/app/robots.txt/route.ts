import { getSettings } from '@/lib/state'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const settings = await getSettings()
  const base = (settings.siteUrl || new URL(request.url).origin).replace(/\/+$/, '')
  return new Response(`User-agent: *\nDisallow: /admin\nDisallow: /api/\nDisallow: /ara\n\nSitemap: ${base}/sitemap.xml\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
