import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSettings } from '@/lib/state'
import { istanbulDate, monthSky, skySources } from '@/lib/sky'
import { RANK_LABELS, SKY_KINDS, skyKind } from '@/lib/skyKinds'
import { SkyIcon, skyDay } from '../parts'

export const metadata: Metadata = {
  title: 'Gökyüzü takvimi',
  description: "Türkiye'den gözlenebilecek gökyüzü olayları: Ay evreleri, tutulmalar, meteor yağmurları, gezegenler ve yakınlaşmalar.",
}

const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const monthLabel = (y: number, m: number, month: 'long' | 'short' = 'long') => new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('tr-TR', { month, year: 'numeric', timeZone: 'UTC' })
// Önem derecesine göre görünüm: kaçırılmaması gereken (3) olaylar büyük ve sarı, öne çıkanlar (2) mor, olağanlar küçük
const CELL: Record<number, string> = {
  3: 'border-amber-400 bg-amber-400/15 ring-2 ring-amber-400/50 hover:bg-amber-400/25',
  2: 'border-violet-500 bg-violet-500/15 hover:bg-violet-500/25',
  1: 'border-zinc-300 dark:border-white/15 bg-zinc-100/60 dark:bg-white/[0.03] hover:border-violet-500',
}
const ICON: Record<number, string> = { 3: 'text-2xl sm:text-3xl', 2: 'text-xl sm:text-2xl', 1: 'text-sm sm:text-base opacity-80' }
const BADGE: Record<number, string> = { 3: 'bg-amber-400 text-amber-950', 2: 'bg-violet-600 text-white' }

