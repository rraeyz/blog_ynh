import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getSettings } from '@/lib/state'
import { canSubscribe } from '@/lib/newsletter'
import { periodLabel } from '@/lib/topics'
import { CardPost, FeaturedPost, RowPost, SubscribeBox, type PostItem } from './parts'

const PAGE_SIZE = 24

export default async function HomePage({ searchParams }: { searchParams: { sayfa?: string } }) {
  const page = Math.max(1, Number(searchParams.sayfa) || 1)
  const [settings, posts, weekCount] = await Promise.all([
    getSettings(),
    prisma.post.findMany({
      where: { status: 'published' },
      orderBy: { publishedAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE + 1,
      include: { paper: { select: { topic: true } } },
    }),
    prisma.post.count({ where: { status: 'published', publishedAt: { gte: new Date(Date.now() - 7 * 86_400_000) } } }),
  ])
  const shown: PostItem[] = posts.slice(0, PAGE_SIZE)
  const first = page === 1
  // İlk sayfa: en yeni yazı büyük, sonraki ikisi orta boy, kalanı liste. Diğer sayfalar yalnızca liste
  const featured = first ? shown[0] : undefined
  const pair = first ? shown.slice(1, 3) : []
  const rest = first ? shown.slice(3) : shown

  // Kalan yazılar zaman dilimlerine ayrılır: "Bu hafta", "Geçen hafta", "Ekim 2026"...
  const groups: Array<[string, PostItem[]]> = []
  for (const post of rest) {
    const label = periodLabel(post.publishedAt ?? post.createdAt)
    const last = groups[groups.length - 1]
    if (last?.[0] === label) last[1].push(post)
    else groups.push([label, [post]])
  }

  return (
    <div className="mx-auto max-w-5xl px-4">
      {first && (
        <section className="relative py-14 md:py-20">
          <div aria-hidden className="pointer-events-none absolute -top-10 right-0 h-72 w-72 rounded-full bg-violet-500/25 blur-3xl animate-blob" />
          <div aria-hidden className="pointer-events-none absolute top-20 -left-10 h-60 w-60 rounded-full bg-fuchsia-500/15 blur-3xl animate-blob [animation-delay:-7s]" />
          <p className="relative inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-700 dark:text-violet-300">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-500 animate-pulse" />
            {weekCount > 0 ? `Bu hafta ${weekCount} yeni yazı` : 'Yeni makaleler yolda'}
          </p>
          <h1 className="relative mt-5 max-w-3xl text-4xl md:text-6xl font-semibold leading-[1.05]">
            {settings.siteDescription || settings.siteTitle}
          </h1>
          <p className="relative mt-5 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
            Yeni yayımlanan bilimsel makaleleri seçiyor, jargonsuz ve kısa Türkçe yazılarla anlatıyoruz. Her yazının sonunda kaynak makalenin bağlantısı var.
          </p>
          <div className="relative mt-8 flex flex-wrap gap-3">
            <Link href="#yazilar" className="rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-6 py-3 font-medium hover:opacity-90 transition">Okumaya başla</Link>
            {canSubscribe(settings) && <Link href="#abone" className="rounded-full border border-zinc-300 dark:border-ink-line px-6 py-3 font-medium hover:border-violet-500 transition">Haftalık bülten</Link>}
          </div>
        </section>
      )}

      <div id="yazilar" className="scroll-mt-24 space-y-6">
        {!featured && rest.length === 0 && (
          <p className="rounded-3xl border border-dashed border-zinc-300 dark:border-ink-line p-10 text-center text-zinc-500">İlk yazılar hazırlanıyor. Bültene abone olursan ilk sen haberdar olursun.</p>
        )}
        {featured && <FeaturedPost post={featured} />}
        {pair.length > 0 && (
          <div className="grid gap-6 md:grid-cols-5">
            {pair.map((post, i) => (
              <div key={post.id} className={i === 0 ? 'md:col-span-3' : 'md:col-span-2'}>
                <CardPost post={post} tall={i === 0} />
              </div>
            ))}
          </div>
        )}
      </div>

      {first && <div className="my-12"><SubscribeBox settings={settings} /></div>}

      {groups.map(([label, items]) => (
        <section key={label} className="grid md:grid-cols-[160px_1fr] gap-x-8 gap-y-2 py-6 border-t border-zinc-200/70 dark:border-ink-line">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-300 md:sticky md:top-24 self-start pt-3">{label}</h2>
          <div className="space-y-1">{items.map((post) => <RowPost key={post.id} post={post} />)}</div>
        </section>
      ))}

      <nav className="mt-10 flex justify-between text-sm">
        {page > 1 ? <Link href={`/?sayfa=${page - 1}`} className="rounded-full border border-zinc-300 dark:border-ink-line px-4 py-2 hover:border-violet-500">← Daha yeni</Link> : <span />}
        {posts.length > PAGE_SIZE && <Link href={`/?sayfa=${page + 1}`} className="rounded-full border border-zinc-300 dark:border-ink-line px-4 py-2 hover:border-violet-500">Daha eski →</Link>}
      </nav>
    </div>
  )
}
