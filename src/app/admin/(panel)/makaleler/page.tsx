import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { addPaperAction, skipPaperAction, writePaperAction } from '../../actions'
import { Notice } from '../../Notice'

const STATUS: Record<string, string> = { new: 'Bekliyor', failed: 'Hata', skipped: 'Atlandı', written: 'Yazıldı' }

export default async function PapersPage({ searchParams }: { searchParams: { mesaj?: string; durum?: string } }) {
  const status = STATUS[searchParams.durum ?? ''] ? searchParams.durum! : 'new'
  const [papers, counts] = await Promise.all([
    prisma.paper.findMany({ where: { status }, orderBy: { publishedAt: 'desc' }, take: 100, include: { post: { select: { id: true, title: true } } } }),
    prisma.paper.groupBy({ by: ['status'], _count: true }),
  ])
  const count = (key: string) => counts.find((row) => row.status === key)?._count ?? 0
  return (
    <>
      <Notice message={searchParams.mesaj} />
      <h1 className="text-xl font-bold mb-2">Makaleler</h1>
      <p className="text-sm text-zinc-500 mb-4">
        Kaynaklardan çekilen ham makaleler. Günlük iş <b>Bekliyor</b> listesinden seçip yazıya dönüştürür; seçilmeyenler <b>Atlandı</b>&apos;ya,
        yazıya dönüşenler <b>Yazıldı</b>&apos;ya geçer. İstediğini elle de dönüştürebilir ya da aşağıya tek bir makale linki ekleyebilirsin.
      </p>
      <form action={addPaperAction} className="card mb-6 flex flex-col sm:flex-row gap-2">
        <input name="url" type="url" required placeholder="https://arxiv.org/abs/2510.12345 ya da herhangi bir makale/yazı linki" className="input" />
        <button className="btn-primary whitespace-nowrap">Ekle</button>
      </form>
      <nav className="flex flex-wrap gap-2 mb-4 text-sm">
        {Object.entries(STATUS).map(([key, label]) => (
          <Link key={key} href={`/admin/makaleler?durum=${key}`} className={key === status ? 'btn-primary' : 'btn'}>{label} · {count(key)}</Link>
        ))}
      </nav>
      {papers.length === 0 ? (
        <p className="text-sm text-stone-500">Bu listede makale yok.</p>
      ) : (
        <ul className="space-y-2">
          {papers.map((paper) => (
            <li key={paper.id} className="card text-sm">
              <a href={paper.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">{paper.title}</a>
              <p className="text-xs text-stone-500 mt-1">{paper.publishedAt.toLocaleDateString('tr-TR')}{paper.authors && ` · ${paper.authors.slice(0, 120)}`}</p>
              {paper.error && <p className="text-xs text-red-600 mt-1">{paper.error}</p>}
              <div className="flex gap-2 mt-2">
                {paper.post ? (
                  <Link href={`/admin/yazilar/${paper.post.id}`} className="btn">Yazıya git: {paper.post.title.slice(0, 60)}</Link>
                ) : (
                  <>
                    <form action={writePaperAction}><input type="hidden" name="id" value={paper.id} /><button className="btn-primary">Yazıya dönüştür</button></form>
                    {paper.status !== 'skipped' && <form action={skipPaperAction}><input type="hidden" name="id" value={paper.id} /><button className="btn">Atla</button></form>}
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
