import type { Metadata } from 'next'
import { getSettings } from '@/lib/state'
import '@fontsource-variable/sora'
import './globals.css'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings()
  return {
    metadataBase: settings.siteUrl ? new URL(settings.siteUrl) : undefined,
    title: { default: settings.siteTitle, template: `%s · ${settings.siteTitle}` },
    description: settings.siteDescription,
    alternates: { types: { 'application/rss+xml': '/rss.xml' } },
    openGraph: { siteName: settings.siteTitle, locale: 'tr_TR', type: 'website', title: settings.siteTitle, description: settings.siteDescription },
    twitter: { card: 'summary_large_image' },
  }
}

// Okurun seçtiği tema boyanmadan önce uygulanır (yoksa sayfa bir an cihazın temasıyla görünür); ThemeToggle.tsx
const THEME_SCRIPT = `try{var t=localStorage.getItem('tema');if(t==='light'||t==='dark')document.documentElement.classList.add(t)}catch(e){}`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
