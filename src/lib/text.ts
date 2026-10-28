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

// Puanlar onda bir tam sayı olarak saklanır (74 = 7,4/10): kolon tipi değişmez, kodda tek ondalık
export const formatScore = (tenths: number) => (tenths / 10).toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export type Criteria = { yenilik: number; etki: number; kanit: number; anlam: number }

// Dört ölçüt (1-5) ağırlıklı ortalaması 1,0-10,0 aralığına: etki %35, kanıt gücü %25, yenilik %20, okur için anlam %20
export function weightedScore(c: Criteria): number {
  const average = 0.35 * c.etki + 0.25 * c.kanit + 0.2 * c.yenilik + 0.2 * c.anlam
  return Math.round((1 + ((average - 1) * 9) / 4) * 10)
}

// Yazarın JSON'undaki {"yenilik": 4, ...}; bir ölçüt eksik ya da bozuksa 0 (puansız)
export function criteriaScore(value: unknown): number {
  const data = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const c = { yenilik: Number(data.yenilik), etki: Number(data.etki), kanit: Number(data.kanit), anlam: Number(data.anlam) }
  if (!Object.values(c).every((n) => n >= 1 && n <= 5)) return 0
  return weightedScore({ yenilik: Math.round(c.yenilik), etki: Math.round(c.etki), kanit: Math.round(c.kanit), anlam: Math.round(c.anlam) })
}

// Ön puan yanıtı satır satır: "NUMARA | yenilik | etki | kanit | anlam | uzay/diğer | tekrar" (numaralar listedeki sıra, 1'den).
// tekrar: "-", "Y" (son yazılanlardan biriyle aynı gelişme) ya da listede önce geçen haberin numarası. Bozuk satır yalnızca kendisi düşer
export type ScoreLine = { index: number; criteria: Criteria; space: boolean; repeat: number | 'written' | null }
export function parseScores(text: string, count: number): ScoreLine[] {
  const seen = new Set<number>()
  const lines: ScoreLine[] = []
  for (const line of text.split('\n')) {
    const parts = line.replace(/^[\s\-*•]+/, '').split('|').map((part) => part.trim().replace(/^\*+|\*+$/g, ''))
    if (parts.length < 6) continue
    const index = parseInt(parts[0], 10) - 1
    const [yenilik, etki, kanit, anlam] = parts.slice(1, 5).map((part) => parseInt(part, 10))
    if (!(index >= 0 && index < count) || seen.has(index) || ![yenilik, etki, kanit, anlam].every((n) => n >= 1 && n <= 5)) continue
    seen.add(index)
    const repeatOf = parseInt(parts[6] ?? '', 10) - 1
    const repeat = /^y/i.test(parts[6] ?? '') ? 'written' : repeatOf >= 0 && repeatOf < count && repeatOf !== index ? repeatOf : null
    lines.push({ index, criteria: { yenilik, etki, kanit, anlam }, space: /^uzay/i.test(parts[5]), repeat })
  }
  return lines
}

