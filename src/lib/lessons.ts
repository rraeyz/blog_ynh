import { prisma } from '@/lib/prisma'
import { complete } from '@/lib/ai'
import { safeFetch } from '@/lib/net'
import { fetchText } from '@/lib/papers'
import { htmlToText } from '@/lib/arxiv'
import { addUsage, getState, logJob, overBudget, setState, type Settings } from '@/lib/state'
import { markdownLinks, parseConcepts, parseIssues, parseLesson, parsePlan, slugify, unlink } from '@/lib/text'
import { isLevel, LEVELS, type Level } from '@/lib/levels'
import type { LessonLinks } from '@/lib/markdown'
import {
  catalogStages, CONCEPT_SCOPE, FIRST_ROUND, NOTATION, nextTracks, pickStage, requirementsOf, SERIES, stageDone, TERMS, TRACKS, type Track,
} from '@/lib/curriculum'

// Eğitim bölümü. Konu seçimi yapay zekâya bırakılmaz: önce elle istenen dersler, sonra müfredat (lib/curriculum.ts).
// Müfredat hatlardan oluşur (uygulama, astronomi, temel bilim, kavram); her hattın blokları (serinin bir aşaması) sırayla işlenir,
// blok sırası gelince araştırılarak derslere bölünür. Her ders öğrettiklerini kaydeder (covers); sonraki dersler bunları bilinen sayar.
// Her ders üç aşamada hazırlanır: web araştırması (notlar + kaynaklar) → notlardan yazım → notlarla karşılaştırmalı denetim.

const REQUESTS_TITLE = 'Tek Dersler'
const LONG = 15 * 60_000 // uzman seviyesinde uzun ders yazımı dakikalar sürer

// Dersler OpenRouter'da (Ayarlar → Yapay zekâ'daki anahtar) yazılır: web araması orada. Maliyetin çoğu araştırmanın okuduğu sayfalardan
// gelir; bu yüzden araştırma, plan, denetim ve gökyüzü ucuz "yardımcı" modelle, yalnızca okurun gördüğü yazım ders modeliyle yapılır
export function lessonSettings(settings: Settings, role: 'yazim' | 'yardimci' = 'yardimci'): Settings {
  if (!settings.imageApiKey.trim()) throw new Error('Dersler OpenRouter anahtarını kullanır: Ayarlar → Yapay zekâ bölümüne gir')
  const model = role === 'yazim' ? settings.lessonModel.trim() || 'anthropic/claude-sonnet-5.5' : settings.lessonHelperModel.trim() || 'anthropic/claude-haiku-5.5'
  return { ...settings, aiProvider: 'openrouter', aiModel: model, aiApiKey: settings.imageApiKey, aiBaseUrl: '' }
}
const webSearch = (maxUses: number) => ({ tools: [{ type: 'openrouter:web_search', parameters: { max_uses: maxUses, max_total_results: 30 } }] })

async function ask(settings: Settings, system: string, user: string, extra: Record<string, unknown>, timeoutMs?: number, role: 'yazim' | 'yardimci' = 'yardimci') {
  const result = await complete(lessonSettings(settings, role), system, user, extra, timeoutMs)
  await addUsage(result.inputTokens, result.outputTokens)
  return result
}

async function uniqueSlug(title: string, taken: (slug: string) => Promise<boolean>): Promise<string> {
  const base = slugify(title) || 'ders'
  for (let i = 1; ; i++) {
    const slug = i === 1 ? base : `${base}-${i}`
    if (!(await taken(slug))) return slug
  }
}
const seriesSlug = (title: string) => uniqueSlug(title, async (slug) => !!(await prisma.series.findUnique({ where: { slug }, select: { id: true } })))
const lessonSlug = (title: string) => uniqueSlug(title, async (slug) => !!(await prisma.lesson.findUnique({ where: { slug }, select: { id: true } })))

// Katalogda olup veritabanında olmayan seri ve blokları ekler; var olana dokunmaz (panelde değişen sıra, kapsam kalır)
export async function seedCurriculum(): Promise<number> {
  const existing = new Set((await prisma.stage.findMany({ select: { key: true } })).map((s) => s.key))
  const missing = catalogStages().filter((s) => !existing.has(s.key))
  if (missing.length === 0) return 0
  const seriesIds = new Map((await prisma.series.findMany({ select: { id: true, slug: true } })).map((s) => [s.slug, s.id]))
  const defs = [...SERIES, { key: 'kavramlar', title: 'Kavramlar', track: 'kavram', summary: 'Tek derslik "astronomi kültürü" dersleri: ne olduğu, ne işe yaradığı, nerede karşına çıktığı.' }]
  for (const [i, def] of defs.entries()) {
    if (seriesIds.has(def.key) || !missing.some((s) => s.series === def.key)) continue
    const created = await prisma.series.create({ data: { slug: def.key, title: def.title, summary: def.summary, track: def.track, position: (i + 1) * 10 } })
    seriesIds.set(def.key, created.id)
  }
  await prisma.stage.createMany({
    data: missing.map(({ series, ...stage }) => ({ ...stage, seriesId: seriesIds.get(series)! })),
  })
  return missing.length
}

