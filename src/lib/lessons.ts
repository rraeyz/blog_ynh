import { prisma } from '@/lib/prisma'
import { complete } from '@/lib/ai'
import { safeFetch } from '@/lib/net'
import { fetchText } from '@/lib/papers'
import { htmlToText } from '@/lib/arxiv'
import { addUsage, logJob, overBudget, type Settings } from '@/lib/state'
import { markdownLinks, parseIssues, parseLesson, parsePlan, parseProposal, slugify, unlink } from '@/lib/text'
import { isLevel, LEVELS, planLevels, type Level } from '@/lib/levels'

// Eğitim bölümü. Konu seçimi yapay zekâya bırakılmaz: önce elle istenen dersler, sonra müfredat sırası.
// Her seri konunun en temel noktasından başlar, dersler ilerledikçe seviye yükselir (lib/levels.ts); tek derslik konu kendi içinde temelden
// uzmanlığa gider. Aynı anda ACTIVE seri yürür, sırayla birer ders yazılır. Her ders öğrettiklerini kaydeder (covers); sonraki ders bunları bilinen sayar.
// Müfredatta her zaman en az 2 "sıradaki seri" tutulur; azalınca yapay zekâ alan dengesine, seviye ilerlemesine ve son haftaların
// önemli astronomi/fizik haberlerine bakarak yeni seri önerir (panelde görünür, silinebilir, sırası değiştirilebilir).
// Her ders üç aşamada hazırlanır: web araştırması (notlar + kaynaklar) → notlardan yazım → notlarla karşılaştırmalı denetim.

export const TRACKS = [
  'Optik ve enstrümantasyon',
  'Gözlem teknikleri',
  'Veri analizi ve yazılım',
  'Yıldız astrofiziği',
  'Atom ve ışınım fiziği',
  'Sayısal yöntemler ve modelleme',
  'Gezegen bilimi ve ötegezegenler',
  'Galaksiler ve kozmoloji',
  'Yüksek enerji astrofiziği ve kütleçekim',
  'Güneş ve uzay fiziği',
]

// Kullanıcının istediği konulardan başlangıç müfredatı (ilk çalışmada eklenir, panelden değiştirilebilir)
export const STARTER_SERIES = [
  { title: 'Optik ve Görüntü Oluşumu', track: TRACKS[0], level: 'temel', summary: 'Kırınım ve Airy diski, açısal çözünürlük, nokta yayılım fonksiyonu, atmosferik seeing ve Fried parametresi, dalga cephesi hataları ve Zernike polinomları (kim buldu, neden ortaya çıktı, nerede kullanılır).' },
  { title: 'Uyarlamalı Optik ve Koronagraflar', track: TRACKS[0], level: 'ileri', summary: 'Atmosferik türbülansın düzeltilmesi: dalga cephesi algılayıcılar, deforme olabilen aynalar, lazer kılavuz yıldızlar; koronagrafların çalışma ilkesi ve türleri, yüksek kontrastlı görüntüleme ve gözlemevlerinde kullanılan örnekler.' },
  { title: 'Fotometri', track: TRACKS[1], level: 'temel', summary: 'Kadir sistemleri ve filtreler, CCD temelleri, açıklık ve PSF fotometrisi, diferansiyel fotometri, sönümleme ve kalibrasyon, hata hesabı; kullanılan programlar (Astropy, photutils, IRAF/PyRAF) ve örnek kodlar.' },
  { title: 'Spektroskopi ve Radyal Hız', track: TRACKS[1], level: 'orta', summary: 'Spektrograf türleri, dalgaboyu kalibrasyonu, Doppler kayması, çapraz korelasyon, radyal hız ölçümüyle ötegezegen ve çift yıldız çalışmaları, kesinliği sınırlayan etkenler.' },
  { title: 'Veri İndirgeme ve Yazılımlar', track: TRACKS[2], level: 'temel', summary: 'Bias, dark, flat düzeltmeleri; FITS dosyaları; IRAF ne işe yarar ve nasıl kullanılır, günümüzde yerini alan Python araçları (Astropy, ccdproc, photutils), DS9; örnek komutlar ve kodlarla.' },
  { title: 'Görüntü İşleme ve OpenCV', track: TRACKS[2], level: 'orta', summary: 'Astronomik ve genel görüntülerde filtreleme, eşikleme, kenar ve kaynak bulma, morfolojik işlemler, hizalama ve istifleme (stacking), gürültü azaltma; OpenCV, scikit-image ve Astropy ile Python örnekleri.' },
  { title: 'Yıldız Yapısı ve Evrimi', track: TRACKS[3], level: 'orta', summary: 'Hidrostatik denge, yıldızın merkezindeki ve herhangi bir katmanındaki basıncın tahmini, durum denklemi, enerji üretimi ve taşınımı, yapı denklemlerinin sayısal çözümü.' },
  { title: 'Atom Fiziği ve Spektral Çizgiler', track: TRACKS[4], level: 'orta', summary: 'Atomun enerji seviyeleri, bağlanma ve iyonlaşma enerjisi hesabı, geçişler ve seçim kuralları, Boltzmann ve Saha denklemleri, çizgi oluşumu ve genişlemesi.' },
  { title: 'Astronomide Modelleme', track: TRACKS[5], level: 'ileri', summary: 'Gözlemsel verinin fiziksel modelle karşılaştırılması: ışık eğrisi ve radyal hız modelleme, en küçük kareler ve MCMC ile parametre kestirimi, model seçimi; Python ile örnekler.' },
]

