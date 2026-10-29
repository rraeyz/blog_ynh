import type { Metadata } from 'next'

// Panel arama motorlarına kapalı: robots.txt'de adını yazmak yerine her sayfada "noindex" (adres herkese ilan edilmesin)
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children
}