export async function addLesson(seriesId: number, title: string, scope: string, sourceUrls = '', position?: number, level: Level = 'kapsamli', stageId: number | null = null) {
  const last = await prisma.lesson.findFirst({ where: { seriesId }, orderBy: { position: 'desc' }, select: { position: true } })
  return prisma.lesson.create({ data: { seriesId, stageId, title, scope, sourceUrls, level, slug: await lessonSlug(title), position: position ?? (last?.position ?? 0) + 1 } })
}

// Elle istenen tek ders: sıradaki ilk ders olur ("Tek Dersler" serisi müfredatta en önde)
export async function requestLesson(title: string, scope: string, sourceUrls: string) {
  const series =
    (await prisma.series.findFirst({ where: { title: REQUESTS_TITLE } })) ??
    (await prisma.series.create({ data: { title: REQUESTS_TITLE, summary: 'Müfredat dışında istenen konular.', slug: await seriesSlug(REQUESTS_TITLE), position: -1, planned: true } }))
  return addLesson(series.id, title, scope, sourceUrls, undefined, 'kapsamli')
}

// Panelden blok ekleme: serisi yoksa hattında yeni seri açılır; blok hattın sonuna girer
export async function addStage(track: Track, seriesTitle: string, level: Level, summary: string) {
  const kavram = track === 'kavram'
  const series = kavram
    ? await prisma.series.findUniqueOrThrow({ where: { slug: 'kavramlar' } })
    : (await prisma.series.findFirst({ where: { title: seriesTitle, track } })) ??
      (await prisma.series.create({ data: { title: seriesTitle, summary, track, slug: await seriesSlug(seriesTitle), position: ((await prisma.series.aggregate({ _max: { position: true } }))._max.position ?? 0) + 10 } }))
  const key = kavram ? `kavram/${slugify(seriesTitle)}` : `${series.slug}/${level}`
  if (await prisma.stage.findUnique({ where: { key } })) throw new Error(kavram ? 'Bu kavram zaten var' : 'Bu serinin bu aşaması zaten var')
  const last = await prisma.stage.aggregate({ where: { track }, _max: { position: true } })
  return prisma.stage.create({
    data: { key, seriesId: series.id, track, level: kavram ? 'kapsamli' : level, title: kavram ? seriesTitle : `${series.title} · ${LEVELS[level].label}`, summary, position: (last._max.position ?? 0) + 10 },
  })
}

// Yazım ve denetime giden seviye tarifi, matematikle (okura görünen kısa adlar lib/levels.ts'te)
const LEVEL_GUIDE: Record<Level, string> = {
  temel: 'lise matematiği (cebir, trigonometri, logaritma) yeter; türev ve integral kullanma. Kavramlar, sezgi, tarihçe ve basit sayısal hesaplar; kod yalnızca konu gerektiriyorsa ve basit',
  orta: 'türev, integral, vektörler ve basit diferansiyel denklemler kullanılabilir. Yöntemin matematiği adım adım türetilir; konu uygulamalıysa çalışan kod ve gerçekçi örnek',
  ileri: 'Fourier dönüşümü, kısmi türevli denklemler, kuantum mekaniği ve istatistiksel çıkarım kullanılabilir. Tam türetmeler, gerçek veriyle uygulama, araştırmada kullanılan yöntemler, sınırlar ve güncel alternatifler',
  kapsamli: 'tek derste temelden uzman seviyesine: önce sezgi ve temel kavramlar (lise matematiği), sonra matematik, sonra uygulama (konu gerektiriyorsa kod); ağır matematik "Merak edene" kutusunda',
}
const BASELINE = 'lise matematiği (cebir, trigonometri, logaritma) ve giriş fiziği'

const PLAN = `Bir astronomi ve astrofizik eğitimcisisin; bir ders serisinin tek bir aşamasını (bloğunu) derslere bölüyorsun.
Önce web'de araştır (gözlemevi ve yazılım belgeleri, ders notları, güncel yöntemler): bu aşamanın konusu bugün nasıl öğretiliyor ve
uygulanıyor, hangi alt başlıklar şart, hangi sırayla. Bir ders kitabının ya da üniversite programının sırasını kopyalama: okurun işine yarayan sıra.
"Önerilen dersler" başlangıç noktasıdır: araştırmana göre birleştir, böl ya da eksik olanı ekle. Ders sayısı önerinin yakınında kalsın
(en fazla 2 fazla ya da eksik); öneride sayı yoksa 2 ile 6 arası.
Her ders tek bir kavramı ya da yöntemi eksiksiz anlatacak büyüklükte olsun. Aşamanın seviyesinin dışına çıkma. Serinin önceki aşamalarında
anlatılanı tekrar etme, sonraki aşamaların konusuna girme. Popüler bilim değil, yöntem ve mantık öğreten dersler olsun.
Yanıtta yalnızca ders satırları olsun, sırayla, her ders tek satırda (başlık satırı, numara, JSON yok):
DERS | Kısa ders başlığı | Bu derste neler anlatılacak, 1-3 cümle
Örnek: DERS | Bias, dark ve flat: neden ve nasıl | CCD'deki üç sistematik etkinin kaynağı; düzeltme görüntülerinin alınması ve uygulanması.`

