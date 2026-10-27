'use client'

import { useEffect, useState } from 'react'

// Sayfanın üstünde okuma ilerlemesi çubuğu
export function ReadingProgress() {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])
  return <div aria-hidden className="fixed left-0 top-0 z-50 h-1 bg-gradient-to-r from-violet-500 to-fuchsia-500" style={{ width: `${progress * 100}%` }} />
}