const REQUESTS_TITLE = 'Tek Dersler'
const LOOKAHEAD = 2 // müfredatta bekleyen (henüz derslere bölünmemiş) en az seri sayısı
const ACTIVE = 2 // aynı anda yürüyen seri: uzun seriler bitene kadar öteki alanlar aylarca beklemesin
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

export async function addSeries(title: string, summary: string, position?: number, track = '', level = '') {
  const last = await prisma.series.findFirst({ orderBy: { position: 'desc' }, select: { position: true } })
  return prisma.series.create({ data: { title, summary, track, level, slug: await seriesSlug(title), position: position ?? (last?.position ?? 0) + 1 } })
}

export async function addLesson(seriesId: number, title: string, scope: string, sourceUrls = '', position?: number, level: Level = 'kapsamli') {
  const last = await prisma.lesson.findFirst({ where: { seriesId }, orderBy: { position: 'desc' }, select: { position: true } })
  return prisma.lesson.create({ data: { seriesId, title, scope, sourceUrls, level, slug: await lessonSlug(title), position: position ?? (last?.position ?? 0) + 1 } })
}

export async function seedStarterSeries() {
  for (const [i, s] of STARTER_SERIES.entries()) await addSeries(s.title, s.summary, i + 1, s.track, s.level)
}

// Elle istenen tek ders: sıradaki ilk ders olur ("Tek Dersler" serisi müfredatta en önde)
export async function requestLesson(title: string, scope: string, sourceUrls: string) {
  const series =
    (await prisma.series.findFirst({ where: { title: REQUESTS_TITLE } })) ??
    (await prisma.series.create({ data: { title: REQUESTS_TITLE, summary: 'Müfredat dışında istenen konular.', slug: await seriesSlug(REQUESTS_TITLE), position: -1, planned: true } }))
  return addLesson(series.id, title, scope, sourceUrls, undefined, 'kapsamli')
}

const PLAN = `Bir astronomi ve astrofizik eğitimcisisin; bir konuyu baştan uzman seviyesine götüren dersleri planlıyorsun.
Önce web'de araştır (ders kitapları, üniversite ders notları, gözlemevi ve yazılım belgeleri): konu bugün nasıl öğretiliyor, hangi alt başlıklar şart, hangi sırayla.
Konunun gerektirdiği sayıda ders çıkar (1 ile 15 arası): tek derste eksiksiz anlatılabilen konu tek ders olur, geniş konu seri olur.
Dersler konunun en temel noktasından başlar ve ilerledikçe seviye yükselir: önce kavramlar ve sezgi, sonra matematik, sonra uygulama ve
(konu gerektiriyorsa) kod, sonunda araştırmada kullanılan uzman seviyesi. Her derse seviye ver: "temel", "orta" ya da "ileri"; seviye sırayla düşmez.
Konu doğası gereği ileriyse (en temeli bile uzman işi) zor diye eleme ya da sulandırma: ilk dersler gereken temeli kursun; ilk ders "orta" ya da "ileri" olabilir.
Okurun bilmediği bir matematik aracı (ör. Fourier dönüşümü, karmaşık sayılar, olasılık dağılımları) seride yoğun kullanılacaksa onu öğreten bir ders koy.
Her ders tek bir kavramı ya da yöntemi eksiksiz anlatacak büyüklükte olsun. Popüler bilim değil, yöntem ve mantık öğreten dersler olsun.
Yanıtta yalnızca ders satırları olsun, sırayla, her ders tek satırda (başlık satırı, numara, JSON yok):
SEVİYE | Kısa ders başlığı | Bu derste neler anlatılacak, 1-3 cümle
Örnek: temel | Işık bir dalgadır: kırınım ve girişim | Dalga boyu, faz ve girişim; yarıktan geçen ışığın deseni.`

