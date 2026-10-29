import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { topicHue } from '@/lib/topics'
import { isLevel, levelRange, LEVELS } from '@/lib/levels'
import { TRACK_HINTS, TRACKS, type Track } from '@/lib/curriculum'
import { LevelBadge } from '../parts'
import { SuggestForm } from './SuggestForm'

export const metadata: Metadata = {
  title: 'Eğitim',
  description: 'Astronomi ve astrofizikte uygulama, kuram ve kavramları temelden uzman seviyesine anlatan dersler.',
}

type LessonRow = { id: number; slug: string; title: string; excerpt: string; level: string; series: { slug: string; title: string } }

const LessonList = ({ lessons, showSeries = true }: { lessons: LessonRow[]; showSeries?: boolean }) => (
  <ul className="divide-y divide-zinc-200/70 dark:divide-ink-line">
    {lessons.map((l) => (
      <li key={l.id} className="py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/egitim/${l.series.slug}/${l.slug}`} className="font-semibold hover:text-violet-600 dark:hover:text-violet-300">{l.title}</Link>
          <LevelBadge level={l.level} />
        </div>
        <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{[showSeries && l.series.title, l.excerpt].filter(Boolean).join(' · ')}</p>
      </li>
    ))}
  </ul>
)

// Seriler hatlarına göre gruplu (uygulama, astronomi, temel bilim), kavramlar A–Z sayfasında, istekler ayrı listede;
// seviyeye göre süzülebilir (?seviye=temel)
export default async function EducationPage({ searchParams }: { searchParams: { seviye?: string } }) {
  const level = isLevel(searchParams.seviye) ? searchParams.seviye : null
  const lessonFields = { id: true, slug: true, title: true, excerpt: true, level: true, series: { select: { slug: true, title: true } } } as const
  const [series, latest, filtered] = await Promise.all([
    prisma.series.findMany({
      where: { lessons: { some: { status: 'published' } } },
      orderBy: { position: 'asc' },
      include: { lessons: { orderBy: { position: 'asc' }, select: { status: true, level: true, id: true, slug: true, title: true, excerpt: true } } },
    }),
    prisma.lesson.findMany({ where: { status: 'published' }, orderBy: { publishedAt: 'desc' }, take: 6, select: lessonFields }),
    level
      ? prisma.lesson.findMany({ where: { status: 'published', level }, orderBy: [{ series: { position: 'asc' } }, { position: 'asc' }], select: lessonFields })
      : Promise.resolve([]),
  ])
  // İstenen dersler seri kartı yerine listede
  const singles = series.filter((s) => s.position < 0).flatMap((s) => s.lessons.filter((l) => l.status === 'published').map((l) => ({ ...l, series: { slug: s.slug, title: s.title } })))
  const concepts = series.find((s) => s.track === 'kavram')
  const conceptLessons = concepts ? concepts.lessons.filter((l) => l.status === 'published') : []
  const tracks = (['uygulama', 'astronomi', 'temel'] as Track[]).map((track) => [track, series.filter((s) => s.track === track)] as const).filter(([, list]) => list.length > 0)

  return (
    <div className="mx-auto max-w-5xl px-4">
      <header className="py-10 md:py-14 max-w-3xl">
        <p className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-700 dark:text-violet-300">Ders serileri</p>
        <h1 className="mt-5 text-4xl md:text-5xl font-semibold leading-[1.08]">Eğitim</h1>
        <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
          Astronomide elle yapılan işi (yazılım, gözlem, veri indirgeme, fotometri, tayf), astronominin konularını, dayandığı fizik ve
          matematiği ve bir astronomun bilmesi gereken kavramları öğreten dersler. Her seri temelden başlar ve aşama aşama uzman seviyesine
          götürür; her derste neyi bilmen, neyi hesaplayabilmen gerektiği ve neyi ezberlemene gerek olmadığı ayrı kutularda. Her ders
          kaynaklara dayanır; kaynaklar dersin sonunda.
        </p>
      </header>

      <nav aria-label="Seviyeler" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Object.entries(LEVELS).map(([key, l]) => (
          <Link
            key={key}
            href={key === level ? '/egitim' : `/egitim?seviye=${key}`}
            aria-current={key === level ? 'page' : undefined}
            className={`rounded-2xl border p-4 transition ${key === level ? 'border-violet-500 bg-violet-500/10' : 'border-zinc-200 dark:border-ink-line hover:border-violet-500'}`}
          >
            <LevelBadge level={key} />
            <span className="mt-2 block text-sm text-zinc-600 dark:text-zinc-400">{l.hint}</span>
          </Link>
        ))}
      </nav>

      {level ? (
        <section className="mt-10">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-2xl font-semibold">{`${LEVELS[level].label} dersler`}</h2>
            <Link href="/egitim" className="text-sm text-violet-600 dark:text-violet-300 hover:underline">Bütün seriler →</Link>
          </div>
          {filtered.length === 0 ? <p className="mt-4 text-zinc-500">Bu seviyede henüz yayımlanmış ders yok.</p> : <LessonList lessons={filtered} />}
        </section>
      ) : series.length === 0 ? (
        <p className="mt-10 rounded-3xl border border-dashed border-zinc-300 dark:border-ink-line p-10 text-center text-zinc-500">İlk dersler hazırlanıyor.</p>
      ) : (
        <>
          {tracks.map(([track, list]) => (
            <section key={track} className="mt-12">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-300">{TRACKS[track]}</h2>
              <p className="mt-1 text-sm text-zinc-500">{TRACK_HINTS[track]}</p>
              <div className="mt-4 grid gap-5 md:grid-cols-2">
                {list.map((s) => {
                  const published = s.lessons.filter((l) => l.status === 'published').length
                  const hue = topicHue(s.slug)
                  const range = levelRange(s.lessons.map((l) => l.level))
                  return (
                    <Link key={s.id} href={`/egitim/${s.slug}`} className="group rounded-3xl border border-zinc-200 dark:border-ink-line bg-white dark:bg-ink-card p-6 hover:shadow-lg hover:shadow-violet-500/10 transition">
                      <span className="block h-1.5 w-14 rounded-full" style={{ background: `hsl(${hue} 80% 60%)` }} />
                      <h3 className="mt-4 text-xl font-semibold group-hover:text-violet-600 dark:group-hover:text-violet-300 transition">{s.title}</h3>
                      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 line-clamp-3">{s.summary}</p>
                      <p className="mt-4 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                        {range && <span className="rounded-full bg-zinc-100 dark:bg-white/10 px-2.5 py-0.5 font-medium text-zinc-700 dark:text-zinc-300">{range}</span>}
                        {published} / {s.lessons.length} ders yayında
                      </p>
                      <span className="mt-2 block h-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-white/10">
                        <span className="block h-full rounded-full" style={{ width: `${Math.round((published / Math.max(1, s.lessons.length)) * 100)}%`, background: `hsl(${hue} 80% 60%)` }} />
                      </span>
                    </Link>
                  )
                })}
              </div>
            </section>
          ))}

          {concepts && conceptLessons.length > 0 && (
            <section className="mt-12">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-300">{TRACKS.kavram}</h2>
                <Link href={`/egitim/${concepts.slug}`} className="text-sm text-violet-600 dark:text-violet-300 hover:underline">Kavramlar A–Z ({conceptLessons.length}) →</Link>
              </div>
              <p className="mt-1 text-sm text-zinc-500">{TRACK_HINTS.kavram}</p>
              <LessonList lessons={conceptLessons.slice(-6).reverse().map((l) => ({ ...l, series: { slug: concepts.slug, title: concepts.title } }))} showSeries={false} />
            </section>
          )}

          {singles.length > 0 && (
            <section className="mt-12">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-300">İstenen dersler</h2>
              <LessonList lessons={singles} showSeries={false} />
            </section>
          )}

          {latest.length > 0 && (
            <section className="mt-12">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-300">Son dersler</h2>
              <LessonList lessons={latest} />
            </section>
          )}
        </>
      )}

      <section id="oner" className="mt-14 mb-6 max-w-2xl scroll-mt-24 rounded-3xl border border-zinc-200 dark:border-ink-line bg-white dark:bg-ink-card p-6 md:p-8">
        <h2 className="text-xl font-semibold">Ders öner</h2>
        <p className="mt-1 mb-4 text-sm text-zinc-500">Öğrenmek istediğin bir konu mu var? Yaz; değerlendirip müfredata uygunsa ekleyelim.</p>
        <SuggestForm />
      </section>
    </div>
  )
}
