import Link from 'next/link'
import { CATEGORIES, coverOf, periodLabel, readingMinutes, topicHue, topicLabel } from '@/lib/topics'
import { prisma } from '@/lib/prisma'
import { canSubscribe } from '@/lib/newsletter'
import type { Settings } from '@/lib/state'
import type { Sky } from '@/lib/sky'
import { isLevel, LEVELS, type Level } from '@/lib/levels'
import { SubscribeForm } from './SubscribeForm'

export type PostItem = {
  id: number
  slug: string
  title: string
  excerpt: string
  body: string
  publishedAt: Date | null
  createdAt: Date
  category: string
  image: string
  paper: { topic: string; url: string; imageUrl: string } | null
}

// Kartlarda ve yazı sayfasında aynı: makalenin görselini göstermek için gereken alanlar
export const PAPER_FIELDS = { select: { topic: true, url: true, imageUrl: true } } as const

// Renkli kapağın üstüne serilir; görsel yüklenemezse renkli kapak görünür kalır
export const CoverImage = ({ post }: { post: Parameters<typeof coverOf>[0] }) => {
  const cover = coverOf(post)
  // Dış sitelerin görselleri: next/image optimizasyonu için alan adı listesi gerekirdi, düz img yeterli
  // eslint-disable-next-line @next/next/no-img-element
  return cover ? <img src={cover.src} alt="" loading="lazy" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover" /> : null
}

const DAYS = ['pazar', 'pazartesi', 'salı', 'çarşamba', 'perşembe', 'cuma', 'cumartesi']
// Konu sekmesi; konusu seçilmemiş eski yazılarda makalenin arXiv kategorisi ya da sitesi
export const topicOf = (post: Pick<PostItem, 'category' | 'paper'>) => post.category || post.paper?.topic || ''
export const postDate = (post: PostItem) => (post.publishedAt ?? post.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })

// Görseli olmayan yazılar için konuya göre renkli, yazıya göre biraz kayan soyut kapak
export function coverStyle(topic: string, slug: string): React.CSSProperties {
  const hue = topicHue(topic)
  let shift = 0
  for (const ch of slug) shift = (shift + ch.charCodeAt(0)) % 50
  const second = (hue + 35 + shift) % 360
  return {
    backgroundImage: [
      `radial-gradient(circle at ${20 + shift}% 25%, hsl(${hue} 90% 68% / 0.85), transparent 45%)`,
      `radial-gradient(circle at 85% ${60 + shift / 2}%, hsl(${second} 85% 58% / 0.75), transparent 50%)`,
      `linear-gradient(135deg, hsl(${hue} 55% 16%), hsl(${second} 50% 9%))`,
    ].join(','),
  }
}

