import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isLevel, LEVELS, levelRange } from '@/lib/levels'
import { coverStyle, LevelBadge } from '../../parts'
import { ReadCheck, SeriesProgress } from '../Progress'

const RANK = ['temel', 'orta', 'ileri', 'kapsamli']
const lessonFields = { id: true, slug: true, title: true, scope: true, status: true, level: true, stageId: true } as const

const findSeries = (slug: string) =>
  prisma.series.findUnique({
    where: { slug },
    include: { stages: { where: { approved: true }, select: { id: true, level: true, summary: true, planned: true } }, lessons: { orderBy: { position: 'asc' }, select: lessonFields } },
  })

export async function generateMetadata({ params }: { params: { seri: string } }): Promise<Metadata> {
  const series = await findSeries(params.seri)
  return series ? { title: series.track === 'kavram' ? 'Kavramlar A–Z' : series.title, description: series.summary } : {}
}

type Row = { id: number; slug: string; title: string; scope: string; status: string; level: string }

const LessonRow = ({ seriesSlug, lesson, n }: { seriesSlug: string; lesson: Row; n: number }) => {
  const open = lesson.status === 'published'
  const content = (
    <>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${open ? 'bg-violet-600 text-white' : 'bg-zinc-200 text-zinc-500 dark:bg-white/10'}`}>{n}</span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2"><span className={`font-semibold ${open ? '' : 'text-zinc-500'}`}>{lesson.title}</span><LevelBadge level={lesson.level} />{open && <ReadCheck id={lesson.id} />}</span>
        <span className="block text-sm text-zinc-500 mt-0.5">{open ? lesson.scope : `Yakında · ${lesson.scope}`}</span>
      </span>
    </>
  )
  return (
    <li>
      {open ? (
        <Link href={`/egitim/${seriesSlug}/${lesson.slug}`} className="flex gap-4 rounded-2xl border border-zinc-200 dark:border-ink-line bg-white dark:bg-ink-card p-4 hover:border-violet-500 transition">{content}</Link>
      ) : (
        <div className="flex gap-4 rounded-2xl border border-dashed border-zinc-300 dark:border-ink-line p-4">{content}</div>
      )}
    </li>
  )
}

// Kavramlar A–Z: yayımlanmış kavram dersleri harf sırasıyla
function Concepts({ slug, lessons }: { slug: string; lessons: Row[] }) {
  const published = lessons.filter((l) => l.status === 'published').sort((a, b) => a.title.localeCompare(b.title, 'tr'))
  const letters = new Map<string, Row[]>()
  for (const l of published) {
    const letter = l.title.charAt(0).toLocaleUpperCase('tr')
    letters.set(letter, [...(letters.get(letter) ?? []), l])
  }
  return (
    <>
      <nav aria-label="Harfler" className="mt-8 flex flex-wrap gap-2 text-sm">
        {Array.from(letters.keys(), (letter) => <a key={letter} href={`#harf-${letter}`} className="rounded-lg border border-zinc-200 dark:border-ink-line px-2.5 py-1 hover:border-violet-500">{letter}</a>)}
      </nav>
      {Array.from(letters, ([letter, list]) => (
        <section key={letter} id={`harf-${letter}`} className="mt-8">
          <h2 className="text-2xl font-semibold">{letter}</h2>
          <ul className="mt-3 divide-y divide-zinc-200/70 dark:divide-ink-line">
            {list.map((l) => <li key={l.id} className="flex flex-wrap items-center gap-2 py-2.5"><Link href={`/egitim/${slug}/${l.slug}`} className="font-medium hover:text-violet-600 dark:hover:text-violet-300">{l.title}</Link><ReadCheck id={l.id} /></li>)}
          </ul>
        </section>
      ))}
    </>
  )
}

// Serinin aşamaları ve sıralı dersleri: yayımlananlar açılır, diğerleri "yakında"; bölünmemiş aşamalar yol haritası olarak görünür
export default async function SeriesPage({ params }: { params: { seri: string } }) {
  const series = await findSeries(params.seri)
  if (!series || !series.lessons.some((l) => l.status === 'published')) notFound()
  const kavram = series.track === 'kavram'
  const stages = [...series.stages].sort((a, b) => RANK.indexOf(a.level) - RANK.indexOf(b.level))
  const loose = series.lessons.filter((l) => !stages.some((s) => s.id === l.stageId))
  let n = 0
  return (
    <div className="mx-auto max-w-3xl px-4 pb-10">
      <p className="mt-8 text-sm"><Link href="/egitim" className="text-violet-600 dark:text-violet-300 hover:underline">← Eğitim</Link></p>
      <header className="mt-4 overflow-hidden rounded-3xl p-7 md:p-10 text-white" style={coverStyle(series.slug, series.slug)}>
        <p className="text-sm text-white/75">{kavram ? 'Tek derslik kavramlar' : 'Ders serisi'}</p>
        <h1 className="mt-1 text-3xl md:text-4xl font-semibold">{kavram ? 'Kavramlar A–Z' : series.title}</h1>
        <p className="mt-3 text-white/85">{series.summary}</p>
        {!kavram && levelRange(series.lessons.map((l) => l.level)) && <p className="mt-4 text-sm text-white/75">{series.lessons.length} ders · {levelRange(series.lessons.map((l) => l.level))}</p>}
      </header>
      <SeriesProgress ids={series.lessons.filter((l) => l.status === 'published').map((l) => l.id)} />
      {kavram ? (
        <Concepts slug={series.slug} lessons={series.lessons} />
      ) : (
        <>
          {stages.map((stage) => {
            const lessons = series.lessons.filter((l) => l.stageId === stage.id)
            return (
              <section key={stage.id} className="mt-10">
                <h2 className="text-xl font-semibold">{isLevel(stage.level) ? LEVELS[stage.level].label : stage.level}</h2>
                {isLevel(stage.level) && <p className="mt-1 text-sm text-zinc-500">{LEVELS[stage.level].hint}</p>}
                {lessons.length > 0 ? (
                  <ol className="mt-4 space-y-3">{lessons.map((l) => <LessonRow key={l.id} seriesSlug={series.slug} lesson={l} n={++n} />)}</ol>
                ) : (
                  <p className="mt-3 rounded-2xl border border-dashed border-zinc-300 dark:border-ink-line p-4 text-sm text-zinc-500">{stage.planned ? 'Bu aşama atlandı.' : `Sırası gelince derslere bölünecek: ${stage.summary}`}</p>
                )}
              </section>
            )
          })}
          {loose.length > 0 && <ol className="mt-8 space-y-3">{loose.map((l) => <LessonRow key={l.id} seriesSlug={series.slug} lesson={l} n={++n} />)}</ol>}
        </>
      )}
    </div>
  )
}
