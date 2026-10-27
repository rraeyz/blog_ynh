import { prisma } from '@/lib/prisma'
import { apiUrl, htmlTitle, htmlToText, parseAtom, parseSourceUrl, type PaperData } from '@/lib/arxiv'

const USER_AGENT = 'blog_ynh (+https://github.com/rraeyz/blog_ynh)'

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(60_000), redirect: 'follow' })
  if (!response.ok) throw new Error(`${new URL(url).host} yanıtı ${response.status}`)
  return response.text()
}

// Yenileri ekler, var olanlara dokunmaz. Eklenen sayısını döner
async function savePapers(papers: PaperData[]): Promise<number> {
  let added = 0
  for (const paper of papers) {
    const exists = await prisma.paper.findUnique({ where: { externalId: paper.externalId }, select: { id: true } })
    if (exists) continue
    await prisma.paper.create({ data: paper })
    added++
  }
  return added
}

// Tek makale ya da herhangi bir sayfa linki → bekleyen makaleler listesine
export async function addPaperFromUrl(input: string): Promise<{ id: number; title: string }> {
  const ref = parseSourceUrl(input)
  if (!ref) throw new Error('Geçerli bir http(s) linki gir')
  let paper: PaperData
  if (ref.kind === 'category') throw new Error('Bu bir kategori linki; Kaynaklar sayfasından ekle')
  if (ref.kind === 'paper') {
    const found = parseAtom(await fetchText(apiUrl(ref)))[0]
    if (!found) throw new Error('arXiv bu makaleyi bulamadı')
    paper = found
  } else {
    const html = await fetchText(ref.url)
    const text = htmlToText(html)
    paper = { externalId: `url:${ref.url}`, title: htmlTitle(html) || ref.url, authors: '', abstract: text.slice(0, 1500), url: ref.url, publishedAt: new Date() }
  }
  const existing = await prisma.paper.findUnique({ where: { externalId: paper.externalId } })
  if (existing) {
    // Daha önce atlanmışsa yeniden sıraya al
    if (existing.status === 'skipped' || existing.status === 'failed') await prisma.paper.update({ where: { id: existing.id }, data: { status: 'new', error: '' } })
    return { id: existing.id, title: existing.title }
  }
  const created = await prisma.paper.create({ data: paper })
  return { id: created.id, title: created.title }
}

// Açık kaynakların hepsini tarar; her kaynağın hatası kendi satırına yazılır
export async function fetchSources(): Promise<number> {
  const sources = await prisma.source.findMany({ where: { enabled: true } })
  let added = 0
  for (const source of sources) {
    const ref = parseSourceUrl(source.url)
    try {
      if (ref?.kind !== 'category') throw new Error('Desteklenmeyen kaynak linki')
      const count = await savePapers(parseAtom(await fetchText(apiUrl(ref))))
      added += count
      await prisma.source.update({ where: { id: source.id }, data: { lastFetchedAt: new Date(), lastError: '' } })
    } catch (error) {
      await prisma.source.update({ where: { id: source.id }, data: { lastFetchedAt: new Date(), lastError: String((error as Error).message || error).slice(0, 300) } })
    }
    // arXiv API isteği: istekler arasında 3 saniye bekleyin
    await new Promise((resolve) => setTimeout(resolve, 3000))
  }
  return added
}

// Modele gidecek metin: "full" modda arXiv'in HTML sürümü (yoksa özet), web sayfalarında sayfanın kendisi
export async function paperText(paper: { externalId: string; abstract: string; url: string }, readMode: string, maxChars: number): Promise<string> {
  if (readMode === 'full') {
    try {
      if (paper.externalId.startsWith('arxiv:')) {
        const text = htmlToText(await fetchText(`https://arxiv.org/html/${paper.externalId.slice(6)}`))
        if (text.length > paper.abstract.length) return text.slice(0, maxChars)
      } else {
        return htmlToText(await fetchText(paper.url)).slice(0, maxChars)
      }
    } catch {
      // HTML sürümü olmayan makale: özetle devam
    }
  }
  return paper.abstract.slice(0, maxChars)
}
