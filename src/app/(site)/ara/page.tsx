import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { searchScore } from '@/lib/text'
import { LevelBadge, PAPER_FIELDS, RowPost } from '../parts'

export const metadata: Metadata = { title: 'Ara', robots: { index: false } }

// shortcut: yayımlanan her şey bellekte taranır (Türkçe harf duyarsız); binlerce yazıda yavaşlarsa SQLite FTS5'e geç
export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = String(searchParams.q ?? '').trim().slice(0, 100)
  const [posts, lessons] = q
    ? await Promise.all([
        prisma.post.findMany({ where: { status: 'published' }, include: { paper: PAPER_FIELDS } }),
        prisma.lesson.findMany({ where: { status: 'published' }, include: { series: { select: { slug: true, title: true } } } }),
      ])
    : [[], []]
  const rank = <T,>(items: T[], score: (item: T) => number, take: number) =>
    items.map((item) => ({ item, score: score(item) })).filter((r) => r.score > 0).sort((a, b) => b.score - a.score).slice(0, take).map((r) => r.item)
  const foundPosts = rank(posts, (p) => searchScore(q, p.title, `${p.excerpt}\n${p.body}`), 40)
  const foundLessons = rank(lessons, (l) => searchScore(q, l.title, `${l.excerpt}\n${l.series.title}\n${l.body}`), 20)
  return (
    <div className="mx-auto max-w-3xl px-4">
      <form action="/ara" className="py-10 flex gap-2" role="search">
        <input name="q" type="search" defaultValue={q} placeholder="Yazılarda ve derslerde ara" aria-label="Arama" className="input flex-1" autoFocus />
        <button className="btn-primary">Ara</button>
      </form>
      {q && foundPosts.length === 0 && foundLessons.length === 0 && <p className="text-zinc-500">{`"${q}" için sonuç yok.`}</p>}
      {foundLessons.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-300 mb-3">Dersler</h2>
          <ul className="space-y-3">
            {foundLessons.map((l) => (
              <li key={l.id}>
                <Link href={`/egitim/${l.series.slug}/${l.slug}`} className="group block">
                  <span className="font-semibold group-hover:text-violet-600 dark:group-hover:text-violet-300">{l.title}</span> <LevelBadge level={l.level} />
                  <span className="block text-sm text-zinc-500">{l.series.title}{l.excerpt && ` — ${l.excerpt}`}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {foundPosts.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-300 mb-3">Yazılar</h2>
          <div className="space-y-1">{foundPosts.map((p) => <RowPost key={p.id} post={p} />)}</div>
        </section>
      )}
    </div>
  )
}
