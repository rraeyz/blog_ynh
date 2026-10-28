import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { inOrder, searchIds } from '@/lib/search'

export const dynamic = 'force-dynamic'

// Üstteki arama kutusunun anlık önerileri: /ara sayfasıyla aynı dizin, ilk birkaç sonuç
export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get('q') ?? '').trim().slice(0, 100)
  if (q.length < 2) return NextResponse.json({ results: [] })
  const ids = await searchIds(q, 6, 3)
  const [posts, lessons] = await Promise.all([
    prisma.post.findMany({ where: { id: { in: ids.posts } }, select: { id: true, title: true, slug: true, excerpt: true } }),
    prisma.lesson.findMany({ where: { id: { in: ids.lessons } }, select: { id: true, title: true, slug: true, series: { select: { slug: true, title: true } } } }),
  ])
  const results = [
    ...inOrder(ids.posts, posts).map((p) => ({ kind: 'Yazı', title: p.title, href: `/yazi/${p.slug}`, text: p.excerpt.slice(0, 140) })),
    ...inOrder(ids.lessons, lessons).map((l) => ({ kind: 'Ders', title: l.title, href: `/egitim/${l.series.slug}/${l.slug}`, text: l.series.title })),
  ]
  return NextResponse.json({ results }, { headers: { 'Cache-Control': 'no-store' } })
}