// Bloğu derslere böler. Kavram tek derstir, yapay zekâya sorulmaz
export async function planStage(stageId: number, settings: Settings): Promise<number> {
  const stage = await prisma.stage.findUniqueOrThrow({ where: { id: stageId }, include: { series: { include: { stages: true, lessons: { orderBy: { position: 'asc' }, select: { title: true } } } } } })
  if (stage.planned) return 0
  if (stage.track === 'kavram') {
    await addLesson(stage.seriesId, stage.title, [stage.summary, CONCEPT_SCOPE].filter(Boolean).join(' '), '', undefined, 'kapsamli', stage.id)
    await prisma.stage.update({ where: { id: stage.id }, data: { planned: true } })
    return 1
  }
  const level: Level = isLevel(stage.level) ? stage.level : 'kapsamli'
  const rank = (l: string) => ['temel', 'orta', 'ileri'].indexOf(l)
  const later = stage.series.stages.filter((s) => rank(s.level) > rank(stage.level))
  const result = await ask(
    settings,
    PLAN,
    [
      `Seri: ${stage.series.title} — ${stage.series.summary}`,
      `Hat: ${TRACKS[stage.track as Track] ?? stage.track}${stage.track === 'uygulama' ? ' (her ders elle yapılacak bir işi öğretir: kod, araç, gerçek veri)' : ''}`,
      `Aşama: ${LEVELS[level].label} — ${LEVEL_GUIDE[level]}`,
      `Önerilen dersler: ${stage.summary || '-'}`,
      `Serinin önceki aşamalarındaki dersler (tekrar etme): ${stage.series.lessons.map((l) => l.title).join('; ') || '-'}`,
      `Serinin sonraki aşamaları (bunlara girme): ${later.map((s) => `${LEVELS[s.level as Level]?.label ?? s.level}: ${s.summary}`).join(' / ') || '-'}`,
    ].join('\n'),
    { ...webSearch(4), max_tokens: 16_000 },
  )
  const lessons = parsePlan(result.text)
  if (lessons.length === 0) throw new Error('Ders planı çıkarılamadı')
  for (const lesson of lessons) await addLesson(stage.seriesId, lesson.title, lesson.scope, '', undefined, level, stage.id)
  await prisma.stage.update({ where: { id: stage.id }, data: { planned: true } })
  await logJob(`Eğitim: "${stage.title}" ${lessons.length} derse bölündü`)
  return lessons.length
}

// Müfredatın durumu: bloklar (sırada bekleyen ders sayısıyla) ve hatların sırası
async function curriculum() {
  const rows = await prisma.stage.findMany({ include: { _count: { select: { lessons: { where: { status: 'planned' } } } } } })
  const stages = rows.map(({ _count, ...stage }) => ({ ...stage, pending: _count.lessons }))
  const written = await prisma.lesson.findMany({ where: { writtenAt: { not: null }, stageId: { not: null } }, orderBy: { writtenAt: 'desc' }, select: { stage: { select: { track: true } } } })
  const byKey = new Map(stages.map((s) => [s.key, s]))
  const firstRoundDone = FIRST_ROUND.every((key) => { const s = byKey.get(key); return !s || stageDone(s) })
  return { stages, tracks: nextTracks(written.map((l) => l.stage?.track ?? ''), firstRoundDone) }
}

// Sıradaki blok (bölmeden): panelde "sırada" göstermek için
export async function upcomingStage() {
  const { stages, tracks } = await curriculum()
  for (const track of tracks) {
    const stage = pickStage(stages, track)
    if (stage) return stage
  }
  return null
}

