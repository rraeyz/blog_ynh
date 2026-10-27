// Makale konusu → Türkçe etiket ve renk. Saf fonksiyonlar: tests/unit.test.ts
// Konu, arXiv'de birincil kategori (cs.AI, astro-ph.GA), beslemelerde sitenin adresidir (nature.com)

const LABELS: Record<string, string> = {
  'cs.AI': 'Yapay Zekâ', 'cs.LG': 'Makine Öğrenmesi', 'cs.CL': 'Dil Modelleri', 'cs.CV': 'Görüntü İşleme',
  'cs.RO': 'Robotik', 'cs.CR': 'Siber Güvenlik', 'cs.HC': 'İnsan-Bilgisayar', 'cs.NE': 'Sinir Ağları',
  'stat.ML': 'Makine Öğrenmesi', 'q-bio.NC': 'Sinirbilim', 'physics.med-ph': 'Tıbbi Fizik',
  cs: 'Bilgisayar Bilimi', 'astro-ph': 'Astrofizik', physics: 'Fizik', 'quant-ph': 'Kuantum', 'q-bio': 'Biyoloji',
  math: 'Matematik', stat: 'İstatistik', econ: 'Ekonomi', eess: 'Elektronik', 'cond-mat': 'Yoğun Madde',
  'hep-th': 'Parçacık Fiziği', 'hep-ph': 'Parçacık Fiziği', 'hep-ex': 'Parçacık Fiziği', 'hep-lat': 'Parçacık Fiziği',
  'gr-qc': 'Kütleçekim', nlin: 'Karmaşık Sistemler', 'q-fin': 'Finans', 'nucl-th': 'Nükleer Fizik', 'nucl-ex': 'Nükleer Fizik',
}

export function topicLabel(topic: string): string {
  if (!topic) return 'Makale'
  return LABELS[topic] ?? LABELS[topic.split('.')[0]] ?? topic.replace(/^www\./, '')
}

// Aynı konu hep aynı renk. Tonlar Künye'nin morunu tamamlayan seçili bir paletten (zeytin/sarı gibi uyumsuzlar yok):
// mor, fuşya, gül, mavi, gök, camgöbeği, turkuaz, çivit, eflatun, turuncu
const PALETTE = [262, 292, 330, 220, 200, 188, 168, 240, 276, 18]

export function topicHue(topic: string): number {
  let hash = 0
  for (const ch of topicLabel(topic)) hash = (hash * 31 + ch.codePointAt(0)!) >>> 0
  return PALETTE[hash % PALETTE.length]
}

export const readingMinutes = (text: string) => Math.max(1, Math.round(text.split(/\s+/).filter(Boolean).length / 200))

// "Bu hafta", "Geçen hafta", sonra ay adı (Ekim 2026)
export function periodLabel(date: Date, now = new Date()): string {
  const days = (now.getTime() - date.getTime()) / 86_400_000
  if (days < 7) return 'Bu hafta'
  if (days < 14) return 'Geçen hafta'
  return date.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
}
