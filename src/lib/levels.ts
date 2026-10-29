// Ders seviyeleri, matematikle tanımlı: okur hangi dersi okuyabileceğini buradan anlar.
// Her serinin aşamaları temel → orta → ileri; tek derslik konu (kavram, istek) kendi içinde temelden ileriye gider ("kapsamli")
export const LEVELS = {
  temel: { label: 'Temel', hint: 'Lise matematiği yeter; türev ve integral yok' },
  orta: { label: 'Orta', hint: 'Türev, integral, vektörler, basit diferansiyel denklemler' },
  ileri: { label: 'İleri', hint: 'Fourier dönüşümü, kısmi türevli denklemler, kuantum, istatistiksel çıkarım' },
  kapsamli: { label: 'Temelden ileriye', hint: 'Tek derste baştan uzman seviyesine' },
} as const

export type Level = keyof typeof LEVELS
export const isLevel = (value: unknown): value is Level => typeof value === 'string' && Object.hasOwn(LEVELS, value)

const ORDER: Level[] = ['temel', 'orta', 'ileri']

// Serinin seviye aralığı ("Temel → İleri"); seviyesi olmayan seri için boş
export function levelRange(levels: string[]): string {
  const known = ORDER.filter((level) => levels.includes(level))
  if (known.length === 0) return levels.includes('kapsamli') ? LEVELS.kapsamli.label : ''
  const [first, last] = [LEVELS[known[0]].label, LEVELS[known[known.length - 1]].label]
  return first === last ? first : `${first} → ${last}`
}