// Serinin ders listesini çıkarır (ders sayısına model, kapsama göre karar verir)
export async function planSeries(seriesId: number, settings: Settings): Promise<number> {
  const series = await prisma.series.findUniqueOrThrow({ where: { id: seriesId } })
  const others = await prisma.series.findMany({ where: { id: { not: seriesId } }, orderBy: { position: 'asc' }, select: { title: true } })
  const result = await ask(
    settings,
    PLAN,
    `Konu: ${series.title}${series.level ? ` (giriş seviyesi: ${series.level})` : ''}\nKapsam: ${series.summary}\nMüfredattaki diğer seriler (onların konusunu tekrar etme): ${others.map((s) => s.title).join(', ') || '-'}`,
    { ...webSearch(4), max_tokens: 16_000 },
  )
  const lessons = parsePlan(result.text)
  if (lessons.length === 0) throw new Error('Ders planı çıkarılamadı')
  const levels = planLevels(lessons.map((l) => l.level))
  for (const [i, lesson] of lessons.entries()) await addLesson(series.id, lesson.title, lesson.scope, '', i + 1, levels[i])
  await prisma.series.update({ where: { id: series.id }, data: { planned: true } })
  return lessons.length
}

const PROPOSE = `Bir astronomi ve astrofizik bölümünün müfredatını yürütüyorsun (gözlemsel ve kuramsal astrofizik, enstrümantasyon, veri analizi).
Mevcut konulardan sonra gelmesi gereken, onlarla çakışmayan TEK bir yeni konu öner (kaç derse bölüneceğine sonra karar verilir: tek ders de olabilir uzun seri de). Seçerken:
- alanlar arasında denge kur: en az işlenmiş alanlara öncelik ver;
- önkoşulu olan konu, önkoşulunu öğreten konudan sonra gelsin; doğası gereği ileri bir konuyu zor diye eleme;
- son haftaların önemli astronomi/fizik haberlerinde öne çıkan bir yöntem ya da kavram varsa (ör. kütleçekim dalgası tespiti, interferometri), onu öğreten bir seri iyi bir adaydır;
- popüler bilim değil, bir astronomi öğrencisinin ya da araştırmacının bilmesi gereken yöntem, alet, yazılım ya da kuram olsun.
Yanıtta yalnızca şu dört satır olsun:
Başlık: Seri adı
Kapsam: 1-3 cümle
Alan: listedeki alanlardan biri
Seviye: konunun giriş seviyesi (temel, orta ya da ileri)`

