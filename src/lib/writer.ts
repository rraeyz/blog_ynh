import { prisma } from '@/lib/prisma'
import { complete } from '@/lib/ai'
import { paperText } from '@/lib/papers'
import { extractJson, parseSelection, slugify } from '@/lib/text'
import { addUsage, logJob, overBudget, type Settings } from '@/lib/state'
import { CATEGORIES } from '@/lib/topics'
import { coverIfNeeded } from '@/lib/images'

// Öne çıkanlara alınması önerilen en düşük önem puanı (panelde rozet)
export const FEATURE_SUGGESTION = 8

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
    await coverIfNeeded(post.id, settings)
    return post
  } catch (error) {
    // Yeniden yazımda eski yazı yerinde kalır; makale "Hata"ya düşmez
    if (!replacePostId) await prisma.paper.update({ where: { id: paper.id }, data: { status: 'failed', error: String((error as Error).message || error).slice(0, 300) } })
    throw error
  }
}

const SELECT = `Bir bilim editörüsün. Verilen makale ve haberlerden en önemlilerini seç:
- yeni ve somut bir sonuç (keşif, icat, ölçüm, yeni yöntem) içerenler,
- alanında ya da günlük hayatta etkisi büyük olanlar,
- meraklı ama uzman olmayan bir okuru ilgilendirecek olanlar.
Küçük iyileştirmeleri, birbirinin tekrarı olanları ve yalnızca dar bir uzman kitleyi ilgilendirenleri seçme; eşit önemdeyse farklı konulardan seç.
Ayrıca listedeki HER makaleye bu ölçütlere göre 1-10 arası bir puan ver (cömert olma; çoğu 3-6 arasında olmalı).
Yanıtı yalnızca şu JSON biçiminde ver: {"picked": [seçtiğin numaralar önem sırasıyla], "scores": {"1": puan, "2": puan, ...}}`

// Model en önemli n makaleyi seçer ve hepsine ön puan verir (Makaleler → Bekliyor bu puana göre sıralı).
// Başlık ve özetin başı gider (makale başına ~60 token, puanlar için ~4 token)
export async function selectPapers(candidates: Array<{ id: number; title: string; abstract: string }>, settings: Settings, n: number): Promise<number[]> {
  if (candidates.length <= n) return candidates.map((paper) => paper.id)
  const list = candidates.map((paper, index) => `${index + 1}. ${paper.title}\n   ${paper.abstract.replace(/\s+/g, ' ').slice(0, 220)}`).join('\n')
  // İlgi alanları öncelik verir (baştaki en çok); ama konusu uyan sıradan bir haber önemli bir haberin önüne geçmez
  const interests = settings.interests.trim()
    ? `Okurun öncelikli ilgi alanları (baştaki en öncelikli): ${settings.interests}\nBu alanlardaki somut ve yeni gelişmeleri, biraz daha az önemli olsalar bile öne al ve puanlarını buna göre ver; ama sıradan bir haberi yalnızca konusu uyuyor diye seçme.\n`
    : ''
  const result = await complete(settings, SELECT, `${interests}Seçilecek sayı: ${n}\n\nMakaleler:\n${list}`)
  await addUsage(result.inputTokens, result.outputTokens)
  const { picked, scores } = parseSelection(result.text, candidates.length, n)
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
  // Bekleyenlerin hepsi modele gider (makale başına ~70 token; 400 makale ~28 bin). Sınır yalnızca olağan dışı yığılmaya karşı
  const pool = candidates.slice(0, 400)
  const picked = await selectPapers(pool, settings, settings.postsPerDay)
  await logJob(`Günlük iş: ${pool.length} makaleden ${picked.length} tanesi seçildi, yazılıyor…`)
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
