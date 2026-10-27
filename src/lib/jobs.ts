import { cleanupPapers, fetchSources } from '@/lib/papers'
import { writeDaily } from '@/lib/writer'
import { createWeeklyDigest, sendDigest } from '@/lib/newsletter'
import { getSettings, getState, logJob, setState } from '@/lib/state'

// Saatte bir bakılır. Günlük iş ayarlanan saatte günde bir kez çalışır (tarama + yazı üretimi);
// bülten günü ise ardından haftalık bülten hazırlanır. Son çalışma günü AppState'te: yeniden başlatmada tekrar etmez.

const today = () => new Date().toLocaleDateString('sv-SE') // 2026-10-27 (sunucu saati)
const globalForJobs = globalThis as unknown as { jobsStarted?: boolean; jobRunning?: boolean }

// Panel düğmeleri de bunu kullanır: aynı anda tek iş çalışır
export async function runExclusive(name: string, task: () => Promise<string>): Promise<boolean> {
  if (globalForJobs.jobRunning) return false
  globalForJobs.jobRunning = true
  try {
    await logJob(`${name}: ${await task()}`)
  } catch (error) {
    await logJob(`${name} başarısız: ${String((error as Error).message || error).slice(0, 200)}`)
  } finally {
    globalForJobs.jobRunning = false
  }
  return true
}

export const isJobRunning = () => !!globalForJobs.jobRunning

export async function dailyTask(): Promise<string> {
  const settings = await getSettings()
  const added = await fetchSources()
  // Ara adımlar günlüğe: iş dakikalarca sürer, panelde nerede olduğu görünsün
  await logJob(`Günlük iş: tarama bitti, ${added} yeni makale; yapay zekâ seçiyor…`)
  const result = await writeDaily(settings)
  const parts = [`${added} yeni makale`, `${result.written} yazı ${settings.autoPublish ? 'yayımlandı' : 'taslak'}`]
  if (result.failed) parts.push(`${result.failed} hata`)
  if (result.skipped) parts.push(`${result.skipped} makale 3 gün seçilmeyip atlandı`)
  if (result.budget) parts.push('aylık token sınırına ulaşıldı')
  const cleaned = await cleanupPapers()
  if (cleaned) parts.push(`${cleaned} eski makale temizlendi`)
  return parts.join(', ')
}

export async function weeklyTask(): Promise<string> {
  const settings = await getSettings()
  const digest = await createWeeklyDigest(settings)
  if (!digest) return 'son 7 günde yayımlanan yazı yok, bülten hazırlanmadı'
  if (!settings.autoNewsletter) return 'taslak bülten hazır (Bültenler)'
  await sendDigest(digest.id, settings)
  return 'bülten Künye üzerinden abonelere planlandı'
}

async function tick() {
  const settings = await getSettings()
  if (new Date().getHours() < settings.dailyHour) return
  if ((await getState('job.dailyDate')) !== today()) {
    await setState('job.dailyDate', today())
    await runExclusive('Günlük iş', dailyTask)
  }
  if (new Date().getDay() === settings.digestWeekday && (await getState('job.weeklyDate')) !== today()) {
    await setState('job.weeklyDate', today())
    await runExclusive('Haftalık bülten', weeklyTask)
  }
}

export function startScheduler() {
  if (globalForJobs.jobsStarted) return
  globalForJobs.jobsStarted = true
  const run = () => tick().catch((error) => console.error('Otomatik iş çalıştırılamadı:', error))
  setTimeout(run, 60_000).unref()
  setInterval(run, 60 * 60 * 1000).unref()
}
