import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { deletePostAction, featurePostAction, postToDigestAction, publishPostAction, rewritePostAction, savePostAction } from '../../../actions'
import { Notice } from '../../../Notice'
import { ConfirmButton } from '../../../ConfirmButton'
import { CATEGORIES } from '@/lib/topics'
import { FEATURE_SUGGESTION } from '@/lib/writer'

export default async function EditPostPage({ params, searchParams }: { params: { id: string }; searchParams: { mesaj?: string } }) {
  const post = await prisma.post.findUnique({ where: { id: Number(params.id) || 0 }, include: { paper: true } })
  if (!post) notFound()
  const published = post.status === 'published'
  return (
    <>
      <Notice message={searchParams.mesaj} />
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <h1 className="text-xl font-bold flex-1">{published ? 'Yayındaki yazı' : 'Taslak'}</h1>
        <a href={`/yazi/${post.slug}`} className="btn" target="_blank">Önizle</a>
        <form action={publishPostAction}><input type="hidden" name="id" value={post.id} /><button className={published ? 'btn' : 'btn-primary'}>{published ? 'Yayından kaldır' : 'Yayımla'}</button></form>
        {published && <form action={featurePostAction}><input type="hidden" name="id" value={post.id} /><button className="btn">{post.featuredAt ? '★ Öne çıkanlardan kaldır' : '☆ Öne çıkar'}</button></form>}
        {published && <form action={postToDigestAction}><input type="hidden" name="id" value={post.id} /><button className="btn">Abonelere gönder…</button></form>}
        {post.paperId && <form action={rewritePostAction}><input type="hidden" name="id" value={post.id} /><ConfirmButton question="Yazı aynı makaleden yapay zekâyla baştan yazılsın mı? Elle yaptığın düzenlemeler kaybolur." className="btn">Yapay zekâyla yeniden yaz</ConfirmButton></form>}
        <form action={deletePostAction}><input type="hidden" name="id" value={post.id} /><ConfirmButton question="Yazı silinsin mi?" className="btn-danger">Sil</ConfirmButton></form>
      </div>
      {post.paper && <p className="text-sm text-stone-500 mb-2">Kaynak: <a href={post.paper.url} className="underline" target="_blank" rel="noopener noreferrer">{post.paper.title}</a> · {post.inputTokens + post.outputTokens} token</p>}
      {post.importance > 0 && (
        <p className="text-sm mb-4">
          Yapay zekânın önem puanı: <strong>{post.importance}/10</strong>
          {post.importance >= FEATURE_SUGGESTION && !post.featuredAt && <span className="ml-2 rounded bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300 px-2 py-0.5 text-xs">Öne çıkarılması öneriliyor</span>}
        </p>
      )}
      <form action={savePostAction} className="space-y-4">
        <input type="hidden" name="id" value={post.id} />
        <div>
          <label className="label" htmlFor="title">Başlık</label>
          <input id="title" name="title" defaultValue={post.title} className="input" required />
        </div>
        <div>
          <label className="label" htmlFor="category">Konu</label>
          <select id="category" name="category" defaultValue={post.category} className="input">
            <option value="">Belirsiz (yalnızca &quot;Tümü&quot; sekmesinde)</option>
            {Object.entries(CATEGORIES).map(([key, c]) => <option key={key} value={key}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="excerpt">Kısa gelişme metni</label>
          <textarea id="excerpt" name="excerpt" defaultValue={post.excerpt} rows={2} className="input" />
          <p className="hint">1-2 cümle, haber dilinde. Sitenin başındaki &quot;Yeni gelişmeler&quot; bölümünde ve bültende görünür.</p>
        </div>
        <div>
          <label className="label" htmlFor="highlights">Kısaca (her satır bir madde)</label>
          <textarea id="highlights" name="highlights" defaultValue={post.highlights} rows={3} className="input" />
          <p className="hint">Yazının başındaki özet kutusu. Boş bırakılırsa kutu görünmez.</p>
        </div>
        <div>
          <label className="label" htmlFor="body">Gövde (Markdown)</label>
          <textarea id="body" name="body" defaultValue={post.body} rows={24} className="input font-mono" required />
          <p className="hint">## başlık, - liste, &gt; öne çıkan bulgu, **kalın**, *italik*, [metin](https://link)</p>
        </div>
        <button className="btn-primary">Kaydet</button>
      </form>
    </>
  )
}
