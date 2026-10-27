import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { CATEGORIES } from '@/lib/topics'
import { Archive, coverStyle, PAGE_SIZE, PAPER_FIELDS } from '../../parts'

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const topic = CATEGORIES[params.slug]
  return topic ? { title: topic.label, description: `${topic.label}: ${topic.hint}` } : {}
}

// Tek bir konunun yazıları (Uzay, Sağlık...): üst menüdeki konu bağlantılarından açılır
export default async function TopicPage({ params, searchParams }: { params: { slug: string }; searchParams: { sayfa?: string } }) {
  const topic = CATEGORIES[params.slug]
  if (!topic) notFound()
  const page = Math.max(1, Number(searchParams.sayfa) || 1)
  const where = { status: 'published', category: params.slug }
  const [posts, count] = await Promise.all([
    prisma.post.findMany({ where, orderBy: { publishedAt: 'desc' }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE + 1, include: { paper: PAPER_FIELDS } }),
    prisma.post.count({ where }),
  ])
  return (
    <div className="mx-auto max-w-5xl px-4">
      <header className="mt-8 overflow-hidden rounded-3xl p-7 md:p-10 text-white" style={coverStyle(params.slug, params.slug)}>
        <p className="text-sm text-white/75">Konu</p>
        <h1 className="mt-1 text-4xl md:text-5xl font-semibold">{topic.label}</h1>
        <p className="mt-3 text-white/85 first-letter:uppercase">{topic.hint}</p>
        <p className="mt-4 text-sm text-white/70">{count} yazı</p>
      </header>
      <Archive posts={posts} page={page} href={(p) => `/konu/${params.slug}?sayfa=${p}`} empty="Bu konuda henüz yazı yok." />
    </div>
  )
}