// Müfredat hep LOOKAHEAD kadar ileriyi görsün: sıradaki seriler azalınca yenisi önerilir
async function ensureRoadmap(settings: Settings) {
  if ((await prisma.series.count()) === 0) {
    await seedStarterSeries()
    await logJob(`Eğitim: başlangıç müfredatı eklendi (${STARTER_SERIES.length} seri)`)
  }
  while ((await prisma.series.count({ where: { planned: false } })) < LOOKAHEAD) {
    const existing = await prisma.series.findMany({ where: { position: { gte: 0 } }, orderBy: { position: 'asc' }, include: { lessons: { select: { status: true } } } })
    const news = await prisma.post.findMany({
      where: { status: 'published', category: { in: ['uzay', 'fizik'] }, importance: { gte: 7 }, publishedAt: { gte: new Date(Date.now() - 30 * 86_400_000) } },
      orderBy: { importance: 'desc' },
      take: 20,
      select: { title: true },
    })
    const result = await ask(
      settings,
      PROPOSE,
      [
        `Alanlar: ${TRACKS.join('; ')}`,
        `Mevcut seriler (sırasıyla):\n${existing.map((s) => `- ${s.title} [${s.track || 'alan yok'}, ${s.level || 'seviye yok'}, ${s.lessons.filter((l) => l.status === 'published').length}/${s.lessons.length} ders yayında]: ${s.summary}`).join('\n')}`,
        `Son 30 günün önemli astronomi/fizik haberleri:\n${news.map((n) => `- ${n.title}`).join('\n') || '-'}`,
      ].join('\n\n'),
      { max_tokens: 8000 },
    )
    const data = parseProposal(result.text)
    if (!data) throw new Error('Yeni seri önerilemedi')
    if (existing.some((s) => slugify(s.title) === slugify(data.title))) throw new Error(`Önerilen seri zaten var: ${data.title}`)
    const series = await addSeries(data.title, data.summary, undefined, data.track, data.level)
    await logJob(`Eğitim: müfredata yeni seri önerildi: "${series.title}" (${series.track || 'alan yok'}, ${series.level || 'seviye yok'})`)
  }
}

// Sıradaki yazılacak ders: önce elle istenenler, sonra yürüyen ACTIVE seriden son dersi en eski yazılanın sıradaki dersi.
// Yürüyen seri azsa sıradaki seri derslere bölünür (bölünemezse yürüyenlerle devam edilir)
export async function nextLesson(settings: Settings) {
  await ensureRoadmap(settings)
  const request = await prisma.lesson.findFirst({ where: { status: 'planned', series: { position: { lt: 0 } } }, orderBy: { position: 'asc' }, include: { series: true } })
  if (request) return request
  const running = () => prisma.series.findMany({ where: { position: { gte: 0 }, planned: true, lessons: { some: { status: 'planned' } } }, orderBy: { position: 'asc' }, take: ACTIVE })
  let active = await running()
  const unplanned = active.length < ACTIVE && (await prisma.series.findFirst({ where: { planned: false }, orderBy: { position: 'asc' } }))
  if (unplanned) {
    try {
      const count = await planSeries(unplanned.id, settings)
      await logJob(`Eğitim: "${unplanned.title}" ${count > 1 ? `serisi ${count} derse bölündü` : 'tek ders olarak planlandı'}`)
      await ensureRoadmap(settings)
    } catch (error) {
      if (active.length === 0) throw error
      await logJob(`Eğitim: "${unplanned.title}" planlanamadı (${String((error as Error).message || error).slice(0, 120)}); yürüyen seriyle devam`)
    }
    active = await running()
  }
  if (active.length === 0) return null
  const last = await Promise.all(active.map((series) => prisma.lesson.findFirst({ where: { seriesId: series.id, status: { not: 'planned' } }, orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } })))
  const turn = last.reduce((best, lesson, i) => ((lesson?.updatedAt.getTime() ?? 0) < (last[best]?.updatedAt.getTime() ?? 0) ? i : best), 0)
  return prisma.lesson.findFirst({ where: { seriesId: active[turn].id, status: 'planned' }, orderBy: { position: 'asc' }, include: { series: true } })
}

const RESEARCH = `Bir astronomi ve astrofizik araştırma asistanısın. Bir dersin yazılmasından önce konuyu araştırıp eksiksiz notlar çıkaracaksın;
dersi başka biri bu notlardan yazacak ve notlarda olmayan hiçbir bilgiyi kullanmayacak.
Web'de en az 6 farklı arama yap. Ders kitaplarını, üniversite ders notlarını, gözlemevi ve alet belgelerini, hakemli makaleleri ve resmi yazılım
belgelerini tercih et; forum ve içerik çiftliklerine güvenme. Bilgileri birden çok kaynakla karşılaştır; çelişkileri yaz.
Notlarda bulunsun:
- tanımlar ve kavramlar; tarihçe (kim, ne zaman, hangi problemi çözmek için);
- bütün temel formüller LaTeX ile ($...$), türetme adımları, terimlerin anlamı ve birimleri, tipik sayısal değerler;
- yöntemin adım adım uygulanışı; kullanılan yazılımlar ve gerçek fonksiyon/komut adları (Python: astropy, numpy, photutils, opencv gibi;
  IRAF anlatılıyorsa komutları ve bugün yerini neyin aldığı);
- gerçekçi bir uygulamalı örnek için veri ve parametreler; sık yapılan hatalar; yöntemin zayıflıkları ve modern alternatifleri;
- iyi öğretim kaynakları (ders notu, belge, kitap bölümü, gerçekten bulduğun video).
Her bilginin sonunda hangi kaynaktan geldiğini [1], [2] diye belirt ve en sonda "Kaynaklar" başlığı altında numaralı listede [n] Başlık — URL yaz.
Doğrulayamadığın hiçbir şeyi not etme.`

