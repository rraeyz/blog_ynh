// Yazı gövdesi için küçük ve güvenli Markdown: ## / ### başlık, - liste, > vurgu kutusu, **kalın**, *italik*, `kod`,
// [metin](https://...). Önce tüm HTML kaçışlanır; yapay zekâ çıktısı sayfaya ham HTML olarak giremez.
// Satır satır işlenir: modeller başlıktan sonra boş satır bırakmayabilir. Saf fonksiyon: tests/unit.test.ts
import { slugify } from './text.ts'

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

// Tek satırlık metin için (ör. "Kısaca" maddeleri): kalın, italik, kod ve link; HTML kaçışlanır
export function inline(text: string): string {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" rel="noopener noreferrer" target="_blank">$1</a>')
}

// İçindekiler için: "## Ne yaptılar?" → { id: 'ne-yaptilar', text: 'Ne yaptılar?' }
export function headings(source: string): Array<{ id: string; text: string }> {
  return Array.from(source.matchAll(/^##\s+(.+)$/gm), (m) => ({ id: slugify(m[1]), text: m[1].trim() }))
}

export function renderMarkdown(source: string): string {
  const html: string[] = []
  let paragraph: string[] = []
  let list: string[] = []
  let quote: string[] = []
  const flush = () => {
    if (paragraph.length) html.push(`<p>${paragraph.map(inline).join('<br>')}</p>`)
    if (list.length) html.push(`<ul>${list.map((item) => `<li>${inline(item)}</li>`).join('')}</ul>`)
    if (quote.length) html.push(`<blockquote>${quote.map(inline).join('<br>')}</blockquote>`)
    paragraph = []
    list = []
    quote = []
  }
  for (const raw of source.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim()
    const heading = line.match(/^(#{2,3})\s+(.+)$/)
    const item = line.match(/^[-*]\s+(.+)$/)
    const quoted = line.match(/^>\s?(.*)$/)
    if (!line) flush()
    else if (heading) {
      flush()
      const level = heading[1].length
      html.push(`<h${level} id="${slugify(heading[2])}">${inline(heading[2])}</h${level}>`)
    } else if (item) {
      if (paragraph.length || quote.length) flush()
      list.push(item[1])
    } else if (quoted) {
      if (paragraph.length || list.length) flush()
      if (quoted[1]) quote.push(quoted[1])
    } else {
      if (list.length || quote.length) flush()
      paragraph.push(line)
    }
  }
  flush()
  return html.join('\n')
}
