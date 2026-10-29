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

// Aylık kullanım, AppState "usage.2026-10": toplam token (bütçe sınırı için) ve kaleme göre çağrı, token, ücret (maliyet tablosu)
export type UsageKind = 'haber' | 'ders' | 'gokyuzu' | 'oneri' | 'gorsel'
type Tally = { calls: number; input: number; output: number; cost: number }
export async function getUsage(month = monthKey()): Promise<{ input: number; output: number; kinds: Partial<Record<UsageKind, Tally>> }> {
  const raw = await getState(`usage.${month}`)
  return { input: 0, output: 0, kinds: {}, ...(raw ? JSON.parse(raw) : {}) }
}

export async function addUsage(result: { inputTokens: number; outputTokens: number; cost: number }, kind: UsageKind): Promise<void> {
  const usage = await getUsage()
  const tally = usage.kinds[kind] ?? { calls: 0, input: 0, output: 0, cost: 0 }
  usage.kinds[kind] = { calls: tally.calls + 1, input: tally.input + result.inputTokens, output: tally.output + result.outputTokens, cost: tally.cost + result.cost }
  await setState(`usage.${monthKey()}`, JSON.stringify({ input: usage.input + result.inputTokens, output: usage.output + result.outputTokens, kinds: usage.kinds }))
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
