import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Notice } from '../../Notice'
import { coverMissingAction, deleteDraftsAction, deletePostAction, featurePostAction } from '../../actions'
import { ConfirmButton } from '../../ConfirmButton'
import { BackTo, Pager, pageOf } from '../../Pager'
import { CATEGORIES, freeImage, topicLabel } from '@/lib/topics'
import { getSettings } from '@/lib/state'
import { formatScore } from '@/lib/text'

type Filters = { mesaj?: string; durum?: string; konu?: string; onem?: string; sira?: string; sayfa?: string }
const PAGE = 100

// Süzgeçler adreste (?durum=yayinda&konu=uzay&onem=7&sira=onem): sayfa yenilense de kalır, JavaScript gerekmez
export default async function PostsPage({ searchParams }: { searchParams: Filters }) {
  const status = { taslak: { status: 'draft' }, yayinda: { status: 'published' }, one: { featuredAt: { not: null } } }[searchParams.durum ?? ''] ?? {}
  const category = searchParams.konu === 'yok' ? '' : CATEGORIES[searchParams.konu ?? ''] ? searchParams.konu : undefined
  const minImportance = Math.min(10, Math.max(0, Number(searchParams.onem) || 0))
  const SORTS = {
    yeni: [{ createdAt: 'desc' }],
    eski: [{ createdAt: 'asc' }],
    onem: [{ importance: 'desc' }, { createdAt: 'desc' }],
    'onem-az': [{ importance: 'asc' }, { createdAt: 'desc' }],
  } as const
  const sort = searchParams.sira && Object.hasOwn(SORTS, searchParams.sira) ? (searchParams.sira as keyof typeof SORTS) : null
  const paper = { select: { title: true, url: true, imageUrl: true } }
  const where = { ...status, ...(category !== undefined ? { category } : {}), ...(minImportance ? { importance: { gte: minImportance * 10 } } : {}) }
  const total = await prisma.post.count({ where })
  const pages = Math.max(1, Math.ceil(total / PAGE))
  const page = pageOf(searchParams.sayfa, pages)
  // Süzgeçler sayfa değişince de, düğmelerden dönünce de kalsın
  const params = Object.fromEntries(Object.entries({ durum: searchParams.durum, konu: searchParams.konu, onem: searchParams.onem, sira: searchParams.sira }).filter((entry): entry is [string, string] => !!entry[1]))
  const here = `/admin/yazilar?${new URLSearchParams({ ...params, sayfa: String(page) })}`
  const [posts, published, { featureScore }] = await Promise.all([
    prisma.post.findMany({
      where,
      // Varsayılan: taslaklar üstte (onay bekleyenler), sonra en yeni
      orderBy: sort ? [...SORTS[sort]] : [{ status: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * PAGE,
      take: PAGE,
      include: { paper },
    }),
    prisma.post.findMany({ where: { status: 'published', image: '' }, select: { paper } }),
    getSettings(),
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
          <select name="sira" defaultValue={sort ?? ''} className="input">
            <option value="">Taslaklar üstte, sonra en yeni</option>
            <option value="yeni">En yeni önce</option>
            <option value="eski">En eski önce</option>
            <option value="onem">Önem puanı: yüksekten düşüğe</option>
            <option value="onem-az">Önem puanı: düşükten yükseğe</option>
          </select>
        </label>
        <button className="btn-primary">Uygula</button>
        {(filtered || sort) && <Link href="/admin/yazilar" className="btn">Temizle</Link>}
        <span className="ml-auto self-center text-stone-500">{`${total} yazı`}</span>
      </form>
      <p className="text-sm text-stone-500 mb-4">☆ ile yayındaki yazıyı ana sayfadaki Öne çıkanlara al (en fazla 10; yenisi eklenince en eskisi düşer). <span className="text-violet-700 dark:text-violet-300">Öneri</span> rozeti, yapay zekânın önem puanı {formatScore(featureScore)}/10 ve üstü olanlarda görünür (Ayarlar → Haberler).</p>
      <Pager path="/admin/yazilar" params={params} page={page} pages={pages} />
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
                  {post.importance > 0 && ` · önem ${formatScore(post.importance)}/10`}
                  {post.paper && ` · Kaynak: ${post.paper.title}`}
                </span>
              </Link>
              {post.importance >= featureScore && !post.featuredAt && <span className="text-xs rounded px-2 py-0.5 bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300">Öneri</span>}
              {post.status === 'published' && (
                <form action={featurePostAction}>
                  <input type="hidden" name="id" value={post.id} />
                  <BackTo href={here} />
                  <button className={`text-lg leading-none ${post.featuredAt ? 'text-violet-600' : 'text-stone-400 hover:text-violet-600'}`} title={post.featuredAt ? 'Öne çıkanlardan kaldır' : 'Öne çıkar'} aria-label={post.featuredAt ? 'Öne çıkanlardan kaldır' : 'Öne çıkar'}>{post.featuredAt ? '★' : '☆'}</button>
                </form>
              )}
              <span className="text-xs text-stone-500">{post.createdAt.toLocaleDateString('tr-TR')}</span>
              <form action={deletePostAction}>
                <input type="hidden" name="id" value={post.id} />
                <BackTo href={here} />
                <ConfirmButton question={`"${post.title}" silinsin mi?`} className="text-stone-400 hover:text-red-600 text-lg leading-none"><span aria-hidden>×</span><span className="sr-only">Sil</span></ConfirmButton>
              </form>
            </li>
          ))}
        </ul>
      )}
      <Pager path="/admin/yazilar" params={params} page={page} pages={pages} />
    </>
  )
}
