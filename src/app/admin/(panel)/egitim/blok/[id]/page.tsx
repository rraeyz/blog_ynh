import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { LEVELS, isLevel } from '@/lib/levels'
import { TRACKS, type Track } from '@/lib/curriculum'
import { Notice } from '../../../../Notice'
import { ConfirmButton } from '../../../../ConfirmButton'
import { addLessonAction, deleteStageAction, planStageAction, saveStageAction, skipStageAction } from '../../../../actions'

const STATUS: Record<string, string> = { planned: 'Sırada', draft: 'Taslak', published: 'Yayında', failed: 'Hata' }

export default async function StageAdminPage({ params, searchParams }: { params: { id: string }; searchParams: { mesaj?: string } }) {
  const stage = await prisma.stage.findUnique({ where: { id: Number(params.id) || 0 }, include: { series: true, lessons: { orderBy: { position: 'asc' } } } })
  if (!stage) notFound()
  return (
    <>
      <Notice message={searchParams.mesaj} />
      <p className="text-sm mb-2"><Link href="/admin/egitim" className="hover:underline">← Eğitim</Link> · <Link href={`/admin/egitim/seri/${stage.seriesId}`} className="hover:underline">{stage.series.title}</Link></p>
      <h1 className="text-xl font-bold">{stage.title}</h1>
      <p className="text-sm text-zinc-500 mb-4">
        {TRACKS[stage.track as Track] ?? stage.track} · {isLevel(stage.level) ? LEVELS[stage.level].label : stage.level} · anahtar <code>{stage.key}</code>
        {!stage.approved && ' · onay bekleyen öneri'}
      </p>
      <form action={saveStageAction} className="card space-y-3 mb-6">
        <input type="hidden" name="id" value={stage.id} />
        <div><label className="label" htmlFor="title">Ad</label><input id="title" name="title" defaultValue={stage.title} className="input" required /></div>
        <div><label className="label" htmlFor="summary">Önerilen dersler ve kapsam (ders listesi buna göre çıkarılır)</label><textarea id="summary" name="summary" defaultValue={stage.summary} rows={3} className="input" /></div>
        <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
          <div><label className="label" htmlFor="position">Hattaki sıra</label><input id="position" name="position" type="number" defaultValue={stage.position} className="input" /></div>
          <div><label className="label" htmlFor="requires">Ek önkoşullar (anahtarlar, virgüllü)</label><input id="requires" name="requires" defaultValue={stage.requires} placeholder="ör. hareket/orta, isi/orta" className="input" /></div>
        </div>
        <p className="hint">Küçük sıra önce yazılır. Serinin önceki aşaması ve seviyenin matematiği (orta: Değişim ve Birikim · Orta; ileri: Dalgalar · Orta) kendiliğinden önkoşuldur.</p>
        <button className="btn-primary">Kaydet</button>
      </form>
      <div className="flex flex-wrap gap-2 mb-6">
        {!stage.planned && <form action={planStageAction}><input type="hidden" name="id" value={stage.id} /><button className="btn">Derslere şimdi böl</button></form>}
        {stage.lessons.length === 0 && <form action={skipStageAction}><input type="hidden" name="id" value={stage.id} /><button className="btn">{stage.planned ? 'Yeniden sıraya al' : 'Bu bloğu atla'}</button></form>}
        {stage.lessons.length === 0 && <form action={deleteStageAction}><input type="hidden" name="id" value={stage.id} /><ConfirmButton question="Blok silinsin mi?" className="btn-danger">Sil</ConfirmButton></form>}
      </div>

      <h2 className="font-semibold mb-2">Dersler</h2>
      {stage.lessons.length === 0 ? (
        <p className="text-sm text-zinc-500 mb-4">Ders listesi, blok sırası gelince araştırılarak çıkarılır. İstersen şimdi böl ya da aşağıdan elle ekle.</p>
      ) : (
        <ol className="space-y-2 mb-6">
          {stage.lessons.map((l) => (
            <li key={l.id} className="card flex items-center gap-3 text-sm">
              <span className="w-8 text-zinc-500">{l.position}</span>
              <Link href={`/admin/egitim/ders/${l.id}`} className="flex-1 hover:underline">{l.title}<span className="block text-xs text-zinc-500 line-clamp-1">{l.scope}</span></Link>
              <span className="text-xs text-zinc-500">{STATUS[l.status] ?? l.status}</span>
            </li>
          ))}
        </ol>
      )}
      <form action={addLessonAction} className="card space-y-3">
        <input type="hidden" name="id" value={stage.id} />
        <p className="font-medium text-sm">Bu bloğa ders ekle</p>
        <input name="title" required placeholder="Ders başlığı" className="input" />
        <textarea name="scope" rows={2} placeholder="Neler anlatılsın?" className="input" />
        <textarea name="sourceUrls" rows={2} placeholder="Kaynak linkleri (isteğe bağlı), satır başına bir tane" className="input" />
        <button className="btn">Ekle</button>
        <p className="hint">Elle ders eklenen blok bölünmüş sayılır: yapay zekâ ayrıca ders listesi çıkarmaz.</p>
      </form>
    </>
  )
}
