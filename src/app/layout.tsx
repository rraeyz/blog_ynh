import type { Metadata } from 'next'
import { getSettings } from '@/lib/state'
import './globals.css'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings()
  return {
    title: { default: settings.siteTitle, template: `%s · ${settings.siteTitle}` },
    description: settings.siteDescription,
    alternates: { types: { 'application/rss+xml': '/rss.xml' } },
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  )
}
