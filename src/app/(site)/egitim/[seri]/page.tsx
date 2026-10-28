import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { levelRange } from '@/lib/levels'
import { coverStyle, LevelBadge } from '../../parts'

const findSeries = (slug: string) =>
  prisma.series.findUnique({ where: { slug }, include: { lessons: { orderBy: { position: 'asc' }, select: { id: true, slug: true, title: true, scope: true, status: true, level: true } } } })

export async function generateMetadata({ params }: { params: { seri: string } }): Promise<Metadata> {
  const series = await findSeries(params.seri)
  return series ? { title: series.title, description: series.summary } : {}
}

// Serinin sıralı ders listesi: yayımlananlar açılır, diğerleri "yakında" görünür (yol haritası)
export default async function SeriesPage({ params }: { params: { seri: string } }) {
  const series = await findSeries(params.seri)
  if (!series || !series.lessons.some((l) => l.status === 'published')) notFound()
  return (
    <div className="mx-auto max-w-3xl px-4">
      <p className="mt-8 text-sm"><Link href="/egitim" className="text-violet-600 dark:text-violet-300 hover:underline">← Eğitim</Link></p>
      <header className="mt-4 overflow-hidden rounded-3xl p-7 md:p-10 text-white" style={coverStyle(series.slug, series.slug)}>
        <p className="text-sm text-white/75">Ders serisi</p>
        <h1 className="mt-1 text-3xl md:text-4xl font-semibold">{series.title}</h1>
        <p className="mt-3 text-white/85">{series.summary}</p>
        {levelRange(series.lessons.map((l) => l.level)) && <p className="mt-4 text-sm text-white/75">{series.lessons.length} ders · {levelRange(series.lessons.map((l) => l.level))}</p>}
      </header>
      <ol className="mt-8 space-y-3">
        {series.lessons.map((lesson, i) => {
          const open = lesson.status === 'published'
          const content = (
            <>
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${open ? 'bg-violet-600 text-white' : 'bg-zinc-200 text-zinc-500 dark:bg-white/10'}`}>{i + 1}</span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2"><span className={`font-semibold ${open ? '' : 'text-zinc-500'}`}>{lesson.title}</span><LevelBadge level={lesson.level} /></span>
                <span className="block text-sm text-zinc-500 mt-0.5">{open ? lesson.scope : `Yakında · ${lesson.scope}`}</span>
              </span>
            </>
          )
          return (
            <li key={lesson.id}>
              {open ? (
                <Link href={`/egitim/${series.slug}/${lesson.slug}`} className="flex gap-4 rounded-2xl border border-zinc-200 dark:border-ink-line bg-white dark:bg-ink-card p-4 hover:border-violet-500 transition">{content}</Link>
              ) : (
                <div className="flex gap-4 rounded-2xl border border-dashed border-zinc-300 dark:border-ink-line p-4">{content}</div>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
