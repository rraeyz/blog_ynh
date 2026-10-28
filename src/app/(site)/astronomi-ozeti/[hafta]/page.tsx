import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { istanbulDate } from '@/lib/sky'
import { RANK_LABELS } from '@/lib/skyKinds'
import { mondayOf } from '@/lib/text'
import { astroWeeks, weekLabel, weeklyAstro } from '@/lib/weekly'
import { LevelBadge, RowPost, SkyIcon, skyDay } from '../../parts'

const valid = (hafta: string) => /^\d{4}-\d{2}-\d{2}$/.test(hafta) && mondayOf(hafta) === hafta

export function generateMetadata({ params }: { params: { hafta: string } }): Metadata {
  return valid(params.hafta) ? { title: `Haftanın astronomi özeti · ${weekLabel(params.hafta)}` } : {}
}

export default async function AstroWeekPage({ params }: { params: { hafta: string } }) {
  const monday = params.hafta
  const thisWeek = mondayOf(istanbulDate())
  if (!valid(monday) || monday > thisWeek) notFound()
  const [{ posts, lessons, sky }, weeks] = await Promise.all([weeklyAstro(monday), astroWeeks()])
  const index = weeks.findIndex((w) => w.monday === monday)
  const [newer, older] = [weeks[index - 1], weeks[index + 1]]
  if (monday !== thisWeek && posts.length === 0 && lessons.length === 0 && sky.length === 0) notFound()
  const heading = 'text-sm font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-300'
  return (
    <div className="mx-auto max-w-3xl px-4">
      <p className="mt-8 text-sm"><Link href="/astronomi-ozeti" className="text-violet-600 dark:text-violet-300 hover:underline">← Bütün haftalar</Link></p>
      <header className="py-8">
        <p className="text-sm text-zinc-500">{monday === thisWeek ? 'Bu hafta · ' : ''}{weekLabel(monday)}</p>
        <h1 className="mt-2 text-4xl md:text-5xl font-semibold leading-[1.08]">Haftanın astronomi özeti</h1>
        <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">{`${posts.length} gelişme, ${lessons.length} yeni ders, gökyüzünde ${sky.length} olay.`}</p>
      </header>

      <section>
        <h2 className={heading}>Bu haftanın gelişmeleri</h2>
        {posts.length === 0 ? <p className="mt-3 text-zinc-500">Bu hafta öne çıkan bir astronomi ya da fizik haberi yok.</p> : <div className="mt-3 space-y-1">{posts.map((p) => <RowPost key={p.id} post={p} />)}</div>}
      </section>

      {lessons.length > 0 && (
        <section className="mt-12">
          <h2 className={heading}>Bu haftanın dersleri</h2>
          <ul className="mt-3 space-y-3">
            {lessons.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-2">
                <Link href={`/egitim/${l.series.slug}/${l.slug}`} className="font-semibold hover:text-violet-600 dark:hover:text-violet-300">{l.title}</Link>
                <LevelBadge level={l.level} />
                <span className="w-full text-sm text-zinc-500">{l.series.title}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-12">
        <h2 className={heading}>Bu hafta gökyüzünde</h2>
        {sky.length === 0 ? (
          <p className="mt-3 text-zinc-500">Bu hafta için kayıtlı gökyüzü olayı yok.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {sky.map((e) => (
              <li key={e.id} className={`flex gap-3 ${e.rank === 3 ? 'rounded-2xl border border-amber-400 bg-amber-400/10 p-3' : ''}`}>
                <span className={`${e.rank >= 2 ? 'text-3xl' : 'text-2xl'} leading-none`}><SkyIcon kind={e.kind} /></span>
                <span>
                  <span className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">{skyDay(e.date)}{e.time && ` · ${e.time}`}{RANK_LABELS[e.rank] && ` · ${RANK_LABELS[e.rank]}`}</span>
                  <span className={`block ${e.rank >= 2 ? 'font-semibold' : 'font-medium'}`}>{e.title}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link href={`/gokyuzu?ay=${monday.slice(0, 7)}`} className="mt-4 inline-flex text-sm font-medium text-violet-600 dark:text-violet-300 hover:underline">Takvimde gör →</Link>
      </section>

      <nav className="mt-12 flex justify-between text-sm">
        {older ? <Link href={`/astronomi-ozeti/${older.monday}`} className="hover:text-violet-500">← Önceki hafta</Link> : <span />}
        {newer && <Link href={`/astronomi-ozeti/${newer.monday}`} className="hover:text-violet-500">Sonraki hafta →</Link>}
      </nav>
    </div>
  )
}
