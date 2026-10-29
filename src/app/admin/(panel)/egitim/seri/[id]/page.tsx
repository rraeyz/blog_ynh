import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { LEVELS, isLevel } from '@/lib/levels'
import { Notice } from '../../../../Notice'
import { ConfirmButton } from '../../../../ConfirmButton'
import { deleteSeriesAction, saveSeriesAction } from '../../../../actions'

const STATUS: Record<string, string> = { planned: 'Sırada', draft: 'Taslak', published: 'Yayında', failed: 'Hata' }

export default async function SeriesAdminPage({ params, searchParams }: { params: { id: string }; searchParams: { mesaj?: string } }) {
  const series = await prisma.series.findUnique({
    where: { id: Number(params.id) || 0 },
    include: { stages: { orderBy: { position: 'asc' }, select: { id: true, title: true, planned: true } }, lessons: { orderBy: { position: 'asc' } } },
  })
  if (!series) notFound()
  return (
    <>
      <Notice message={searchParams.mesaj} />
      <p className="text-sm mb-2"><Link href="/admin/egitim" className="hover:underline">← Eğitim</Link></p>
      <h1 className="text-xl font-bold mb-4">{series.title}</h1>
      <form action={saveSeriesAction} className="card space-y-3 mb-6">
        <input type="hidden" name="id" value={series.id} />
        <div><label className="label" htmlFor="title">Seri adı</label><input id="title" name="title" defaultValue={series.title} className="input" required /></div>
        <div><label className="label" htmlFor="summary">Kapsam</label><textarea id="summary" name="summary" defaultValue={series.summary} rows={3} className="input" /></div>
        <div><label className="label" htmlFor="position">Sayfadaki sıra</label><input id="position" name="position" type="number" defaultValue={series.position} className="input w-32" /></div>
        <button className="btn-primary">Kaydet</button>
      </form>
      <div className="flex flex-wrap gap-2 mb-6">
        {series.lessons.some((l) => l.status === 'published') && <a href={`/egitim/${series.slug}`} className="btn" target="_blank">Sitede aç</a>}
        <form action={deleteSeriesAction}><input type="hidden" name="id" value={series.id} /><ConfirmButton question="Seri, blokları ve bütün dersleri silinsin mi? Katalogdaki seri boş olarak yeniden eklenir." className="btn-danger">Seriyi sil</ConfirmButton></form>
      </div>

      {series.stages.length > 0 && (
        <>
          <h2 className="font-semibold mb-2">Bloklar</h2>
          <ul className="flex flex-wrap gap-2 mb-6 text-sm">
            {series.stages.map((s) => <li key={s.id}><Link href={`/admin/egitim/blok/${s.id}`} className="btn">{s.title}</Link></li>)}
          </ul>
        </>
      )}

      <h2 className="font-semibold mb-2">Dersler</h2>
      {series.lessons.length === 0 ? (
        <p className="text-sm text-zinc-500">Bu serinin blokları henüz derslere bölünmedi.</p>
      ) : (
        <ol className="space-y-2">
          {series.lessons.map((l) => (
            <li key={l.id} className="card flex items-center gap-3 text-sm">
              <span className="w-8 text-zinc-500">{l.position}</span>
              <Link href={`/admin/egitim/ders/${l.id}`} className="flex-1 hover:underline">{l.title}<span className="block text-xs text-zinc-500 line-clamp-1">{l.scope}</span></Link>
              <span className="text-xs text-zinc-500">{isLevel(l.level) ? `${LEVELS[l.level].label} · ` : ''}{STATUS[l.status] ?? l.status}</span>
            </li>
          ))}
        </ol>
      )}
    </>
  )
}
