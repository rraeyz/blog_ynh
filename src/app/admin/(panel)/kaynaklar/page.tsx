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
      <div className="text-sm text-stone-500 mb-4 space-y-1">
        <p>İstediğin kadar kaynak ekleyebilirsin; her gün yeni makaleler çekilir. Kabul edilenler:</p>
        <ul className="list-disc pl-5">
          <li>arXiv kategori ya da arşiv sayfası: <code>https://arxiv.org/list/cs.AI/recent</code>, <code>https://arxiv.org/archive/astro-ph</code>, birden fazla: <code>https://arxiv.org/list/cs.AI+cs.LG/recent</code></li>
          <li>Herhangi bir sitenin RSS/Atom beslemesi (dergiler, bloglar): genelde sitedeki &quot;RSS&quot; ya da &quot;feed&quot; linki</li>
        </ul>
      </div>
      <form action={addSourceAction} className="card mb-6 flex flex-col sm:flex-row gap-2">
        <input name="url" type="url" required placeholder="https://arxiv.org/archive/astro-ph ya da https://site.com/feed" className="input" />
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
