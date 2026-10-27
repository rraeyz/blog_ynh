import { prisma } from '@/lib/prisma'
import { monthKey } from '@/lib/text'

export async function getState(key: string): Promise<string | null> {
  return (await prisma.appState.findUnique({ where: { key } }))?.value ?? null
}

export async function setState(key: string, value: string): Promise<void> {
  await prisma.appState.upsert({ where: { key }, update: { value }, create: { key, value } })
}

export async function getSettings() {
  return prisma.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } })
}

export type Settings = Awaited<ReturnType<typeof getSettings>>

// Aylık token kullanımı (giriş + çıkış), bütçe sınırı için: AppState "usage.2026-10"
export async function getUsage(month = monthKey()): Promise<{ input: number; output: number }> {
  const raw = await getState(`usage.${month}`)
  return raw ? JSON.parse(raw) : { input: 0, output: 0 }
}

export async function addUsage(input: number, output: number): Promise<void> {
  const usage = await getUsage()
  await setState(`usage.${monthKey()}`, JSON.stringify({ input: usage.input + input, output: usage.output + output }))
}

export async function overBudget(settings: Settings): Promise<boolean> {
  if (settings.monthlyTokenLimit <= 0) return false
  const usage = await getUsage()
  return usage.input + usage.output >= settings.monthlyTokenLimit
}

// Panelde gösterilen son iş günlüğü (en yeni üstte, en fazla 30 satır)
export async function logJob(line: string): Promise<void> {
  const previous = (await getState('job.log')) ?? ''
  const stamp = new Date().toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })
  await setState('job.log', [`${stamp} · ${line}`, ...previous.split('\n').filter(Boolean)].slice(0, 60).join('\n'))
}
