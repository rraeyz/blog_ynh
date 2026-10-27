import Link from 'next/link'
import { prisma } from '@/lib/prisma'

const PAGE_SIZE = 20

export default async function HomePage({ searchParams }: { searchParams: { sayfa?: string } }) {
  const page = Math.max(1, Number(searchParams.sayfa) || 1)
  const posts = await prisma.post.findMany({
    where: { status: 'published' },
    orderBy: { publishedAt: 'desc' },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE + 1,
  })
  if (posts.length === 0 && page === 1) return <p className="text-stone-500">Henüz yazı yok.</p>
  return (
    <>
      <ul className="space-y-8">
        {posts.slice(0, PAGE_SIZE).map((post) => (
          <li key={post.id}>
            <time className="text-xs text-stone-500">{post.publishedAt?.toLocaleDateString('tr-TR', { dateStyle: 'long' })}</time>
            <h2 className="text-lg font-semibold"><Link href={`/yazi/${post.slug}`} className="hover:underline">{post.title}</Link></h2>
            {post.excerpt && <p className="text-stone-600 dark:text-stone-400 mt-1">{post.excerpt}</p>}
          </li>
        ))}
      </ul>
      <nav className="mt-10 flex justify-between text-sm">
        {page > 1 ? <Link href={`/?sayfa=${page - 1}`} className="underline">← Daha yeni</Link> : <span />}
        {posts.length > PAGE_SIZE && <Link href={`/?sayfa=${page + 1}`} className="underline">Daha eski →</Link>}
      </nav>
    </>
  )
}
