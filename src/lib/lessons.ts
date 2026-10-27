import { prisma } from '@/lib/prisma'
import { complete } from '@/lib/ai'
import { safeFetch } from '@/lib/net'
import { fetchText } from '@/lib/papers'
import { htmlToText } from '@/lib/arxiv'
import { addUsage, logJob, type Settings } from '@/lib/state'
import { extractJson, markdownLinks, parseLesson, slugify, unlink } from '@/lib/text'

// Eğitim bölümü: müfredattaki serileri derslere böler ve dersleri web'de araştırarak yazar.
// Konu seçimi yapay zekâya bırakılmaz: yalnızca müfredattaki sıradaki dersi yazar; müfredat bitince
// mevcut serilerle çakışmayan tek bir yeni seri önerir. Dersler taslak gelir, yönetici onaylayınca yayımlanır.

// Kullanıcının istediği konulardan başlangıç müfredatı (ilk çalışmada eklenir, panelden değiştirilebilir)
export const STARTER_SERIES = [
  { title: 'Optik ve Görüntü Oluşumu', summary: 'Kırınım ve Airy diski, açısal çözünürlük, nokta yayılım fonksiyonu, atmosferik seeing ve Fried parametresi, dalga cephesi hataları ve Zernike polinomları (kim buldu, neden ortaya çıktı, nerede kullanılır).' },
  { title: 'Uyarlamalı Optik ve Koronagraflar', summary: 'Atmosferik türbülansın düzeltilmesi: dalga cephesi algılayıcılar, deforme olabilen aynalar, lazer kılavuz yıldızlar; koronagrafların çalışma ilkesi ve türleri, yüksek kontrastlı görüntüleme ve gözlemevlerinde kullanılan örnekler.' },
  { title: 'Fotometri', summary: 'Kadir sistemleri ve filtreler, CCD temelleri, açıklık ve PSF fotometrisi, diferansiyel fotometri, sönümleme ve kalibrasyon, hata hesabı; kullanılan programlar (Astropy, photutils, IRAF/PyRAF) ve örnek kodlar.' },
  { title: 'Spektroskopi ve Radyal Hız', summary: 'Spektrograf türleri, dalgaboyu kalibrasyonu, Doppler kayması, çapraz korelasyon, radyal hız ölçümüyle ötegezegen ve çift yıldız çalışmaları, kesinliği sınırlayan etkenler.' },
  { title: 'Veri İndirgeme ve Yazılımlar', summary: 'Bias, dark, flat düzeltmeleri; FITS dosyaları; IRAF ne işe yarar ve nasıl kullanılır, günümüzde yerini alan Python araçları (Astropy, ccdproc, photutils), DS9; örnek komutlar ve kodlarla.' },
  { title: 'Yıldız Yapısı ve Evrimi', summary: 'Hidrostatik denge, yıldızın merkezindeki ve herhangi bir katmanındaki basıncın tahmini, durum denklemi, enerji üretimi ve taşınımı, yapı denklemlerinin sayısal çözümü.' },
  { title: 'Atom Fiziği ve Spektral Çizgiler', summary: 'Atomun enerji seviyeleri, bağlanma ve iyonlaşma enerjisi hesabı, geçişler ve seçim kuralları, Boltzmann ve Saha denklemleri, çizgi oluşumu ve genişlemesi.' },
  { title: 'Astronomide Modelleme', summary: 'Gözlemsel verinin fiziksel modelle karşılaştırılması: ışık eğrisi ve radyal hız modelleme, en küçük kareler ve MCMC ile parametre kestirimi, model seçimi; Python ile örnekler.' },
]

const REQUESTS_TITLE = 'Tek Dersler'

// Dersler OpenRouter'da (görsellerdeki anahtar) yazılır: web araması orada
function lessonSettings(settings: Settings): Settings {
  if (!settings.imageApiKey.trim()) throw new Error('Dersler OpenRouter anahtarını kullanır: Ayarlar → Görseller bölümüne gir')
  return { ...settings, aiProvider: 'openrouter', aiModel: settings.lessonModel.trim() || 'anthropic/claude-sonnet-5.5', aiApiKey: settings.imageApiKey, aiBaseUrl: '' }
}
const webSearch = (maxUses: number) => ({ tools: [{ type: 'openrouter:web_search', parameters: { max_uses: maxUses, max_total_results: 40 } }] })

