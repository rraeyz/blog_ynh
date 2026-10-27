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
  return JSON.parse(text.slice(start, end + 1))
}

export const monthKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
