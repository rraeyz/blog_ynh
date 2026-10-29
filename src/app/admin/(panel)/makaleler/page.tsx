import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatScore } from '@/lib/text'
import { addPaperAction, bulkPapersAction, deletePaperAction, skipPaperAction, writePaperAction } from '../../actions'
import { Notice } from '../../Notice'
import { ConfirmButton } from '../../ConfirmButton'
import { BackTo, Pager, pageOf } from '../../Pager'
import { Tabs } from '../../Tabs'

const STATUS: Record<string, string> = { new: 'Bekliyor', failed: 'Hata', skipped: 'Atlandı', written: 'Yazıldı' }
const PAGE = 100

export default async function PapersPage({ searchParams }: { searchParams: { mesaj?: string; durum?: string; sayfa?: string } }) {
  const status = STATUS[searchParams.durum ?? ''] ? searchParams.durum! : 'new'
  const counts = await prisma.paper.groupBy({ by: ['status'], _count: true })
  const count = (key: string) => counts.find((row) => row.status === key)?._count ?? 0
  const pages = Math.max(1, Math.ceil(count(status) / PAGE))
  const page = pageOf(searchParams.sayfa, pages)
  const papers = await prisma.paper.findMany({ where: { status }, orderBy: [{ score: 'desc' }, { publishedAt: 'desc' }], skip: (page - 1) * PAGE, take: PAGE, include: { post: { select: { id: true, title: true } } } })
  const params = { durum: status }
  const here = `/admin/makaleler?durum=${status}&sayfa=${page}`
  const pager = <Pager path="/admin/makaleler" params={params} page={page} pages={pages} />
  return (
    <>
      <Notice message={searchParams.mesaj} />
      <h1 className="text-xl font-bold mb-4">Makaleler</h1>
      <Tabs path="/admin/makaleler" param="durum" active={status} tabs={Object.entries(STATUS).map(([key, label]) => [key, `${label} · ${count(key)}`])} />
      <div className="mb-4 grid gap-2 sm:grid-cols-2">
        <details className="card text-sm text-zinc-500">
          <summary className="cursor-pointer font-medium text-zinc-700 dark:text-zinc-300">Nasıl çalışır?</summary>
          <p className="mt-2">
            Kaynaklardan çekilen ham makaleler. Günlük iş her yeni habere başlık, tarih ve özetten bir kez <b>ön puan</b> verir (liste bu puana
            göre sıralı, puanlanmamışlar en sonda) ve eşiği geçenleri yazıya dönüştürür. O gün sınır dolduğu için kalanlar 3 gün boyunca
            sonraki günlerin seçimine aynı puanla girer, sonra <b>Atlandı</b>&apos;ya geçer. Atlanan ve hatalı makaleler 30 gün sonra
            listeden kalkar; kaydı (yalnızca adres ve başlık) kalır, böylece kaynağında dursa da bir daha gelmez. Sildiğin makaleler de geri gelmez.
          </p>
        </details>
        <details className="card text-sm">
          <summary className="cursor-pointer font-medium">Tek bir makale ekle</summary>
          <form action={addPaperAction} className="mt-3 flex flex-col gap-2">
            <input name="url" type="url" required placeholder="https://arxiv.org/abs/2510.12345 ya da herhangi bir makale/yazı linki" className="input" />
            <button className="btn-primary">Ekle</button>
          </form>
        </details>
      </div>
      {status !== 'written' && papers.length > 0 && (
        <form action={bulkPapersAction} className="mb-2 flex justify-end">
          <input type="hidden" name="status" value={status} />
          <ConfirmButton question={status === 'skipped' ? `Atlanan ${count(status)} makalenin hepsi silinsin mi?` : `Bu listedeki ${count(status)} makalenin hepsi atlansın mı?`} className="btn btn-sm">
            {status === 'skipped' ? `Hepsini sil (${count(status)})` : `Hepsini atla (${count(status)})`}
          </ConfirmButton>
        </form>
      )}
      {pager}
      {papers.length === 0 ? (
        <p className="text-sm text-stone-500">Bu listede makale yok.</p>
      ) : (
        <ul className="space-y-2">
          {papers.map((paper) => (
            <li key={paper.id} className="card py-3 text-sm">
              <a href={paper.url} target="_blank" rel="noopener noreferrer" className="font-medium leading-snug hover:underline">{paper.title}</a>
              <p className="text-xs text-stone-500 mt-1">{paper.score > 0 && <span className="mr-1 rounded bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300 px-1.5 py-0.5">ön puan {formatScore(paper.score)}/10{paper.space && ' · uzay'}</span>}{paper.publishedAt.toLocaleDateString('tr-TR')}{paper.authors && ` · ${paper.authors.slice(0, 120)}`}</p>
              {paper.error && <p className="text-xs text-red-600 mt-1">{paper.error}</p>}
              <div className="flex flex-wrap gap-2 mt-2">
                {paper.post ? (
                  <Link href={`/admin/yazilar/${paper.post.id}`} className="btn btn-sm">Yazıya git: {paper.post.title.slice(0, 60)}</Link>
                ) : (
                  <>
                    <form action={writePaperAction}><input type="hidden" name="id" value={paper.id} /><BackTo href={here} /><button className="btn-primary btn-sm">Yazıya dönüştür</button></form>
                    {paper.status !== 'skipped' && <form action={skipPaperAction}><input type="hidden" name="id" value={paper.id} /><BackTo href={here} /><button className="btn btn-sm">Atla</button></form>}
                    <form action={deletePaperAction}><input type="hidden" name="id" value={paper.id} /><input type="hidden" name="status" value={paper.status} /><BackTo href={here} /><button className="btn btn-sm">Sil</button></form>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {pager}
    </>
  )
}
