import { prisma } from '@/lib/prisma'
import { complete } from '@/lib/ai'
import { paperText } from '@/lib/papers'
import { extractJson, parseSelection, slugify } from '@/lib/text'
import { addUsage, logJob, overBudget, type Settings } from '@/lib/state'
import { CATEGORIES } from '@/lib/topics'
import { coverIfNeeded } from '@/lib/images'

// Öne çıkanlara alınması önerilen en düşük önem puanı (panelde rozet; ayar açıksa kendiliğinden öne çıkar)
export const FEATURE_SUGGESTION = 8
// Ön puanı bu ve altı olan haberler seçimden hemen sonra atlanır. 4 bırakılır: sıradan ama geçerli ve astronomi kotasını doldurabilir
export const MIN_PRESCORE = 3
const MAX_FEATURED = 10
const CHUNK = 300 // seçimde modele bir seferde gösterilen en fazla haber (~21 bin token)

// Öne çıkanlara alır; en fazla 10, yenisi eklenince en eski düşer. Düşen yazının başlığını döner
export async function featurePost(postId: number): Promise<string | null> {
  await prisma.post.update({ where: { id: postId }, data: { featuredAt: new Date() } })
  const dropped = await prisma.post.findMany({ where: { featuredAt: { not: null } }, orderBy: { featuredAt: 'desc' }, skip: MAX_FEATURED, select: { id: true, title: true } })
  await prisma.post.updateMany({ where: { id: { in: dropped.map((p) => p.id) } }, data: { featuredAt: null } })
  return dropped[0]?.title ?? null
}

// Ayar açıksa yayımlanan yüksek puanlı yazı kendiliğinden öne çıkar
export async function autoFeature(post: { id: number; importance: number }, settings: Settings) {
  if (settings.autoFeature && post.importance >= FEATURE_SUGGESTION) await featurePost(post.id)
}

const SYSTEM = `Sen Türkçe yazan bir bilim iletişimcisisin. Sana bir makalenin bilgileri ve metni verilecek.
Bu makaleyi teknik olmayan ama meraklı bir okur için Türkçe anlat.

Kurallar:
- Yalnızca verilen metindeki bilgileri kullan. Metinde olmayan sayı, sonuç ya da iddia ekleme; emin olmadığın yerde bunu belirt.
- Terimleri ilk geçtikleri yerde kısaca açıkla; yaygın İngilizce terimi parantez içinde verebilirsin.
- Başlık çekici ama abartısız olsun, makalenin İngilizce başlığının çevirisi olmak zorunda değil.
- "brief": haber dilinde 1-2 cümle; ne bulunduğunu söyle, ayrıntıya girme. Sitenin "Yeni gelişmeler" bölümünde ve bültende tek başına okunur.
- "highlights": tam 3 kısa madde (her biri en fazla 15 kelime); yazıyı okumayan biri bunlarla ana fikri anlamalı.
- "body" Markdown ve ekranda rahat okunmalı:
  - Kısa bir giriş paragrafı, sonra "## Ne yaptılar?", "## Neden önemli?", "## Sınırlamalar" bölümleri. Toplam 300-600 kelime.
  - Her paragraf en fazla 3 cümle. Uzun açıklamaları paragraflara böl.
  - Önemli terimleri ve sayıları **kalın** yaz. Sıralanabilen şeyleri "- " ile listele.
  - En çarpıcı bulguyu "> " ile başlayan tek satırlık bir vurgu olarak "Ne yaptılar?" bölümüne koy.
  - Her başlıktan önce ve sonra boş satır bırak.
- "category": şu anahtarlardan en uygun olanı: ${Object.entries(CATEGORIES).map(([key, c]) => `${key} (${c.hint})`).join(', ')}.
- "importance": 1-10 arası tam sayı, gelişmenin önemi. 9-10: alanında çığır açan ya da geniş kitleyi doğrudan ilgilendiren; 6-8: somut, yeni ve dikkat çekici bir sonuç; 3-5: sağlam ama sıradan bir adım; 1-2: küçük bir iyileştirme. Cömert olma.

Yanıtı yalnızca şu JSON biçiminde ver, başka hiçbir şey yazma:
{"title": "...", "brief": "...", "highlights": ["...", "...", "..."], "body": "...", "category": "...", "importance": 5}`

async function uniqueSlug(title: string): Promise<string> {
  const base = slugify(title) || 'yazi'
  for (let i = 1; ; i++) {
    const slug = i === 1 ? base : `${base}-${i}`
    if (!(await prisma.post.findUnique({ where: { slug }, select: { id: true } }))) return slug
  }
}

