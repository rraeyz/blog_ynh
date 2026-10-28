'use client'
import { usePathname } from 'next/navigation'

// Ortak düzendeki bir parçayı bazı sayfalarda gizler (ör. haber konuları eğitim ve gökyüzü sayfalarında anlamsız)
export function HideOn({ prefixes, children }: { prefixes: string[]; children: React.ReactNode }) {
  const path = usePathname()
  return prefixes.some((prefix) => path.startsWith(prefix)) ? null : children
}
