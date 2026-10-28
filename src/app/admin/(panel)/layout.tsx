import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { logoutAction } from '../actions'

const NAV = [
  ['/admin', 'Genel'],
  ['/admin/yazilar', 'Yazılar'],
  ['/admin/makaleler', 'Makaleler'],
  ['/admin/kaynaklar', 'Kaynaklar'],
  ['/admin/bultenler', 'Bültenler'],
  ['/admin/egitim', 'Eğitim'],
  ['/admin/ayarlar', 'Ayarlar'],
]

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-zinc-200/70 dark:border-ink-line bg-paper/80 dark:bg-ink/75 backdrop-blur-xl">
        <div className="mx-auto max-w-5xl px-4 py-3 flex flex-wrap items-center gap-2">
          <Link href="/admin" className="flex items-center gap-2 font-display font-semibold mr-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" width={24} height={24} className="rounded-md" />
            Panel
          </Link>
          <nav className="flex flex-wrap gap-1 text-sm">
            {NAV.map(([href, label]) => <Link key={href} href={href} className="rounded-full px-3 py-1.5 hover:bg-zinc-200/60 dark:hover:bg-white/5">{label}</Link>)}
          </nav>
          <div className="ml-auto flex gap-2">
            <a href="/" className="btn">Siteyi aç</a>
            <form action={logoutAction}><button className="btn">Çıkış</button></form>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-8">{children}</div>
    </div>
  )
}