// Seçime giden özetin başı: beslemelerin kalıp sözleri ("The post … appeared first on …", görsel kredisi, "Read more") atılır
export function cleanSummary(text: string): string {
  return text
    .replace(/The post .{0,300}? appeared first on [^.]*\.?/gi, ' ')
    .replace(/\((?:image|photo|illustration|video|banner)?\s*credits?\s*:[^)]{0,200}\)/gi, ' ')
    .replace(/\b(?:image|photo|illustration|video|banner)?\s*credits?\s*:\s*[^.\n]{0,120}?(?:\.(?=\s|$)|$)/gim, ' ')
    .replace(/\b(?:read more|continue reading|read (?:the )?full (?:story|article))\b.{0,80}$/i, ' ')
    .replace(/\[(?:…|\.\.\.|&#8230;)\]|&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export const DAILY_HARD_MAX = 15 // istisnalarla bile günde en fazla

export type PickOptions = { min: number; max: number; threshold: number; exceptional: number; spaceMin: number; spaceNormal: number; spaceMax: number; spaceImportant: number }

// Günlük seçim, puanlar mutlak olduğu için kodda: eşiği geçenler en yüksekten, en fazla max (istisna puanlılar max'ı aşar,
// en fazla DAILY_HARD_MAX); eşiği geçen azsa en iyilerle min'e tamamlanır. Uzay haberi normalde spaceNormal'a kadar,
// spaceImportant ve üstü olanlar spaceMax'a kadar. Uzay haberi spaceMin'den azsa en iyi uzay haberleri eklenir ya da sondakinin yerine geçer
export function pickDaily<T extends { score: number; space: boolean }>(items: T[], o: PickOptions): T[] {
  const sorted = items.filter((item) => item.score > 0).sort((a, b) => b.score - a.score)
  const picked: T[] = []
  const spaces = () => picked.filter((p) => p.space).length
  const fits = (item: T) => !item.space || spaces() < Math.max(o.spaceMin, item.score >= o.spaceImportant ? o.spaceMax : o.spaceNormal)
  for (const item of sorted) {
    if (picked.length >= DAILY_HARD_MAX || (item.score < o.threshold && picked.length >= o.min)) break
    if (picked.length >= o.max && item.score < o.exceptional) break
    if (fits(item)) picked.push(item)
  }
  for (const item of sorted.filter((i) => i.space && !picked.includes(i))) {
    if (spaces() >= Math.min(o.spaceMin, o.max)) break
    if (picked.length < o.max) {
      picked.push(item)
      continue
    }
    const last = picked.findLastIndex((p) => !p.space && p.score < o.exceptional)
    if (last < 0) break
    picked.splice(last, 1)
    picked.push(item)
  }
  return picked.sort((a, b) => b.score - a.score)
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
// Biçim satır satır: "TARİH | SAAT | TÜR | ÖNEM | BAŞLIK | AÇIKLAMA". JSON değil: açıklamadaki bir tırnak bütün yanıtı bozuyordu;
// burada bozuk satır yalnızca kendisi düşer
export function parseSkyEvents(text: string, from: string, to: string): SkyEvent[] {
  return text
    .split('\n')
    .map((line) => line.replace(/^[\s\-*•]+/, '').split('|').map((part) => part.trim()))
    .filter((parts) => parts.length >= 5)
    .map(([date, time, kind, importance, title, ...detail]) => ({
      date,
      time: /^\d{2}:\d{2}$/.test(time) ? time : '',
      kind: skyKind(kind),
      rank: skyRank(skyKind(kind), /önemli|evet|true/i.test(importance)),
      title: title.replace(/^\*+|\*+$/g, '').slice(0, 150),
      detail: detail.join(' | ').slice(0, 800),
    }))
    .filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date) && e.date >= from && e.date <= to && e.title)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .slice(0, 80)
}

// Arama için: küçük harf, Türkçe harfler ASCII karşılığına (okur "gokyuzu" da yazsa "Gökyüzü" bulunsun). Dizine giren metin de böyle
export const foldText = (text: string) => text.toLocaleLowerCase('tr').replace(/[çğıöşüâîû]/g, (c) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' })[c] ?? c)

// FTS5 sorgusu: her kelime geçmeli, kelime başı yeter ("kara del" → "kara delik"). Harf ve rakam dışı her şey atılır:
// okurun yazdığı tırnak ya da işleç sorguyu bozamaz
export function ftsQuery(query: string): string {
  return (foldText(query).match(/[\p{L}\p{N}]+/gu) ?? []).slice(0, 8).map((word) => `"${word}"*`).join(' ')
}

// Takvim günleri ("2026-10-28"): saat dilimi kaymasın diye UTC öğlen üzerinden
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
export const mondayOf = (date: string) => addDays(date, -((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7))

// Ders aşamalarının yanıtları da satır satır: JSON'daki tek bir kaçışsız tırnak bütün planı bozuyordu.
// "|" ile ayrılmış satırlar; liste işaretleri ve ** atılır, biçime uymayan satır yalnızca kendisi düşer
const fields = (text: string) => text.split('\n').map((line) => line.replace(/^[\s\-*•\d.)]+(?=\S)/, '').split('|').map((part) => part.trim().replace(/^\*+|\*+$/g, '')))

// Ders planı: "SEVİYE | Başlık | Kapsam"
export function parsePlan(text: string): Array<{ level: string; title: string; scope: string }> {
  return fields(text)
    .filter((parts) => parts.length >= 2 && /^(temel|orta|ileri)$/i.test(parts[0]) && parts[1])
    .map(([level, title, ...scope]) => ({ level: level.toLowerCase(), title: title.slice(0, 200), scope: scope.join(' | ').slice(0, 1000) }))
    .slice(0, 15)
}

// Denetim: "ciddi | nerede | sorun | doğrusu" satırları ya da "SORUN YOK". İkisi de yoksa okunamadı sayılır (ders yayımlanmaz)
export function parseIssues(text: string): { issues: Array<{ major: boolean; where: string; problem: string; fix: string }>; readable: boolean } {
  const issues = fields(text)
    .filter((parts) => parts.length >= 3 && /^(ciddi|küçük|kucuk)$/i.test(parts[0]) && parts[2])
    .map(([severity, where, problem, ...fix]) => ({ major: /^ciddi$/i.test(severity), where, problem, fix: fix.join(' | ') }))
  return { issues, readable: issues.length > 0 || /SORUN YOK/i.test(text) }
}

// Yeni seri önerisi: "Başlık: …", "Kapsam: …", "Alan: …", "Seviye: …" satırları
export function parseProposal(text: string): { title: string; summary: string; track: string; level: string } | null {
  const field = (name: string) => text.match(new RegExp(`^[\\s*-]*\\**${name}\\**\\s*:\\**\\s*(.+)$`, 'im'))?.[1].trim().replace(/\*+$/, '') ?? ''
  const title = field('Başlık')
  return title ? { title: title.slice(0, 200), summary: field('Kapsam').slice(0, 1000), track: field('Alan').slice(0, 100), level: field('Seviye').toLowerCase().slice(0, 20) } : null
}
