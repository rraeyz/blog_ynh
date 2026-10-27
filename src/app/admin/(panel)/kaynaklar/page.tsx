import { prisma } from '@/lib/prisma'
import { addSourceAction, deleteSourceAction, toggleSourceAction } from '../../actions'
import { Notice } from '../../Notice'
import { ConfirmButton } from '../../ConfirmButton'

export default async function SourcesPage({ searchParams }: { searchParams: { mesaj?: string } }) {
  const sources = await prisma.source.findMany({ orderBy: { createdAt: 'asc' } })
  return (
    <>
      <Notice message={searchParams.mesaj} />
      <h1 className="text-xl font-bold mb-2">Kaynaklar</h1>
      <p className="text-sm text-stone-500 mb-4">
        arXiv&apos;te kategori sayfasını aç ve linkini buraya yapıştır, örn. <code>https://arxiv.org/list/cs.AI/recent</code>.
        Birden fazla kategori: <code>https://arxiv.org/list/cs.AI+cs.LG/recent</code>. Her gün yeni makaleler çekilir.
      </p>
      <form action={addSourceAction} className="card mb-6 flex flex-col sm:flex-row gap-2">
        <input name="url" type="url" required placeholder="https://arxiv.org/list/cs.AI/recent" className="input" />
        <button className="btn-primary whitespace-nowrap">Kaynak ekle</button>
      </form>
      <ul className="space-y-2">
        {sources.map((source) => (
          <li key={source.id} className="card text-sm flex flex-wrap items-center gap-2">
            <span className={`flex-1 break-all ${source.enabled ? '' : 'line-through text-stone-500'}`}>{source.url}</span>
            <span className="text-xs text-stone-500">{source.lastFetchedAt ? `son tarama ${source.lastFetchedAt.toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}` : 'henüz taranmadı'}</span>
            <form action={toggleSourceAction}><input type="hidden" name="id" value={source.id} /><button className="btn">{source.enabled ? 'Durdur' : 'Aç'}</button></form>
            <form action={deleteSourceAction}><input type="hidden" name="id" value={source.id} /><ConfirmButton question="Kaynak silinsin mi?" className="btn-danger">Sil</ConfirmButton></form>
            {source.lastError && <p className="w-full text-xs text-red-600">{source.lastError}</p>}
          </li>
        ))}
      </ul>
    </>
  )
}
