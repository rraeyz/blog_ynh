'use client'
import { useEffect, useState } from 'react'

type Theme = 'auto' | 'light' | 'dark'
const NEXT: Record<Theme, Theme> = { auto: 'light', light: 'dark', dark: 'auto' }
const LABEL: Record<Theme, string> = { auto: 'Tema: Otomatik (cihaza göre)', light: 'Tema: Açık', dark: 'Tema: Koyu' }

// Sağ üstteki tema düğmesi: Otomatik → Açık → Koyu. Seçim tarayıcıda (localStorage "tema"), site ve panel ortak.
// Sınıfı sayfa açılırken layout.tsx'teki betik uygular; burada yalnızca düğmeyle değişir
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('auto')
  useEffect(() => {
    const root = document.documentElement
    setTheme(root.classList.contains('dark') ? 'dark' : root.classList.contains('light') ? 'light' : 'auto')
  }, [])
  const change = () => {
    const next = NEXT[theme]
    document.documentElement.classList.remove('light', 'dark')
    if (next !== 'auto') document.documentElement.classList.add(next)
    try {
      if (next === 'auto') localStorage.removeItem('tema')
      else localStorage.setItem('tema', next)
    } catch {
      // Gizli sekme vb.: seçim yalnızca bu sayfada geçerli
    }
    setTheme(next)
  }
  return (
    <button type="button" onClick={change} aria-label={LABEL[theme]} title={LABEL[theme]} className="rounded-full p-1.5 sm:p-2 hover:bg-zinc-200/60 dark:hover:bg-white/5">
      <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        {theme === 'light' && <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>}
        {theme === 'dark' && <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />}
        {theme === 'auto' && <><circle cx="12" cy="12" r="8" /><path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" /></>}
      </svg>
    </button>
  )
}
