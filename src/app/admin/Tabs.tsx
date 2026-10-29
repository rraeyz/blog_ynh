import Link from 'next/link'

// Sayfa içi sekmeler (?bolum= ya da verilen parametre): telefonda yana kayar, sayı rozeti bekleyen işi gösterir
export function Tabs({ path, tabs, active, param = 'bolum' }: { path: string; tabs: Array<[key: string, label: string, count?: number]>; active: string; param?: string }) {
  return (
    <nav aria-label="Sekmeler" className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 text-sm">
      {tabs.map(([key, label, count]) => (
        <Link key={key} href={`${path}?${param}=${key}`} aria-current={key === active ? 'page' : undefined} className={`${key === active ? 'btn-primary' : 'btn'} shrink-0 gap-1.5 whitespace-nowrap`}>
          {label}
          {count ? <span className="min-w-5 rounded-full bg-amber-500 px-1.5 text-center text-[11px] font-semibold leading-5 text-white">{count}</span> : null}
        </Link>
      ))}
    </nav>
  )
}
