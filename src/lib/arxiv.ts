// arXiv linklerini çözümleme ve Atom/HTML ayrıştırma. Saf fonksiyonlar (dış bağımlılık yok): tests/unit.test.ts

export type SourceRef =
  | { kind: 'category'; categories: string[] } // arxiv.org/list/cs.AI/recent, /archive/astro-ph, rss.arxiv.org/rss/cs.AI+cs.LG
  | { kind: 'paper'; id: string } // arxiv.org/abs/2510.12345v2, /pdf/..., /html/...
  | { kind: 'web'; url: string } // başka herhangi bir adres: kaynak olarak RSS/Atom beslemesi, tek makale olarak sayfa

export interface PaperData {
  externalId: string
  title: string
  authors: string
  abstract: string
  topic: string
  url: string
  publishedAt: Date
}

const CATEGORY = /^[a-z-]+(\.[A-Za-z-]+)?$/
const PAPER_ID = /^(\d{4}\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/\d{7})(v\d+)?$/

export function parseSourceUrl(input: string): SourceRef | null {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  if (!/^https?:$/.test(url.protocol)) return null
  const host = url.hostname.replace(/^www\./, '')
  const parts = url.pathname.split('/').filter(Boolean)
  if (host === 'arxiv.org' || host === 'export.arxiv.org' || host === 'rss.arxiv.org') {
    if (['list', 'rss', 'atom', 'archive'].includes(parts[0]) && parts[1]) {
      const categories = decodeURIComponent(parts[1]).split('+').filter((c) => CATEGORY.test(c))
      if (categories.length) return { kind: 'category', categories }
    }
    if (['abs', 'pdf', 'html'].includes(parts[0]) && parts.length >= 2) {
      const id = parts.slice(1).join('/').replace(/\.pdf$/, '')
      const match = id.match(PAPER_ID)
      if (match) return { kind: 'paper', id: match[1] }
    }
    return null
  }
  return { kind: 'web', url: url.toString() }
}

export function apiUrl(ref: SourceRef, maxResults = 100): string {
  if (ref.kind === 'paper') return `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(ref.id)}`
  if (ref.kind === 'category') {
    // Noktasız ad bir arşivdir (astro-ph): alt kategorileriyle (astro-ph.GA ...) birlikte aranır
    const query = ref.categories.map((c) => `cat:${c}${c.includes('.') ? '' : '*'}`).join('+OR+')
    return `https://export.arxiv.org/api/query?search_query=${query}&sortBy=submittedDate&sortOrder=descending&max_results=${maxResults}`
  }
  return ref.url
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : whole
    }
    return ENTITIES[code.toLowerCase()] ?? whole
  })
}

const clean = (text: string) => decodeEntities(text).replace(/\s+/g, ' ').trim()
const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1] ?? ''

// arXiv API Atom yanıtı → makaleler (sürüm eki atılır: 2510.12345v2 → arxiv:2510.12345)
export function parseAtom(xml: string): PaperData[] {
  const papers: PaperData[] = []
  for (const entry of xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? []) {
    const absUrl = clean(tag(entry, 'id'))
    const id = absUrl.match(/arxiv\.org\/abs\/(.+?)(v\d+)?$/)?.[1]
    const title = clean(tag(entry, 'title'))
    if (!id || !title) continue
    const authors = Array.from(entry.matchAll(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>/g), (m) => clean(m[1]))
    const published = new Date(clean(tag(entry, 'published')))
    papers.push({
      externalId: `arxiv:${id}`,
      title,
      authors: authors.join(', '),
      abstract: clean(tag(entry, 'summary')),
      topic: entry.match(/<arxiv:primary_category[^>]*term="([^"]+)"/)?.[1] ?? '',
      url: `https://arxiv.org/abs/${id}`,
      publishedAt: Number.isNaN(published.getTime()) ? new Date() : published,
    })
  }
  return papers
}

// HTML sayfa → düz metin (script/stil/menü atılır)
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|nav|header|footer|noscript|svg|math)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<\/(p|div|h[1-6]|li|section|tr)>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim()
}

export const htmlTitle = (html: string) => clean(tag(html, 'title'))

const unwrap = (text: string) => text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')

// Herhangi bir RSS 2.0 / Atom beslemesi → makaleler (bağlantısı olmayan öğeler atlanır)
export function parseFeed(xml: string): PaperData[] {
  const papers: PaperData[] = []
  for (const item of xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/g) ?? []) {
    const atomLink = item.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/)?.[1] ?? item.match(/<link[^>]*href="([^"]+)"/)?.[1]
    const link = clean(unwrap(atomLink ?? tag(item, 'link')))
    const title = clean(unwrap(tag(item, 'title')).replace(/<[^>]+>/g, ''))
    if (!/^https?:\/\//.test(link) || !title) continue
    const body = unwrap(tag(item, 'content:encoded') || tag(item, 'description') || tag(item, 'summary') || tag(item, 'content'))
    const date = new Date(clean(tag(item, 'pubDate') || tag(item, 'published') || tag(item, 'updated') || tag(item, 'dc:date')))
    papers.push({
      externalId: `url:${link}`,
      title,
      authors: clean(unwrap(tag(item, 'dc:creator') || tag(tag(item, 'author'), 'name') || tag(item, 'author'))),
      // Bazı beslemeler açıklamayı kaçışlanmış HTML olarak verir: önce çöz, sonra etiketleri at
      abstract: htmlToText(decodeEntities(body)).slice(0, 4000),
      topic: link.match(/^https?:\/\/([^/?#:]+)/)![1].replace(/^www\./, ''),
      url: link,
      publishedAt: Number.isNaN(date.getTime()) ? new Date() : date,
    })
  }
  return papers
}
