import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getSettings } from '@/lib/state'
import { upcomingSky } from '@/lib/sky'
import { skyDay } from '../parts'

export const metadata: Metadata = {
  title: 'Bu hafta gökyüzünde',
  description: "Önümüzdeki günlerde Türkiye'den gözlenebilecek gökyüzü olayları: Ay, gezegenler, meteor yağmurları, tutulmalar.",
}

export default async function SkyPage() {
  const [settings, sky] = await Promise.all([getSettings(), upcomingSky()])
  if (!settings.skyEnabled) notFound()
  return (
    <div className="mx-auto max-w-3xl px-4">
      <header className="py-10 md:py-14">
        <p className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-700 dark:text-violet-300">Gökyüzü takvimi</p>
        <h1 className="mt-5 text-4xl md:text-5xl font-semibold leading-[1.08]">Bu hafta gökyüzünde</h1>
        <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
          Türkiye&apos;den gözlenebilecek olaylar; saatler Türkiye saatiyle. Haftada bir, kaynaklara bakılarak hazırlanır.
        </p>
      </header>
      {!sky || sky.events.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-zinc-300 dark:border-ink-line p-10 text-center text-zinc-500">Bu haftanın takvimi hazırlanıyor.</p>
      ) : (
        <>
          <ol className="space-y-4">
            {sky.events.map((e, i) => (
              <li key={i} className="card">
                <p className="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-300">{skyDay(e.date)}{e.time && ` · ${e.time}`}</p>
                <h2 className="mt-1 text-lg font-semibold">{e.title}</h2>
                {e.detail && <p className="mt-1 text-zinc-600 dark:text-zinc-400">{e.detail}</p>}
              </li>
            ))}
          </ol>
          {sky.sources.length > 0 && (
            <aside className="mt-10 text-sm text-zinc-500">
              <p className="font-semibold">Kaynaklar</p>
              <ul className="mt-2 space-y-1">
                {sky.sources.map((s) => <li key={s.url}><a href={s.url} className="hover:text-violet-500 break-words" rel="noopener noreferrer" target="_blank">{s.title} ↗</a></li>)}
              </ul>
              <p className="mt-3">Yapay zekâ yardımıyla bu kaynaklardan derlendi; gözleme çıkmadan önce saatleri kendi konumun için kontrol et.</p>
            </aside>
          )}
        </>
      )}
    </div>
  )
}
