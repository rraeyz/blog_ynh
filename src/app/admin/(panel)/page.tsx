import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatScore } from '@/lib/text'
import { getSettings, getState, getUsage } from '@/lib/state'
import { isJobRunning } from '@/lib/jobs'
import { aiConfig, PROVIDERS } from '@/lib/ai'
import { runAstroDigestAction, runDailyAction, runSkyAction, runWeeklyAction } from '../actions'
import { Notice } from '../Notice'

const DAYS = ['pazar', 'pazartesi', 'salı', 'çarşamba', 'perşembe', 'cuma', 'cumartesi']

export default async function DashboardPage({ searchParams }: { searchParams: { mesaj?: string } }) {
  const [settings, usage, log, drafts, published, newPapers, sources, digests] = await Promise.all([
    getSettings(),
    getUsage(),
    getState('job.log'),
    prisma.post.count({ where: { status: 'draft' } }),
    prisma.post.count({ where: { status: 'published' } }),
    prisma.paper.count({ where: { status: 'new' } }),
    prisma.source.count({ where: { enabled: true } }),
    prisma.digest.count({ where: { status: 'draft' } }),
  ])
  const ai = aiConfig(settings)
  const missing = [
    !ai.apiKey && ai.provider !== 'custom' && 'yapay zekâ API anahtarı',
    !ai.model && 'model adı',
    (!settings.kunyeUrl || !settings.kunyeToken) && 'Künye adresi ve API anahtarı',
    sources === 0 && 'en az bir kaynak',
  ].filter(Boolean)
  const total = usage.input + usage.output

  return (
    <>
      <Notice message={searchParams.mesaj} />
      {missing.length > 0 && (
        <p className="mb-6 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 px-3 py-2 text-sm">
          Eksik ayar: {missing.join(', ')}. <Link href="/admin/ayarlar" className="underline">Ayarlar</Link>
        </p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Link href="/admin/yazilar" className="card"><b className="text-2xl">{drafts}</b><br />taslak yazı</Link>
        <Link href="/admin/yazilar" className="card"><b className="text-2xl">{published}</b><br />yayında</Link>
        <Link href="/admin/makaleler" className="card"><b className="text-2xl">{newPapers}</b><br />bekleyen makale</Link>
        <Link href="/admin/bultenler" className="card"><b className="text-2xl">{digests}</b><br />taslak bülten</Link>
      </div>

      <section className="card mb-6 text-sm space-y-1">
        <p><b>Yapay zekâ:</b> {PROVIDERS[ai.provider].label} · {ai.model || 'model seçilmedi'}</p>
        <p>
          <b>Bu ay kullanılan token:</b> {total.toLocaleString('tr-TR')} (giriş {usage.input.toLocaleString('tr-TR')}, çıkış {usage.output.toLocaleString('tr-TR')})
          {settings.monthlyTokenLimit > 0 && ` / sınır ${settings.monthlyTokenLimit.toLocaleString('tr-TR')}`}
        </p>
        <p><b>Otomatik:</b> her gün {settings.dailyHour}:00&apos;da tarama ve ön puanı {formatScore(settings.scoreThreshold)}+ olan {settings.postsMinPerDay}-{settings.postsPerDay} yazı ({settings.autoPublish ? 'doğrudan yayımlanır' : 'taslak olarak bekler'}{settings.autoFeature && `, önem puanı ${formatScore(settings.featureScore)}+ olanlar öne çıkar`}); her {DAYS[settings.digestWeekday]} haftalık bülten
          {settings.astroDigest && `, her ${DAYS[settings.astroDigestWeekday]} astronomi özeti`} ({settings.autoNewsletter ? 'otomatik gönderilir' : 'taslak olarak bekler'}){settings.skyEnabled && '; haftada bir gökyüzü takvimi'}.</p>
      </section>

      <section className="flex flex-wrap gap-2 mb-6">
        <form action={runDailyAction}><button className="btn-primary" disabled={isJobRunning()}>Şimdi tara ve yazı üret</button></form>
        <form action={runWeeklyAction}><button className="btn" disabled={isJobRunning()}>Haftalık bülteni şimdi hazırla</button></form>
        <form action={runAstroDigestAction}><button className="btn" disabled={isJobRunning()}>Astronomi özetini şimdi hazırla</button></form>
        {settings.skyEnabled && <form action={runSkyAction}><button className="btn" disabled={isJobRunning()}>Gökyüzü takvimini güncelle</button></form>}
        {isJobRunning() && <span className="text-sm text-stone-500 self-center">Bir iş çalışıyor… sayfayı yenile.</span>}
      </section>

      <section>
        <h2 className="font-semibold mb-2">İş günlüğü</h2>
        <pre className="card text-xs whitespace-pre-wrap">{log || 'Henüz çalışmadı.'}</pre>
      </section>
    </>
  )
}
