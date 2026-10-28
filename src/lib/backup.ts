import path from 'node:path'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { prisma } from '@/lib/prisma'
import { IMAGE_DIR, IMAGE_NAME } from '@/lib/images'

// Tam yedek: ayarlar (API anahtarları dahil, yönetici şifresi hariç), kaynaklar, makaleler, yazılar, bültenler, dersler
// ve yapay zekâ kapakları (base64; yeniden üretmek para tutar).
// Geri yükleme hepsini yedektekiyle değiştirir; mevcut şifre ve oturum aynen kalır.

export const BACKUP_FORMAT = 'blog-backup'
const VERSION = 1

// Geri yüklemede yalnızca bu alanlar alınır (yedek dosyası güvenilmeyen girdidir)
const FIELDS = {
  settings: ['siteTitle', 'siteDescription', 'siteUrl', 'aiProvider', 'aiModel', 'aiApiKey', 'aiBaseUrl', 'readMode', 'maxInputChars', 'postsPerDay', 'spacePerDay', 'dailyHour', 'interests', 'monthlyTokenLimit', 'autoPublish', 'autoNewsletter', 'digestWeekday', 'kunyeUrl', 'kunyeToken', 'newsletterTag', 'imageApiKey', 'imageModel', 'lessonModel', 'lessonWeekdays', 'lessonAutoPublish', 'autoFeature', 'skyEnabled', 'astroDigest', 'astroDigestWeekday'],
  sources: ['id', 'url', 'enabled', 'lastFetchedAt', 'lastError', 'createdAt'],
  papers: ['id', 'externalId', 'title', 'authors', 'abstract', 'score', 'imageUrl', 'topic', 'url', 'publishedAt', 'status', 'error', 'createdAt'],
  posts: ['id', 'slug', 'title', 'excerpt', 'highlights', 'category', 'importance', 'image', 'featuredAt', 'body', 'status', 'publishedAt', 'paperId', 'inputTokens', 'outputTokens', 'createdAt', 'updatedAt'],
  digests: ['id', 'createdAt', 'subject', 'body', 'status', 'sentAt', 'result'],
  series: ['id', 'slug', 'title', 'summary', 'track', 'level', 'position', 'planned', 'createdAt'],
  lessons: ['id', 'seriesId', 'position', 'slug', 'title', 'scope', 'sourceUrls', 'excerpt', 'body', 'sources', 'research', 'review', 'prerequisites', 'level', 'covers', 'status', 'error', 'publishedAt', 'inputTokens', 'outputTokens', 'createdAt', 'updatedAt'],
  skyEvents: ['date', 'time', 'kind', 'title', 'detail', 'createdAt'],
} as const

type Row = Record<string, unknown>
const pick = (row: unknown, fields: readonly string[]): Row => {
  if (!row || typeof row !== 'object') throw new Error('Yedekte bozuk kayıt var')
  return Object.fromEntries(fields.filter((field) => field in row).map((field) => [field, (row as Row)[field]]))
}
const rows = (value: unknown, fields: readonly string[]) => {
  if (!Array.isArray(value)) throw new Error('Yedek dosyası eksik ya da bozuk')
  return value.map((row) => pick(row, fields))
}

export async function createBackup() {
  const [settings, sources, papers, posts, digests, series, lessons, skyEvents] = await Promise.all([
    prisma.settings.findUnique({ where: { id: 1 } }),
    prisma.source.findMany({ orderBy: { id: 'asc' } }),
    prisma.paper.findMany({ orderBy: { id: 'asc' } }),
    prisma.post.findMany({ orderBy: { id: 'asc' } }),
    prisma.digest.findMany({ orderBy: { id: 'asc' } }),
    prisma.series.findMany({ orderBy: { id: 'asc' } }),
    prisma.lesson.findMany({ orderBy: { id: 'asc' } }),
    prisma.skyEvent.findMany({ orderBy: { date: 'asc' }, select: { date: true, time: true, kind: true, title: true, detail: true, createdAt: true } }),
  ])
  const images: Record<string, string> = {}
  for (const post of posts) {
    if (!IMAGE_NAME.test(post.image)) continue
    const file = await readFile(path.join(IMAGE_DIR, post.image)).catch(() => null)
    if (file) images[post.image] = file.toString('base64')
  }
  return {
    format: BACKUP_FORMAT,
    formatVersion: VERSION,
    createdAt: new Date().toISOString(),
    settings: pick(settings ?? {}, FIELDS.settings),
    sources,
    papers,
    posts,
    digests,
    series,
    lessons,
    skyEvents,
    images,
  }
}

export async function restoreBackup(data: unknown) {
  const backup = data as Row
  if (!backup || backup.format !== BACKUP_FORMAT) throw new Error('Bu dosya bu blogun yedeği değil')
  if (typeof backup.formatVersion !== 'number' || backup.formatVersion > VERSION) throw new Error('Yedek bu sürümden daha yeni bir sürümle alınmış')
  const settings = pick(backup.settings, FIELDS.settings)
  const sources = rows(backup.sources, FIELDS.sources)
  const papers = rows(backup.papers, FIELDS.papers)
  const posts = rows(backup.posts, FIELDS.posts)
  const digests = rows(backup.digests, FIELDS.digests)
  // Eğitim bölümünden önceki yedeklerde bu alanlar yok
  const series = rows(backup.series ?? [], FIELDS.series)
  const lessons = rows(backup.lessons ?? [], FIELDS.lessons)
  const skyEvents = rows(backup.skyEvents ?? [], FIELDS.skyEvents)
  // Dosya adı denetlenir: yedekten gelen ad klasör dışına yazamasın
  const images = Object.entries((backup.images ?? {}) as Record<string, unknown>).filter(
    (entry): entry is [string, string] => IMAGE_NAME.test(entry[0]) && typeof entry[1] === 'string',
  )

  // Hepsi ya da hiçbiri: hata olursa veritabanı değişmeden kalır
  await prisma.$transaction(async (tx) => {
    await tx.post.deleteMany()
    await tx.series.deleteMany() // dersler seriyle birlikte silinir
    await tx.digest.deleteMany()
    await tx.skyEvent.deleteMany()
    await tx.paper.deleteMany()
    await tx.source.deleteMany()
    await tx.settings.update({ where: { id: 1 }, data: settings })
    // Sıra önemli: yazılar makalelere bağlı
    if (sources.length) await tx.source.createMany({ data: sources as never })
    if (papers.length) await tx.paper.createMany({ data: papers as never })
    if (posts.length) await tx.post.createMany({ data: posts as never })
    if (digests.length) await tx.digest.createMany({ data: digests as never })
    if (series.length) await tx.series.createMany({ data: series as never })
    if (lessons.length) await tx.lesson.createMany({ data: lessons as never })
    if (skyEvents.length) await tx.skyEvent.createMany({ data: skyEvents as never })
  })
  if (images.length) await mkdir(IMAGE_DIR, { recursive: true })
  for (const [name, data] of images) await writeFile(path.join(IMAGE_DIR, name), Buffer.from(data, 'base64'))
  return { sources: sources.length, papers: papers.length, posts: posts.length, digests: digests.length, lessons: lessons.length, images: images.length }
}
