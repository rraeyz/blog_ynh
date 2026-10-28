import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getSettings } from '@/lib/state'
import { canSubscribe } from '@/lib/newsletter'
import { topicHue } from '@/lib/topics'
import { upcomingSky } from '@/lib/sky'
import { activeTopics, Archive, CardPost, FeaturedPost, PAGE_SIZE, PAPER_FIELDS, postDate, SkyBox, SubscribeBox, TopicChip, TopicLink, topicOf, type PostItem } from './parts'

export default async function HomePage({ searchParams }: { searchParams: { sayfa?: string } }) {
  const page = Math.max(1, Number(searchParams.sayfa) || 1)
  const published = { status: 'published' }
  const include = { paper: PAPER_FIELDS }
  const [settings, posts, latest, picked, topics, weekCount, sky] = await Promise.all([
    getSettings(),
    prisma.post.findMany({
      where: published,
      orderBy: { publishedAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE + 1,
      include,
    }),
    prisma.post.findMany({ where: published, orderBy: { publishedAt: 'desc' }, take: 5, include }),
    prisma.post.findMany({ where: { ...published, featuredAt: { not: null } }, orderBy: { featuredAt: 'desc' }, take: 10, include }),
    activeTopics(),
    prisma.post.count({ where: { ...published, publishedAt: { gte: new Date(Date.now() - 7 * 86_400_000) } } }),
    upcomingSky(4),
  ])
  const first = page === 1
  // Yeni gelişmeler hep en yeni 5 yazı: eskiler buradan düşer, arşivde ve sekmelerde kalır
  const news: PostItem[] = first ? latest : []
  // Öne çıkanlar elle seçilir; hiç yoksa en yeni üç yazı "Okuma köşesi" olur
  const highlight: PostItem[] = !first ? [] : picked.length > 0 ? picked : latest.slice(0, 3)
  return (
    <div className="mx-auto max-w-5xl px-4">
      {first && (
        <section className="relative grid gap-10 py-10 md:py-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
          <div aria-hidden className="pointer-events-none absolute -top-10 right-0 h-72 w-72 rounded-full bg-violet-500/25 blur-3xl animate-blob" />
          <div aria-hidden className="pointer-events-none absolute top-40 -left-10 h-60 w-60 rounded-full bg-fuchsia-500/15 blur-3xl animate-blob [animation-delay:-7s]" />
          <div className="relative self-start lg:sticky lg:top-24">
            <p className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-700 dark:text-violet-300">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-500 animate-pulse" />
              {weekCount > 0 ? `Bu hafta ${weekCount} yeni gelişme` : 'Yeni gelişmeler yolda'}
            </p>
            <h1 className="mt-5 text-4xl md:text-5xl font-semibold leading-[1.08]">{settings.siteDescription || settings.siteTitle}</h1>
            <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
              Bilimden ve teknolojiden en ilginç gelişmeleri seçip sade Türkçeyle anlatıyoruz. Önce kısaca oku, merak ettiğinin detayına bir tıkla in; kaynağı her yazının sonunda.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="#yazilar" className="rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-6 py-3 font-medium hover:opacity-90 transition">Yazılara göz at</Link>
              {canSubscribe(settings) && <Link href="#abone" className="rounded-full border border-zinc-300 dark:border-ink-line px-6 py-3 font-medium hover:border-violet-500 transition">Haftalık bülten</Link>}
            </div>
          </div>

          <div className="relative rounded-3xl border border-zinc-200 dark:border-ink-line bg-white/80 dark:bg-ink-card/80 backdrop-blur p-6 md:p-8">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2.5 text-xl font-semibold">
                <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75 animate-ping" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-violet-500" /></span>
                Yeni gelişmeler
              </h2>
              {news[0] && <span className="text-xs text-zinc-500">Son: {postDate(news[0])}</span>}
            </div>
            {news.length === 0 ? (
              <p className="mt-6 text-zinc-500">İlk gelişmeler hazırlanıyor.</p>
            ) : (
              <ol className="mt-6 space-y-6 border-l border-zinc-200 dark:border-ink-line ml-1.5">
                {news.map((post) => (
                  <li key={post.id} className="relative pl-6">
                    <span aria-hidden className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white dark:ring-ink-card" style={{ background: `hsl(${topicHue(topicOf(post))} 80% 60%)` }} />
                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500"><TopicChip topic={topicOf(post)} />{postDate(post)}</div>
                    <p className="mt-2 leading-relaxed text-zinc-800 dark:text-zinc-200">
                      <strong className="font-semibold text-zinc-900 dark:text-white">{post.title}</strong>
                      {post.excerpt && <span className="text-zinc-600 dark:text-zinc-400"> — {post.excerpt}</span>}
                    </p>
                    <Link href={`/yazi/${post.slug}`} className="mt-1.5 inline-flex text-sm font-medium text-violet-600 dark:text-violet-300 hover:underline">Detaylar →</Link>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      )}

      {highlight.length > 0 && (
        <section className="space-y-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-300">{picked.length > 0 ? 'Öne çıkanlar' : 'Okuma köşesi'}</h2>
          <FeaturedPost post={highlight[0]} badge={picked.length > 0 ? '★ Öne çıkan' : '✦ En yeni'} />
          {highlight.length > 1 && (
            // Kalanlar yana kayan bir katalog: telefonda parmakla, masaüstünde kaydırma çubuğuyla
            <div className="-mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-3 md:mx-0 md:px-0">
              {highlight.slice(1).map((post, i) => (
                <div key={post.id} className="w-72 shrink-0 snap-start md:w-80">
                  <CardPost post={post} tall={i % 3 === 0} />
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {first && settings.skyEnabled && sky && sky.events.length > 0 && <div className="mt-12"><SkyBox sky={sky} /></div>}

      {first && <div className="my-12"><SubscribeBox settings={settings} /></div>}

      <section id="yazilar" className="scroll-mt-20 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold">Yazılar</h2>
          {topics.length > 0 && (
            <nav aria-label="Konular" className="flex flex-wrap gap-2">
              {topics.map(([key, c]) => <TopicLink key={key} slug={key} label={c.label} />)}
            </nav>
          )}
        </div>
        <Archive posts={posts} page={page} href={(p) => `/?sayfa=${p}#yazilar`} empty="İlk yazılar hazırlanıyor. Bültene abone olursan ilk sen haberdar olursun." />
      </section>
    </div>
  )
}
