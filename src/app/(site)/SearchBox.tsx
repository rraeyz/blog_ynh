'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

type Result = { kind: string; title: string; href: string; text: string }

// Üstteki arama: yazdıkça eşleşenler hemen altta (/api/ara), "Ara" ya da Enter /ara?q= sayfasına gider.
// JavaScript yoksa simge doğrudan /ara sayfasını açar
export function SearchBox() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Result[] | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const path = usePathname()

  useEffect(() => setOpen(false), [path])

  useEffect(() => {
    const query = q.trim()
    if (query.length < 2) return setResults(null)
    const controller = new AbortController()
    // Her tuşta değil, yazma duraklayınca
    const timer = setTimeout(() => {
      fetch(`/api/ara?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((response) => response.json())
        .then((data) => setResults(data.results))
        .catch(() => {})
    }, 200)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [q])

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !box.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  return (
    <div ref={box}>
      <a
        href="/ara"
        aria-label="Ara"
        title="Ara"
        aria-expanded={open}
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey) return
          event.preventDefault()
          setOpen(!open)
        }}
        className="block rounded-full p-2 hover:bg-zinc-200/60 dark:hover:bg-white/5"
      >
        <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      </a>
      {open && (
        <div className="absolute inset-x-0 top-full border-b border-zinc-200/70 dark:border-ink-line bg-paper dark:bg-ink shadow-lg">
          <div className="mx-auto max-w-3xl px-4 py-4">
            <form action="/ara" role="search" className="flex gap-2">
              <input name="q" type="search" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Yazılarda ve derslerde ara" aria-label="Arama" autoComplete="off" className="input flex-1" autoFocus />
              <button className="btn-primary">Ara</button>
            </form>
            <div aria-live="polite">
              {results && results.length === 0 && <p className="mt-3 text-sm text-zinc-500">Eşleşen yazı yok.</p>}
              {results && results.length > 0 && (
                <ul className="mt-3 max-h-[60vh] overflow-y-auto divide-y divide-zinc-200/70 dark:divide-ink-line">
                  {results.map((r) => (
                    <li key={r.href}>
                      <Link href={r.href} onClick={() => setOpen(false)} className="group block py-2.5">
                        <span className="text-xs font-medium text-violet-600 dark:text-violet-300 mr-2">{r.kind}</span>
                        <span className="font-medium group-hover:text-violet-600 dark:group-hover:text-violet-300">{r.title}</span>
                        {r.text && <span className="block text-sm text-zinc-500 truncate">{r.text}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
