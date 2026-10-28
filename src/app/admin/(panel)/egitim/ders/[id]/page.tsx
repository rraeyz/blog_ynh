import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { renderMarkdown } from '@/lib/markdown'
import { Notice } from '../../../../Notice'
import { ConfirmButton } from '../../../../ConfirmButton'
import { deleteLessonAction, publishLessonAction, rewriteLessonAction, saveLessonAction } from '../../../../actions'

export default async function LessonAdminPage({ params, searchParams }: { params: { id: string }; searchParams: { mesaj?: string } }) {
  const lesson = await prisma.lesson.findUnique({ where: { id: Number(params.id) || 0 }, include: { series: true } })
  if (!lesson) notFound()
  const published = lesson.status === 'published'
  const written = !!lesson.body.trim()
  const sources = lesson.sources.split('\n').filter(Boolean).map((line) => line.split('\t'))
  return (
    <>
      <Notice message={searchParams.mesaj} />
      <p className="text-sm mb-2"><Link href={`/admin/egitim/seri/${lesson.seriesId}`} className="hover:underline">← {lesson.series.title}</Link></p>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <h1 className="text-xl font-bold flex-1">{published ? 'Yayındaki ders' : written ? 'Taslak ders' : 'Henüz yazılmadı'}</h1>
        {written && <a href={`/egitim/${lesson.series.slug}/${lesson.slug}`} className="btn" target="_blank">Önizle</a>}
        {written && <form action={publishLessonAction}><input type="hidden" name="id" value={lesson.id} /><button className={published ? 'btn' : 'btn-primary'}>{published ? 'Yayından kaldır' : 'Yayımla'}</button></form>}
        <form action={rewriteLessonAction}><input type="hidden" name="id" value={lesson.id} /><ConfirmButton question={written ? 'Ders baştan araştırılıp yazılsın mı? Elle yaptığın düzenlemeler kaybolur.' : 'Ders şimdi araştırılıp yazılsın mı?'} className="btn">{written ? 'Araştırıp yeniden yaz' : 'Şimdi yaz'}</ConfirmButton></form>
        <form action={deleteLessonAction}><input type="hidden" name="id" value={lesson.id} /><ConfirmButton question="Ders silinsin mi?" className="btn-danger">Sil</ConfirmButton></form>
      </div>
      {lesson.error && <p className="text-sm text-red-600 mb-4">Son deneme: {lesson.error}</p>}
      {written && <p className="text-sm text-zinc-500 mb-4">{lesson.inputTokens + lesson.outputTokens} token · {sources.length} kaynak{lesson.prerequisites && ` · önkoşul ders no: ${lesson.prerequisites}`}</p>}
      {written && (
        <section className="card mb-4 text-sm">
          <p className="font-medium mb-2">Denetim bulguları</p>
          {lesson.review ? <div className="prose-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(lesson.review) }} /> : <p className="text-zinc-500">Denetim sorun bulmadı.</p>}
        </section>
      )}
      <form action={saveLessonAction} className="space-y-4">
        <input type="hidden" name="id" value={lesson.id} />
        <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
          <div><label className="label" htmlFor="title">Başlık</label><input id="title" name="title" defaultValue={lesson.title} className="input" required /></div>
          <div><label className="label" htmlFor="position">Sıra</label><input id="position" name="position" type="number" defaultValue={lesson.position} className="input" /></div>
        </div>
        <div><label className="label" htmlFor="scope">Kapsam (yazarken modele verilir)</label><textarea id="scope" name="scope" defaultValue={lesson.scope} rows={2} className="input" /></div>
        <div><label className="label" htmlFor="sourceUrls">Verilen kaynaklar (satır başına bir link; yazarken önce bunlar okunur)</label><textarea id="sourceUrls" name="sourceUrls" defaultValue={lesson.sourceUrls} rows={2} className="input" /></div>
        <div><label className="label" htmlFor="excerpt">Özet</label><textarea id="excerpt" name="excerpt" defaultValue={lesson.excerpt} rows={2} className="input" /></div>
        <div>
          <label className="label" htmlFor="body">Ders (Markdown)</label>
          <textarea id="body" name="body" defaultValue={lesson.body} rows={28} className="input font-mono" />
          <p className="hint">## başlık, - liste, **kalın**, `kod`, ```python kod bloğu```, $satır içi formül$, $$ayrı satırda formül$$, [metin](https://link)</p>
        </div>
        <button className="btn-primary">Kaydet</button>
      </form>
      {sources.length > 0 && (
        <section className="card mt-6 text-sm">
          <p className="font-medium mb-2">Yazarken kullanılan kaynaklar</p>
          <ol className="list-decimal pl-5 space-y-1">{sources.map(([title, url]) => <li key={url}><a href={url} className="underline break-words" target="_blank" rel="noopener noreferrer">{title}</a></li>)}</ol>
        </section>
      )}
      {lesson.research && (
        <details className="card mt-6 text-sm">
          <summary className="font-medium cursor-pointer">Araştırma notları (dersin dayandığı)</summary>
          <div className="prose-body mt-3" dangerouslySetInnerHTML={{ __html: renderMarkdown(lesson.research, { math: true }) }} />
        </details>
      )}
    </>
  )
}
