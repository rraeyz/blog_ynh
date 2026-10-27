import Link from 'next/link'
import { readingMinutes, topicHue, topicLabel } from '@/lib/topics'
import { canSubscribe } from '@/lib/newsletter'
import type { Settings } from '@/lib/state'
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
  paper: { topic: string } | null
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
        <span className="self-start rounded-full bg-black/30 backdrop-blur px-3 py-1 text-xs font-semibold text-white">{badge}</span>
        <div className="self-start"><TopicChip topic={topicOf(post)} light /></div>
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
      <div className={tall ? 'h-40' : 'h-24'} style={coverStyle(topicOf(post), post.slug)} />
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
          <h2 className="text-2xl md:text-3xl font-semibold mt-1">Haftanın en ilginç makaleleri, her {DAYS[settings.digestWeekday]} e-postanda.</h2>
          <p className="text-violet-100/80 mt-2 text-sm">Kahveni içerken 5 dakikada okunur. Reklam yok, istediğin an tek tıkla ayrılırsın.</p>
        </div>
        <SubscribeForm />
      </div>
    </section>
  )
}
