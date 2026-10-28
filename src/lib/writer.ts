import { prisma } from '@/lib/prisma'
import { complete } from '@/lib/ai'
import { paperText } from '@/lib/papers'
import { cleanSummary, criteriaScore, extractJson, parseScores, pickDaily, slugify, weightedScore } from '@/lib/text'
import { addUsage, getState, logJob, overBudget, type Settings } from '@/lib/state'
import { CATEGORIES } from '@/lib/topics'
import { coverIfNeeded } from '@/lib/images'

// Puanlar onda bir (80 = 8,0/10). Öne çıkanlara alınması önerilen en düşük önem puanı (panelde rozet; ayar açıksa kendiliğinden öne çıkar)
export const FEATURE_SUGGESTION = 80
// Ön puanı bu ve altı olan haberler puanlanınca hemen atlanır, en az sayıyı tamamlamaya da girmez
export const MIN_PRESCORE = 30
const MAX_FEATURED = 10
const CHUNK = 100 // puanlamada modele bir seferde gösterilen en fazla haber (~16 bin token)
const OLD_NEWS_DAYS = 14 // bundan eski haberin yeniliği en fazla 2

// Ön puan (başlık + özetten, seçim için) ve önem puanı (tam metinden, yazarken) aynı ölçütlerle verilir
const CRITERIA = `Dört ölçüt, her biri 1-5 arası tam sayı:
- yenilik: 5 alanında bir ilk ya da çığır açan bulgu; 4 yeni ve somut bir sonuç (keşif, icat, ölçüm, yöntem); 3 bilinen bir konuda yeni veri; 2 önceki bir sonuca küçük bir ek ya da eski bir haber; 1 yeni bir sonuç yok (duyuru, tanıtım, röportaj, yorum, etkinlik).
- etki: 5 alanını ya da çok sayıda insanı doğrudan değiştirecek; 4 alanında önemli bir ilerleme; 3 kendi alt alanında kayda değer; 2 dar bir uzmanlık için; 1 neredeyse yok.
- kanit (kanıt gücü): 5 hakemli yayın ve güçlü veri (büyük örnek, doğrudan ölçüm, bağımsız doğrulama); 4 hakemli yayın; 3 ön baskı ya da ilk sonuç; 2 tek gözlem, küçük çalışma ya da yalnızca model; 1 kanıtsız iddia ya da yalnızca basın açıklaması.
- anlam (okur için anlam; meraklı ama uzman olmayan okur): 5 herkesin konuşacağı; 4 kolayca ilgi çeker; 3 iyi anlatılırsa ilgi çeker; 2 ancak çok meraklısı okur; 1 okuru ilgilendirmez.
Temel bilimde gerçek bir ilk (yeni bir ötegezegen ya da süpernova, yeni bir parçacık ya da kuantum olgusu, ilk kez yapılan bir ölçüm, yeni bir gözlem tekniği) teknik görünse bile yeni ve etkilidir: okura anlatılabilir.
Haberi kendi başına, bu sabit ölçeğe göre puanla; başka haberlerle kıyaslama.`

export const SCORES_TENTHS = 'scores.tenths'

// Puanlar 1-10 tam sayıdan onda bire geçti: eski kurulumda bir kez dönüştürülür; bekleyenler yeni ölçütlerle yeniden puanlanır
export async function upgradeScores() {
  if (await getState(SCORES_TENTHS)) return
  await prisma.$transaction([
    prisma.post.updateMany({ data: { importance: { multiply: 10 } } }),
    prisma.paper.updateMany({ where: { status: 'new' }, data: { score: 0 } }),
    prisma.paper.updateMany({ where: { status: { not: 'new' } }, data: { score: { multiply: 10 } } }),
    prisma.appState.create({ data: { key: SCORES_TENTHS, value: '1' } }),
  ])
}

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
- "scores": gelişmenin önemi, tam metne bakarak. ${CRITERIA}