async function uniqueSlug(title: string, taken: (slug: string) => Promise<boolean>): Promise<string> {
  const base = slugify(title) || 'ders'
  for (let i = 1; ; i++) {
    const slug = i === 1 ? base : `${base}-${i}`
    if (!(await taken(slug))) return slug
  }
}
const seriesSlug = (title: string) => uniqueSlug(title, async (slug) => !!(await prisma.series.findUnique({ where: { slug }, select: { id: true } })))
const lessonSlug = (title: string) => uniqueSlug(title, async (slug) => !!(await prisma.lesson.findUnique({ where: { slug }, select: { id: true } })))

export async function addSeries(title: string, summary: string, position?: number) {
  const last = await prisma.series.findFirst({ orderBy: { position: 'desc' }, select: { position: true } })
  return prisma.series.create({ data: { title, summary, slug: await seriesSlug(title), position: position ?? (last?.position ?? 0) + 1 } })
}

export async function addLesson(seriesId: number, title: string, scope: string, sourceUrls = '', position?: number) {
  const last = await prisma.lesson.findFirst({ where: { seriesId }, orderBy: { position: 'desc' }, select: { position: true } })
  return prisma.lesson.create({ data: { seriesId, title, scope, sourceUrls, slug: await lessonSlug(title), position: position ?? (last?.position ?? 0) + 1 } })
}

// Elle istenen tek ders: sıradaki ilk ders olur ("Tek Dersler" serisi müfredatta en önde)
export async function requestLesson(title: string, scope: string, sourceUrls: string) {
  const series =
    (await prisma.series.findFirst({ where: { title: REQUESTS_TITLE } })) ??
    (await prisma.series.create({ data: { title: REQUESTS_TITLE, summary: 'Müfredat dışında istenen konular.', slug: await seriesSlug(REQUESTS_TITLE), position: -1, planned: true } }))
  return addLesson(series.id, title, scope, sourceUrls)
}

const PLAN = `Bir astronomi ve astrofizik eğitimcisisin; lisans ve yüksek lisans öğrencilerine yönelik bir ders serisi planlıyorsun.
Önce web'de araştır (ders kitapları, üniversite ders notları, gözlemevi ve yazılım belgeleri): konu bugün nasıl öğretiliyor, hangi alt başlıklar şart, hangi sırayla.
Seriyi, konunun gerektirdiği sayıda derse böl (en az 4, en fazla 15). Her ders tek oturumda (20-30 dakikalık okuma) anlatılabilecek büyüklükte olsun;
sıra, önceki dersin bilgisini kullanan mantıklı bir ilerleme izlesin. Popüler bilim değil, yöntem ve mantık öğreten dersler olsun.
Yanıtı yalnızca şu JSON biçiminde ver: {"lessons": [{"title": "Kısa ders başlığı", "scope": "Bu derste neler anlatılacak, 1-2 cümle"}]}`

// Serinin ders listesini çıkarır (ders sayısına model, kapsama göre karar verir)
export async function planSeries(seriesId: number, settings: Settings): Promise<number> {
  const series = await prisma.series.findUniqueOrThrow({ where: { id: seriesId } })
  const others = await prisma.series.findMany({ where: { id: { not: seriesId } }, orderBy: { position: 'asc' }, select: { title: true } })
  const result = await complete(
    lessonSettings(settings),
    PLAN,
    `Seri: ${series.title}\nKapsam: ${series.summary}\nMüfredattaki diğer seriler (onların konusunu tekrar etme): ${others.map((s) => s.title).join(', ') || '-'}`,
    { ...webSearch(4), max_tokens: 4000 },
  )
  await addUsage(result.inputTokens, result.outputTokens)
  const data = extractJson(result.text) as { lessons?: Array<{ title?: unknown; scope?: unknown }> }
  const lessons = (Array.isArray(data.lessons) ? data.lessons : [])
    .filter((l) => typeof l.title === 'string' && l.title.trim())
    .slice(0, 15)
  if (lessons.length < 2) throw new Error('Ders planı çıkarılamadı')
  for (const [i, lesson] of lessons.entries()) await addLesson(series.id, String(lesson.title).trim().slice(0, 200), String(lesson.scope ?? '').trim().slice(0, 1000), '', i + 1)
  await prisma.series.update({ where: { id: series.id }, data: { planned: true } })
  return lessons.length
}

