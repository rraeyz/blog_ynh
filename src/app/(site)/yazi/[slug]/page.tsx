import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/auth'
import { getSettings } from '@/lib/state'
import { headings, inline, renderMarkdown } from '@/lib/markdown'
import { coverOf, readingMinutes, topicHue } from '@/lib/topics'
import { CardPost, CoverImage, coverStyle, JsonLd, PAPER_FIELDS, postDate, SubscribeBox, TopicChip, topicOf } from '../../parts'
import { ReadingProgress } from './ReadingProgress'

// Taslak yazıyı yalnızca giriş yapmış yönetici görebilir (önizleme)
async function findPost(slug: string) {
  const post = await prisma.post.findUnique({ where: { slug }, include: { paper: true } })
  if (!post || (post.status !== 'published' && !(await isAdmin()))) return null
  return post
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await findPost(params.slug)
  if (!post) return {}
  const image = coverOf(post)
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: { type: 'article', title: post.title, description: post.excerpt, publishedTime: post.publishedAt?.toISOString(), images: [image?.src ?? '/opengraph-image.png'] },
  }
}

export default async function PostPage({ params }: { params: { slug: string } }) {
  const post = await findPost(params.slug)
  if (!post) notFound()
  const [settings, more] = await Promise.all([
    getSettings(),
    prisma.post.findMany({
      where: { status: 'published', id: { not: post.id } },
      orderBy: { publishedAt: 'desc' },
      take: 2,
      include: { paper: PAPER_FIELDS },
    }),
  ])
  const topic = topicOf(post)
  const image = coverOf(post)
  const highlights = post.highlights.split('\n').filter(Boolean)
  const toc = headings(post.body)
  // Yazının rengi konusundan: Kısaca kutusu, bölüm rozetleri, vurgu ve kalın terimler bu tonda
  const accent = { ['--h' as string]: topicHue(topic) } as React.CSSProperties

  return (
    <article className="mx-auto max-w-5xl px-4" style={accent}>
      <ReadingProgress />
      <JsonLd data={{
        '@type': 'NewsArticle',
        headline: post.title,
        description: post.excerpt,
        datePublished: (post.publishedAt ?? post.createdAt).toISOString(),
        dateModified: post.updatedAt.toISOString(),
        ...(image ? { image: new URL(image.src, settings.siteUrl || 'http://localhost').href } : {}),
        publisher: { '@type': 'Organization', name: settings.siteTitle },
      }} />
      {post.status !== 'published' && <p className="mt-6 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300 px-4 py-2 text-sm">Taslak önizlemesi: henüz yayımlanmadı.</p>}

      <header className="relative mt-8 overflow-hidden rounded-3xl p-7 md:p-12 text-white min-h-72 md:min-h-96 flex flex-col justify-end" style={coverStyle(topic, post.slug)}>
        <CoverImage post={post} />
        {/* Görselin üstündeki başlık okunsun diye alttan koyulaşan perde */}
        {image && <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />}
        {image && <span className="absolute top-4 right-5 left-5 text-right text-xs text-white/75">{image.credit}</span>}
        <div className="relative max-w-3xl">
          <TopicChip topic={topic} light />
          <h1 className="mt-4 text-3xl md:text-5xl font-semibold leading-tight drop-shadow-sm">{post.title}</h1>
          <p className="mt-4 text-sm text-white/80">{postDate(post)} · {readingMinutes(post.body)} dk okuma</p>
        </div>
      </header>

      <div className="mx-auto mt-10 max-w-4xl lg:grid lg:grid-cols-[minmax(0,1fr)_13rem] lg:gap-14">
      <div className="max-w-2xl">
        {highlights.length > 0 ? (
          <section className="rounded-3xl border border-[hsl(var(--h)_80%_60%/0.3)] bg-[linear-gradient(135deg,hsl(var(--h)_85%_60%/0.14),hsl(calc(var(--h)+45)_85%_60%/0.05))] p-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--h)_70%_45%)] dark:text-[hsl(var(--h)_85%_75%)]">Kısaca · 30 saniyede</h2>
            <ul className="mt-3 space-y-2.5">
              {highlights.map((item) => (
                <li key={item} className="flex gap-3 text-zinc-800 dark:text-zinc-200">
                  <span aria-hidden className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--h)_75%_55%)] text-[0.7rem] text-white">✓</span>
                  <span dangerouslySetInnerHTML={{ __html: inline(item) }} />
                </li>
              ))}
            </ul>
          </section>
        ) : post.excerpt && <p className="border-l-4 border-violet-500 pl-5 text-lg text-zinc-600 dark:text-zinc-400">{post.excerpt}</p>}
        <div className="prose-body mt-8" style={accent} dangerouslySetInnerHTML={{ __html: renderMarkdown(post.body) }} />

        {post.paper && (
          <aside className="mt-12 card">
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-300">Kaynak</p>
            <a href={post.paper.url} className="mt-2 block font-display font-semibold hover:text-violet-500 break-words" rel="noopener noreferrer" target="_blank">{post.paper.title} ↗</a>
            {post.paper.authors && <p className="text-sm text-zinc-500 mt-1 line-clamp-2">{post.paper.authors}</p>}
            <p className="text-xs text-zinc-500 mt-3">Bu yazı yapay zekâ yardımıyla hazırlandı; ayrıntılar ve kesin sonuçlar için kaynağa bakın.</p>
          </aside>
        )}
      </div>
      {toc.length > 1 && (
        <nav aria-label="Bu yazıda" className="hidden lg:block">
          <div className="sticky top-24 border-l border-zinc-200 dark:border-ink-line pl-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Bu yazıda</p>
            <ol className="mt-3 space-y-2 text-sm">
              {toc.map((item) => <li key={item.id}><a href={`#${item.id}`} className="text-zinc-600 dark:text-zinc-400 hover:text-violet-600 dark:hover:text-violet-300">{item.text}</a></li>)}
            </ol>
            <a href="#abone" className="mt-6 block text-xs text-violet-600 dark:text-violet-300 hover:underline">Bültene abone ol →</a>
          </div>
        </nav>
      )}
      </div>

      <div className="mt-14"><SubscribeBox settings={settings} /></div>

      {more.length > 0 && (
        <section className="mt-14">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="text-xl font-semibold">Sıradaki okumalar</h2>
            <Link href="/#yazilar" className="text-sm text-violet-600 dark:text-violet-300 hover:underline">Tümü →</Link>
          </div>
          <div className="grid gap-6 md:grid-cols-2">{more.map((item) => <CardPost key={item.id} post={item} />)}</div>
        </section>
      )}
    </article>
  )
}