// Sıradaki yazılacak ders: önce elle istenenler, sonra hatların sırasıyla ilk hazır blok. Bölünemeyen blok o gün atlanır
export async function nextLesson(settings: Settings) {
  await seedCurriculum()
  const request = await prisma.lesson.findFirst({ where: { status: 'planned', series: { position: { lt: 0 } } }, orderBy: { position: 'asc' }, include: { series: true } })
  if (request) return request
  const { stages, tracks } = await curriculum()
  for (const track of tracks) {
    const stage = pickStage(stages, track)
    if (!stage) continue
    try {
      await planStage(stage.id, settings)
    } catch (error) {
      await logJob(`Eğitim: "${stage.title}" derslere bölünemedi (${String((error as Error).message || error).slice(0, 120)}); sıradaki hatla devam`)
      continue
    }
    const lesson = await prisma.lesson.findFirst({ where: { stageId: stage.id, status: 'planned' }, orderBy: { position: 'asc' }, include: { series: true } })
    if (lesson) return lesson
  }
  return null
}

const RESEARCH = `Bir astronomi ve astrofizik araştırma asistanısın. Bir dersin yazılmasından önce konuyu araştırıp eksiksiz notlar çıkaracaksın;
dersi başka biri bu notlardan yazacak ve notlarda olmayan hiçbir bilgiyi kullanmayacak.
Web'de en az 6 farklı arama yap. Ders kitaplarını, üniversite ders notlarını, gözlemevi ve alet belgelerini, hakemli makaleleri ve resmi yazılım
belgelerini tercih et; forum ve içerik çiftliklerine güvenme. Bilgileri birden çok kaynakla karşılaştır; çelişkileri yaz.
Notlarda bulunsun:
- tanımlar ve kavramlar; tarihçe (kim, ne zaman, hangi problemi çözmek için);
- bütün temel formüller LaTeX ile ($...$), türetme adımları, terimlerin anlamı ve birimleri, tipik sayısal değerler;
- yöntemin adım adım uygulanışı; kullanılan yazılımlar ve gerçek fonksiyon/komut adları (Python: astropy, numpy, photutils, opencv gibi;
  IRAF anlatılıyorsa komutları ve bugün yerini neyin aldığı); kütüphanelerin güncel sürüm numaraları ve son sürümlerde değişen fonksiyonlar;
- gerçekçi bir uygulamalı örnek için veri ve parametreler (uygulama dersinde herkesin indirebileceği açık bir veri kümesi ve adresi); sık yapılan hatalar; yöntemin zayıflıkları ve modern alternatifleri;
- iyi öğretim kaynakları (ders notu, belge, kitap bölümü, gerçekten bulduğun video).
Her bilginin sonunda hangi kaynaktan geldiğini [1], [2] diye belirt ve en sonda "Kaynaklar" başlığı altında numaralı listede [n] Başlık — URL yaz.
Doğrulayamadığın hiçbir şeyi not etme.`