const monthKey = (y: number, m: number) => {
  const d = new Date(Date.UTC(y, m - 1, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

// Aylık takvim (?ay=2026-11): günlerde olay simgeleri, altında o ayın olaylarının ayrıntısı. JavaScript gerekmez
export default async function SkyPage({ searchParams }: { searchParams: { ay?: string } }) {
  const settings = await getSettings()
  if (!settings.skyEnabled) notFound()
  const today = istanbulDate()
  const [y, m] = (/^\d{4}-(0[1-9]|1[0-2])$/.test(searchParams.ay ?? '') ? searchParams.ay! : today.slice(0, 7)).split('-').map(Number)
  const month = monthKey(y, m)
  const [events, info] = await Promise.all([monthSky(month), skySources()])
  const byDay = new Map<string, typeof events>()
  for (const e of events) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e])
  const highlights = events.filter((e) => e.rank >= 2).sort((a, b) => b.rank - a.rank || a.date.localeCompare(b.date))
  const offset = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7 // pazartesiden başlar
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const cells = [...Array<null>(offset).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)]
  const kinds = Array.from(new Set(events.map((e) => e.kind)))

  return (
    <div className="mx-auto max-w-4xl px-4">
      <header className="py-10 md:py-12">
        <p className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-700 dark:text-violet-300">Gökyüzü takvimi</p>
        <h1 className="mt-5 text-4xl md:text-5xl font-semibold leading-[1.08]">Gökyüzünde neler var?</h1>
        <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">Türkiye&apos;den gözlenebilecek olaylar; saatler Türkiye saatiyle. Haftada bir, önümüzdeki beş hafta için kaynaklara bakılarak güncellenir.</p>
      </header>

      <nav aria-label="Aylar" className="flex items-center justify-between gap-3">
        <Link href={`/gokyuzu?ay=${monthKey(y, m - 1)}`} className="rounded-full px-3 py-1.5 text-sm hover:bg-zinc-200/60 dark:hover:bg-white/5">{`← ${monthLabel(y, m - 1, 'short')}`}</Link>
        <h2 className="text-xl font-semibold capitalize">{monthLabel(y, m)}</h2>
        <Link href={`/gokyuzu?ay=${monthKey(y, m + 1)}`} className="rounded-full px-3 py-1.5 text-sm hover:bg-zinc-200/60 dark:hover:bg-white/5">{`${monthLabel(y, m + 1, 'short')} →`}</Link>
      </nav>

      {highlights.length > 0 && (
        <section aria-label="Bu ayın öne çıkanları" className="mt-6 grid gap-3 sm:grid-cols-2">
          {highlights.map((e) => (
            <a key={e.id} href={`#gun-${e.date}`} className={`flex items-center gap-4 rounded-2xl border p-4 ${CELL[e.rank]}`}>
              <span className="text-4xl leading-none"><SkyIcon kind={e.kind} /></span>
              <span className="min-w-0">
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE[e.rank]}`}>{RANK_LABELS[e.rank]}</span>
                <span className="mt-1 block font-semibold leading-snug">{e.title}</span>
                <span className="block text-sm text-zinc-600 dark:text-zinc-400">{skyDay(e.date)}{e.time && ` · ${e.time}`}</span>
              </span>
            </a>
          ))}
        </section>
      )}

      <div className="mt-6 grid grid-cols-7 gap-1 text-center text-xs text-zinc-500">{WEEKDAYS.map((d) => <span key={d}>{d}</span>)}</div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <span key={`bos-${i}`} />
          const list = [...(byDay.get(date) ?? [])].sort((a, b) => b.rank - a.rank)
          const top = list[0]?.rank ?? 0
          const body = (
            <>
              <span className={`text-xs ${date === today ? 'rounded-full bg-violet-600 px-1.5 text-white' : 'text-zinc-500'}`}>{Number(date.slice(8))}</span>
              <span className="mt-1 flex flex-wrap items-center justify-center gap-0.5 leading-none">
                {list.slice(0, 3).map((e) => <span key={e.id} className={ICON[e.rank]}><SkyIcon kind={e.kind} /></span>)}
                {list.length > 3 && <span className="text-[10px] text-zinc-500">+{list.length - 3}</span>}
              </span>
              {top >= 2 && <span className="mt-1 hidden sm:block text-[11px] font-semibold leading-tight line-clamp-2">{SKY_KINDS[skyKind(list[0].kind)].label}</span>}
            </>
          )
          const cell = 'flex min-h-14 sm:min-h-24 flex-col items-center rounded-xl border p-1 sm:p-2'
          return list.length ? (
            <a key={date} href={`#gun-${date}`} aria-label={`${skyDay(date)}: ${list.map((e) => e.title).join(', ')}`} className={`${cell} ${CELL[top]}`}>{body}</a>
          ) : (
            <span key={date} className={`${cell} border-zinc-200/70 dark:border-ink-line`}>{body}</span>
          )
        })}
      </div>

      {kinds.length > 0 && (
        <ul aria-label="Simgeler" className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
          {Object.entries(SKY_KINDS).filter(([key]) => kinds.includes(key)).map(([key, k]) => <li key={key}>{k.icon} {k.label}</li>)}
        </ul>
      )}

      {events.length === 0 ? (
        <p className="mt-10 rounded-3xl border border-dashed border-zinc-300 dark:border-ink-line p-10 text-center text-zinc-500">
          {month < today.slice(0, 7) ? 'Bu ay için kayıtlı olay yok.' : 'Bu ayın takvimi henüz hazırlanmadı; her hafta önümüzdeki beş hafta eklenir.'}
        </p>
      ) : (
        <ol className="mt-10 space-y-8">
          {Array.from(byDay, ([date, list]) => (
            <li key={date} id={`gun-${date}`} className="scroll-mt-24">
              <h3 className={`text-sm font-semibold uppercase tracking-wider ${date < today ? 'text-zinc-500' : 'text-violet-600 dark:text-violet-300'}`}>{skyDay(date)}</h3>
              <ul className="mt-3 space-y-3">
                {list.map((e) => (
                  <li key={e.id} className={`card flex gap-4 ${e.rank === 3 ? 'border-amber-400 ring-2 ring-amber-400/40' : e.rank === 2 ? 'border-violet-500' : ''}`}>
                    <span className={`${e.rank >= 2 ? 'text-4xl' : 'text-3xl'} leading-none`}><SkyIcon kind={e.kind} /></span>
                    <span>
                      {e.rank >= 2 && <span className={`mb-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE[e.rank]}`}>{RANK_LABELS[e.rank]}</span>}
                      <span className="block font-semibold">{e.title}{e.time && <span className="ml-2 text-sm font-normal text-zinc-500">{e.time}</span>}</span>
                      {e.detail && <span className="mt-1 block text-zinc-600 dark:text-zinc-400">{e.detail}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}

      {info && info.sources.length > 0 && (
        <aside className="mt-12 text-sm text-zinc-500">
          <p className="font-semibold">Son güncellemenin kaynakları ({new Date(info.updatedAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })})</p>
          <ul className="mt-2 space-y-1">
            {info.sources.map((s) => <li key={s.url}><a href={s.url} className="hover:text-violet-500 break-words" rel="noopener noreferrer" target="_blank">{s.title} ↗</a></li>)}
          </ul>
          <p className="mt-3">Yapay zekâ yardımıyla bu kaynaklardan derlendi; gözleme çıkmadan önce saatleri kendi konumun için kontrol et.</p>
        </aside>
      )}
    </div>
  )
}