// Müfredat bitince: mevcutlarla çakışmayan bir sonraki seri
async function proposeSeries(settings: Settings) {
  const existing = await prisma.series.findMany({ orderBy: { position: 'asc' }, select: { title: true, summary: true } })
  const result = await complete(
    lessonSettings(settings),
    `Bir astronomi ve astrofizik müfredatı hazırlıyorsun (gözlemsel ve kuramsal astrofizik, enstrümantasyon, veri analizi). Mevcut serilerden sonra gelmesi gereken, onlarla çakışmayan TEK bir yeni ders serisi öner.
Popüler bilim değil, bir astronomi öğrencisinin bilmesi gereken yöntem, teknik ya da kuram olsun. Yanıtı yalnızca şu JSON biçiminde ver: {"title": "Seri adı", "summary": "Kapsam, 1-2 cümle"}`,
    `Mevcut seriler:\n${existing.map((s) => `- ${s.title}: ${s.summary}`).join('\n')}`,
    { max_tokens: 1000 },
  )
  await addUsage(result.inputTokens, result.outputTokens)
  const data = extractJson(result.text) as { title?: unknown; summary?: unknown }
  if (typeof data.title !== 'string' || !data.title.trim()) throw new Error('Yeni seri önerilemedi')
  return addSeries(data.title.trim().slice(0, 200), String(data.summary ?? '').trim().slice(0, 1000))
}

// Sıradaki yazılacak ders: önce elle istenenler, sonra müfredat sırası. Gerekirse sıradaki seriyi planlar
export async function nextLesson(settings: Settings) {
  if ((await prisma.series.count()) === 0) {
    for (const [i, series] of STARTER_SERIES.entries()) await addSeries(series.title, series.summary, i + 1)
    await logJob('Eğitim: başlangıç müfredatı eklendi (8 seri)')
  }
  const queued = () =>
    prisma.lesson.findFirst({ where: { status: 'planned', series: { planned: true } }, orderBy: [{ series: { position: 'asc' } }, { position: 'asc' }], include: { series: true } })
  const ready = await queued()
  if (ready) return ready
  const unplanned = (await prisma.series.findFirst({ where: { planned: false }, orderBy: { position: 'asc' } })) ?? (await proposeSeries(settings))
  const count = await planSeries(unplanned.id, settings)
  await logJob(`Eğitim: "${unplanned.title}" serisi ${count} derse bölündü`)
  return queued()
}

const LESSON = `Sen astronomi ve astrofizik öğreten deneyimli bir öğretim üyesisin. Lisans ve yüksek lisans öğrencileri için Türkçe bir ders yazıyorsun.
Amaç yalnızca anlatmak değil öğretmek: okur dersi bitirdiğinde yöntemi kendisi uygulayabilmeli ve neden, ne zaman kullanıldığını bilmeli.

ARAŞTIRMA (zorunlu): Yazmaya başlamadan önce web'de en az 4 farklı arama yap. Ders kitaplarını, üniversite ders notlarını, gözlemevi ve alet belgelerini,
hakemli makaleleri ve resmi yazılım belgelerini tercih et; forum ve içerik çiftliklerine güvenme. Bilgileri birden çok kaynakla karşılaştır; kaynaklar
çelişiyorsa bunu belirt. Kaynaklarda doğrulayamadığın sayı, tarih, isim ya da formül yazma. Yöntemin bilinen zayıflıklarını ve bugün tercih edilen
alternatifleri mutlaka yaz: eskimiş bir yöntemi tek doğru yol gibi anlatma.

BİÇİM: İlk satır "Özet: " ile başlayan tek cümlelik özet olsun. Sonra şu bölümler, bu başlıklarla ve bu sırayla:
## Nedir?
## Neden ortaya çıktı?
(hangi problemi çözdü; kim, ne zaman geliştirdi)
## Mantığı
(sezgisel açıklama; benzetmeler kullanabilirsin)
## Matematiği
(formüller ve adım adım türetme; terimlerin anlamı ve birimleri)
## Nasıl kullanılır?
(adım adım uygulama; gerekiyorsa çalışan örnek kod. Python için astropy/numpy/photutils gibi güncel araçları tercih et; IRAF anlatılıyorsa
komutlarını ver ve bugün yerini hangi araçların aldığını söyle)
## Ne zaman kullanılır?
(hangi gözlemde ve problemde; sınırları; alternatifleri ve aralarında nasıl seçim yapılır)
## Sık yapılan hatalar
## Alıştırma
(bir soru ve altında ayrıntılı çözümü)
## İleri okuma
(araştırmada gerçekten gördüğün kaynakların linkleri: kitap bölümü, ders notu, belge, makale; YouTube videosu yalnızca aramada çıktıysa)

KURALLAR: Formülleri LaTeX ile yaz: satır içi $...$, ayrı satırda $$...$$. Kodu dil adıyla üç ters tırnaklı blokta ver (\`\`\`python).
Linkleri yalnızca [metin](https://...) biçiminde ver ve yalnızca araştırmada açtığın sayfalara link ver; link uydurma.
Terimleri ilk geçtiklerinde açıkla, İngilizce karşılığını parantezde ver. Uzunluk 1500-3000 kelime.`

