import { prisma } from '@/lib/prisma'

// Tam yedek: ayarlar (API anahtarları dahil, yönetici şifresi hariç), kaynaklar, makaleler, yazılar, bültenler.
// Geri yükleme hepsini yedektekiyle değiştirir; mevcut şifre ve oturum aynen kalır.

export const BACKUP_FORMAT = 'blog-backup'
const VERSION = 1

// Geri yüklemede yalnızca bu alanlar alınır (yedek dosyası güvenilmeyen girdidir)
const FIELDS = {
  settings: ['siteTitle', 'siteDescription', 'siteUrl', 'aiProvider', 'aiModel', 'aiApiKey', 'aiBaseUrl', 'readMode', 'maxInputChars', 'postsPerDay', 'dailyHour', 'interests', 'monthlyTokenLimit', 'autoPublish', 'autoNewsletter', 'digestWeekday', 'kunyeUrl', 'kunyeToken', 'newsletterTag', 'imageApiKey', 'imageModel'],
  sources: ['id', 'url', 'enabled', 'lastFetchedAt', 'lastError', 'createdAt'],
  papers: ['id', 'externalId', 'title', 'authors', 'abstract', 'imageUrl', 'topic', 'url', 'publishedAt', 'status', 'error', 'createdAt'],
  posts: ['id', 'slug', 'title', 'excerpt', 'highlights', 'category', 'importance', 'image', 'featuredAt', 'body', 'status', 'publishedAt', 'paperId', 'inputTokens', 'outputTokens', 'createdAt', 'updatedAt'],
  digests: ['id', 'createdAt', 'subject', 'body', 'status', 'sentAt', 'result'],
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
  const [settings, sources, papers, posts, digests] = await Promise.all([
    prisma.settings.findUnique({ where: { id: 1 } }),
    prisma.source.findMany({ orderBy: { id: 'asc' } }),
    prisma.paper.findMany({ orderBy: { id: 'asc' } }),
    prisma.post.findMany({ orderBy: { id: 'asc' } }),
    prisma.digest.findMany({ orderBy: { id: 'asc' } }),
  ])
  return {
    format: BACKUP_FORMAT,
    formatVersion: VERSION,
    createdAt: new Date().toISOString(),
    settings: pick(settings ?? {}, FIELDS.settings),
    sources,
    papers,
    posts,
    digests,
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

  // Hepsi ya da hiçbiri: hata olursa veritabanı değişmeden kalır
  await prisma.$transaction(async (tx) => {
    await tx.post.deleteMany()
    await tx.digest.deleteMany()
    await tx.paper.deleteMany()
    await tx.source.deleteMany()
    await tx.settings.update({ where: { id: 1 }, data: settings })
    // Sıra önemli: yazılar makalelere bağlı
    if (sources.length) await tx.source.createMany({ data: sources as never })
    if (papers.length) await tx.paper.createMany({ data: papers as never })
    if (posts.length) await tx.post.createMany({ data: posts as never })
    if (digests.length) await tx.digest.createMany({ data: digests as never })
  })
  return { sources: sources.length, papers: papers.length, posts: posts.length, digests: digests.length }
}
