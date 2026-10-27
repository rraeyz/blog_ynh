import Link from 'next/link'
import { getSettings } from '@/lib/state'

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings()
  const subscribeUrl = settings.kunyeUrl.trim()
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <header className="mb-10">
        <Link href="/" className="text-2xl font-bold">{settings.siteTitle}</Link>
        <p className="text-stone-500 mt-1">{settings.siteDescription}</p>
        <nav className="mt-3 flex gap-4 text-sm">
          <a href="/rss.xml" className="underline">RSS</a>
          {subscribeUrl && <a href={subscribeUrl} className="underline">Haftalık bültene abone ol</a>}
        </nav>
      </header>
      <main>{children}</main>
    </div>
  )
}