// Bir makaleden yazı üretir; ayara göre taslak ya da yayımlanmış olarak kaydeder.
// replacePostId verilirse o yazının metni yeniden yazılır (adresi ve yayın durumu aynı kalır)
export async function writePost(paperId: number, settings: Settings, publish = settings.autoPublish, replacePostId?: number) {
  const paper = await prisma.paper.findUniqueOrThrow({ where: { id: paperId } })
  try {
    const text = await paperText(paper, settings.readMode, settings.maxInputChars)
    const user = `Başlık: ${paper.title}\nYazarlar: ${paper.authors || '-'}\nLink: ${paper.url}\n\nMetin:\n${text}`
    const result = await complete(settings, SYSTEM, user)
    await addUsage(result.inputTokens, result.outputTokens)
    const data = extractJson(result.text) as { title?: unknown; brief?: unknown; excerpt?: unknown; highlights?: unknown; body?: unknown; category?: unknown; importance?: unknown }
    if (typeof data.title !== 'string' || typeof data.body !== 'string' || !data.title.trim() || !data.body.trim()) {
      throw new Error('Model beklenen biçimde yanıt vermedi')
    }
    const content = {
      title: data.title.trim().slice(0, 300),
      excerpt: String(typeof data.brief === 'string' ? data.brief : typeof data.excerpt === 'string' ? data.excerpt : '').trim().slice(0, 500),
      highlights: Array.isArray(data.highlights) ? data.highlights.filter((h): h is string => typeof h === 'string').map((h) => h.trim().replace(/\n/g, ' ')).filter(Boolean).slice(0, 5).join('\n') : '',
      body: data.body.trim(),
      category: typeof data.category === 'string' && CATEGORIES[data.category] ? data.category : '',
      importance: Math.min(10, Math.max(0, Math.round(Number(data.importance)) || 0)),
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    }
    const post = replacePostId
      ? await prisma.post.update({ where: { id: replacePostId }, data: content })
      : await prisma.post.create({
          data: {
            ...content,
            slug: await uniqueSlug(content.title),
            status: publish ? 'published' : 'draft',
            publishedAt: publish ? new Date() : null,
            paperId: paper.id,
          },
        })
    await prisma.paper.update({ where: { id: paper.id }, data: { status: 'written', error: '' } })
    if (!replacePostId && post.status === 'published') await autoFeature(post, settings)
    await coverIfNeeded(post.id, settings)
    return post
  } catch (error) {
    // Yeniden yazımda eski yazı yerinde kalır; makale "Hata"ya düşmez
    if (!replacePostId) await prisma.paper.update({ where: { id: paper.id }, data: { status: 'failed', error: String((error as Error).message || error).slice(0, 300) } })
    throw error
  }
}

const selectPrompt = (minSpace: number, maxSpace: number) => `Bir bilim editörüsün. Verilen makale ve haberlerden en önemlilerini seç:
- yeni ve somut bir sonuç (keşif, icat, ölçüm, yeni yöntem) içerenler,
- alanında ya da günlük hayatta etkisi büyük olanlar,
- meraklı ama uzman olmayan bir okuru ilgilendirecek olanlar.
Temel bilimde gerçek bir ilk (yeni bir ötegezegen ya da süpernova, yeni bir parçacık ya da kuantum olgusu, ilk kez yapılan bir ölçüm, yeni bir gözlem tekniği) teknik görünse bile önemlidir: okura anlatılabilir.
Küçük iyileştirmeleri, birbirinin tekrarı olanları, kurum duyurularını (bütçe, atama, etkinlik) ve aynı alanda sıradan bir ek sonucu seçme; eşit önemdeyse farklı konulardan seç.
Ayrıca listedeki HER makaleye bu ölçütlere göre 1-10 arası bir puan ver (cömert olma; çoğu 3-6 arasında olmalı).
Seçtiklerinin en az ${minSpace}, en fazla ${maxSpace} tanesi astronomi, astrofizik ya da uzay araştırması haberi olsun (listede o kadar somut uzay gelişmesi varsa);
kalanları fizik, yapay zekâ, teknoloji, sağlık, Dünya gibi başka konuların en önemli gelişmelerinden seç.
"space" alanına listedeki bütün astronomi/astrofizik/uzay haberlerinin numaralarını yaz.
Yanıtı yalnızca şu JSON biçiminde ver: {"picked": [seçtiğin numaralar önem sırasıyla], "scores": {"1": puan, "2": puan, ...}, "space": [uzay haberlerinin numaraları]}`

