import { prisma } from '@/lib/prisma'
import { safeFetch } from '@/lib/net'
import { apiUrl, htmlTitle, htmlToText, parseAtom, parseFeed, parseSourceUrl, safeImage, type PaperData } from '@/lib/arxiv'

const USER_AGENT = 'blog_ynh (+https://github.com/rraeyz/blog_ynh)'

export async function fetchText(url: string): Promise<string> {
  const response = await safeFetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(60_000) })
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
    const image = safeImage(html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)?.[1] ?? '')
    paper = { externalId: `url:${ref.url}`, title: htmlTitle(html) || ref.url, authors: '', abstract: text.slice(0, 1500), topic: new URL(ref.url).hostname.replace(/^www\./, ''), url: ref.url, publishedAt: new Date(), imageUrl: image }
  }
  const existing = await prisma.paper.findUnique({ where: { externalId: paper.externalId } })
  if (existing) {
    // Daha önce atlanmışsa yeniden sıraya al
    if (['skipped', 'failed', 'deleted'].includes(existing.status)) await prisma.paper.update({ where: { id: existing.id }, data: { status: 'new', error: '', abstract: paper.abstract } })
    return { id: existing.id, title: existing.title }
  }
  const created = await prisma.paper.create({ data: paper })
  return { id: created.id, title: created.title }
}

// Silinen makale gizlenir ama kaydı kalır: kaynağın beslemesinde durdukça yeniden "Bekliyor"a düşmesin.
// Yazısı olan makaleye dokunulmaz (yazının kaynak kartı ona bağlı)
export const hidePapers = (status: string, id?: number) =>
  prisma.paper.updateMany({ where: { status, ...(id ? { id } : {}), post: { is: null } }, data: { status: 'deleted', abstract: '', error: '' } })

// Otomatik temizlik (günlük iş): 30 günden eski atlanan ve hatalı makaleler gizlenir (hidePapers gibi: metni silinir, kaydı kalır).
// Kayıt silinmez: arşiv beslemeleri (ör. AAS Nova'nın 600 eski haberi) hep aynı haberleri gösterir, silinen kayıt yeni diye geri gelirdi.
// Kayıt başına ~0,4 KB (adres, başlık, durum); günde 300 haberde yılda ~40 MB
export async function cleanupPapers(): Promise<number> {
  const { count } = await prisma.paper.updateMany({
    where: { status: { in: ['skipped', 'failed'] }, createdAt: { lt: new Date(Date.now() - 30 * 86_400_000) }, post: { is: null } },
    data: { status: 'deleted', abstract: '', error: '' },
  })
  return count
}

// Kaynaktaki güncel makaleler: arXiv kategorisi API'den, diğer adresler RSS/Atom beslemesi olarak
export async function readSource(url: string): Promise<PaperData[]> {
  const ref = parseSourceUrl(url)
  if (!ref || ref.kind === 'paper') throw new Error('Kaynak olarak arXiv kategori/arşiv linki ya da bir RSS/Atom besleme adresi gir')
  if (ref.kind === 'category') return parseAtom(await fetchText(apiUrl(ref)))
  const papers = parseFeed(await fetchText(ref.url))
  if (papers.length === 0) throw new Error('Bu adreste RSS/Atom beslemesi bulunamadı (sitenin "RSS" ya da "feed" linkini dene)')
  return papers
}

// Açık kaynakların hepsini tarar; her kaynağın hatası kendi satırına yazılır
export async function fetchSources(): Promise<number> {
  const sources = await prisma.source.findMany({ where: { enabled: true } })
  let added = 0
  for (const source of sources) {
    try {
      const count = await savePapers(await readSource(source.url))
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
      const url = paper.externalId.startsWith('arxiv:') ? `https://arxiv.org/html/${paper.externalId.slice(6)}` : paper.url
      const text = htmlToText(await fetchText(url))
      // Özetten kısa metin gerçek sayfa değil: arXiv'de HTML sürümü yok ya da sitede bir engel sayfası ("Just a moment...")
      if (text.length > paper.abstract.length) return text.slice(0, maxChars)
    } catch {
      // HTML sürümü olmayan makale: özetle devam
    }
  }
  return paper.abstract.slice(0, maxChars)
}
