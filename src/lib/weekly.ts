import { prisma } from '@/lib/prisma'
import { istanbulDate } from '@/lib/sky'
import { addDays, mondayOf } from '@/lib/text'

// Haftanın astronomi özeti sitede: haftanın (pazartesi–pazar, Türkiye takvimi) uzay ve fizik yazıları, yayımlanan dersler ve gökyüzü olayları.
// Kaydedilmez, veriden o an kurulur: yapay zekâ maliyeti yok, geçmiş haftalar kendiliğinden arşiv olur
export const ASTRO_CATEGORIES = ['uzay', 'fizik']
// Türkiye 2016'dan beri yıl boyu UTC+3
const startOf = (date: string) => new Date(`${date}T00:00:00+03:00`)

export async function weeklyAstro(monday: string) {
  const range = { gte: startOf(monday), lt: startOf(addDays(monday, 7)) }
  const [posts, lessons, sky] = await Promise.all([
    prisma.post.findMany({ where: { status: 'published', category: { in: ASTRO_CATEGORIES }, publishedAt: range }, orderBy: [{ importance: 'desc' }, { publishedAt: 'desc' }], include: { paper: { select: { topic: true, url: true, imageUrl: true } } } }),
    prisma.lesson.findMany({ where: { status: 'published', publishedAt: range }, orderBy: { publishedAt: 'asc' }, include: { series: { select: { slug: true, title: true } } } }),
    prisma.skyEvent.findMany({ where: { date: { gte: monday, lte: addDays(monday, 6) } }, orderBy: [{ date: 'asc' }, { time: 'asc' }] }),
  ])
  return { posts, lessons, sky }
}

// Özeti olan haftalar (en yeni önce): yazı ya da ders yayımlanan haftalar ve içinde bulunulan hafta
// shortcut: bütün yayın tarihleri bellekte gruplanır; binlerce yazıda yavaşlarsa haftayı veritabanında tut
export async function astroWeeks(): Promise<Array<{ monday: string; posts: number; lessons: number; top: string }>> {
  const [posts, lessons] = await Promise.all([
    prisma.post.findMany({ where: { status: 'published', category: { in: ASTRO_CATEGORIES }, publishedAt: { not: null } }, orderBy: { importance: 'desc' }, select: { title: true, publishedAt: true } }),
    prisma.lesson.findMany({ where: { status: 'published', publishedAt: { not: null } }, select: { publishedAt: true } }),
  ])
  const weeks = new Map<string, { monday: string; posts: number; lessons: number; top: string }>()
  const week = (date: Date) => {
    const monday = mondayOf(istanbulDate(date))
    if (!weeks.has(monday)) weeks.set(monday, { monday, posts: 0, lessons: 0, top: '' })
    return weeks.get(monday)!
  }
  week(new Date())
  for (const post of posts) {
    const w = week(post.publishedAt!)
    w.posts++
    w.top ||= post.title
  }
  for (const lesson of lessons) week(lesson.publishedAt!).lessons++
  return Array.from(weeks.values()).sort((a, b) => b.monday.localeCompare(a.monday))
}

// "27 Ekim – 2 Kasım 2026"
export function weekLabel(monday: string): string {
  const day = (date: string, month: boolean) => new Date(`${date}T12:00:00Z`).toLocaleDateString('tr-TR', { day: 'numeric', ...(month ? { month: 'long' } : {}), timeZone: 'UTC' })
  const sunday = addDays(monday, 6)
  return `${day(monday, monday.slice(5, 7) !== sunday.slice(5, 7))} – ${day(sunday, true)} ${sunday.slice(0, 4)}`
}
