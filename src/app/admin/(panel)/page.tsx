import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatScore } from '@/lib/text'
import { getSettings, getState, getUsage, type UsageKind } from '@/lib/state'
import { monthKey } from '@/lib/text'
import { isJobRunning } from '@/lib/jobs'
import { aiConfig, PROVIDERS } from '@/lib/ai'
import { runAstroDigestAction, runDailyAction, runSkyAction, runWeeklyAction } from '../actions'
import { Notice } from '../Notice'

const KINDS: Record<UsageKind, string> = { haber: 'Haberler (puanlama, yazım)', ders: 'Dersler (plan, araştırma, yazım, denetim)', gokyuzu: 'Gökyüzü takvimi', oneri: 'Kavram ve okur önerileri', gorsel: 'Kapak görselleri' }
const dollars = (cost: number) => `${cost.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`

const DAYS = ['pazar', 'pazartesi', 'salı', 'çarşamba', 'perşembe', 'cuma', 'cumartesi']

export default async function DashboardPage({ searchParams }: { searchParams: { mesaj?: string } }) {
  const lastMonth = new Date()
  lastMonth.setDate(0)
  const [settings, usage, previous, log, drafts, published, newPapers, sources, digests, lessons, series, lessonDrafts, lessonFailed, suggestions, reports, concepts] = await Promise.all([
    getSettings(),
    getUsage(),
    getUsage(monthKey(lastMonth)),
    getState('job.log'),
    prisma.post.count({ where: { status: 'draft' } }),
    prisma.post.count({ where: { status: 'published' } }),
    prisma.paper.count({ where: { status: 'new' } }),
    prisma.source.count({ where: { enabled: true } }),
    prisma.digest.count({ where: { status: 'draft' } }),
    prisma.lesson.count({ where: { status: 'published' } }),
    prisma.series.count({ where: { lessons: { some: { status: 'published' } } } }),
    prisma.lesson.count({ where: { status: 'draft' } }),
    prisma.lesson.count({ where: { status: 'failed' } }),
    prisma.suggestion.count(),
    prisma.lessonReport.count(),
    prisma.stage.count({ where: { approved: false } }),
  ])
  const ai = aiConfig(settings)
  const missing = [
    !ai.apiKey && ai.provider !== 'custom' && 'yapay zekâ API anahtarı',
    !ai.model && 'model adı',
    (!settings.kunyeUrl || !settings.kunyeToken) && 'Künye adresi ve API anahtarı',
    sources === 0 && 'en az bir kaynak',
  ].filter(Boolean)
  const total = usage.input + usage.output
  const cost = Object.values(usage.kinds).reduce((sum, t) => sum + (t?.cost ?? 0), 0)
  // Senin bakmanı bekleyenler: yalnızca sıfır olmayanlar görünür
  const waiting = ([
    [drafts, 'taslak yazı', '/admin/yazilar?durum=taslak'],
    [lessonDrafts, 'incelenecek ders', '/admin/egitim?bolum=bugun'],
    [lessonFailed, 'yazılamayan ders', '/admin/egitim?bolum=bugun'],
    [suggestions, 'okur önerisi', '/admin/egitim?bolum=okurlar'],
    [reports, 'okur bildirimi', '/admin/egitim?bolum=okurlar'],
    [concepts, 'kavram önerisi', '/admin/egitim?bolum=okurlar'],
    [digests, 'taslak bülten', '/admin/bultenler'],
  ] as const).filter(([count]) => count > 0)
  const lines = (log ?? '').split('\n').filter(Boolean)

  return (
    <>
      <Notice message={searchParams.mesaj} />
      {missing.length > 0 && (
        <p className="mb-6 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 px-3 py-2 text-sm">
          Eksik ayar: {missing.join(', ')}. <Link href="/admin/ayarlar" className="underline">Ayarlar</Link>
        </p>
      )}
      <h1 className="text-xl font-bold mb-3">Seni bekleyenler</h1>
      {waiting.length === 0 ? (
        <p className="card mb-6 text-sm text-zinc-500">✓ Şu an bakman gereken bir şey yok.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {waiting.map(([count, label, href]) => (
            <Link key={label} href={href} className="card border-amber-400/50 hover:border-amber-400"><b className="text-2xl">{count}</b><br />{label}</Link>
          ))}
        </div>
      )}

      <section className="flex flex-wrap gap-2 mb-6">
        <form action={runDailyAction}><button className="btn-primary" disabled={isJobRunning()}>Şimdi tara ve yazı üret</button></form>
        <form action={runWeeklyAction}><button className="btn" disabled={isJobRunning()}>Haftalık bülteni hazırla</button></form>
        <form action={runAstroDigestAction}><button className="btn" disabled={isJobRunning()}>Astronomi özetini hazırla</button></form>
        {settings.skyEnabled && <form action={runSkyAction}><button className="btn" disabled={isJobRunning()}>Gökyüzü takvimini güncelle</button></form>}
        {isJobRunning() && <span className="text-sm text-stone-500 self-center">Bir iş çalışıyor… sayfayı yenile.</span>}
      </section>

      <div className="grid grid-cols-3 gap-3 mb-6 text-sm">
        <Link href="/admin/yazilar?durum=yayinda" className="card"><b className="text-xl">{published}</b><br />yayında yazı</Link>
        <Link href="/admin/makaleler" className="card"><b className="text-xl">{newPapers}</b><br />bekleyen makale</Link>
        <div className="card"><b className="text-xl">{dollars(cost)}</b><br />bu ayın harcaması</div>
      </div>

      <details className="card mb-3 text-sm">
        <summary className="cursor-pointer font-semibold">Otomatik işler ve yapay zekâ</summary>
        <div className="mt-3 space-y-1">
        <p><b>Yapay zekâ:</b> {PROVIDERS[ai.provider].label} · {ai.model || 'model seçilmedi'}</p>
        <p>
          <b>Bu ay kullanılan token:</b> {total.toLocaleString('tr-TR')} (giriş {usage.input.toLocaleString('tr-TR')}, çıkış {usage.output.toLocaleString('tr-TR')})
          {settings.monthlyTokenLimit > 0 && ` / sınır ${settings.monthlyTokenLimit.toLocaleString('tr-TR')}`}
        </p>
        <p><b>Otomatik:</b> her gün {settings.dailyHour}:00&apos;da tarama ve ön puanı {formatScore(settings.scoreThreshold)}+ olan {settings.postsMinPerDay}-{settings.postsPerDay} yazı ({settings.autoPublish ? 'doğrudan yayımlanır' : 'taslak olarak bekler'}{settings.autoFeature && `, önem puanı ${formatScore(settings.featureScore)}+ olanlar öne çıkar`}); her {DAYS[settings.digestWeekday]} haftalık bülten
          {settings.astroDigest && `, her ${DAYS[settings.astroDigestWeekday]} astronomi özeti`} ({settings.autoNewsletter ? 'otomatik gönderilir' : 'taslak olarak bekler'}){settings.skyEnabled && '; haftada bir gökyüzü takvimi'}.</p>
        </div>
      </details>

      <details id="harcama" className="card mb-3 text-sm">
        <summary className="cursor-pointer font-semibold">Bu ayın harcaması · {dollars(cost)}</summary>
        <div className="mt-3">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-xs text-zinc-500"><tr><th className="py-1 pr-3 font-medium">Kalem</th><th className="py-1 pr-3 font-medium text-right">Çağrı</th><th className="py-1 pr-3 font-medium text-right">Token</th><th className="py-1 font-medium text-right">Ücret</th></tr></thead>
            <tbody className="divide-y divide-zinc-200/70 dark:divide-ink-line">
              {(Object.keys(KINDS) as UsageKind[]).map((kind) => {
                const tally = usage.kinds[kind]
                return (
                  <tr key={kind}>
                    <td className="py-1.5 pr-3">{KINDS[kind]}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{tally?.calls ?? 0}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{((tally?.input ?? 0) + (tally?.output ?? 0)).toLocaleString('tr-TR')}</td>
                    <td className="py-1.5 text-right tabular-nums">{tally?.cost ? dollars(tally.cost) : '—'}</td>
                  </tr>
                )
              })}
              <tr className="font-semibold">
                <td className="py-1.5 pr-3">Toplam</td><td /><td className="py-1.5 pr-3 text-right tabular-nums">{total.toLocaleString('tr-TR')}</td>
                <td className="py-1.5 text-right tabular-nums">{dollars(Object.values(usage.kinds).reduce((sum, t) => sum + (t?.cost ?? 0), 0))}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="hint mt-2">
          Geçen ay: {dollars(Object.values(previous.kinds).reduce((sum, t) => sum + (t?.cost ?? 0), 0))}. Ücret OpenRouter&apos;ın her çağrıda bildirdiği tutardır; başka
          sağlayıcıda (ör. haber yazımı doğrudan Claude ya da Gemini ile) ücret bilinmez, &quot;—&quot; görünür, token sayılır. Kesin tutar OpenRouter hesabında.
        </p>
        </div>
      </details>

      <details className="card mb-6 text-sm">
        <summary className="cursor-pointer font-semibold">Arama motorları</summary>
        <p className="text-zinc-500 my-3">
          Google gibi arama motorları siteyi bu iki dosyadan tanır; ikisi de kendiliğinden güncellenir, senin bir şey yapman gerekmez.
          Site haritasında şu an {published + lessons + series + 4} adres var ({published} yazı, {lessons} ders, {series} seri, 4 ana sayfa).
        </p>
        <div className="flex flex-wrap gap-2">
          <a href="/sitemap.xml" target="_blank" rel="noopener" className="btn">Site haritasını aç</a>
          <a href="/robots.txt" target="_blank" rel="noopener" className="btn">robots.txt&apos;yi aç</a>
          <a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer" className="btn">Google Search Console</a>
        </div>
      </details>


      <section>
        <h2 className="font-semibold mb-2">İş günlüğü</h2>
        <pre className="card text-xs whitespace-pre-wrap">{lines.slice(0, 8).join('\n') || 'Henüz çalışmadı.'}</pre>
        {lines.length > 8 && (
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer text-zinc-500">Önceki {lines.length - 8} satır</summary>
            <pre className="card mt-2 text-xs whitespace-pre-wrap">{lines.slice(8).join('\n')}</pre>
          </details>
        )}
      </section>
    </>
  )
}