const WRITE = `Sen astronomi ve astrofizik öğreten deneyimli bir öğretim üyesisin. Türkçe, eksiksiz bir ders yazıyorsun.
Amaç: dersi baştan sona okuyan, örnekleri deneyen ve alıştırmaları çözen kişi bu dersin konusunu tamamen öğrensin; neden ve ne zaman
kullanıldığını bilsin; neyi bilmesi gerektiğini ve neyi ezberlemesine gerek olmadığını açıkça görsün. Uzunluk sınırı yok: konu ne kadar
gerektiriyorsa o kadar yaz, hiçbir adımı atlama.

SEVİYE: "Bu dersin seviyesi" satırındaki matematikle yaz; o matematiğin ötesine geçen ayrıntı "Merak edene" kutusuna gider. Konu doğası
gereği zorsa sulandırma: gereken her aracı öğret.
OKUR: "Okurun bildikleri" satırındakileri bilir; geri kalan her kavramı, sembolü ve matematik aracını açıklamadan kullanma. Önceki derslerde
öğretileni yeniden anlatma, gerekirse bir cümleyle hatırlat ve o derse bağlantı ver. Her formülü önce sözle ve sezgiyle anlat, sonra yaz;
türetmede adım atlama ve her adımda ne yaptığını söyle.
UYGULAMA DERSİ (hat "Uygulama" ise): elle yapılacak işi adım adım öğret. Gereken kuramı bekletme: "Ön bilgiler"de işi yapmaya yetecek kadar
anlat, ayrıntısı için ilgili derse bağlantı ver. Kod çalışır, yorum satırlı ve açık (indirilebilir) veriyle olsun; her kod bloğunun sonunda
bir yorum satırında hangi kütüphane sürümleriyle yazıldığını belirt.
KAVRAM DERSİ (hat "Kavramlar" ise): kendi başına okunur: ne olduğu, ne işe yaradığı, astronomide nerede karşına çıktığı, tipik değerleri.
Matematiği "Merak edene" kutusunda; konu bir seride ayrıntılı anlatılıyorsa kısa tut ve o seriye bağlantı ver.

Bilgiler yalnızca verilen araştırma notlarından gelir; notlarda olmayan sayı, tarih, isim, deney sonucu ya da fonksiyon adı ekleme. Temel
matematik ve fizik araçlarının ders kitabı tanımları ve kendi yaptığın cebir bu sınırın dışındadır. Metinde araştırma sürecinden, notlardan,
kaynakların neyi doğrulayıp doğrulamadığından ya da aralarındaki çelişkilerden söz etme: okur yalnızca dersi görür. Doğrulanmamış bilgiyi hiç yazma.

BİÇİM: İlk satır "Özet: " ile başlayan tek cümle. İkinci satır "Önkoşul: " ve BAĞLANTI LİSTESİ'nden bu dersten önce okunması gereken en
fazla 3 anahtar, virgülle (yoksa "Önkoşul: yok"). Üçüncü satır "Öğretilenler: " ve bu derste öğrettiğin kavram ve araçların virgüllü kısa
listesi (sonraki dersler bunları bilinen sayar). Sonra şu bölümler, bu başlıklarla ve bu sırayla; köşeli parantezli olanları yalnızca dersin
içeriği gerektiriyorsa yaz:
## Bu dersten aklında kalacaklar
(3-5 madde: dersi bitiren okurun bilmesi gereken en önemli sonuçlar, birer cümle)
[## Ön bilgiler]
(okurun bilmediği ama dersin kullandığı her kavram ve matematik aracı için kendi başına yeten kısa bir açıklama: sade tanım, neden gerektiği,
küçük bir sayısal örnek. Sonunda dersteki sembollerin tablosu: | Sembol | Anlamı | Birimi |)
## Nedir?
## Neden ortaya çıktı?
## Mantığı
[## Matematiği]
(formüllerin türetmesi; terimlerin anlamı ve birimleri)
[## Nasıl kullanılır?]
(adım adım yöntem ve araçlar; konu hesaplamaya ya da veri işlemeye dayanıyorsa çalışan, yorum satırlı kod)
## Uygulamalı örnek
(baştan sona çözülmüş tam bir örnek: kavramsal derste elle hesap ya da gerçek bir gözlem üzerinden; uygulamalı derste kod, beklenen çıktı ve yorumu)
[## Ne zaman kullanılır?]
(hangi gözlemde ve problemde; sınırları; alternatifleri ve aralarında nasıl seçim yapılır)
## Sık yapılan hatalar
## Alıştırmalar
(kolaydan zora en az 3 alıştırma; her birinin ayrıntılı çözümü ayrı satırlarda ":::cozum" ile ":::" arasında)
## Özet ve sonraki adımlar
## Bağlantılı kavramlar
(3-8 madde, her biri "[[anahtar|metin]]: ilişkisi bir cümleyle"; yalnızca BAĞLANTI LİSTESİ'ndeki anahtarlar)
## İleri okuma
(yalnızca notların kaynak listesindeki linkler)

KUTULAR: metnin içinde, ait oldukları yerde, ayrı satırlarda açılıp ":::" satırıyla kapanır:
:::bilmen — okurun bilmesi ve kendi cümlesiyle anlatabilmesi gereken kavram ya da sonuç; kısa. Ana bölümlerin çoğunda bir tane olsun.
:::hesap — okurun yapabilmesi gereken hesap ya da kod: formül, ne zaman kullanılacağı, küçük bir sayısal örnek.
:::merak — ezberlenmesi gerekmeyen ayrıntı: uzun türetmeler, ileri matematik, tarihî ayrıntı. Okur bunu atlayıp dersi yine anlayabilmeli.
Kutuların içinde başlık (##) ve başka kutu kullanma.

BAĞLANTILAR: Başka bir dersin konusuna değinince onu yeniden anlatma; bir cümleyle hatırlat ve [[anahtar|metin]] biçiminde bağlantı ver.
Yalnızca BAĞLANTI LİSTESİ'ndeki anahtarları kullan. O ders henüz yazılmadıysa sayfada "ileride" görünür; sen yine bağlantıyı yaz.

TERİMLER: TERİM LİSTESİ'ndeki Türkçe karşılıkları kullan, aynı kavrama başka ad verme; ilk geçişte İngilizcesini parantezde ver.
Listede olmayan terimde yerleşik Türkçe karşılığı kullan.
GÖSTERİM: GÖSTERİM KURALLARI'na uy.
KURALLAR: Formüller LaTeX: satır içi $...$, ayrı satırda $$...$$. Kod dil adıyla üç ters tırnaklı blokta (\`\`\`python). Linkler yalnızca
[metin](https://...) biçiminde ve yalnızca notların kaynaklarından. Numaralı adımlar için "1. " listesi, karşılaştırma için "| a | b |" tablosu
kullanabilirsin. Eskimiş bir yöntemi tek doğru yol gibi anlatma.`

