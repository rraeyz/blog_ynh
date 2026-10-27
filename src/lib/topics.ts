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

// Sitedeki konu sekmeleri. Yazıyı yazan model birini seçer (Post.category); renkler sabit
export const CATEGORIES: Record<string, { label: string; hue: number; hint: string }> = {
  uzay: { label: 'Uzay', hue: 262, hint: 'astronomi, gezegenler, uzay görevleri, teleskoplar' },
  fizik: { label: 'Fizik', hue: 220, hint: 'parçacık, kuantum, malzeme fiziği, enerji' },
  teknoloji: { label: 'Teknoloji', hue: 188, hint: 'icatlar, mühendislik, donanım, sensörler, elektronik, robotik' },
  'yapay-zeka': { label: 'Yapay Zekâ', hue: 292, hint: 'yapay zekâ, yazılım, bilgisayar bilimi, siber güvenlik' },
  saglik: { label: 'Sağlık', hue: 330, hint: 'tıp, biyoloji, genetik, sinirbilim' },
  dunya: { label: 'Dünya ve İklim', hue: 168, hint: 'iklim, çevre, yer bilimleri, ekoloji' },
  bilim: { label: 'Bilim', hue: 18, hint: 'kimya, matematik ve diğer her şey' },
}

export function topicLabel(topic: string): string {
  if (CATEGORIES[topic]) return CATEGORIES[topic].label
  if (!topic) return 'Makale'
  return LABELS[topic] ?? LABELS[topic.split('.')[0]] ?? topic.replace(/^www\./, '')
}

// Aynı konu hep aynı renk. Tonlar Künye'nin morunu tamamlayan seçili bir paletten (zeytin/sarı gibi uyumsuzlar yok):
// mor, fuşya, gül, mavi, gök, camgöbeği, turkuaz, çivit, eflatun, turuncu
const PALETTE = [262, 292, 330, 220, 200, 188, 168, 240, 276, 18]

export function topicHue(topic: string): number {
  if (CATEGORIES[topic]) return CATEGORIES[topic].hue
  let hash = 0
  for (const ch of topicLabel(topic)) hash = (hash * 31 + ch.codePointAt(0)!) >>> 0
  return PALETTE[hash % PALETTE.length]
}

// Görselini gösterdiğimiz kurumlar: görselleri kamu malı (NASA) ya da kaynak gösterilerek serbest (ESA, ESO; CC BY).
// Diğer sitelerin görselleri çoğunlukla ajans (Getty vb.) fotoğrafı ve telifli; onlarda renkli kapak kalır
const FREE_IMAGES: Array<[RegExp, string]> = [
  [/(^|\.)nasa\.gov$/, 'NASA'],
  [/(^|\.)esa\.int$/, 'ESA'],
  [/(^|\.)esawebb\.org$/, 'ESA/Webb'],
  [/(^|\.)esahubble\.org$/, 'ESA/Hubble'],
  [/(^|\.)eso\.org$/, 'ESO'],
]

export function freeImage(paper: { url: string; imageUrl: string } | null | undefined): { src: string; credit: string } | null {
  if (!paper?.imageUrl) return null
  const host = paper.url.match(/^https?:\/\/([^/?#:]+)/)?.[1] ?? ''
  const credit = FREE_IMAGES.find(([pattern]) => pattern.test(host))?.[1]
  return credit ? { src: paper.imageUrl, credit } : null
}

// Kapak görseli: önce kaynağın serbest lisanslı görseli, yoksa yapay zekânın temsili kapağı, o da yoksa renkli kapak
export function coverOf(post: { image: string; paper: { url: string; imageUrl: string } | null | undefined }): { src: string; credit: string; ai: boolean } | null {
  const free = freeImage(post.paper)
  if (free) return { src: free.src, credit: `Görsel: ${free.credit}`, ai: false }
  return post.image ? { src: `/gorsel/${post.image}`, credit: 'Temsili görsel, yapay zekâyla üretildi', ai: true } : null
}

export const readingMinutes = (text: string) => Math.max(1, Math.round(text.split(/\s+/).filter(Boolean).length / 200))

// "Bu hafta", "Geçen hafta", sonra ay adı (Ekim 2026)
export function periodLabel(date: Date, now = new Date()): string {
  const days = (now.getTime() - date.getTime()) / 86_400_000
  if (days < 7) return 'Bu hafta'
  if (days < 14) return 'Geçen hafta'
  return date.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
}
