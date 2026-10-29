import Link from 'next/link'

// Uzun listelerde sayfa gezinmesi: önceki solda, sonraki sağda, ortada numara yazıp gitme. Süzgeçler (params) adreste kalır
export function Pager({ path, params, page, pages }: { path: string; params: Record<string, string>; page: number; pages: number }) {
  if (pages <= 1) return null
  const href = (n: number) => `${path}?${new URLSearchParams({ ...params, sayfa: String(n) })}`
  return (
    <nav aria-label="Sayfalar" className="flex items-center justify-between gap-2 my-4 text-sm">
      {page > 1 ? <Link href={href(page - 1)} className="btn whitespace-nowrap">← Önceki</Link> : <span className="btn whitespace-nowrap opacity-40">← Önceki</span>}
      <form action={path} className="flex items-center gap-1.5">
        {Object.entries(params).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
        {/* key: sayfa değişince kutu yeni numarayı göstersin (yoksa ilk açılıştaki değerde kalır) */}
        <input key={page} name="sayfa" type="number" min={1} max={pages} defaultValue={page} aria-label="Sayfa numarası" className="input w-16 py-1 text-center" />
        <span className="whitespace-nowrap text-stone-500">/ {pages}</span>
        <button className="btn">Git</button>
      </form>
      {page < pages ? <Link href={href(page + 1)} className="btn whitespace-nowrap">Sonraki →</Link> : <span className="btn whitespace-nowrap opacity-40">Sonraki →</span>}
    </nav>
  )
}

// Liste sayfası numarası: elle yazılan numara sınırların dışındaysa en yakın sayfa
export const pageOf = (value: string | undefined, pages: number) => Math.min(pages, Math.max(1, Math.floor(Number(value)) || 1))

// Listedeki düğmeler bulunduğu adresi gönderir; işlem bitince aynı sayfaya dönülür
export function BackTo({ href }: { href: string }) {
  return <input type="hidden" name="back" value={href} />
}
