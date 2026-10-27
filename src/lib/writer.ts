import { prisma } from '@/lib/prisma'
import { complete } from '@/lib/ai'
import { paperText } from '@/lib/papers'
import { extractJson, slugify } from '@/lib/text'
import { addUsage, overBudget, type Settings } from '@/lib/state'

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

Yanıtı yalnızca şu JSON biçiminde ver, başka hiçbir şey yazma:
{"title": "...", "brief": "...", "highlights": ["...", "...", "..."], "body": "..."}`

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
    const data = extractJson(result.text) as { title?: unknown; brief?: unknown; excerpt?: unknown; highlights?: unknown; body?: unknown }
    if (typeof data.title !== 'string' || typeof data.body !== 'string' || !data.title.trim() || !data.body.trim()) {
      throw new Error('Model beklenen biçimde yanıt vermedi')
    }
    const content = {
      title: data.title.trim().slice(0, 300),
      excerpt: String(typeof data.brief === 'string' ? data.brief : typeof data.excerpt === 'string' ? data.excerpt : '').trim().slice(0, 500),
      highlights: Array.isArray(data.highlights) ? data.highlights.filter((h): h is string => typeof h === 'string').map((h) => h.trim().replace(/\n/g, ' ')).filter(Boolean).slice(0, 5).join('\n') : '',
      body: data.body.trim(),
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
    return post
  } catch (error) {
    // Yeniden yazımda eski yazı yerinde kalır; makale "Hata"ya düşmez
    if (!replacePostId) await prisma.paper.update({ where: { id: paper.id }, data: { status: 'failed', error: String((error as Error).message || error).slice(0, 300) } })
    throw error
  }
}

// İlgi alanı girilmişse model en uygun n makaleyi seçer (yalnızca başlıklar gider, ucuz); yoksa en yeniler
export async function selectPapers(candidates: Array<{ id: number; title: string }>, settings: Settings, n: number): Promise<number[]> {
  if (candidates.length <= n || !settings.interests.trim()) return candidates.slice(0, n).map((paper) => paper.id)
  const list = candidates.map((paper, index) => `${index + 1}. ${paper.title}`).join('\n')
  const result = await complete(
    settings,
    'Bir bülten editörüsün. Verilen makale başlıklarından okurun ilgi alanlarına en uygun olanları seç. Yalnızca seçtiğin numaraları JSON dizi olarak yaz, örn. [3, 1, 7].',
    `İlgi alanları: ${settings.interests}\nSeçilecek sayı: ${n}\n\nMakaleler:\n${list}`,
  )
  await addUsage(result.inputTokens, result.outputTokens)
  const picked = extractJson(result.text)
  if (!Array.isArray(picked)) throw new Error('Seçim yanıtı dizi değil')
  const ids = picked.map((i) => candidates[Number(i) - 1]?.id).filter((id): id is number => typeof id === 'number')
  return Array.from(new Set(ids)).slice(0, n)
}

// Günlük iş: son 3 günün bekleyen makalelerinden seçip yazar, seçilmeyenleri atlar
export async function writeDaily(settings: Settings): Promise<{ written: number; failed: number; skipped: number; budget: boolean }> {
  const candidates = await prisma.paper.findMany({
    where: { status: 'new', createdAt: { gte: new Date(Date.now() - 3 * 24 * 3600_000) } },
    orderBy: { publishedAt: 'desc' },
    select: { id: true, title: true },
  })
  const summary = { written: 0, failed: 0, skipped: 0, budget: false }
  if (candidates.length === 0 || settings.postsPerDay <= 0) return summary
  if (await overBudget(settings)) return { ...summary, budget: true }
  // Modele en yeni 80 başlık gider (token için); seçilmeyenlerin hepsi atlanır, ertesi güne yığılmaz
  const picked = await selectPapers(candidates.slice(0, 80), settings, settings.postsPerDay)
  for (const id of picked) {
    if (await overBudget(settings)) {
      summary.budget = true
      break
    }
    try {
      await writePost(id, settings)
      summary.written++
    } catch {
      summary.failed++
    }
  }
  const rest = candidates.filter((paper) => !picked.includes(paper.id)).map((paper) => paper.id)
  if (!summary.budget && rest.length) {
    summary.skipped = (await prisma.paper.updateMany({ where: { id: { in: rest }, status: 'new' }, data: { status: 'skipped' } })).count
  }
  return summary
}