Yanıtı yalnızca şu JSON biçiminde ver, başka hiçbir şey yazma:
{"title": "...", "brief": "...", "highlights": ["...", "...", "..."], "body": "...", "category": "...", "scores": {"yenilik": 3, "etki": 3, "kanit": 3, "anlam": 3}}`

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
    const data = extractJson(result.text) as { title?: unknown; brief?: unknown; excerpt?: unknown; highlights?: unknown; body?: unknown; category?: unknown; scores?: unknown }
    if (typeof data.title !== 'string' || typeof data.body !== 'string' || !data.title.trim() || !data.body.trim()) {
      throw new Error('Model beklenen biçimde yanıt vermedi')
    }
    const content = {
      title: data.title.trim().slice(0, 300),
      excerpt: String(typeof data.brief === 'string' ? data.brief : typeof data.excerpt === 'string' ? data.excerpt : '').trim().slice(0, 500),
      highlights: Array.isArray(data.highlights) ? data.highlights.filter((h): h is string => typeof h === 'string').map((h) => h.trim().replace(/\n/g, ' ')).filter(Boolean).slice(0, 5).join('\n') : '',
      body: data.body.trim(),
      category: typeof data.category === 'string' && CATEGORIES[data.category] ? data.category : '',
      importance: criteriaScore(data.scores),
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

const SCORE_PROMPT = `Bir bilim editörüsün. Numaralı haberlerin başlığı, tarihi ve özetinin başı verilecek; her habere puan ver.
${CRITERIA}
Her haberi ayrı ayrı değerlendir; listeyi sıralama ya da haberleri birbirine göre ayarlama. Aynı listede birçok 5 de olabilir, hiç 5 olmayabilir de.
konu: astronomi, astrofizik ya da uzay araştırması ise "uzay", değilse "diğer".
tekrar: haber "Son yazılanlar" listesindeki bir yazıyla aynı gelişmeyse "Y"; bu listede daha önce geçen bir haberle aynı gelişmeyse o haberin numarası; değilse "-".
Her haber için tek satır yaz, başka hiçbir şey yazma:
NUMARA | yenilik | etki | kanit | anlam | konu | tekrar
Örnek: 7 | 4 | 3 | 4 | 3 | uzay | -`

type Candidate = { id: number; title: string; abstract: string; publishedAt: Date }

// Ön puan: başlık, tarih ve temizlenmiş özetin ilk 500 karakteri (haber başına ~150 token). Her haber bir kez puanlanır;
// puan mutlak olduğundan ertesi günlerin seçiminde de geçerli. Tekrarlar (son 7 günde yazılan ya da listede önce geçen) atlanır
export async function scorePapers(candidates: Candidate[], settings: Settings, recentTitles: string[]): Promise<{ scored: number; repeats: number }> {
  const today = new Date()
  const list = candidates.map((paper, index) => `${index + 1}. ${paper.title} (${paper.publishedAt.toISOString().slice(0, 10)})\n   ${cleanSummary(paper.abstract).slice(0, 500)}`).join('\n')
  // İlgi alanları yalnızca "okur için anlam"a dokunur: konusu uyan sıradan bir haber önemli bir haberin önüne geçmesin
  const interests = settings.interests.trim() ? `Okurun ilgi alanları: ${settings.interests}\nBu alanlardaki haberlerde "anlam" bir puan yüksek olabilir; diğer ölçütler değişmez.\n` : ''
  const recent = recentTitles.length ? `Son yazılanlar:\n${recentTitles.map((title) => `- ${title}`).join('\n')}\n\n` : ''
  // temperature 0: aynı haber iki kez puanlanınca fark yarıya iner (gerçek Haiku denemesinde 0,52 → 0,33)
  const result = await complete(settings, SCORE_PROMPT, `${interests}Bugün: ${today.toISOString().slice(0, 10)}\n\n${recent}Haberler:\n${list}`, { temperature: 0 })
  await addUsage(result.inputTokens, result.outputTokens)
  const lines = parseScores(result.text, candidates.length)
  if (lines.length === 0) throw new Error('Puan yanıtında geçerli satır yok')
  const scores = new Map(lines.map((line) => {
    const old = today.getTime() - candidates[line.index].publishedAt.getTime() > OLD_NEWS_DAYS * 86_400_000
    return [line.index, weightedScore({ ...line.criteria, yenilik: old ? Math.min(2, line.criteria.yenilik) : line.criteria.yenilik })]
  }))
  // Aynı gelişmeden yalnızca en yüksek puanlısı kalır
  const repeats = new Map<number, string>()
  for (const line of lines) {
    if (line.repeat === 'written') repeats.set(line.index, 'Son 7 günde yazılan bir haberin tekrarı')
    else if (line.repeat !== null && scores.has(line.repeat)) {
      const [drop, keep] = (scores.get(line.index) ?? 0) > (scores.get(line.repeat) ?? 0) ? [line.repeat, line.index] : [line.index, line.repeat]
      repeats.set(drop, `Aynı gelişme: ${candidates[keep].title}`.slice(0, 300))
    }
  }
  await prisma.$transaction(
    lines.map((line) => prisma.paper.update({
      where: { id: candidates[line.index].id },
      data: { score: scores.get(line.index)!, space: line.space, ...(repeats.has(line.index) ? { status: 'skipped', error: repeats.get(line.index) } : {}) },
    })),
  )
  return { scored: lines.length, repeats: repeats.size }
}

// Günlük iş: yeni haberler puanlanır, son 3 günün bekleyenlerinden eşiği geçenler yazılır. Seçilmeyenler (o gün sınır dolduysa)
// 3 gün boyunca ertesi günlerin seçimine aynı puanla girer; 3 günü dolan atlanır
export async function writeDaily(settings: Settings): Promise<{ written: number; failed: number; skipped: number; budget: boolean }> {
  const cutoff = new Date(Date.now() - 3 * 24 * 3600_000)
  const expired = await prisma.paper.updateMany({ where: { status: 'new', createdAt: { lt: cutoff } }, data: { status: 'skipped' } })
  const unscored = await prisma.paper.findMany({
    where: { status: 'new', createdAt: { gte: cutoff }, score: 0 },
    orderBy: { publishedAt: 'desc' },
    select: { id: true, title: true, abstract: true, publishedAt: true },
  })
  const summary = { written: 0, failed: 0, skipped: expired.count, budget: false }
  if (settings.postsPerDay <= 0) return summary
  if (unscored.length && (await overBudget(settings))) return { ...summary, budget: true }
  const recent = await prisma.post.findMany({ where: { createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } }, select: { title: true, paper: { select: { title: true } } } })
  const recentTitles = recent.map((post) => post.paper?.title || post.title)
  let repeats = 0
  for (let i = 0; i < unscored.length; i += CHUNK) repeats += (await scorePapers(unscored.slice(i, i + CHUNK), settings, recentTitles)).repeats
  // Ön puanı çok düşük olanlar beklemeden atlanır (Bekliyor listesi dolmasın)
  const low = await prisma.paper.updateMany({ where: { status: 'new', score: { gte: 1, lte: MIN_PRESCORE } }, data: { status: 'skipped' } })
  summary.skipped += low.count + repeats
  const pool = await prisma.paper.findMany({ where: { status: 'new', createdAt: { gte: cutoff }, score: { gt: MIN_PRESCORE } }, select: { id: true, score: true, space: true } })
  const picked = pickDaily(pool, {
    min: settings.postsMinPerDay,
    max: settings.postsPerDay,
    threshold: settings.scoreThreshold,
    exceptional: settings.scoreExceptional,
    spaceMin: settings.spacePerDay,
    spaceNormal: settings.spaceNormalPerDay,
    spaceMax: settings.spaceMaxPerDay,
    spaceImportant: settings.spaceImportantScore,
  }).map((paper) => paper.id)
  const notes = [low.count && `ön puanı ${MIN_PRESCORE / 10} ve altı olan ${low.count}`, repeats && `tekrar olan ${repeats}`].filter(Boolean)
  await logJob(`Günlük iş: ${unscored.length} yeni makale puanlandı${notes.length ? ` (${notes.join(', ')} tanesi atlandı)` : ''}; ${pool.length} adayın ${pool.filter((p) => p.score >= settings.scoreThreshold).length} tanesi eşiği geçti, ${picked.length} tanesi seçildi, yazılıyor…`)
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
