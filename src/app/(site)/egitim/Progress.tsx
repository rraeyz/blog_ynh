'use client'

import { useEffect, useRef, useState } from 'react'

// Okuma ilerlemesi yalnızca okurun tarayıcısında (localStorage) tutulur; sunucuya gitmez, üyelik gerekmez
const KEY = 'okunan'
const MIN_SECONDS = 30 // sona hızla kaydıran okumuş sayılmasın

function readSet(): Set<number> {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return new Set(Array.isArray(value) ? value.filter((id) => typeof id === 'number') : [])
  } catch {
    return new Set()
  }
}

function useRead(): Set<number> | null {
  const [read, setRead] = useState<Set<number> | null>(null)
  useEffect(() => setRead(readSet()), [])
  return read
}

// Dersin sonuna konur: okur buraya ulaşınca (sayfada en az 30 saniye kaldıysa) ders kendiliğinden okundu sayılır
export function ReadMark({ id }: { id: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const start = Date.now()
    let visible = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const mark = () => {
      if (!visible) return
      try {
        const read = readSet()
        read.add(id)
        localStorage.setItem(KEY, JSON.stringify(Array.from(read)))
      } catch {}
      observer.disconnect()
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      clearTimeout(timer)
      if (visible) timer = setTimeout(mark, Math.max(0, MIN_SECONDS * 1000 - (Date.now() - start)))
    })
    if (ref.current) observer.observe(ref.current)
    return () => {
      clearTimeout(timer)
      observer.disconnect()
    }
  }, [id])
  return <div ref={ref} aria-hidden className="h-px" />
}

// Seride okunan ders sayısı ve yeşil çubuk; hiç okunmadıysa görünmez
export function SeriesProgress({ ids }: { ids: number[] }) {
  const read = useRead()
  const done = read ? ids.filter((id) => read.has(id)).length : 0
  if (done === 0) return null
  return (
    <span className="mt-2 block">
      <span className="block text-xs text-emerald-700 dark:text-emerald-400">{done === ids.length ? 'Yayımlanan derslerin hepsini okudun' : `${done} / ${ids.length} ders okundu`}</span>
      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-white/10">
        <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${Math.round((done / ids.length) * 100)}%` }} />
      </span>
    </span>
  )
}

export function ReadCheck({ id }: { id: number }) {
  const read = useRead()
  return read?.has(id) ? <span className="inline-flex shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">✓ Okundu</span> : null
}
