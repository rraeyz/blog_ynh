import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { addPaperAction, skipPaperAction, writePaperAction } from '../../actions'
import { Notice } from '../../Notice'

const STATUS: Record<string, string> = { new: 'Bekliyor', failed: 'Hata', skipped: 'Atlandı', written: 'Yazıldı' }

export default async function PapersPage({ searchParams }: { searchParams: { mesaj?: string; durum?: string } }) {
  const status = STATUS[searchParams.durum ?? ''] ? searchParams.durum! : 'new'
  const papers = await prisma.paper.findMany({ where: { status }, orderBy: { publishedAt: 'desc' }, take: 100, include: { post: { select: { id: true } } } })
  return (
    <>
      <Notice message={searchParams.mesaj} />
      <h1 className="text-xl font-bold mb-4">Makaleler</h1>
      <form action={addPaperAction} className="card mb-6 flex flex-col sm:flex-row gap-2">
        <input name="url" type="url" required placeholder="https://arxiv.org/abs/2510.12345 ya da herhangi bir makale/yazı linki" className="input" />
        <button className="btn-primary whitespace-nowrap">Ekle</button>
      </form>
      <nav className="flex gap-2 mb-4 text-sm">
        {Object.entries(STATUS).map(([key, label]) => (
          <Link key={key} href={`/admin/makaleler?durum=${key}`} className={key === status ? 'btn-primary' : 'btn'}>{label}</Link>
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
                  <Link href={`/admin/yazilar/${paper.post.id}`} className="btn">Yazıya git</Link>
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
