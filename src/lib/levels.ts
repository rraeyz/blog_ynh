// Ders seviyeleri. Her seri konunun en temel noktasından başlar, dersler ilerledikçe seviye yükselir;
// tek derslik konu kendi içinde temelden uzmanlığa gider ("kapsamli"). Okur seviyeyi görüp dersini seçer
export const LEVELS = {
  temel: { label: 'Temel', hint: 'Konuya giriş: kavramlar ve sezgi; lise matematiği yeter' },
  orta: { label: 'Orta', hint: 'Yöntemin matematiği ve uygulaması; serinin önceki dersleri bilinir' },
  ileri: { label: 'İleri', hint: 'Uzman seviyesi: tam türetmeler, gerçek veri, araştırmada kullanım' },
  kapsamli: { label: 'Temelden ileriye', hint: 'Tek derste baştan uzman seviyesine' },
} as const

export type Level = keyof typeof LEVELS
export const isLevel = (value: unknown): value is Level => typeof value === 'string' && Object.hasOwn(LEVELS, value)

const ORDER: Level[] = ['temel', 'orta', 'ileri']

// Planlanan derslerin seviyeleri: tek ders "kapsamli"; seride seviye sırayla düşmez, bilinmeyen değer öncekini sürdürür
export function planLevels(raw: unknown[]): Level[] {
  if (raw.length === 1) return ['kapsamli']
  let floor = 0
  return raw.map((value) => {
    floor = Math.max(floor, ORDER.indexOf(value as Level))
    return ORDER[floor]
  })
}

// Serinin seviye aralığı ("Temel → İleri"); seviyesi olmayan seri için boş
export function levelRange(levels: string[]): string {
  const known = ORDER.filter((level) => levels.includes(level))
  if (known.length === 0) return levels.includes('kapsamli') ? LEVELS.kapsamli.label : ''
  const [first, last] = [LEVELS[known[0]].label, LEVELS[known[known.length - 1]].label]
  return first === last ? first : `${first} → ${last}`
}
