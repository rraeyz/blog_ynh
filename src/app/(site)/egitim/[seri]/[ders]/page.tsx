import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/auth'
import { headings, renderMarkdown } from '@/lib/markdown'
import { readingMinutes, topicHue } from '@/lib/topics'
import { coverStyle } from '../../../parts'
import { ReadingProgress } from '../../../yazi/[slug]/ReadingProgress'

// Yayımlanmamış ders yalnızca giriş yapmış yöneticiye görünür (önizleme)
async function findLesson(seri: string, ders: string) {
  const lesson = await prisma.lesson.findUnique({
    where: { slug: ders },
    include: { series: { include: { lessons: { where: { status: 'published' }, orderBy: { position: 'asc' }, select: { id: true, slug: true, title: true, position: true } } } } },
  })
  if (!lesson || lesson.series.slug !== seri || (lesson.status !== 'published' && !(await isAdmin()))) return null
  return lesson
}

export async function generateMetadata({ params }: { params: { seri: string; ders: string } }): Promise<Metadata> {
  const lesson = await findLesson(params.seri, params.ders)
  return lesson ? { title: lesson.title, description: lesson.excerpt, openGraph: { type: 'article', title: lesson.title, description: lesson.excerpt } } : {}
}

export default async function LessonPage({ params }: { params: { seri: string; ders: string } }) {
  const lesson = await findLesson(params.seri, params.ders)
  if (!lesson) notFound()
  const published = lesson.series.lessons
  const index = published.findIndex((l) => l.id === lesson.id)
  const previous = index > 0 ? published[index - 1] : published.filter((l) => l.position < lesson.position).pop()
  const next = index >= 0 ? published[index + 1] : published.find((l) => l.position > lesson.position)
  const toc = headings(lesson.body)
  const sources = lesson.sources.split('\n').filter(Boolean).map((line) => {
    const [title, url] = line.split('\t')
    return { title: title || url, url }
  }).filter((s) => /^https?:\/\//.test(s.url ?? ''))
  const accent = { ['--h' as string]: topicHue(lesson.series.slug) } as React.CSSProperties

  return (
    <article className="mx-auto max-w-5xl px-4" style={accent}>
      <ReadingProgress />
      {lesson.status !== 'published' && <p className="mt-6 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300 px-4 py-2 text-sm">Taslak önizlemesi: henüz yayımlanmadı.</p>}
      <p className="mt-8 text-sm">
        <Link href="/egitim" className="text-violet-600 dark:text-violet-300 hover:underline">Eğitim</Link>
        <span className="text-zinc-400"> / </span>
        <Link href={`/egitim/${lesson.series.slug}`} className="text-violet-600 dark:text-violet-300 hover:underline">{lesson.series.title}</Link>
      </p>
      <header className="mt-4 overflow-hidden rounded-3xl p-7 md:p-12 text-white" style={coverStyle(lesson.series.slug, lesson.slug)}>
        <p className="text-sm text-white/75">{lesson.series.title} · Ders {lesson.position}</p>
        <h1 className="mt-2 text-3xl md:text-5xl font-semibold leading-tight drop-shadow-sm">{lesson.title}</h1>
        <p className="mt-4 text-sm text-white/80">{readingMinutes(lesson.body)} dk okuma</p>
      </header>

      <div className="mx-auto mt-10 max-w-4xl lg:grid lg:grid-cols-[minmax(0,1fr)_13rem] lg:gap-14">
        <div className="max-w-2xl min-w-0">
          {lesson.excerpt && <p className="border-l-4 border-violet-500 pl-5 text-lg text-zinc-600 dark:text-zinc-400">{lesson.excerpt}</p>}
          <div className="prose-body lesson-body mt-8" dangerouslySetInnerHTML={{ __html: renderMarkdown(lesson.body, { math: true }) }} />

          {sources.length > 0 && (
            <aside className="mt-12 card">
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-300">Bu dersin kaynakları</p>
              <ol className="mt-3 space-y-1.5 text-sm list-decimal pl-5">
                {sources.map((s) => <li key={s.url}><a href={s.url} className="hover:text-violet-500 break-words" rel="noopener noreferrer" target="_blank">{s.title} ↗</a></li>)}
              </ol>
              <p className="text-xs text-zinc-500 mt-3">Bu ders yapay zekâ yardımıyla bu kaynaklardan derlendi ve yayımlanmadan önce incelendi. Önemli bir işte kullanmadan önce kaynaklara bakın.</p>
            </aside>
          )}

          <nav className="mt-10 grid gap-3 sm:grid-cols-2 text-sm">
            {previous ? <Link href={`/egitim/${lesson.series.slug}/${previous.slug}`} className="card hover:border-violet-500">← Önceki ders<span className="block font-semibold mt-1">{previous.title}</span></Link> : <span />}
            {next && <Link href={`/egitim/${lesson.series.slug}/${next.slug}`} className="card hover:border-violet-500 sm:text-right">Sonraki ders →<span className="block font-semibold mt-1">{next.title}</span></Link>}
          </nav>
        </div>
        {toc.length > 1 && (
          <nav aria-label="Bu derste" className="hidden lg:block">
            <div className="sticky top-24 border-l border-zinc-200 dark:border-ink-line pl-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Bu derste</p>
              <ol className="mt-3 space-y-2 text-sm">
                {toc.map((item) => <li key={item.id}><a href={`#${item.id}`} className="text-zinc-600 dark:text-zinc-400 hover:text-violet-600 dark:hover:text-violet-300">{item.text}</a></li>)}
              </ol>
            </div>
          </nav>
        )}
      </div>
    </article>
  )
}