const CHECK = `Bir astronomi dersinin bilimsel editörüsün. Sana dersin hattı ve seviyesi, okurun bildikleri, terim listesi, araştırma notları (kaynaklı)
ve yazılmış ders verilecek. Dersi notlarla karşılaştır ve yalnızca gerçek sorunları bul: yanlış ya da notlarla çelişen formül, katsayı, birim,
sayı, isim ya da tarih; notlarda dayanağı olmayan önemli iddialar; çalışmayacak ya da yanlış API kullanan kod; çözümü hatalı alıştırmalar;
eskimiş yöntemin tek doğru gibi sunulması.
Sonra dersi yalnızca "okurun bildikleri"ni bilen birinin gözüyle oku: açıklanmadan kullanılan kavram, sembol ya da matematik aracı; okurun
izleyemeyeceği atlanmış türetme adımı; seviyesine göre fazla zor (seviye tanımının dışındaki matematik kutu dışında) ya da fazla sulandırılmış
bölüm; araştırma sürecine dair metin ("notlarda", "kaynaklar doğrulamadı" gibi).
Küçük sayılacaklar: ezberlenmesi gereken temel sonucun "merak" kutusunda ya da uzun türetmenin "bilmen" kutusunda olması; terim listesine
aykırı terim; uygulama dersinde kod sürüm satırının olmaması.
Üslup ve yazım tercihlerini sorun sayma.
Yanıtta yalnızca sorun satırları olsun, her sorun tek satırda (JSON yok):
ciddi ya da küçük | bölüm ya da kısa alıntı | sorun | doğrusu
"ciddi": okuru yanlış öğrenmeye götürür ya da okur bir bölümü hiç izleyemez. Hiç sorun yoksa yalnızca SORUN YOK yaz.`

const TERM_LIST = `TERİM LİSTESİ: ${TERMS.join('; ')}`
const NOTATION_LIST = `GÖSTERİM KURALLARI:\n${NOTATION.map((n) => `- ${n}`).join('\n')}`

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

// Derslerdeki [[anahtar]] bağlantıları için: blok anahtarı → bloğun yayımlanmış ilk dersi (henüz yoksa null: "ileride")
export async function lessonLinks(): Promise<LessonLinks> {
  const stages = await prisma.stage.findMany({
    where: { approved: true },
    select: { key: true, title: true, series: { select: { slug: true } }, lessons: { where: { status: 'published' }, orderBy: { position: 'asc' }, take: 1, select: { slug: true } } },
  })
  return Object.fromEntries(stages.map((s) => [s.key, { title: s.title, href: s.lessons[0] ? `/egitim/${s.series.slug}/${s.lessons[0].slug}` : null }]))
}

