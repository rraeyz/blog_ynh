import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { topicHue } from '@/lib/topics'

export const metadata: Metadata = {
  title: 'Eğitim',
  description: 'Astronomi ve astrofizikte yöntemleri, mantığı ve kullanıldıkları yerleri anlatan sıralı ders serileri.',
}

// Seri kartının rengi başlığından: her seri hep aynı renkte
const hueOf = (slug: string) => topicHue(slug)

export default async function EducationPage() {
  const [series, latest] = await Promise.all([
    prisma.series.findMany({
      where: { lessons: { some: { status: 'published' } } },
      orderBy: { position: 'asc' },
      include: { lessons: { select: { status: true } } },
    }),
    prisma.lesson.findMany({ where: { status: 'published' }, orderBy: { publishedAt: 'desc' }, take: 6, include: { series: { select: { slug: true, title: true } } } }),
  ])
  return (
    <div className="mx-auto max-w-5xl px-4">
      <header className="py-10 md:py-14 max-w-3xl">
        <p className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-700 dark:text-violet-300">Ders serileri</p>
        <h1 className="mt-5 text-4xl md:text-5xl font-semibold leading-[1.08]">Eğitim</h1>
        <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
          Astronomide kullanılan yöntemleri, aletleri ve kuramları sırayla öğreten dersler: neden ortaya çıktıklarını, mantıklarını, matematiklerini,
          nasıl ve ne zaman kullanıldıklarını örnek kodlarla anlatır. Her ders kaynaklara dayanır; kaynaklar dersin sonunda.
        </p>
      </header>

      {series.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-zinc-300 dark:border-ink-line p-10 text-center text-zinc-500">İlk dersler hazırlanıyor.</p>
      ) : (
        <section className="grid gap-5 md:grid-cols-2">
          {series.map((s) => {
            const published = s.lessons.filter((l) => l.status === 'published').length
            const hue = hueOf(s.slug)
            return (
              <Link key={s.id} href={`/egitim/${s.slug}`} className="group rounded-3xl border border-zinc-200 dark:border-ink-line bg-white dark:bg-ink-card p-6 hover:shadow-lg hover:shadow-violet-500/10 transition">
                <span className="block h-1.5 w-14 rounded-full" style={{ background: `hsl(${hue} 80% 60%)` }} />
                <h2 className="mt-4 text-xl font-semibold group-hover:text-violet-600 dark:group-hover:text-violet-300 transition">{s.title}</h2>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 line-clamp-3">{s.summary}</p>
                <p className="mt-4 text-xs text-zinc-500">{published} / {s.lessons.length} ders yayında</p>
                <span className="mt-2 block h-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-white/10">
                  <span className="block h-full rounded-full" style={{ width: `${Math.round((published / Math.max(1, s.lessons.length)) * 100)}%`, background: `hsl(${hue} 80% 60%)` }} />
                </span>
              </Link>
            )
          })}
        </section>
      )}

      {latest.length > 0 && (
        <section className="mt-14">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-300">Son dersler</h2>
          <ul className="mt-4 divide-y divide-zinc-200/70 dark:divide-ink-line">
            {latest.map((l) => (
              <li key={l.id} className="py-3">
                <Link href={`/egitim/${l.series.slug}/${l.slug}`} className="font-semibold hover:text-violet-600 dark:hover:text-violet-300">{l.title}</Link>
                <p className="text-xs text-zinc-500 mt-0.5">{l.series.title}{l.excerpt && ` · ${l.excerpt}`}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
