import { prisma } from '@/lib/prisma'
import { addSourceAction, deleteSourceAction, toggleSourceAction } from '../../actions'
import { Notice } from '../../Notice'
import { ConfirmButton } from '../../ConfirmButton'

export default async function SourcesPage({ searchParams }: { searchParams: { mesaj?: string } }) {
  const sources = await prisma.source.findMany({ orderBy: { createdAt: 'asc' } })
  return (
    <>
      <Notice message={searchParams.mesaj} />
      <h1 className="text-xl font-bold mb-4">Kaynaklar <span className="text-sm font-normal text-zinc-500">· {sources.filter((source) => source.enabled).length} açık</span></h1>
      <details className="card mb-4 text-sm">
        <summary className="cursor-pointer font-medium">Hangi adresler eklenebilir?</summary>
        <div className="mt-2 text-stone-500 space-y-1">
          <p>İstediğin kadar kaynak ekleyebilirsin; her gün yeni makaleler çekilir. Kabul edilenler:</p>
          <ul className="list-disc pl-5">
            <li>arXiv kategori ya da arşiv sayfası: <code>https://arxiv.org/list/cs.AI/recent</code>, <code>https://arxiv.org/archive/astro-ph</code>, birden fazla: <code>https://arxiv.org/list/cs.AI+cs.LG/recent</code></li>
            <li>Herhangi bir sitenin RSS/Atom beslemesi (dergiler, bloglar): genelde sitedeki &quot;RSS&quot; ya da &quot;feed&quot; linki</li>
          </ul>
        </div>
      </details>
      <form action={addSourceAction} className="card mb-6 flex flex-col sm:flex-row gap-2">
        <input name="url" type="url" required placeholder="https://arxiv.org/archive/astro-ph ya da https://site.com/feed" className="input" />
        <button className="btn-primary whitespace-nowrap">Kaynak ekle</button>
      </form>
      {sources.length === 0 ? (
        <p className="text-sm text-stone-500">Henüz kaynak yok. Yukarıdan bir arXiv sayfası ya da RSS beslemesi ekle.</p>
      ) : (
        <ul className="space-y-2">
          {sources.map((source) => (
            <li key={source.id} className="card py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`rounded px-2 py-0.5 ${source.enabled ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300' : 'bg-zinc-100 text-zinc-600 dark:bg-white/5 dark:text-zinc-400'}`}>{source.enabled ? 'Açık' : 'Durduruldu'}</span>
                <span className="flex-1 text-stone-500">{source.lastFetchedAt ? `son tarama ${source.lastFetchedAt.toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}` : 'henüz taranmadı'}</span>
                <form action={toggleSourceAction}><input type="hidden" name="id" value={source.id} /><button className="btn btn-sm">{source.enabled ? 'Durdur' : 'Aç'}</button></form>
                <form action={deleteSourceAction}><input type="hidden" name="id" value={source.id} /><ConfirmButton question="Kaynak silinsin mi?" className="btn-danger btn-sm">Sil</ConfirmButton></form>
              </div>
              <p className={`mt-1.5 break-all ${source.enabled ? '' : 'line-through text-stone-500'}`}>{source.url}</p>
              {source.lastError && <p className="mt-1 text-xs text-red-600">{source.lastError}</p>}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
