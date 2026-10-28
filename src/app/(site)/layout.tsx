import Link from 'next/link'
import { getSettings } from '@/lib/state'
import { canSubscribe } from '@/lib/newsletter'
import { activeTopics, TopicLink } from './parts'
import { HideOn } from './HideOn'

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, topics] = await Promise.all([getSettings(), activeTopics()])
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 border-b border-zinc-200/70 dark:border-ink-line bg-paper/80 dark:bg-ink/75 backdrop-blur-xl">
        <div className="mx-auto max-w-5xl px-4 h-16 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5 font-display font-semibold text-lg min-w-0 truncate">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" width={28} height={28} className="rounded-lg" />
            {settings.siteTitle}
          </Link>
          <nav className="ml-auto flex items-center gap-1 text-sm">
            <Link href="/#yazilar" className="hidden sm:inline rounded-full px-3 py-1.5 hover:bg-zinc-200/60 dark:hover:bg-white/5">Yazılar</Link>
            <Link href="/egitim" className="rounded-full px-3 py-1.5 hover:bg-zinc-200/60 dark:hover:bg-white/5">Eğitim</Link>
            {settings.skyEnabled && <Link href="/gokyuzu" className="hidden sm:inline rounded-full px-3 py-1.5 hover:bg-zinc-200/60 dark:hover:bg-white/5">Gökyüzü</Link>}
            <Link href="/ara" aria-label="Ara" title="Ara" className="rounded-full p-2 hover:bg-zinc-200/60 dark:hover:bg-white/5">
              <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            </Link>
            {canSubscribe(settings) && <Link href="#abone" className="rounded-full bg-violet-600 text-white px-4 py-1.5 font-medium hover:bg-violet-500 transition">Abone ol</Link>}
          </nav>
        </div>
      </header>
      {topics.length > 0 && (
        // Konu sayfaları: yalnızca bir konuyu okumak isteyen için; telefonda yana kayar. Eğitimde ve gökyüzünde haber konuları yok
        <HideOn prefixes={['/egitim', '/gokyuzu']}>
          <nav aria-label="Konular" className="border-b border-zinc-200/70 dark:border-ink-line">
            <div className="mx-auto max-w-5xl px-4 py-2.5 flex gap-2 overflow-x-auto">
              {topics.map(([key, c]) => <TopicLink key={key} slug={key} label={c.label} />)}
            </div>
          </nav>
        </HideOn>
      )}
      <main className="flex-1">{children}</main>
      <footer className="border-t border-zinc-200/70 dark:border-ink-line mt-20">
        <div className="mx-auto max-w-5xl px-4 py-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-500">
          {/* Telif sahibi site adından bağımsız: site adı değişse de alt bilgide marka kalır */}
          <span>© {new Date().getFullYear()} Raeyz Labs</span>
          <a href="/rss.xml" className="hover:text-violet-500" title="Feedly, Inoreader gibi bir besleme okuyucuya bu adresi ekleyerek yeni yazıları takip edebilirsin">RSS beslemesi</a>
          {settings.kunyeUrl && <a href={settings.kunyeUrl} className="hover:text-violet-500">{settings.kunyeUrl.replace(/^https?:\/\//, '')}</a>}
          <span className="ml-auto">Yazılar yapay zekâ yardımıyla hazırlanır; kaynağı her yazının sonunda.</span>
        </div>
      </footer>
    </div>
  )
}