const SOURCE_CHARS = 12_000

// Link açılıyor mu? YouTube her adres için 200 döndüğünden videolar oEmbed ile denetlenir
async function linkWorks(url: string): Promise<boolean> {
  try {
    const youtube = /^https:\/\/(www\.|m\.)?(youtube\.com\/watch\?|youtu\.be\/)/.test(url)
    const target = youtube ? `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}` : url
    const response = await safeFetch(target, { headers: { 'User-Agent': 'Mozilla/5.0 (blog_ynh link denetimi)' }, signal: AbortSignal.timeout(15_000) })
    await response.body?.cancel()
    return response.status < 400
  } catch {
    return false
  }
}

// Dersi araştırarak yazar ve taslak olarak kaydeder. En az 3 doğrulanmış kaynak yoksa yazmaz (uydurma riskine karşı)
export async function writeLesson(lessonId: number, settings: Settings) {
  const lesson = await prisma.lesson.findUniqueOrThrow({ where: { id: lessonId }, include: { series: { include: { lessons: { orderBy: { position: 'asc' }, select: { id: true, title: true } } } } } })
  try {
    const given = lesson.sourceUrls.split('\n').map((l) => l.trim()).filter((l) => /^https?:\/\//.test(l)).slice(0, 3)
    const read: Array<{ url: string; text: string }> = []
    for (const url of given) {
      const text = await fetchText(url).then(htmlToText).catch(() => '')
      if (text) read.push({ url, text: text.slice(0, SOURCE_CHARS) })
    }
    const index = lesson.series.lessons.findIndex((l) => l.id === lesson.id)
    const user = [
      `Seri: ${lesson.series.title} — ${lesson.series.summary}`,
      `Ders: ${lesson.title}`,
      `Bu derste anlatılacaklar: ${lesson.scope || '-'}`,
      `Serinin önceki dersleri (bunları bildiğini varsay, tekrar anlatma): ${lesson.series.lessons.slice(0, index).map((l) => l.title).join('; ') || '-'}`,
      `Sonraki dersler (bunlara girme): ${lesson.series.lessons.slice(index + 1).map((l) => l.title).join('; ') || '-'}`,
      ...read.map((s, i) => `\nVerilen kaynak ${i + 1} (${s.url}) — önce bunu kullan:\n${s.text}`),
    ].join('\n')
    const result = await complete(lessonSettings(settings), LESSON, user, { ...webSearch(8), max_tokens: 12_000 })
    await addUsage(result.inputTokens, result.outputTokens)
    const parsed = parseLesson(result.text)
    if (!parsed) throw new Error('Ders beklenen biçimde yazılmadı')

    // Aramada gerçekten açılan sayfalar güvenilir; metindeki diğer linkler tek tek denetlenir
    const cited = new Map(result.citations.map((c) => [c.url, c.title]))
    const dead = new Set<string>()
    for (const url of markdownLinks(parsed.body)) if (!cited.has(url) && !(await linkWorks(url))) dead.add(url)
    const body = unlink(parsed.body, dead)
    const sources = new Map<string, string>([...read.map((s) => [s.url, s.url] as [string, string]), ...cited])
    for (const url of markdownLinks(body)) if (!sources.has(url)) sources.set(url, url)
    if (sources.size < 3) throw new Error(`Yalnızca ${sources.size} doğrulanmış kaynak bulundu; ders yazılmadı (en az 3 gerekir)`)

    return await prisma.lesson.update({
      where: { id: lesson.id },
      data: {
        body,
        excerpt: parsed.excerpt,
        sources: Array.from(sources, ([url, title]) => `${(title || url).replace(/[\t\n]/g, ' ').slice(0, 200)}\t${url}`).join('\n'),
        status: 'draft',
        error: '',
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      },
    })
  } catch (error) {
    // Hatalı ders kuyruğu tıkamaz: atlanır, panelden yeniden denenebilir
    await prisma.lesson.update({ where: { id: lesson.id }, data: { status: lesson.status === 'planned' ? 'failed' : lesson.status, error: String((error as Error).message || error).slice(0, 300) } })
    throw error
  }
}

// Zamanlanmış iş: sıradaki dersi yazar (taslak; yönetici onaylar)
export async function lessonTask(settings: Settings): Promise<string> {
  lessonSettings(settings)
  const lesson = await nextLesson(settings)
  if (!lesson) return 'yazılacak ders yok'
  await logJob(`Eğitim: "${lesson.title}" (${lesson.series.title}) araştırılıp yazılıyor…`)
  const written = await writeLesson(lesson.id, settings)
  return `"${written.title}" taslak olarak hazır (onaylayınca yayımlanır)`
}
