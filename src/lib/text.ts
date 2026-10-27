// Saf yardımcılar: tests/unit.test.ts

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

// Seçim yanıtı: {"picked": [3, 1], "scores": {"1": 6, "2": 3}} (numaralar listedeki sıra, 1'den başlar).
// Seçilen numaralar bozuksa en yüksek puanlılar alınır; puanlar 1-10'a sıkıştırılır
export function parseSelection(text: string, count: number, n: number): { picked: number[]; scores: Map<number, number> } {
  const data = extractJson(text) as { picked?: unknown; scores?: unknown }
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
  return { picked: Array.from(new Set(picked)).slice(0, n), scores }
}

export const monthKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
