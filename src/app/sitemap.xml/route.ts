import { prisma } from '@/lib/prisma'
import { getSettings } from '@/lib/state'

export const dynamic = 'force-dynamic'

const xml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Arama motorları için: yayımlanmış yazılar, dersler, seriler ve ana sayfalar (panel ve arama dışarıda; robots.txt)
export async function GET(request: Request) {
  const settings = await getSettings()
  const base = (settings.siteUrl || new URL(request.url).origin).replace(/\/+$/, '')
  const [posts, lessons] = await Promise.all([
    prisma.post.findMany({ where: { status: 'published' }, orderBy: { publishedAt: 'desc' }, select: { slug: true, updatedAt: true } }),
    prisma.lesson.findMany({ where: { status: 'published' }, select: { slug: true, updatedAt: true, series: { select: { slug: true } } } }),
  ])
  const series = new Map<string, Date>()
  for (const l of lessons) if ((series.get(l.series.slug)?.getTime() ?? 0) < l.updatedAt.getTime()) series.set(l.series.slug, l.updatedAt)
  const urls: Array<[string, Date | undefined]> = [
    ['/', posts[0]?.updatedAt],
    ['/egitim', undefined],
    ['/gokyuzu', undefined],
    ['/astronomi-ozeti', undefined],
    ...posts.map((p) => [`/yazi/${p.slug}`, p.updatedAt] as [string, Date]),
    ...Array.from(series, ([slug, date]) => [`/egitim/${slug}`, date] as [string, Date]),
    ...lessons.map((l) => [`/egitim/${l.series.slug}/${l.slug}`, l.updatedAt] as [string, Date]),
  ]
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([path, date]) => `<url><loc>${xml(base + path)}</loc>${date ? `<lastmod>${date.toISOString()}</lastmod>` : ''}</url>`).join('\n')}
</urlset>`
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } })
}
