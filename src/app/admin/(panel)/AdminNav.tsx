'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

type Item = { href: string; label: string; icon: string }

// Simgeler tek çizgi yolu (24×24): bağımlılık eklememek için
const ITEMS: Item[] = [
  { href: '/admin', label: 'Genel', icon: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z' },
  { href: '/admin/yazilar', label: 'Yazılar', icon: 'M5 4h14v16H5zM8 8h8M8 12h8M8 16h5' },
  { href: '/admin/egitim', label: 'Eğitim', icon: 'M3 8l9-4 9 4-9 4zM7 10v5c3 2 7 2 10 0v-5' },
  { href: '/admin/makaleler', label: 'Makaleler', icon: 'M4 5h16v14H4zM4 9h16M9 9v10' },
  { href: '/admin/kaynaklar', label: 'Kaynaklar', icon: 'M5 19a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16' },
  { href: '/admin/bultenler', label: 'Bültenler', icon: 'M4 6h16v12H4zM4 7l8 6 8-6' },
  { href: '/admin/ayarlar', label: 'Ayarlar', icon: 'M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4' },
]
const PRIMARY = 4 // telefonda altta görünenler; gerisi "Daha fazla"da

const Icon = ({ d }: { d: string }) => (
  <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
)

const Badge = ({ count }: { count?: number }) =>
  count ? <span className="min-w-5 rounded-full bg-amber-500 px-1.5 text-center text-[11px] font-semibold leading-5 text-white">{count > 99 ? '99+' : count}</span> : null

const active = (path: string, href: string) => (href === '/admin' ? path === '/admin' : path.startsWith(href))

// Bölüm menüsü geniş ekranda üstte. Rozet: o bölümde seni bekleyen iş sayısı
export function TopNav({ badges }: { badges: Record<string, number> }) {
  const path = usePathname()
  return (
      <nav aria-label="Bölümler" className="hidden lg:flex flex-wrap gap-1 text-sm">
        {ITEMS.map((item) => {
          const on = active(path, item.href)
          return (
            <Link key={item.href} href={item.href} aria-current={on ? 'page' : undefined} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 ${on ? 'bg-violet-600 text-white' : 'hover:bg-zinc-200/60 dark:hover:bg-white/5'}`}>
              {item.label}<Badge count={badges[item.href]} />
            </Link>
          )
        })}
      </nav>
  )
}

// Telefonda altta (Künye panelindeki gibi). Başlığın dışında durmalı: başlığın bulanık arka planı sabit konumu bozar
export function BottomNav({ badges, extra }: { badges: Record<string, number>; extra: React.ReactNode }) {
  const path = usePathname()
  const [more, setMore] = useState(false)
  useEffect(() => setMore(false), [path])
  const rest = ITEMS.slice(PRIMARY)
  const restBadge = rest.reduce((sum, item) => sum + (badges[item.href] ?? 0), 0)
  return (
    <>
      <nav aria-label="Alt menü" className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-zinc-200 dark:border-ink-line bg-paper/95 dark:bg-ink/95 backdrop-blur pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5">
        <div className="mx-auto flex max-w-md items-stretch justify-around">
          {ITEMS.slice(0, PRIMARY).map((item) => {
            const on = active(path, item.href)
            return (
              <Link key={item.href} href={item.href} aria-current={on ? 'page' : undefined} className={`relative flex min-w-16 flex-col items-center gap-1 py-1 text-[11px] font-medium ${on ? 'text-violet-600 dark:text-violet-300' : 'text-zinc-500'}`}>
                <Icon d={item.icon} />
                {item.label}
                <span className="absolute -top-1 left-1/2 ml-1.5"><Badge count={badges[item.href]} /></span>
              </Link>
            )
          })}
          <button type="button" onClick={() => setMore(true)} aria-expanded={more} className={`relative flex min-w-16 flex-col items-center gap-1 py-1 text-[11px] font-medium ${rest.some((item) => active(path, item.href)) ? 'text-violet-600 dark:text-violet-300' : 'text-zinc-500'}`}>
            <Icon d="M5 12h.01M12 12h.01M19 12h.01" />
            Daha fazla
            <span className="absolute -top-1 left-1/2 ml-1.5"><Badge count={restBadge} /></span>
          </button>
        </div>
      </nav>

      {more && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setMore(false)}>
          <div role="dialog" aria-modal="true" aria-label="Diğer bölümler" onClick={(event) => event.stopPropagation()}
            className="absolute bottom-0 inset-x-0 rounded-t-2xl border-t border-zinc-200 dark:border-ink-line bg-paper dark:bg-ink-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="grid grid-cols-3 gap-2">
              {rest.map((item) => (
                <Link key={item.href} href={item.href} aria-current={active(path, item.href) ? 'page' : undefined}
                  className={`relative flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border text-xs font-medium ${active(path, item.href) ? 'border-violet-500/60 bg-violet-500/10' : 'border-zinc-200 dark:border-ink-line'}`}>
                  <Icon d={item.icon} />
                  {item.label}
                  <span className="absolute right-2 top-2"><Badge count={badges[item.href]} /></span>
                </Link>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">{extra}</div>
          </div>
        </div>
      )}
    </>
  )
}
