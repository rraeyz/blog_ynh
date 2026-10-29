import path from 'node:path'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { prisma } from '@/lib/prisma'
import { compressImage } from '@/lib/compress'
import { PROVIDERS } from '@/lib/ai'
import { freeImage } from '@/lib/topics'
import { addUsage, logJob, type Settings } from '@/lib/state'

// Yapay zekâ kapakları veritabanının yanında durur (YunoHost veri klasörü); JSON yedeğe base64 olarak girer
export const IMAGE_DIR = path.join(path.dirname((process.env.DATABASE_URL || 'file:/app/prisma/dev.db').replace(/^file:/, '')), 'gorseller')
export const IMAGE_NAME = /^\d+-\d+\.(jpg|png|webp)$/
// Görsel başına sabit ~0,01 $ (1K); ayarlardan değiştirilebilir
export const DEFAULT_IMAGE_MODEL = 'black-forest-labs/flux-3-image-klein'
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

export const removeImage = (name: string) => (IMAGE_NAME.test(name) ? unlink(path.join(IMAGE_DIR, name)).catch(() => {}) : Promise.resolve())

// Temsili kapak: başlık ve kısa metinden, OpenRouter'ın görsel API'siyle. Fotoğraf gibi görünmesin (bilim haberinde yanıltır)
export async function generateCover(postId: number, settings: Settings): Promise<string> {
  const post = await prisma.post.findUniqueOrThrow({ where: { id: postId } })
  const response = await fetch(`${PROVIDERS.openrouter.baseUrl}/images`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.imageApiKey.trim()}` },
    body: JSON.stringify({
      model: settings.imageModel.trim() || DEFAULT_IMAGE_MODEL,
      prompt: `Editorial cover illustration for a popular-science news article. Headline: "${post.title}". Summary: ${post.excerpt}\n` +
        'Style: modern digital illustration with vivid colors; it must clearly look like an illustration, not a real photograph. No text, letters, numbers, logos or watermarks.',
      // Yalnızca her görsel modelinin kabul ettiği alanlar: model değiştirince istek reddedilmesin
      aspect_ratio: '16:9',
      n: 1,
    }),
    signal: AbortSignal.timeout(180_000),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(response.status === 401 ? 'OpenRouter anahtarı geçersiz' : response.status === 402 ? `OpenRouter ödeme hatası (402): ${String(data.error?.message || 'bakiye ya da anahtarın harcama sınırı yetmiyor').slice(0, 150)}` : data.error?.message || `OpenRouter yanıtı ${response.status}`)
  const image = data.data?.[0]
  if (typeof image?.b64_json !== 'string' || !EXT[image.media_type ?? 'image/png']) throw new Error('OpenRouter görsel döndürmedi')
  const name = `${post.id}-${Date.now()}.webp`
  await mkdir(IMAGE_DIR, { recursive: true })
  await writeFile(path.join(IMAGE_DIR, name), await compressImage(Buffer.from(image.b64_json, 'base64')))
  await prisma.post.update({ where: { id: post.id }, data: { image: name } })
  await removeImage(post.image)
  if (typeof data.usage?.cost !== 'number') return name
  await addUsage({ inputTokens: 0, outputTokens: 0, cost: data.usage.cost }, 'gorsel')
  return `${name} (${data.usage.cost.toFixed(3)} $)`
}

// Yeni yazıda: kaynağın serbest görseli yoksa ve anahtar girilmişse. Görsel hatası yazıyı düşürmez, günlüğe yazılır
export async function coverIfNeeded(postId: number, settings: Settings): Promise<void> {
  if (!settings.imageApiKey.trim()) return
  const post = await prisma.post.findUniqueOrThrow({ where: { id: postId }, include: { paper: true } })
  if (post.image || freeImage(post.paper)) return
  await generateCover(postId, settings).catch((error) => logJob(`Görsel üretilemedi ("${post.title.slice(0, 60)}"): ${String(error?.message || error).slice(0, 150)}`))
}

// Kapağı ve serbest görseli olmayan yayındaki yazılara toplu kapak (ör. bakiye bittiği için çizilemeyenler).
// Ödeme hatasında durur: kalanlar da aynı hatayı verir
export async function coverMissing(settings: Settings): Promise<string> {
  const posts = await prisma.post.findMany({ where: { status: 'published', image: '' }, orderBy: { publishedAt: 'desc' }, include: { paper: true } })
  const missing = posts.filter((post) => !freeImage(post.paper))
  let drawn = 0
  for (const post of missing) {
    try {
      await generateCover(post.id, settings)
      drawn++
    } catch (error) {
      const message = String((error as Error).message || error).slice(0, 200)
      if (message.includes('(402)')) return `${drawn}/${missing.length} kapak çizildi, durdu: ${message}`
      await logJob(`Görsel üretilemedi ("${post.title.slice(0, 60)}"): ${message}`)
    }
  }
  return `${drawn}/${missing.length} kapak çizildi`
}
