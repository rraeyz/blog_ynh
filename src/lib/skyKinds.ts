// Gökyüzü olay türleri, takvimdeki simgeleri ve önem derecesi (3 kaçırılmamalı, 2 öne çıkan, 1 olağan).
// Takvimde önemli olaylar büyük ve renkli görünür; model olağan türde olağanüstü bir olayı (ör. çok yakın kavuşum) "important" ile 2'ye çıkarır
export const SKY_KINDS = {
  'ay-tutulmasi': { icon: '🔴', label: 'Ay tutulması', rank: 3 },
  'gunes-tutulmasi': { icon: '🌞', label: 'Güneş tutulması', rank: 3 },
  kuyruklu: { icon: '☄️', label: 'Kuyruklu yıldız', rank: 3 },
  meteor: { icon: '🌠', label: 'Meteor yağmuru', rank: 2 },
  gezegen: { icon: '🪐', label: 'Gezegen (karşı konum, uzanım)', rank: 2 },
  yakinlasma: { icon: '✨', label: 'Yakınlaşma, kavuşum', rank: 1 },
  dolunay: { icon: '🌕', label: 'Dolunay', rank: 1 },
  yeniay: { icon: '🌑', label: 'Yeni Ay', rank: 1 },
  ilkdordun: { icon: '🌓', label: 'İlk dördün', rank: 1 },
  sondordun: { icon: '🌗', label: 'Son dördün', rank: 1 },
  diger: { icon: '🔭', label: 'Diğer', rank: 1 },
} as const

export type SkyKind = keyof typeof SKY_KINDS
export const skyKind = (value: unknown): SkyKind => (typeof value === 'string' && Object.hasOwn(SKY_KINDS, value) ? (value as SkyKind) : 'diger')
export const skyRank = (kind: SkyKind, important: unknown) => Math.max(SKY_KINDS[kind].rank, important === true ? 2 : 1)
export const RANK_LABELS: Record<number, string> = { 3: 'Kaçırma', 2: 'Öne çıkan' }
