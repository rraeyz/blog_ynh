import { prisma } from '@/lib/prisma'
import { getSettings } from '@/lib/state'

export const dynamic = 'force-dynamic'

const xml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export async function GET(request: Request) {
  const settings = await getSettings()
  const base = (settings.siteUrl || new URL(request.url).origin).replace(/\/+$/, '')
  const posts = await prisma.post.findMany({ where: { status: 'published' }, orderBy: { publishedAt: 'desc' }, take: 30 })
  const items = posts.map((post) => `<item>
<title>${xml(post.title)}</title>
<link>${xml(`${base}/yazi/${post.slug}`)}</link>
<guid>${xml(`${base}/yazi/${post.slug}`)}</guid>
<pubDate>${(post.publishedAt ?? post.createdAt).toUTCString()}</pubDate>
<description>${xml(post.excerpt)}</description>
</item>`).join('\n')
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>${xml(settings.siteTitle)}</title>
<link>${xml(base)}</link>
<description>${xml(settings.siteDescription)}</description>
<language>tr</language>
${items}
</channel></rss>`
  return new Response(body, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } })
}
