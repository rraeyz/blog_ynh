'use client'
import { usePathname } from 'next/navigation'

// Ortak düzendeki bir parçayı bazı sayfalarda gizler (ör. haber konuları eğitim sayfalarında anlamsız)
export function HideOn({ prefix, children }: { prefix: string; children: React.ReactNode }) {
  return usePathname().startsWith(prefix) ? null : children
}