// Model en önemli n makaleyi seçer ve hepsine ön puan verir (Makaleler → Bekliyor bu puana göre sıralı).
// Başlık ve özetin başı gider (makale başına ~60 token, puanlar için ~4 token)
// quota=false: ön elemede uzay sınırları uygulanmaz (yalnızca son seçimde)
export async function selectPapers(candidates: Array<{ id: number; title: string; abstract: string }>, settings: Settings, n: number, quota = true): Promise<number[]> {
  if (candidates.length <= n) return candidates.map((paper) => paper.id)
  const list = candidates.map((paper, index) => `${index + 1}. ${paper.title}\n   ${paper.abstract.replace(/\s+/g, ' ').slice(0, 220)}`).join('\n')
  // İlgi alanları öncelik verir (baştaki en çok); ama konusu uyan sıradan bir haber önemli bir haberin önüne geçmez
  const interests = settings.interests.trim()
    ? `Okurun öncelikli ilgi alanları (baştaki en öncelikli): ${settings.interests}\nBu alanlardaki somut ve yeni gelişmeleri, biraz daha az önemli olsalar bile öne al ve puanlarını buna göre ver; ama sıradan bir haberi yalnızca konusu uyuyor diye seçme.\n`
    : ''
  const [minSpace, maxSpace] = quota ? [settings.spacePerDay, Math.max(settings.spaceMaxPerDay, settings.spacePerDay)] : [0, n]
  const result = await complete(settings, selectPrompt(minSpace, maxSpace), `${interests}Seçilecek sayı: ${n}\n\nMakaleler:\n${list}`)
  await addUsage(result.inputTokens, result.outputTokens)
  const { picked, scores } = parseSelection(result.text, candidates.length, n, minSpace, maxSpace)
  if (picked.length === 0) throw new Error('Seçim yanıtında geçerli makale yok')
  await prisma.$transaction(Array.from(scores).map(([index, score]) => prisma.paper.update({ where: { id: candidates[index].id }, data: { score } })))
  return picked.map((index) => candidates[index].id)
}

// Günlük iş: son 3 günün bekleyen makalelerinden seçip yazar. Seçilmeyenler 3 gün boyunca ertesi günlerin
// seçimine yeniden girer (daha önemlileri yüzünden kalan iyi bir haber ikinci şans bulur); 3 günü dolan atlanır
export async function writeDaily(settings: Settings): Promise<{ written: number; failed: number; skipped: number; budget: boolean }> {
  const cutoff = new Date(Date.now() - 3 * 24 * 3600_000)
  const expired = await prisma.paper.updateMany({ where: { status: 'new', createdAt: { lt: cutoff } }, data: { status: 'skipped' } })
  const candidates = await prisma.paper.findMany({
    where: { status: 'new', createdAt: { gte: cutoff } },
    orderBy: { publishedAt: 'desc' },
    select: { id: true, title: true, abstract: true },
  })
  const summary = { written: 0, failed: 0, skipped: expired.count, budget: false }
  if (candidates.length === 0 || settings.postsPerDay <= 0) return summary
  if (await overBudget(settings)) return { ...summary, budget: true }
  // Bekleyenlerin hepsi modele gider (makale başına ~70 token). Yığılmada (ör. sıfırlamadan sonra bütün beslemeler birden)
  // CHUNK'lık parçalar ayrı ayrı elenir, her parçanın en iyileri son seçime kalır: hiçbir haber bakılmadan düşmez, hepsi ön puan alır
  let pool = candidates
  let rounds = 0
  while (pool.length > CHUNK) {
    const finalists: number[] = []
    for (let i = 0; i < pool.length; i += CHUNK) finalists.push(...(await selectPapers(pool.slice(i, i + CHUNK), settings, settings.postsPerDay * 2, false)))
    pool = pool.filter((paper) => finalists.includes(paper.id))
    rounds++
  }
  const picked = await selectPapers(pool, settings, settings.postsPerDay)
  // Ön puanı çok düşük olanlar ikinci şansı beklemeden atlanır (Bekliyor listesi dolmasın)
  const low = await prisma.paper.updateMany({
    where: { id: { in: candidates.map((p) => p.id), notIn: picked }, status: 'new', score: { gte: 1, lte: MIN_PRESCORE } },
    data: { status: 'skipped' },
  })
  summary.skipped += low.count
  await logJob(`Günlük iş: ${candidates.length} makaleden${rounds ? ` (ön elemeyle ${pool.length} aday)` : ''} ${picked.length} tanesi seçildi${low.count ? `, ön puanı ${MIN_PRESCORE} ve altı olan ${low.count} tanesi atlandı` : ''}; yazılıyor…`)
  for (let index = 0; index < picked.length; index++) {
    const id = picked[index]
    if (await overBudget(settings)) {
      summary.budget = true
      break
    }
    const step = `Günlük iş: yazı ${index + 1}/${picked.length}`
    try {
      const post = await writePost(id, settings)
      summary.written++
      await logJob(`${step} ${post.status === 'published' ? 'yayımlandı' : 'taslak'}: ${post.title.slice(0, 80)}`)
    } catch (error) {
      summary.failed++
      await logJob(`${step} başarısız: ${String((error as Error).message || error).slice(0, 150)}`)
    }
  }
  return summary
}
