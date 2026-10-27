import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Notice } from '../../Notice'
import { deleteDraftsAction, deletePostAction, featurePostAction } from '../../actions'
import { ConfirmButton } from '../../ConfirmButton'
import { topicLabel } from '@/lib/topics'
import { FEATURE_SUGGESTION } from '@/lib/writer'

export default async function PostsPage({ searchParams }: { searchParams: { mesaj?: string } }) {
  const posts = await prisma.post.findMany({ orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], take: 200, include: { paper: { select: { title: true } } } })
  return (
    <>
      <Notice message={searchParams.mesaj} />
      <div className="flex items-center gap-2 mb-1">
        <h1 className="text-xl font-bold flex-1">Yazılar</h1>
        {posts.some((post) => post.status === 'draft') && (
          <form action={deleteDraftsAction}><ConfirmButton question="Bütün taslaklar silinsin mi? Yayındaki yazılara dokunulmaz." className="btn">Taslakları sil</ConfirmButton></form>
        )}
      </div>
      <p className="text-sm text-stone-500 mb-4">☆ ile yayındaki yazıyı ana sayfadaki Öne çıkanlara al (en fazla 10; yenisi eklenince en eskisi düşer). <span className="text-violet-700 dark:text-violet-300">Öneri</span> rozeti, yapay zekânın önem puanı {FEATURE_SUGGESTION}/10 ve üstü olanlarda görünür.</p>
      {posts.length === 0 ? (
        <p className="text-sm text-stone-500">Henüz yazı yok. Makaleler sayfasından bir makaleyi yazıya dönüştür ya da Genel&apos;den günlük işi çalıştır.</p>
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
