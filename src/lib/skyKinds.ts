// Gökyüzü olay türleri ve takvimdeki simgeleri
export const SKY_KINDS = {
  yeniay: { icon: '🌑', label: 'Yeni Ay' },
  ilkdordun: { icon: '🌓', label: 'İlk dördün' },
  dolunay: { icon: '🌕', label: 'Dolunay' },
  sondordun: { icon: '🌗', label: 'Son dördün' },
  'ay-tutulmasi': { icon: '🔴', label: 'Ay tutulması' },
  'gunes-tutulmasi': { icon: '🌞', label: 'Güneş tutulması' },
  meteor: { icon: '🌠', label: 'Meteor yağmuru' },
  yakinlasma: { icon: '✨', label: 'Yakınlaşma, kavuşum' },
  gezegen: { icon: '🪐', label: 'Gezegen' },
  kuyruklu: { icon: '☄️', label: 'Kuyruklu yıldız' },
  diger: { icon: '🔭', label: 'Diğer' },
} as const

export type SkyKind = keyof typeof SKY_KINDS
export const skyKind = (value: unknown): SkyKind => (typeof value === 'string' && Object.hasOwn(SKY_KINDS, value) ? (value as SkyKind) : 'diger')