const WRITE = `Sen astronomi ve astrofizik öğreten deneyimli bir öğretim üyesisin. Türkçe, eksiksiz bir ders yazıyorsun.
Amaç: dersi baştan sona okuyan, örnekleri deneyen ve alıştırmaları çözen kişi bu dersin konusunu tamamen öğrensin; neden ve ne zaman
kullanıldığını bilsin. Uzunluk sınırı yok: konu ne kadar gerektiriyorsa o kadar yaz, hiçbir adımı atlama.

SEVİYE: "Bu dersin seviyesi" satırına göre derinliği ayarla. Konu doğası gereği ileriyse zor diye sulandırma: gereken her aracı öğret ve
seviyenin istediği yere kadar götür.
OKUR: "Okurun bildikleri" satırındakileri bilir; geri kalan her kavramı, sembolü ve matematik aracını açıklamadan kullanma. Serinin önceki
derslerinde öğretileni yeniden anlatma, gerekirse bir cümleyle hatırlat. Her formülü önce sözle ve sezgiyle anlat, sonra yaz; türetmede adım
atlama ve her adımda ne yaptığını söyle.

Bilgiler yalnızca verilen araştırma notlarından gelir; notlarda olmayan sayı, tarih, isim, deney sonucu ya da fonksiyon adı ekleme. Temel
matematik ve fizik araçlarının ders kitabı tanımları ve kendi yaptığın cebir bu sınırın dışındadır. Metinde araştırma sürecinden, notlardan,
kaynakların neyi doğrulayıp doğrulamadığından ya da aralarındaki çelişkilerden söz etme: okur yalnızca dersi görür. Doğrulanmamış bilgiyi hiç yazma.

BİÇİM: İlk satır "Özet: " ile başlayan tek cümle. İkinci satır "Önkoşul: " ve verilen ders listesinden önce okunması gereken derslerin
numaraları (yoksa "Önkoşul: yok"). Üçüncü satır "Öğretilenler: " ve bu derste öğrettiğin kavram ve araçların virgüllü kısa listesi (sonraki
dersler bunları bilinen sayar). Sonra şu bölümler, bu başlıklarla ve bu sırayla; köşeli parantezli olanları yalnızca dersin içeriği gerektiriyorsa yaz:
[## Ön bilgiler]
(okurun bilmediği ama dersin kullandığı her kavram ve matematik aracı için kendi başına yeten kısa bir açıklama: sade tanım, neden gerektiği,
küçük bir sayısal örnek; ör. karmaşık sayılar ve $e^{i\\phi}$, Fourier dönüşümü, Taylor açılımı, integralin anlamı, dalga ve faz. Sonunda
dersteki sembollerin tablosu: | Sembol | Anlamı | Birimi |)
## Nedir?
## Neden ortaya çıktı?
## Mantığı
[## Matematiği]
(formüllerin tam türetmesi; terimlerin anlamı ve birimleri)
[## Nasıl kullanılır?]
(adım adım yöntem ve araçlar; konu hesaplamaya ya da veri işlemeye dayanıyorsa çalışan, yorum satırlı kod)
## Uygulamalı örnek
(baştan sona çözülmüş tam bir örnek: kavramsal derste elle hesap ya da gerçek bir gözlem üzerinden; uygulamalı derste kod, beklenen çıktı ve yorumu)
[## Ne zaman kullanılır?]
(hangi gözlemde ve problemde; sınırları; alternatifleri ve aralarında nasıl seçim yapılır)
## Sık yapılan hatalar
## Alıştırmalar
(kolaydan zora en az 3 alıştırma; her birinin ayrıntılı çözümü ayrı satırlarda ":::cozum" ile ":::" arasında. Çözümün içinde başlık kullanma)
## Özet ve sonraki adımlar
## İleri okuma
(yalnızca notların kaynak listesindeki linkler)

KURALLAR: Formüller LaTeX: satır içi $...$, ayrı satırda $$...$$. Kod dil adıyla üç ters tırnaklı blokta (\`\`\`python). Linkler yalnızca
[metin](https://...) biçiminde ve yalnızca notların kaynaklarından. Numaralı adımlar için "1. " listesi, karşılaştırma için "| a | b |" tablosu kullanabilirsin.
Terimleri ilk geçtiklerinde açıkla, İngilizce karşılığını parantezde ver. Eskimiş bir yöntemi tek doğru yol gibi anlatma.`

