import type { Metadata } from 'next'
import Link from 'next/link'
import { astroWeeks, weekLabel } from '@/lib/weekly'

export const metadata: Metadata = {
  title: 'Haftanın astronomi özeti',
  description: 'Her hafta astronomi ve fizikteki önemli gelişmeler, yeni dersler ve gökyüzü olayları tek sayfada.',
}

// Haftalık özetlerin arşivi; her hafta veriden kurulur
export default async function AstroWeeksPage() {
  const weeks = await astroWeeks()
  return (
    <div className="mx-auto max-w-3xl px-4">
      <header className="py-10 md:py-14">
        <p className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-700 dark:text-violet-300">Haftalık özet</p>
        <h1 className="mt-5 text-4xl md:text-5xl font-semibold leading-[1.08]">Haftanın astronomi özeti</h1>
        <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">Her hafta astronomi ve fizikteki önemli gelişmeler, yeni dersler ve gökyüzü olayları tek sayfada. Derse girmeden önce bir göz at.</p>
      </header>
      <ol className="space-y-3">
        {weeks.map((w, i) => (
          <li key={w.monday}>
            <Link href={`/astronomi-ozeti/${w.monday}`} className="block rounded-2xl border border-zinc-200 dark:border-ink-line bg-white dark:bg-ink-card p-5 hover:border-violet-500 transition">
              <span className="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-300">{i === 0 ? 'Bu hafta · ' : ''}{weekLabel(w.monday)}</span>
              <span className="mt-1 block font-semibold">{w.top || 'Gökyüzü ve dersler'}</span>
              <span className="mt-1 block text-sm text-zinc-500">{`${w.posts} gelişme · ${w.lessons} ders`}</span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  )
}