// Dersi üç aşamada hazırlar. En az 3 doğrulanmış kaynak yoksa yazmaz (uydurma riskine karşı).
// Denetim temizse ve ayar açıksa yayımlar; değilse bulgularıyla taslak bırakır
export async function writeLesson(lessonId: number, settings: Settings) {
  const lesson = await prisma.lesson.findUniqueOrThrow({
    where: { id: lessonId },
    include: { stage: true, series: { include: { lessons: { orderBy: { position: 'asc' }, select: { id: true, title: true, covers: true } } } } },
  })
  try {
    // 1. Araştırma: elle verilen kaynaklar okunur, sonra web araması
    const given = lesson.sourceUrls.split('\n').map((l) => l.trim()).filter((l) => /^https?:\/\//.test(l)).slice(0, 3)
    const read: Array<{ url: string; text: string }> = []
    for (const url of given) {
      const text = await fetchText(url).then(htmlToText).catch(() => '')
      if (text) read.push({ url, text: text.slice(0, SOURCE_CHARS) })
    }
    const track = (lesson.stage?.track ?? '') as Track | ''
    const kavram = track === 'kavram'
    const index = lesson.series.lessons.findIndex((l) => l.id === lesson.id)
    const level: Level = isLevel(lesson.level) ? lesson.level : 'kapsamli'
    // Okurun bildikleri: serinin önceki dersleri (kavramlar birbirinden bağımsız) ve bloğun başka serilerdeki önkoşullarında öğretilenler
    const { stages } = await curriculum()
    const byKey = new Map(stages.map((s) => [s.key, s]))
    const own = lesson.stageId ? stages.find((s) => s.id === lesson.stageId) : undefined
    const requiredIds = own ? requirementsOf(own, stages).flatMap((key) => { const s = byKey.get(key); return s && s.seriesId !== lesson.seriesId ? [s.id] : [] }) : []
    const background = requiredIds.length ? await prisma.lesson.findMany({ where: { stageId: { in: requiredIds }, covers: { not: '' } }, orderBy: { position: 'asc' }, select: { covers: true } }) : []
    const known = [...(kavram ? [] : lesson.series.lessons.slice(0, index)), ...background].map((l) => l.covers).filter(Boolean).join('; ').slice(0, 8000)
    const reader = [
      `Hat: ${track ? TRACKS[track] : 'İstek (müfredat dışı tek ders)'}`,
      `Bu dersin seviyesi: ${LEVELS[level].label} — ${LEVEL_GUIDE[level]}`,
      `Okurun bildikleri: ${BASELINE}${known ? `; önceki derslerde öğrendikleri: ${known}` : ''}`,
    ].join('\n')
    const context = [
      `Seri: ${lesson.series.title} — ${lesson.series.summary}`,
      ...(lesson.stage && !kavram ? [`Aşama: ${lesson.stage.title} — ${lesson.stage.summary}`] : []),
      reader,
      `Ders: ${lesson.title}`,
      `Bu derste anlatılacaklar: ${lesson.scope || '-'}`,
      ...(kavram
        ? []
        : [
            `Serinin önceki dersleri: ${lesson.series.lessons.slice(0, index).map((l) => l.title).join('; ') || '-'}`,
            `Serinin sonraki dersleri (bunlara girme): ${lesson.series.lessons.slice(index + 1).map((l) => l.title).join('; ') || '-'}`,
          ]),
    ].join('\n')
    await logJob(`Eğitim: "${lesson.title}" 1/3 araştırılıyor…`)
    const research = await ask(settings, RESEARCH, [context, ...read.map((s, i) => `\nVerilen kaynak ${i + 1} (${s.url}) — önce bunu kullan:\n${s.text}`)].join('\n'), { ...webSearch(10), max_tokens: 32_000 }, LONG)
    const sources = new Map<string, string>([...read.map((s) => [s.url, s.url] as [string, string]), ...research.citations.map((c) => [c.url, c.title] as [string, string])])
    for (const url of markdownLinks(research.text.replace(/(https?:\/\/[^\s)\]]+)/g, '[k]($1)'))) if (!sources.has(url) && (await linkWorks(url))) sources.set(url, url)
    if (sources.size < 3) throw new Error(`Araştırmada yalnızca ${sources.size} doğrulanmış kaynak bulundu; ders yazılmadı (en az 3 gerekir)`)
    const sourceList = Array.from(sources, ([url, title], i) => `[${i + 1}] ${title || url} — ${url}`).join('\n')

    // 2. Yazım: yalnızca notlardan; bağlantı ve önkoşullar müfredat anahtarlarıyla
    const targets = stages.filter((s) => s.approved && s.id !== lesson.stageId)
    const titles = new Map((await prisma.stage.findMany({ where: { id: { in: targets.map((s) => s.id) } }, select: { id: true, title: true } })).map((s) => [s.id, s.title]))
    if (await overBudget(settings)) throw new Error('Aylık token sınırına ulaşıldı')
    await logJob(`Eğitim: "${lesson.title}" 2/3 yazılıyor…`)
    const written = await ask(
      settings,
      WRITE,
      [
        context,
        `ARAŞTIRMA NOTLARI:\n${research.text}`,
        `KAYNAKLAR (linkler yalnızca bunlardan):\n${sourceList}`,
        `BAĞLANTI LİSTESİ (anahtar — konu):\n${targets.map((s) => `${s.key} — ${titles.get(s.id) ?? s.key}`).join('\n') || '-'}`,
        TERM_LIST,
        NOTATION_LIST,
      ].join('\n\n'),
      { max_tokens: 32_000 },
      LONG,
      'yazim',
    )
    const parsed = parseLesson(written.text)
    if (!parsed) throw new Error('Ders beklenen biçimde yazılmadı')
    const dead = new Set<string>()
    for (const url of markdownLinks(parsed.body)) if (!sources.has(url) && !(await linkWorks(url))) dead.add(url)
    const body = unlink(parsed.body, dead)
    for (const url of markdownLinks(body)) if (!sources.has(url)) sources.set(url, url)
    const prerequisites = parsed.prerequisites.filter((key) => byKey.has(key) && key !== own?.key).slice(0, 3)

    // 3. Denetim: notlarla karşılaştırma; ciddi sorun varsa ders yayımlanmaz
    await logJob(`Eğitim: "${lesson.title}" 3/3 denetleniyor…`)
    const check = await ask(settings, CHECK, `${reader}\n\n${TERM_LIST}\n\nARAŞTIRMA NOTLARI:\n${research.text}\n\nDERS:\n${body}`, { max_tokens: 16_000 }, LONG)
    const { issues, readable } = parseIssues(check.text)
    const review = readable
      ? issues.map((i) => `- **${i.major ? 'Ciddi' : 'Küçük'}** · ${i.where}: ${i.problem}${i.fix ? ` → ${i.fix}` : ''}`).join('\n')
      : '- **Ciddi** · Denetim yanıtı okunamadı: yayımlamadan önce dersi elle kontrol et'
    const publish = settings.lessonAutoPublish && readable && !issues.some((i) => i.major)

    return await prisma.lesson.update({
      where: { id: lesson.id },
      data: {
        body,
        excerpt: parsed.excerpt,
        covers: parsed.covers,
        research: research.text,
        review,
        prerequisites: prerequisites.join(','),
        sources: Array.from(sources, ([url, title]) => `${(title || url).replace(/[\t\n]/g, ' ').slice(0, 200)}\t${url}`).join('\n'),
        status: publish ? 'published' : 'draft',
        publishedAt: publish ? lesson.publishedAt ?? new Date() : lesson.publishedAt,
        // Yeniden yazım hatların dönüşümünü kaydırmasın
        writtenAt: lesson.writtenAt ?? new Date(),
        error: '',
        inputTokens: research.inputTokens + written.inputTokens + check.inputTokens,
        outputTokens: research.outputTokens + written.outputTokens + check.outputTokens,
      },
    })
  } catch (error) {
    // Hatalı ders kuyruğu tıkamaz: atlanır, panelden yeniden denenebilir
    await prisma.lesson.update({ where: { id: lesson.id }, data: { status: lesson.status === 'planned' ? 'failed' : lesson.status, error: String((error as Error).message || error).slice(0, 300) } })
    throw error
  }
}