const CHECK = `Bir astronomi dersinin bilimsel editörüsün. Sana dersin seviyesi, okurun bildikleri, araştırma notları (kaynaklı) ve yazılmış ders verilecek.
Dersi notlarla karşılaştır ve yalnızca gerçek sorunları bul: yanlış ya da notlarla çelişen formül, katsayı, birim, sayı, isim ya da tarih;
notlarda dayanağı olmayan önemli iddialar; çalışmayacak ya da yanlış API kullanan kod; çözümü hatalı alıştırmalar; eskimiş yöntemin tek doğru gibi sunulması.
Sonra dersi yalnızca "okurun bildikleri"ni bilen birinin gözüyle oku: açıklanmadan kullanılan kavram, sembol ya da matematik aracı; okurun
izleyemeyeceği atlanmış türetme adımı; seviyenin gerektirdiği derinliğe inmeyen bölüm; araştırma sürecine dair metin ("notlarda", "kaynaklar doğrulamadı" gibi).
Üslup ve yazım tercihlerini sorun sayma.
Yanıtta yalnızca sorun satırları olsun, her sorun tek satırda (JSON yok):
ciddi ya da küçük | bölüm ya da kısa alıntı | sorun | doğrusu
"ciddi": okuru yanlış öğrenmeye götürür ya da okur bir bölümü hiç izleyemez. Hiç sorun yoksa yalnızca SORUN YOK yaz.`

// Yazım ve denetime giden seviye tarifi (okura görünen kısa adlar lib/levels.ts'te)
const LEVEL_GUIDE: Record<Level, string> = {
  temel: 'konuya ilk giriş: kavramlar, sezgi, tarihçe ve basit sayısal hesaplar; ağır türetme ve kod yalnızca konu gerçekten gerektiriyorsa',
  orta: 'yöntemin matematiği ve uygulaması: türetmeler adım adım; konu uygulamalıysa çalışan kod ve gerçekçi örnek',
  ileri: 'uzman seviyesi: tam türetmeler, gerçek veriyle uygulama, araştırmada kullanılan yöntemler, sınırlar ve güncel alternatifler',
  kapsamli: 'tek derste temelden uzman seviyesine: önce sezgi ve temel kavramlar, sonra matematik, sonra uygulama (konu gerektiriyorsa kod); sonunda okur uzman seviyesine ulaşsın',
}
const BASELINE = 'lise matematiği (cebir, trigonometri, türevin anlamı) ve giriş fiziği'

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

