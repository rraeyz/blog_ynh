import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Notice } from '../../Notice'
import { coverMissingAction, deleteDraftsAction, deletePostAction, featurePostAction } from '../../actions'
import { ConfirmButton } from '../../ConfirmButton'
import { CATEGORIES, freeImage, topicLabel } from '@/lib/topics'
import { FEATURE_SUGGESTION } from '@/lib/writer'

type Filters = { mesaj?: string; durum?: string; konu?: string; onem?: string; sira?: string }

// Süzgeçler adreste (?durum=yayinda&konu=uzay&onem=7&sira=onem): sayfa yenilense de kalır, JavaScript gerekmez
export default async function PostsPage({ searchParams }: { searchParams: Filters }) {
  const status = { taslak: { status: 'draft' }, yayinda: { status: 'published' }, one: { featuredAt: { not: null } } }[searchParams.durum ?? ''] ?? {}
  const category = searchParams.konu === 'yok' ? '' : CATEGORIES[searchParams.konu ?? ''] ? searchParams.konu : undefined
  const minImportance = Math.min(10, Math.max(0, Number(searchParams.onem) || 0))
  const byImportance = searchParams.sira === 'onem'
  const paper = { select: { title: true, url: true, imageUrl: true } }
  const [posts, published] = await Promise.all([
    prisma.post.findMany({
      where: { ...status, ...(category !== undefined ? { category } : {}), ...(minImportance ? { importance: { gte: minImportance } } : {}) },
      orderBy: byImportance ? [{ importance: 'desc' }, { createdAt: 'desc' }] : [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 200,
      include: { paper },
    }),
    prisma.post.findMany({ where: { status: 'published', image: '' }, select: { paper } }),
  ])
  const coverless = published.filter((post) => !freeImage(post.paper)).length
  const filtered = !!(searchParams.durum || category !== undefined || minImportance)
  return (
    <>
      <Notice message={searchParams.mesaj} />
      <div className="flex items-center gap-2 mb-1">
        <h1 className="text-xl font-bold flex-1">Yazılar</h1>
        {coverless > 0 && (
          <form action={coverMissingAction}><ConfirmButton question={`Kapağı olmayan ${coverless} yayındaki yazıya yapay zekâyla kapak çizilsin mi? (yazı başına ~0,01 $)`} className="btn">{`Eksik kapakları çiz (${coverless})`}</ConfirmButton></form>
        )}
        {posts.some((post) => post.status === 'draft') && (
          <form action={deleteDraftsAction}><ConfirmButton question="Bütün taslaklar silinsin mi? Yayındaki yazılara dokunulmaz." className="btn">Taslakları sil</ConfirmButton></form>
        )}
      </div>
      <form className="card mb-4 flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">Durum
          <select name="durum" defaultValue={searchParams.durum ?? ''} className="input">
            <option value="">Hepsi</option><option value="yayinda">Yayında</option><option value="taslak">Taslak</option><option value="one">Öne çıkanlar</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">Konu
          <select name="konu" defaultValue={searchParams.konu ?? ''} className="input">
            <option value="">Hepsi</option>
            {Object.entries(CATEGORIES).map(([key, c]) => <option key={key} value={key}>{c.label}</option>)}
            <option value="yok">Konu yok</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">En az önem
          <select name="onem" defaultValue={String(minImportance || '')} className="input">
            <option value="">Hepsi</option>
            {[5, 6, 7, 8, 9].map((n) => <option key={n} value={n}>{`${n}/10 ve üstü`}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">Sıralama
          <select name="sira" defaultValue={byImportance ? 'onem' : ''} className="input">
            <option value="">En yeni önce</option><option value="onem">En önemli önce</option>
          </select>
        </label>
        <button className="btn-primary">Uygula</button>
        {(filtered || byImportance) && <Link href="/admin/yazilar" className="btn">Temizle</Link>}
        <span className="ml-auto self-center text-stone-500">{`${posts.length} yazı`}</span>
      </form>
      <p className="text-sm text-stone-500 mb-4">☆ ile yayındaki yazıyı ana sayfadaki Öne çıkanlara al (en fazla 10; yenisi eklenince en eskisi düşer). <span className="text-violet-700 dark:text-violet-300">Öneri</span> rozeti, yapay zekânın önem puanı {FEATURE_SUGGESTION}/10 ve üstü olanlarda görünür.</p>
      {posts.length === 0 ? (
        <p className="text-sm text-stone-500">{filtered ? 'Bu süzgece uyan yazı yok.' : <>Henüz yazı yok. Makaleler sayfasından bir makaleyi yazıya dönüştür ya da Genel&apos;den günlük işi çalıştır.</>}</p>
      ) : (
        <ul className="space-y-2">
          {posts.map((post) => (
            <li key={post.id} className="card flex items-center gap-3">
              <span className={`text-xs rounded px-2 py-0.5 ${post.status === 'published' ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'}`}>
                {post.status === 'published' ? 'Yayında' : 'Taslak'}
              </span>
              <Link href={`/admin/yazilar/${post.id}`} className="flex-1 min-w-0 hover:underline">
                {post.title}
                <span className="block truncate text-xs text-zinc-500">
                  {post.category ? topicLabel(post.category) : 'Konu yok'}
                  {post.importance > 0 && ` · önem ${post.importance}/10`}
                  {post.paper && ` · Kaynak: ${post.paper.title}`}
                </span>
              </Link>
              {post.importance >= FEATURE_SUGGESTION && !post.featuredAt && <span className="text-xs rounded px-2 py-0.5 bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300">Öneri</span>}
              {post.status === 'published' && (
                <form action={featurePostAction}>
                  <input type="hidden" name="id" value={post.id} />
                  <input type="hidden" name="from" value="list" />
                  <button className={`text-lg leading-none ${post.featuredAt ? 'text-violet-600' : 'text-stone-400 hover:text-violet-600'}`} title={post.featuredAt ? 'Öne çıkanlardan kaldır' : 'Öne çıkar'} aria-label={post.featuredAt ? 'Öne çıkanlardan kaldır' : 'Öne çıkar'}>{post.featuredAt ? '★' : '☆'}</button>
                </form>
              )}
              <span className="text-xs text-stone-500">{post.createdAt.toLocaleDateString('tr-TR')}</span>
              <form action={deletePostAction}>
                <input type="hidden" name="id" value={post.id} />
                <ConfirmButton question={`"${post.title}" silinsin mi?`} className="text-stone-400 hover:text-red-600 text-lg leading-none"><span aria-hidden>×</span><span className="sr-only">Sil</span></ConfirmButton>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
