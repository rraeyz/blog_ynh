import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Notice } from '../../Notice'

export default async function PostsPage({ searchParams }: { searchParams: { mesaj?: string } }) {
  const posts = await prisma.post.findMany({ orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], take: 200, include: { paper: { select: { title: true } } } })
  return (
    <>
      <Notice message={searchParams.mesaj} />
      <h1 className="text-xl font-bold mb-4">Yazılar</h1>
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
                {post.paper && <span className="block truncate text-xs text-zinc-500">Kaynak: {post.paper.title}</span>}
              </Link>
              <span className="text-xs text-stone-500">{post.createdAt.toLocaleDateString('tr-TR')}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
