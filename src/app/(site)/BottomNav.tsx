'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

// Simgeler tek çizgi yolu (24×24): bağımlılık eklememek için
const ITEMS = [
  { href: '/', label: 'Haberler', icon: 'M4 5h13v14H6a2 2 0 0 1-2-2zM17 9h3v8a2 2 0 0 1-2 2M8 9h5M8 13h5M8 16h3', match: (p: string) => p === '/' || p.startsWith('/yazi') || p.startsWith('/konu') },
  { href: '/egitim', label: 'Eğitim', icon: 'M3 8l9-4 9 4-9 4zM7 10v5c3 2 7 2 10 0v-5', match: (p: string) => p.startsWith('/egitim') },
  { href: '/gokyuzu', label: 'Gökyüzü', icon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5zM17 3v4M15 5h4', match: (p: string) => p.startsWith('/gokyuzu') },
  { href: '/astronomi-ozeti', label: 'Haftalık', icon: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h3', match: (p: string) => p.startsWith('/astronomi-ozeti') },
]

// Telefonda alt menü (geniş ekranda üstteki menü). Okurken yer kaplamasın: aşağı kaydırınca gizlenir, yukarı kaydırınca gelir
export function BottomNav({ sky }: { sky: boolean }) {
  const path = usePathname()
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    let last = window.scrollY
    const update = () => {
      const y = window.scrollY
      if (Math.abs(y - last) < 8) return
      setHidden(y > last && y > 80)
      last = y
    }
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])
  useEffect(() => setHidden(false), [path])
  return (
    <nav aria-label="Alt menü" className={`md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-zinc-200/70 dark:border-ink-line bg-paper/95 dark:bg-ink/95 backdrop-blur-xl pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5 transition-transform duration-300 ${hidden ? 'translate-y-full' : ''}`}>
      <div className="mx-auto flex max-w-md items-stretch justify-around">
        {ITEMS.filter((item) => sky || item.href !== '/gokyuzu').map((item) => {
          const on = item.match(path)
          return (
            <Link key={item.href} href={item.href} aria-current={on ? 'page' : undefined} className={`flex min-w-16 flex-col items-center gap-1 py-1 text-[11px] font-medium ${on ? 'text-violet-600 dark:text-violet-300' : 'text-zinc-500'}`}>
              <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={item.icon} /></svg>
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