export function TopicChip({ topic, light }: { topic: string; light?: boolean }) {
  const hue = topicHue(topic)
  // Açık ve koyu temada okunur kalsın diye renk tonu değişkenle, açıklık sınıfla verilir
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${light ? 'bg-white/15 text-white' : 'bg-[hsl(var(--h)_80%_60%/0.14)] text-[hsl(var(--h)_70%_38%)] dark:text-[hsl(var(--h)_85%_78%)]'}`}
      style={{ ['--h' as string]: hue }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: light ? '#fff' : `hsl(${hue} 80% 55%)` }} />
      {topicLabel(topic)}
    </span>
  )
}

const Meta = ({ post, light }: { post: PostItem; light?: boolean }) => (
  <p className={`text-xs ${light ? 'text-white/70' : 'text-zinc-500'}`}>{postDate(post)} · {readingMinutes(post.body)} dk okuma</p>
)

// Büyük kapaklı, iki sütunlu kart (öne çıkanların ilki ya da en yeni yazı)
export function FeaturedPost({ post, badge }: { post: PostItem; badge: string }) {
  return (
    <Link href={`/yazi/${post.slug}`} className="group grid md:grid-cols-5 overflow-hidden rounded-3xl bg-white dark:bg-ink-card border border-zinc-200 dark:border-ink-line shadow-sm hover:shadow-xl hover:shadow-violet-500/10 transition">
      <div className="md:col-span-3 min-h-56 md:min-h-80 relative p-6 flex flex-col justify-between" style={coverStyle(topicOf(post), post.slug)}>
        <CoverImage post={post} />
        <span className="relative self-start rounded-full bg-black/40 backdrop-blur px-3 py-1 text-xs font-semibold text-white">{badge}</span>
        <div className="relative flex items-end justify-between gap-2"><TopicChip topic={topicOf(post)} light />{coverOf(post)?.ai && <span className="rounded-full bg-black/40 px-2 py-0.5 text-[11px] text-white/80">Temsili görsel</span>}</div>
      </div>
      <div className="md:col-span-2 p-6 md:p-8 flex flex-col justify-center gap-3">
        <Meta post={post} />
        <h2 className="text-2xl md:text-3xl font-semibold leading-tight group-hover:text-violet-600 dark:group-hover:text-violet-300 transition">{post.title}</h2>
        {post.excerpt && <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">{post.excerpt}</p>}
        <span className="text-sm font-medium text-violet-600 dark:text-violet-300">Okumaya başla →</span>
      </div>
    </Link>
  )
}

// Orta boy kart: üstte renkli şerit
export function CardPost({ post, tall }: { post: PostItem; tall?: boolean }) {
  return (
    <Link href={`/yazi/${post.slug}`} className="group flex flex-col overflow-hidden rounded-3xl bg-white dark:bg-ink-card border border-zinc-200 dark:border-ink-line hover:-translate-y-0.5 hover:shadow-lg hover:shadow-violet-500/10 transition">
      <div className={`relative ${tall ? 'h-40' : 'h-24'}`} style={coverStyle(topicOf(post), post.slug)}><CoverImage post={post} /></div>
      <div className="p-5 flex flex-col gap-2 flex-1">
        <div className="flex items-center justify-between gap-2"><TopicChip topic={topicOf(post)} /><Meta post={post} /></div>
        <h3 className="text-lg font-semibold leading-snug group-hover:text-violet-600 dark:group-hover:text-violet-300 transition">{post.title}</h3>
        {post.excerpt && <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-3">{post.excerpt}</p>}
      </div>
    </Link>
  )
}

// Sık liste satırı: renkli nokta, başlık, kısa özet
export function RowPost({ post }: { post: PostItem }) {
  const hue = topicHue(topicOf(post))
  return (
    <Link href={`/yazi/${post.slug}`} className="group flex gap-4 rounded-2xl p-3 -mx-3 hover:bg-white dark:hover:bg-ink-card transition">
      <span className="mt-2 h-3 w-3 shrink-0 rounded-full ring-4" style={{ background: `hsl(${hue} 80% 60%)`, ['--tw-ring-color' as string]: `hsl(${hue} 80% 60% / 0.15)` }} />
      <div className="min-w-0">
        <h3 className="font-semibold leading-snug group-hover:text-violet-600 dark:group-hover:text-violet-300 transition">{post.title}</h3>
        {post.excerpt && <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2 mt-0.5">{post.excerpt}</p>}
        <p className="text-xs text-zinc-500 mt-1">{topicLabel(topicOf(post))} · {postDate(post)} · {readingMinutes(post.body)} dk</p>
      </div>
    </Link>
  )
}

// Abonelik kutusu; Künye bağlantısı yoksa görünmez
export function SubscribeBox({ settings, compact }: { settings: Settings; compact?: boolean }) {
  if (!canSubscribe(settings)) return null
  return (
    <section id="abone" className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-violet-700 to-fuchsia-800 text-white p-7 md:p-10 scroll-mt-24">
      <div aria-hidden className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-fuchsia-400/30 blur-3xl animate-blob" />
      <div aria-hidden className="absolute -left-10 -bottom-20 h-56 w-56 rounded-full bg-violet-300/20 blur-3xl animate-blob [animation-delay:-6s]" />
      <div className={`relative grid gap-6 ${compact ? '' : 'md:grid-cols-2 md:items-center'}`}>
        <div>
          <p className="text-sm font-medium text-violet-200">Haftalık bülten</p>
          <h2 className="text-2xl md:text-3xl font-semibold mt-1">Haftanın en ilginç gelişmeleri, her {DAYS[settings.digestWeekday]} e-postanda.</h2>
          <p className="text-violet-100/80 mt-2 text-sm">Kahveni içerken 5 dakikada okunur. Reklam yok, istediğin an tek tıkla ayrılırsın.</p>
        </div>
        <SubscribeForm />
      </div>
    </section>
  )
}

export const PAGE_SIZE = 24

// Yazı arşivi: zaman dilimlerine ayrılmış liste ("Bu hafta", "Geçen hafta", "Ekim 2026"...) ve sayfalama.
// posts PAGE_SIZE + 1 kayıtla gelir; fazladan biri varsa "Daha eski" görünür
export function Archive({ posts, page, href, empty }: { posts: PostItem[]; page: number; href: (page: number) => string; empty: string }) {
  const groups: Array<[string, PostItem[]]> = []
  for (const post of posts.slice(0, PAGE_SIZE)) {
    const label = periodLabel(post.publishedAt ?? post.createdAt)
    const last = groups[groups.length - 1]
    if (last?.[0] === label) last[1].push(post)
    else groups.push([label, [post]])
  }
  return (
    <>
      {groups.length === 0 && <p className="mt-6 rounded-3xl border border-dashed border-zinc-300 dark:border-ink-line p-10 text-center text-zinc-500">{empty}</p>}
      {groups.map(([label, items]) => (
        <div key={label} className="grid md:grid-cols-[160px_1fr] gap-x-8 gap-y-2 py-6 border-t border-zinc-200/70 dark:border-ink-line first:mt-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-300 md:sticky md:top-24 self-start pt-3">{label}</h3>
          <div className="space-y-1">{items.map((post) => <RowPost key={post.id} post={post} />)}</div>
        </div>
      ))}
      <nav className="mt-10 flex justify-between text-sm">
        {page > 1 ? <Link href={href(page - 1)} className="rounded-full border border-zinc-300 dark:border-ink-line px-4 py-2 hover:border-violet-500">← Daha yeni</Link> : <span />}
        {posts.length > PAGE_SIZE && <Link href={href(page + 1)} className="rounded-full border border-zinc-300 dark:border-ink-line px-4 py-2 hover:border-violet-500">Daha eski →</Link>}
      </nav>
    </>
  )
}

// Yazısı olan konular (sabit sırayla); üst menü ve ana sayfadaki konu bağlantıları
export async function activeTopics(): Promise<Array<[string, (typeof CATEGORIES)[string], number]>> {
  const counts = await prisma.post.groupBy({ by: ['category'], where: { status: 'published' }, _count: true })
  return Object.entries(CATEGORIES).flatMap(([key, c]) => {
    const count = counts.find((row) => row.category === key)?._count ?? 0
    return count > 0 ? [[key, c, count] as [string, (typeof CATEGORIES)[string], number]] : []
  })
}

// Konu bağlantısı: konunun renginde nokta
export const TopicLink = ({ slug, label, active }: { slug: string; label: string; active?: boolean }) => (
  <Link
    href={`/konu/${slug}`}
    aria-current={active ? 'page' : undefined}
    className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${active ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900' : 'border border-zinc-300 dark:border-ink-line hover:border-violet-500'}`}
  >
    <span className="h-2 w-2 rounded-full" style={{ background: `hsl(${topicHue(slug)} 80% 60%)` }} />
    {label}
  </Link>
)

