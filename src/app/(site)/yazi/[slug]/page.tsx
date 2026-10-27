import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/auth'
import { renderMarkdown } from '@/lib/markdown'

// Taslak yazıyı yalnızca giriş yapmış yönetici görebilir (önizleme)
async function findPost(slug: string) {
  const post = await prisma.post.findUnique({ where: { slug }, include: { paper: true } })
  if (!post || (post.status !== 'published' && !(await isAdmin()))) return null
  return post
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await findPost(params.slug)
  return post ? { title: post.title, description: post.excerpt } : {}
}

export default async function PostPage({ params }: { params: { slug: string } }) {
  const post = await findPost(params.slug)
  if (!post) notFound()
  return (
    <article>
      {post.status !== 'published' && <p className="mb-4 rounded-lg bg-amber-100 dark:bg-amber-950 px-3 py-2 text-sm">Taslak önizlemesi: yayımlanmadı.</p>}
      <time className="text-xs text-stone-500">{(post.publishedAt ?? post.createdAt).toLocaleDateString('tr-TR', { dateStyle: 'long' })}</time>
      <h1 className="text-3xl font-bold mt-1 mb-6">{post.title}</h1>
      <div className="prose-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(post.body) }} />
      {post.paper && (
        <aside className="mt-10 card text-sm">
          <p className="font-medium">Kaynak makale</p>
          <a href={post.paper.url} className="underline break-words" rel="noopener noreferrer" target="_blank">{post.paper.title}</a>
          {post.paper.authors && <p className="text-stone-500 mt-1">{post.paper.authors}</p>}
          <p className="text-stone-500 mt-2">Bu yazı yapay zekâ yardımıyla hazırlandı; ayrıntılar ve kesin sonuçlar için kaynak makaleye bakın.</p>
        </aside>
      )}
    </article>
  )
}
