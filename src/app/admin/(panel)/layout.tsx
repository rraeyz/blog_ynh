import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { logoutAction } from '../actions'

const NAV = [
  ['/admin', 'Genel'],
  ['/admin/yazilar', 'Yazılar'],
  ['/admin/makaleler', 'Makaleler'],
  ['/admin/kaynaklar', 'Kaynaklar'],
  ['/admin/bultenler', 'Bültenler'],
  ['/admin/ayarlar', 'Ayarlar'],
]

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <nav className="flex flex-wrap items-center gap-2 mb-8 text-sm">
        {NAV.map(([href, label]) => <Link key={href} href={href} className="btn">{label}</Link>)}
        <a href="/" className="btn ml-auto">Siteyi aç</a>
        <form action={logoutAction}><button className="btn">Çıkış</button></form>
      </nav>
      {children}
    </div>
  )
}