// "2026-10-28" → "28 Ekim Çar" (tarih Türkiye takviminden geldiği için saat dilimi kaydırmasın diye UTC öğlen)
export const skyDay = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long', timeZone: 'UTC' })

// Ana sayfadaki küçük gökyüzü kutusu: önümüzdeki birkaç olay
export function SkyBox({ sky }: { sky: Sky }) {
  return (
    <section className="rounded-3xl border border-zinc-200 dark:border-ink-line bg-white/80 dark:bg-ink-card/80 p-6 md:p-8">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Bu hafta gökyüzünde</h2>
        <Link href="/gokyuzu" className="text-sm font-medium text-violet-600 dark:text-violet-300 hover:underline">Nasıl gözlenir →</Link>
      </div>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2">
        {sky.events.map((e, i) => (
          <li key={i}>
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-300">{skyDay(e.date)}{e.time && ` · ${e.time}`}</p>
            <p className="mt-0.5 font-medium">{e.title}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

const LEVEL_COLORS: Record<Level, string> = {
  temel: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  orta: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  ileri: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  kapsamli: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
}

// Dersin seviyesi: okur buna bakıp nereden başlayacağını seçer
export function LevelBadge({ level }: { level: string }) {
  if (!isLevel(level)) return null
  return <span title={LEVELS[level].hint} className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${LEVEL_COLORS[level]}`}>{LEVELS[level].label}</span>
}
