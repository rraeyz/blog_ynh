import type { MetadataRoute } from 'next'
import { getSettings } from '@/lib/state'

export const dynamic = 'force-dynamic'

// Telefona "uygulama" olarak kurulabilsin (Ana ekrana ekle); Play Store paketi (TWA) de bunu kullanır
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await getSettings()
  return {
    name: settings.siteTitle,
    short_name: settings.siteTitle,
    description: settings.siteDescription,
    lang: 'tr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#07070c',
    theme_color: '#07070c',
    icons: [
      { src: '/simge/simge-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/simge/simge-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/simge/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
