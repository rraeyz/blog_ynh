import { complete } from '@/lib/ai'
import { lessonSettings } from '@/lib/lessons'
import { prisma } from '@/lib/prisma'
import { addUsage, getState, setState, type Settings } from '@/lib/state'
import { parseSkyEvents } from '@/lib/text'
import { SKY_KINDS } from '@/lib/skyKinds'

// Gökyüzü takvimi: haftada bir, önümüzdeki 5 haftada Türkiye'den gözlenebilecek olaylar web'de araştırılır (OpenRouter).
// Araştırılan aralıktaki eski kayıtlar yenileriyle değişir; geçmiş aylar takvimde kalır. Kaynaklar son araştırmanınki (AppState)

const SOURCES_KEY = 'sky.sources'
const RANGE_DAYS = 35
export const istanbulDate = (date = new Date()) => date.toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' })

const SKY = `Bir gözlemsel astronomi editörüsün. Türkiye'den (yaklaşık 39° kuzey enlemi; saatler TSİ, UTC+3) verilen tarih aralığında
gözlenebilecek gökyüzü olaylarını web'de araştır: Ay evreleri (yeni Ay, ilk dördün, dolunay, son dördün), Ay'ın gezegen ve parlak yıldızlarla
yakınlaşmaları, gezegen kavuşumları, karşı konumlar ve en büyük uzanımlar, meteor yağmurlarının tepe noktaları, Ay ve Güneş tutulmaları,
parlak kuyruklu yıldızlar. Güvenilir kaynak kullan (in-the-sky.org, timeanddate.com, NASA, Sky & Telescope, EarthSky, gözlemevleri).
Yalnızca kaynakla doğruladığın ve Türkiye'den gözlenebilen olayları yaz; aralık dışını yazma. Doğrulayamadığın ayrıntıyı hiç yazma;
metinde araştırma sürecinden ya da kaynaklardan söz etme. Her olay için nasıl ve nereye bakılacağını 1-3 cümleyle anlat (yön, saat,
çıplak göz/dürbün/teleskop). Türü şunlardan biri olsun: ${Object.keys(SKY_KINDS).join(', ')}.
Yanıtı yalnızca şu JSON biçiminde ver:
{"events": [{"date": "YYYY-MM-DD", "time": "SS:DD ya da boş", "kind": "tür", "title": "Kısa başlık", "detail": "Nasıl gözlenir"}]}`

export async function skySources(): Promise<{ sources: Array<{ title: string; url: string }>; updatedAt: string } | null> {
  try {
    return JSON.parse((await getState(SOURCES_KEY)) ?? 'null')
  } catch {
    return null
  }
}

// Bugünden itibaren önümüzdeki günlerin olayları (ana sayfa kutusu, bülten)
export const upcomingSky = (limit = 20, days = 7) =>
  prisma.skyEvent.findMany({
    where: { date: { gte: istanbulDate(), lte: istanbulDate(new Date(Date.now() + days * 86_400_000)) } },
    orderBy: [{ date: 'asc' }, { time: 'asc' }],
    take: limit,
  })

// Bir ayın olayları ("2026-11")
export const monthSky = (month: string) =>
  prisma.skyEvent.findMany({ where: { date: { startsWith: `${month}-` } }, orderBy: [{ date: 'asc' }, { time: 'asc' }] })

export async function skyTask(settings: Settings): Promise<string> {
  const from = istanbulDate()
  const to = istanbulDate(new Date(Date.now() + (RANGE_DAYS - 1) * 86_400_000))
  const result = await complete(
    lessonSettings(settings),
    SKY,
    `Tarih aralığı: ${from} – ${to}`,
    { tools: [{ type: 'openrouter:web_search', parameters: { max_uses: 5, max_total_results: 25 } }], max_tokens: 8000 },
    10 * 60_000,
  )
  await addUsage(result.inputTokens, result.outputTokens)
  const events = parseSkyEvents(result.text, from, to)
  if (events.length === 0) throw new Error('Bu aralık için doğrulanmış gökyüzü olayı bulunamadı')
  await prisma.$transaction([prisma.skyEvent.deleteMany({ where: { date: { gte: from, lte: to } } }), prisma.skyEvent.createMany({ data: events })])
  const sources = Array.from(new Map(result.citations.map((c) => [c.url, c.title || c.url])), ([url, title]) => ({ url, title: title.slice(0, 200) })).slice(0, 10)
  await setState(SOURCES_KEY, JSON.stringify({ sources, updatedAt: new Date().toISOString() }))
  return `${from} – ${to} için ${events.length} olay`
}
