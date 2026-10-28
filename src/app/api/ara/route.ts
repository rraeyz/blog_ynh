import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { searchScore, topMatches } from '@/lib/text'

export const dynamic = 'force-dynamic'

// Üstteki arama kutusunun anlık önerileri: /ara sayfasıyla aynı eşleştirme, ilk birkaç sonuç
export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get('q') ?? '').trim().slice(0, 100)
  if (q.length < 2) return NextResponse.json({ results: [] })
  const [posts, lessons] = await Promise.all([
    prisma.post.findMany({ where: { status: 'published' }, select: { title: true, slug: true, excerpt: true, body: true } }),
    prisma.lesson.findMany({ where: { status: 'published' }, select: { title: true, slug: true, excerpt: true, body: true, series: { select: { slug: true, title: true } } } }),
  ])
  const results = [
    ...topMatches(posts, (p) => searchScore(q, p.title, `${p.excerpt}\n${p.body}`), 6).map((p) => ({ kind: 'Yazı', title: p.title, href: `/yazi/${p.slug}`, text: p.excerpt.slice(0, 140) })),
    ...topMatches(lessons, (l) => searchScore(q, l.title, `${l.excerpt}\n${l.series.title}\n${l.body}`), 3).map((l) => ({ kind: 'Ders', title: l.title, href: `/egitim/${l.series.slug}/${l.slug}`, text: l.series.title })),
  ]
  return NextResponse.json({ results }, { headers: { 'Cache-Control': 'no-store' } })
}
