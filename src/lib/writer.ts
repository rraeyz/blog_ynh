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
- Gövde Markdown olsun ve şu bölümleri içersin: kısa bir giriş paragrafı, "## Ne yaptılar?", "## Neden önemli?", "## Sınırlamalar". Toplam 300-600 kelime.
- Başlık çekici ama abartısız olsun, makalenin İngilizce başlığının çevirisi olmak zorunda değil.

Yanıtı yalnızca şu JSON biçiminde ver, başka hiçbir şey yazma:
{"title": "...", "excerpt": "en fazla 2 cümlelik özet", "body": "Markdown gövde"}`

async function uniqueSlug(title: string): Promise<string> {
  const base = slugify(title) || 'yazi'
  for (let i = 1; ; i++) {
    const slug = i === 1 ? base : `${base}-${i}`
    if (!(await prisma.post.findUnique({ where: { slug }, select: { id: true } }))) return slug
  }
}

// Bir makaleden yazı üretir; ayara göre taslak ya da yayımlanmış olarak kaydeder
export async function writePost(paperId: number, settings: Settings, publish = settings.autoPublish) {
  const paper = await prisma.paper.findUniqueOrThrow({ where: { id: paperId } })
  try {
    const text = await paperText(paper, settings.readMode, settings.maxInputChars)
    const user = `Başlık: ${paper.title}\nYazarlar: ${paper.authors || '-'}\nLink: ${paper.url}\n\nMetin:\n${text}`
    const result = await complete(settings, SYSTEM, user)
    await addUsage(result.inputTokens, result.outputTokens)
    const data = extractJson(result.text) as { title?: unknown; excerpt?: unknown; body?: unknown }
    if (typeof data.title !== 'string' || typeof data.body !== 'string' || !data.title.trim() || !data.body.trim()) {
      throw new Error('Model beklenen biçimde yanıt vermedi')
    }
    const post = await prisma.post.create({
      data: {
        slug: await uniqueSlug(data.title),
        title: data.title.trim().slice(0, 300),
        excerpt: typeof data.excerpt === 'string' ? data.excerpt.trim().slice(0, 500) : '',
        body: data.body.trim(),
        status: publish ? 'published' : 'draft',
        publishedAt: publish ? new Date() : null,
        paperId: paper.id,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      },
    })
    await prisma.paper.update({ where: { id: paper.id }, data: { status: 'written', error: '' } })
    return post
  } catch (error) {
    await prisma.paper.update({ where: { id: paper.id }, data: { status: 'failed', error: String((error as Error).message || error).slice(0, 300) } })
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
    take: 80,
    select: { id: true, title: true },
  })
  const summary = { written: 0, failed: 0, skipped: 0, budget: false }
  if (candidates.length === 0 || settings.postsPerDay <= 0) return summary
  if (await overBudget(settings)) return { ...summary, budget: true }
  const picked = await selectPapers(candidates, settings, settings.postsPerDay)
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
