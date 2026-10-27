import { complete } from '@/lib/ai'
import { lessonSettings } from '@/lib/lessons'
import { addUsage, getState, setState, type Settings } from '@/lib/state'
import { parseSkyEvents, type SkyEvent } from '@/lib/text'

// Haftalık gökyüzü takvimi: önümüzdeki 7 günde Türkiye'den gözlenebilecek olaylar, web araştırmasıyla (OpenRouter).
// Sonuç AppState'te tek kayıt: ana sayfa kutusu, /gokyuzu ve bültenler buradan okur

export type Sky = { from: string; to: string; events: SkyEvent[]; sources: Array<{ title: string; url: string }>; updatedAt: string }

const KEY = 'sky.week'
export const istanbulDate = (date = new Date()) => date.toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' })

const SKY = `Bir gözlemsel astronomi editörüsün. Türkiye'den (yaklaşık 39° kuzey enlemi; saatler TSİ, UTC+3) verilen tarih aralığında
gözlenebilecek gökyüzü olaylarını web'de araştır: Ay evreleri ve Ay'ın gezegen/parlak yıldızlarla yakınlaşmaları, gezegen kavuşumları,
karşı konumlar ve en büyük uzanımlar, meteor yağmurlarının tepe noktaları, tutulmalar, parlak kuyruklu yıldızlar, haftanın öne çıkan
gezegen görünürlüğü. Güvenilir kaynak kullan (in-the-sky.org, timeanddate.com, NASA, Sky & Telescope, EarthSky, gözlemevleri).
Yalnızca kaynakla doğruladığın olayları yaz; aralık dışını yazma. Her olay için nasıl ve nereye bakılacağını 1-2 cümleyle anlat
(yön, saat, çıplak göz/dürbün/teleskop). Yanıtı yalnızca şu JSON biçiminde ver:
{"events": [{"date": "YYYY-MM-DD", "time": "SS:DD ya da boş", "title": "Kısa başlık", "detail": "Nasıl gözlenir"}]}`

export async function getSky(): Promise<Sky | null> {
  const raw = await getState(KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as Sky
  } catch {
    return null
  }
}

// Bugünden itibaren kalan olaylar (geçmiş günler kutuda görünmesin)
export async function upcomingSky(limit = 20): Promise<Sky | null> {
  const sky = await getSky()
  if (!sky) return null
  const today = istanbulDate()
  return { ...sky, events: sky.events.filter((e) => e.date >= today).slice(0, limit) }
}

export async function skyTask(settings: Settings): Promise<string> {
  const from = istanbulDate()
  const to = istanbulDate(new Date(Date.now() + 6 * 86_400_000))
  const result = await complete(
    lessonSettings(settings),
    SKY,
    `Tarih aralığı: ${from} – ${to}`,
    { tools: [{ type: 'openrouter:web_search', parameters: { max_uses: 5, max_total_results: 25 } }], max_tokens: 4000 },
    10 * 60_000,
  )
  await addUsage(result.inputTokens, result.outputTokens)
  const events = parseSkyEvents(result.text, from, to)
  const sources = Array.from(new Map(result.citations.map((c) => [c.url, c.title || c.url])), ([url, title]) => ({ url, title: title.slice(0, 200) })).slice(0, 10)
  if (events.length === 0) throw new Error('Bu hafta için doğrulanmış gökyüzü olayı bulunamadı')
  await setState(KEY, JSON.stringify({ from, to, events, sources, updatedAt: new Date().toISOString() } satisfies Sky))
  return `${from} – ${to} için ${events.length} olay`
}
