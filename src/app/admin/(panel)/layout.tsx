import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ThemeToggle } from '../../ThemeToggle'
import { logoutAction } from '../actions'
import { BottomNav, TopNav } from './AdminNav'

// Menüdeki rozetler: o bölümde senin bakmanı bekleyen işler
async function badges(): Promise<Record<string, number>> {
  const [posts, digests, lessons, suggestions, reports, concepts] = await Promise.all([
    prisma.post.count({ where: { status: 'draft' } }),
    prisma.digest.count({ where: { status: 'draft' } }),
    prisma.lesson.count({ where: { status: { in: ['draft', 'failed'] } } }),
    prisma.suggestion.count(),
    prisma.lessonReport.count(),
    prisma.stage.count({ where: { approved: false } }),
  ])
  return { '/admin/yazilar': posts, '/admin/bultenler': digests, '/admin/egitim': lessons + suggestions + reports + concepts }
}

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  const counts = await badges()
  const extra = (
    <>
      <a href="/" className="btn">Siteyi aç</a>
      <form action={logoutAction}><button className="btn">Çıkış</button></form>
    </>
  )
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-zinc-200/70 dark:border-ink-line bg-paper/80 dark:bg-ink/75 backdrop-blur-xl">
        <div className="mx-auto max-w-5xl px-4 py-2.5 flex items-center gap-2">
          <Link href="/admin" className="flex items-center gap-2 font-display font-semibold mr-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" width={24} height={24} className="rounded-md" />
            Panel
          </Link>
          <TopNav badges={counts} />
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <div className="hidden lg:flex items-center gap-2">{extra}</div>
          </div>
        </div>
      </header>
      {/* Telefonda alttaki menü içeriği örtmesin */}
      <div className="mx-auto max-w-5xl px-4 pt-6 pb-28 lg:py-8">{children}</div>
      <BottomNav badges={counts} extra={extra} />
    </div>
  )
}
