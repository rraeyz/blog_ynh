// Saf yardımcılar: tests/unit.test.ts
import { skyKind, skyRank, type SkyKind } from './skyKinds.ts'

const TR: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', İ: 'i', ö: 'o', ş: 's', ü: 'u', Ç: 'c', Ğ: 'g', Ö: 'o', Ş: 's', Ü: 'u' }

export function slugify(text: string): string {
  return text
    .replace(/[çğıİöşüÇĞÖŞÜ]/g, (ch) => TR[ch])
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '')
}

// Model yanıtındaki ilk JSON nesnesi/dizisi (```json bloklarına ve önündeki açıklamaya dayanıklı)
export function extractJson(text: string): unknown {
  const start = text.search(/[[{]/)
  if (start < 0) throw new Error('Yanıtta JSON bulunamadı')
  const open = text[start]
  const close = open === '{' ? '}' : ']'
  const end = text.lastIndexOf(close)
  if (end <= start) throw new Error('Yanıttaki JSON eksik')
  const raw = text.slice(start, end + 1)
  try {
    return JSON.parse(raw)
  } catch {
    // Bazı modeller (Gemini) metnin içine kaçışsız satır sonu koyar ("Bad control character"): onlar kaçışlanıp yeniden denenir
    return JSON.parse(escapeControlInStrings(raw))
  }
}

function escapeControlInStrings(json: string): string {
  let out = ''
  let inString = false
  let escaped = false
  for (const ch of json) {
    if (inString && !escaped && ch < ' ') {
      out += ch === '\n' ? '\\n' : ch === '\r' ? '\\r' : ch === '\t' ? '\\t' : `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`
      continue
    }
    if (inString && !escaped && ch === '"') inString = false
    else if (!inString && ch === '"') inString = true
    escaped = inString && !escaped && ch === '\\'
    out += ch
  }
  return out
}

// Seçim yanıtı: {"picked": [3, 1], "scores": {"1": 6, "2": 3}, "space": [2]} (numaralar listedeki sıra, 1'den başlar).
// Seçilen numaralar bozuksa en yüksek puanlılar alınır; puanlar 1-10'a sıkıştırılır.
// Günde en az minSpace uzay yazısı: eksikse en yüksek puanlı uzay haberleri önce boş yerlere, sonra sondaki uzay olmayanların yerine girer
export function parseSelection(text: string, count: number, n: number, minSpace = 1): { picked: number[]; scores: Map<number, number> } {
  const data = extractJson(text) as { picked?: unknown; scores?: unknown; space?: unknown }
  const scores = new Map<number, number>()
  if (data && typeof data.scores === 'object' && !Array.isArray(data.scores)) {
    for (const [key, value] of Object.entries(data.scores as Record<string, unknown>)) {
      const index = Number(key) - 1
      const score = Math.round(Number(value))
      if (Number.isInteger(index) && index >= 0 && index < count && score > 0) scores.set(index, Math.min(10, score))
    }
  }
  const valid = (i: number) => Number.isInteger(i) && i >= 0 && i < count
  let picked = Array.isArray(data?.picked) ? data.picked.map((i) => Number(i) - 1).filter(valid) : []
  if (picked.length === 0) picked = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]).map(([i]) => i)
  picked = Array.from(new Set(picked)).slice(0, n)
  const space = Array.isArray(data?.space) ? data.space.map((i) => Number(i) - 1).filter(valid) : []
  const missing = Math.min(minSpace, n) - picked.filter((i) => space.includes(i)).length
  const extra = space.filter((i) => !picked.includes(i)).sort((a, b) => (scores.get(b) ?? 0) - (scores.get(a) ?? 0)).slice(0, Math.max(0, missing))
  for (const index of extra) {
    if (picked.length < n) {
      picked.push(index)
      continue
    }
    let last = picked.length - 1
    while (last >= 0 && space.includes(picked[last])) last--
    if (last >= 0) picked[last] = index
  }
  return { picked, scores }
}

export const monthKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

// Ders çıktısı: "Özet: ...", "Önkoşul: 3, 7" ve "Öğretilenler: ..." satırları ile ilk "## " başlığından başlayan gövde
// (öncesindeki "araştırdım…" gibi sözler atılır). Önkoşul numaraları modele verilen ders listesindeki sıradır
export function parseLesson(text: string): { excerpt: string; body: string; prerequisites: number[]; covers: string } | null {
  const start = text.search(/^##\s/m)
  if (start < 0) return null
  const head = text.slice(0, start)
  const excerpt = head.match(/^\s*\**Özet:?\**:?\s*(.+)$/m)?.[1].trim() ?? ''
  const prerequisites = (head.match(/^\s*\**Önkoşul(?:lar)?:?\**:?\s*(.+)$/m)?.[1] ?? '').match(/\d+/g)?.map(Number) ?? []
  const covers = head.match(/^\s*\**Öğretilenler:?\**:?\s*(.+)$/m)?.[1].trim() ?? ''
  return { excerpt: excerpt.slice(0, 500), body: text.slice(start).trim(), prerequisites, covers: covers.slice(0, 1000) }
}

// Gövdedeki [metin](https://...) linkleri
export const markdownLinks = (body: string) => Array.from(new Set(Array.from(body.matchAll(/\[[^\]]+\]\((https?:\/\/[^\s)]+)\)/g), (m) => m[1])))

// Açılmayan linkler metne döner: okur ölü linke tıklamasın
export const unlink = (body: string, dead: Set<string>) =>
  body.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (all, label: string, url: string) => (dead.has(url) ? label : all))

export type SkyEvent = { date: string; time: string; kind: SkyKind; rank: number; title: string; detail: string }

// Gökyüzü takvimi yanıtı: yalnızca istenen aralıktaki, tarihi geçerli olaylar; tarih ve saate göre sıralı
export function parseSkyEvents(text: string, from: string, to: string): SkyEvent[] {
  const data = extractJson(text) as { events?: Array<Record<string, unknown>> }
  return (Array.isArray(data.events) ? data.events : [])
    .map((e) => ({
      date: String(e.date ?? ''),
      time: /^\d{2}:\d{2}$/.test(String(e.time ?? '')) ? String(e.time) : '',
      kind: skyKind(e.kind),
      rank: skyRank(skyKind(e.kind), e.important),
      title: String(e.title ?? '').trim().slice(0, 150),
      detail: String(e.detail ?? '').trim().slice(0, 800),
    }))
    .filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date) && e.date >= from && e.date <= to && e.title)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .slice(0, 80)
}

// Arama için: küçük harf, Türkçe harfler ASCII karşılığına (okur "gokyuzu" da yazsa "Gökyüzü" bulunsun)
const fold = (text: string) => text.toLocaleLowerCase('tr').replace(/[çğıöşü]/g, (c) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' })[c] ?? c)

// Her kelime başlıkta ya da metinde geçmeli; başlıkta geçen kelime daha değerli. Eşleşmezse 0
export function searchScore(query: string, title: string, text: string): number {
  const words = fold(query).split(/\s+/).filter(Boolean)
  const [t, r] = [fold(title), fold(text)]
  let score = 0
  for (const word of words) {
    if (t.includes(word)) score += 3
    else if (r.includes(word)) score += 1
    else return 0
  }
  return score
}

// Takvim günleri ("2026-10-28"): saat dilimi kaymasın diye UTC öğlen üzerinden
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
export const mondayOf = (date: string) => addDays(date, -((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7))