const CONCEPTS = `Bir astronomi eğitim sitesinin editörüsün. Sana son haftanın önemli astronomi ve fizik haberleri ve sitedeki kavram derslerinin listesi verilecek.
Bu haberleri anlamak için bilinmesi gereken ama listede OLMAYAN en fazla 3 kavram öner: bir yöntem, fiziksel etki, alet ya da gök cismi türü.
Listede olanı (başka adla da olsa) ve çok genel olanı ("evren", "yıldız") önerme. Önerecek kavram yoksa yalnızca YOK yaz.
Her öneri tek satırda (JSON yok):
KAVRAM | Kavramın kısa adı | Hangi haberde geçtiği, bir cümle`

// "Haberin arkasındaki bilim": haftanın önemli haberlerinde geçen, listede olmayan kavramlar önerilir; panelde onaylanmadan yazılmaz
export async function proposeConcepts(settings: Settings): Promise<string> {
  const news = await prisma.post.findMany({
    where: { status: 'published', category: { in: ['uzay', 'fizik'] }, importance: { gte: 70 }, publishedAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
    orderBy: { importance: 'desc' },
    take: 15,
    select: { title: true, excerpt: true },
  })
  const series = await prisma.series.findUnique({ where: { slug: 'kavramlar' } })
  if (news.length === 0 || !series) return 'kavram önerisi için haber yok'
  const concepts = await prisma.stage.findMany({ where: { track: 'kavram' }, select: { key: true, title: true } })
  const result = await ask(settings, CONCEPTS, `Haberler:\n${news.map((n) => `- ${n.title}: ${n.excerpt}`).join('\n')}\n\nSitedeki kavram dersleri:\n${concepts.map((c) => `- ${c.title}`).join('\n')}`, { max_tokens: 4000 })
  let added = 0
  for (const proposal of parseConcepts(result.text)) {
    const key = `kavram/${slugify(proposal.title)}`
    if (key === 'kavram/' || concepts.some((c) => c.key === key)) continue
    await prisma.stage.create({ data: { key, seriesId: series.id, track: 'kavram', level: 'kapsamli', title: proposal.title, summary: proposal.reason ? `Haberde geçti: ${proposal.reason}` : '', approved: false } })
    concepts.push({ key, title: proposal.title })
    added++
  }
  return added ? `${added} kavram önerildi (Eğitim sayfasında onayla)` : 'yeni kavram önerisi yok'
}

// Haftada bir: ders günü dersten önce. Hata dersi engellemez
async function weeklyConcepts(settings: Settings): Promise<string> {
  const last = await getState('lesson.conceptsAt')
  if (last && Date.now() - Date.parse(last) < 6.5 * 86_400_000) return ''
  await setState('lesson.conceptsAt', new Date().toISOString())
  return proposeConcepts(settings).catch((error) => `kavram önerisi alınamadı (${String((error as Error).message || error).slice(0, 120)})`)
}

// Zamanlanmış iş: sıradaki dersi hazırlar
export async function lessonTask(settings: Settings): Promise<string> {
  lessonSettings(settings)
  if (await overBudget(settings)) return 'aylık token sınırına ulaşıldı, ders yazılmadı'
  const concepts = await weeklyConcepts(settings)
  const done = await (async () => {
    const lesson = await nextLesson(settings)
    if (!lesson) return 'yazılacak ders yok'
    const written = await writeLesson(lesson.id, settings)
    if (written.status === 'published') return `"${written.title}" yayımlandı (denetim temiz)`
    return written.review ? `"${written.title}" taslak: denetim sorun buldu, Eğitim sayfasında incele` : `"${written.title}" taslak olarak hazır (onaylayınca yayımlanır)`
  })()
  return concepts ? `${done}; ${concepts}` : done
}
