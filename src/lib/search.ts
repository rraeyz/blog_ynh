import { prisma } from '@/lib/prisma'
import { getState, setState } from '@/lib/state'
import { foldText, ftsQuery } from '@/lib/text'

// Arama dizini: SQLite FTS5 (Prisma şemasında tanımlanamadığı için burada kurulur).
// Yayımlanan yazı ve derslerin sayısı ya da son güncellemesi değişince dizin baştan kurulur: içerik günde birkaç kez değişir,
// binlerce yazıyı dizinlemek bir saniyenin altında. Her kaydetme/silme yolunu ayrı ayrı izlemekten sağlam
const globalForSearch = globalThis as unknown as { searchTable?: boolean }

async function stamp(): Promise<string> {
  const [posts, lessons] = await Promise.all([
    prisma.post.aggregate({ where: { status: 'published' }, _count: true, _max: { updatedAt: true } }),
    prisma.lesson.aggregate({ where: { status: 'published' }, _count: true, _max: { updatedAt: true } }),
  ])
  return [posts._count, posts._max.updatedAt?.toISOString(), lessons._count, lessons._max.updatedAt?.toISOString()].join('|')
}

async function ensureIndex() {
  if (!globalForSearch.searchTable) {
    await prisma.$executeRawUnsafe(`CREATE VIRTUAL TABLE IF NOT EXISTS SearchIndex USING fts5(kind UNINDEXED, ref UNINDEXED, title, body, tokenize='unicode61 remove_diacritics 2')`)
    globalForSearch.searchTable = true
  }
  const current = await stamp()
  if ((await getState('search.stamp')) === current) return
  const [posts, lessons] = await Promise.all([
    prisma.post.findMany({ where: { status: 'published' }, select: { id: true, title: true, excerpt: true, highlights: true, body: true } }),
    prisma.lesson.findMany({ where: { status: 'published' }, select: { id: true, title: true, excerpt: true, body: true, series: { select: { title: true } } } }),
  ])
  const rows = [
    ...posts.map((p) => ['post', p.id, p.title, `${p.excerpt}\n${p.highlights}\n${p.body}`] as const),
    ...lessons.map((l) => ['lesson', l.id, l.title, `${l.excerpt}\n${l.series.title}\n${l.body}`] as const),
  ]
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('DELETE FROM SearchIndex')
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100)
      await tx.$executeRawUnsafe(`INSERT INTO SearchIndex (kind, ref, title, body) VALUES ${chunk.map(() => '(?, ?, ?, ?)').join(', ')}`, ...chunk.flatMap(([kind, id, title, body]) => [kind, id, foldText(title), foldText(body)]))
    }
  })
  await setState('search.stamp', current)
}

// Eşleşen yazı ve ders numaraları: önce bütün kelimeleri başlığında geçenler, sonra ötekiler; her grupta en alakalı önce
export async function searchIds(query: string, postLimit: number, lessonLimit: number): Promise<{ posts: number[]; lessons: number[] }> {
  const match = ftsQuery(query)
  if (!match) return { posts: [], lessons: [] }
  await ensureIndex()
  const find = (expression: string) =>
    prisma.$queryRawUnsafe<Array<{ kind: string; ref: number | bigint }>>('SELECT kind, ref FROM SearchIndex WHERE SearchIndex MATCH ? ORDER BY bm25(SearchIndex, 0, 0, 10, 1) LIMIT 200', expression)
  const rows = [...(await find(`title : (${match})`)), ...(await find(match))]
  const ids = (kind: string, limit: number) => Array.from(new Set(rows.filter((r) => r.kind === kind).map((r) => Number(r.ref)))).slice(0, limit)
  return { posts: ids('post', postLimit), lessons: ids('lesson', lessonLimit) }
}

// Numara sırasını koruyarak (findMany sırayı korumaz)
export const inOrder = <T extends { id: number }>(ids: number[], items: T[]) => ids.flatMap((id) => items.filter((item) => item.id === id))