// Dersi üç aşamada hazırlar. En az 3 doğrulanmış kaynak yoksa yazmaz (uydurma riskine karşı).
// Denetim temizse ve ayar açıksa yayımlar; değilse bulgularıyla taslak bırakır
export async function writeLesson(lessonId: number, settings: Settings) {
  const lesson = await prisma.lesson.findUniqueOrThrow({ where: { id: lessonId }, include: { series: { include: { lessons: { orderBy: { position: 'asc' }, select: { id: true, title: true, covers: true } } } } } })
  try {
    // 1. Araştırma: elle verilen kaynaklar okunur, sonra web araması
    const given = lesson.sourceUrls.split('\n').map((l) => l.trim()).filter((l) => /^https?:\/\//.test(l)).slice(0, 3)
    const read: Array<{ url: string; text: string }> = []
    for (const url of given) {
      const text = await fetchText(url).then(htmlToText).catch(() => '')
      if (text) read.push({ url, text: text.slice(0, SOURCE_CHARS) })
    }
    const index = lesson.series.lessons.findIndex((l) => l.id === lesson.id)
    const level: Level = isLevel(lesson.level) ? lesson.level : 'kapsamli'
    const known = lesson.series.lessons.slice(0, index).map((l) => l.covers).filter(Boolean).join('; ')
    const reader = [
      `Bu dersin seviyesi: ${LEVELS[level].label} — ${LEVEL_GUIDE[level]}`,
      `Okurun bildikleri: ${BASELINE}${known ? `; serinin önceki derslerinde öğrendikleri: ${known}` : ''}`,
    ].join('\n')
    const context = [
      `Seri: ${lesson.series.title} — ${lesson.series.summary}`,
      reader,
      `Ders: ${lesson.title}`,
      `Bu derste anlatılacaklar: ${lesson.scope || '-'}`,
      `Serinin önceki dersleri: ${lesson.series.lessons.slice(0, index).map((l) => l.title).join('; ') || '-'}`,
      `Serinin sonraki dersleri (bunlara girme): ${lesson.series.lessons.slice(index + 1).map((l) => l.title).join('; ') || '-'}`,
    ].join('\n')
    await logJob(`Eğitim: "${lesson.title}" 1/3 araştırılıyor…`)
    const research = await ask(settings, RESEARCH, [context, ...read.map((s, i) => `\nVerilen kaynak ${i + 1} (${s.url}) — önce bunu kullan:\n${s.text}`)].join('\n'), { ...webSearch(10), max_tokens: 32_000 }, LONG)
    const sources = new Map<string, string>([...read.map((s) => [s.url, s.url] as [string, string]), ...research.citations.map((c) => [c.url, c.title] as [string, string])])
    for (const url of markdownLinks(research.text.replace(/(https?:\/\/[^\s)\]]+)/g, '[k]($1)'))) if (!sources.has(url) && (await linkWorks(url))) sources.set(url, url)
    if (sources.size < 3) throw new Error(`Araştırmada yalnızca ${sources.size} doğrulanmış kaynak bulundu; ders yazılmadı (en az 3 gerekir)`)
    const sourceList = Array.from(sources, ([url, title], i) => `[${i + 1}] ${title || url} — ${url}`).join('\n')

    // 2. Yazım: yalnızca notlardan; önkoşullar müfredattaki diğer derslerden seçilir
    const catalog = await prisma.lesson.findMany({ where: { id: { not: lesson.id }, status: { not: 'failed' } }, orderBy: [{ series: { position: 'asc' } }, { position: 'asc' }], select: { id: true, title: true, series: { select: { title: true } } } })
    if (await overBudget(settings)) throw new Error('Aylık token sınırına ulaşıldı')
    await logJob(`Eğitim: "${lesson.title}" 2/3 yazılıyor…`)
    const written = await ask(
      settings,
      WRITE,
      `${context}\n\nARAŞTIRMA NOTLARI:\n${research.text}\n\nKAYNAKLAR (linkler yalnızca bunlardan):\n${sourceList}\n\nÖNKOŞUL İÇİN DERS LİSTESİ:\n${catalog.map((l, i) => `${i + 1}. ${l.title} (${l.series.title})`).join('\n') || '-'}`,
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
    const prerequisites = parsed.prerequisites.map((n) => catalog[n - 1]?.id).filter((id): id is number => typeof id === 'number')

    // 3. Denetim: notlarla karşılaştırma; ciddi sorun varsa ders yayımlanmaz
    await logJob(`Eğitim: "${lesson.title}" 3/3 denetleniyor…`)
    const check = await ask(settings, CHECK, `${reader}\n\nARAŞTIRMA NOTLARI:\n${research.text}\n\nDERS:\n${body}`, { max_tokens: 16_000 }, LONG)
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

// Zamanlanmış iş: sıradaki dersi hazırlar
export async function lessonTask(settings: Settings): Promise<string> {
  lessonSettings(settings)
  if (await overBudget(settings)) return 'aylık token sınırına ulaşıldı, ders yazılmadı'
  const lesson = await nextLesson(settings)
  if (!lesson) return 'yazılacak ders yok'
  const written = await writeLesson(lesson.id, settings)
  if (written.status === 'published') return `"${written.title}" yayımlandı (denetim temiz)`
  return written.review ? `"${written.title}" taslak: denetim sorun buldu, Eğitim sayfasında incele` : `"${written.title}" taslak olarak hazır (onaylayınca yayımlanır)`
}
