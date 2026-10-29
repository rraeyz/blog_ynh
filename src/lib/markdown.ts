// Yazı gövdesi için küçük ve güvenli Markdown: ## / ### başlık, - liste, > vurgu kutusu, **kalın**, *italik*, `kod`,
// [metin](https://...), ```dil kod blokları```. Derslerde ayrıca $formül$ ve $$formül$$ (KaTeX).
// Önce tüm HTML kaçışlanır; yapay zekâ çıktısı sayfaya ham HTML olarak giremez (KaTeX ve highlight.js de kaçışlar).
// Satır satır işlenir: modeller başlıktan sonra boş satır bırakmayabilir. Saf fonksiyon: tests/unit.test.ts
import katex from 'katex'
import hljs from 'highlight.js/lib/common'
import { slugify } from './text.ts'

// Derslerdeki [[anahtar|metin]] bağlantıları: müfredat anahtarı → yayımlanmış ders adresi (yoksa null: "ileride")
export type LessonLinks = Record<string, { title: string; href: string | null }>

// Haber yazılarında $ işareti para birimi olabilir; formül ve ders kutuları yalnızca derslerde açılır
type Options = { math?: boolean; links?: LessonLinks }

// Ders bağlantısı adresle değil anahtarla yazılır: hedef ders yayımlanınca eski derslerdeki bağlantı kendiliğinden açılır
function lessonLink(key: string, label: string | undefined, links: LessonLinks | undefined): string {
  const target = links?.[key]
  const text = label ?? target?.title ?? key
  if (target?.href) return `<a href="${escapeHtml(target.href)}">${text}</a>`
  return target ? `${text} <span class="later">(ileride)</span>` : text
}

const tex = (source: string, displayMode: boolean) => katex.renderToString(source, { displayMode, throwOnError: false })

function codeBlock(lang: string, lines: string[]): string {
  const code = lines.join('\n')
  const body = lang && hljs.getLanguage(lang) ? hljs.highlight(code, { language: lang }).value : escapeHtml(code)
  return `<pre><code class="hljs${lang ? ` language-${escapeHtml(lang)}` : ''}">${body}</code></pre>`
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

// Tek satırlık metin için (ör. "Kısaca" maddeleri): kalın, italik, kod ve link; HTML kaçışlanır
export function inline(text: string, { math, links }: Options = {}): string {
  // Formüller önce yer tutucuya alınır: içlerindeki * ve _ kalın/italik sanılmasın
  const formulas: string[] = []
  const source = math ? text.replace(/\$([^$\s](?:[^$]*?[^$\s])?)\$/g, (_, f: string) => `\u0000${formulas.push(f) - 1}\u0000`) : text
  return escapeHtml(source)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/\[\[([a-z0-9-]+(?:\/[a-z0-9-]+)?)(?:\|([^\]]+))?\]\]/g, (_, key: string, label?: string) => lessonLink(key, label, links))
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" rel="noopener noreferrer" target="_blank">$1</a>')
    .replace(/\u0000(\d+)\u0000/g, (_, i: string) => tex(formulas[Number(i)], false))
}

// İçindekiler için: "## Ne yaptılar?" → { id: 'ne-yaptilar', text: 'Ne yaptılar?' }
export function headings(source: string): Array<{ id: string; text: string }> {
  return Array.from(source.matchAll(/^##\s+(.+)$/gm), (m) => ({ id: slugify(m[1]), text: m[1].trim() }))
}

// Derslerde ":::ad" ile ":::" arası kutular: çözüm ve "merak edene" tıklayınca açılır. Anlamı metinde, görünüşü burada ve CSS'te:
// tasarım değişince yazılmış dersleri yeniden yazmak gerekmez
const BOXES: Record<string, [string, string]> = {
  cozum: ['<details class="solution"><summary>Çözümü göster</summary>', '</details>'],
  bilmen: ['<aside class="box box-bilmen"><p class="box-title">Bilmen gereken</p>', '</aside>'],
  hesap: ['<aside class="box box-hesap"><p class="box-title">Hesabını bil</p>', '</aside>'],
  merak: ['<details class="box box-merak"><summary>Merak edene <span>· ezberlemen gerekmez</span></summary>', '</details>'],
}

// Her "##" bölümü <section> içine alınır: sayfada numaralı ve farklı renkte kartlar olarak gösterilir
// Tablo satırı: "| a | b |" → ['a', 'b']
const cells = (row: string) => row.replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim())

export function renderMarkdown(source: string, options: Options = {}): string {
  const html: string[] = []
  const md = (text: string) => inline(text, options)
  let code: { lang: string; lines: string[] } | null = null
  let display: string[] | null = null
  let inSection = false
  let box: string | null = null
  let paragraph: string[] = []
  let list: string[] = []
  let ordered = false
  let quote: string[] = []
  let table: string[] = []
  const flush = () => {
    if (paragraph.length) html.push(`<p>${paragraph.map(md).join('<br>')}</p>`)
    if (list.length) html.push(`<${ordered ? 'ol' : 'ul'}>${list.map((item) => `<li>${md(item)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`)
    if (quote.length) html.push(`<blockquote>${quote.map(md).join('<br>')}</blockquote>`)
    if (table.length) {
      const rows = table.filter((row) => !/^\|?\s*:?-{2,}/.test(row)).map(cells)
      const [head, ...body] = rows
      html.push(`<div class="table"><table><thead><tr>${head.map((c) => `<th>${md(c)}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${md(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`)
    }
    paragraph = []
    list = []
    quote = []
    table = []
  }
  for (const raw of source.replace(/\r\n/g, '\n').split('\n')) {
    // Kod bloğunun içi olduğu gibi (girintisiyle) alınır
    if (code) {
      if (raw.trim().startsWith('```')) {
        html.push(codeBlock(code.lang, code.lines))
        code = null
      } else code.lines.push(raw)
      continue
    }
    if (display) {
      if (raw.trim().endsWith('$$')) {
        display.push(raw.trim().slice(0, -2))
        html.push(`<div class="math">${tex(display.join('\n'), true)}</div>`)
        display = null
      } else display.push(raw)
      continue
    }
    const line = raw.trim()
    const fence = line.match(/^```\s*([\w+#-]*)/)
    if (fence) {
      flush()
      code = { lang: fence[1].toLowerCase(), lines: [] }
      continue
    }
    if (options.math && line.startsWith('$$')) {
      flush()
      const rest = line.slice(2).trim()
      if (rest.endsWith('$$')) html.push(`<div class="math">${tex(rest.slice(0, -2), true)}</div>`)
      else display = [rest]
      continue
    }
    const opener = options.math && line.match(/^:::\s*(cozum|çözüm|bilmen|hesap|merak)$/i)
    if (opener) {
      flush()
      // Model kapatmayı unutursa yeni kutu öncekini kapatır
      if (box) html.push(BOXES[box][1])
      box = opener[1].toLowerCase().replace('çözüm', 'cozum')
      html.push(BOXES[box][0])
      continue
    }
    if (options.math && line === ':::' && box) {
      flush()
      html.push(BOXES[box][1])
      box = null
      continue
    }
    const heading = line.match(/^(#{2,3})\s+(.+)$/)
    const item = line.match(/^[-*]\s+(.+)$/)
    const numbered = line.match(/^\d+[.)]\s+(.+)$/)
    const quoted = line.match(/^>\s?(.*)$/)
    if (!line) flush()
    else if (heading) {
      flush()
      const level = heading[1].length
      if (level === 2 && !box) {
        if (inSection) html.push('</section>')
        html.push('<section>')
        inSection = true
      }
      html.push(`<h${level} id="${slugify(heading[2])}">${md(heading[2])}</h${level}>`)
    } else if (line.startsWith('|')) {
      if (!table.length) flush()
      table.push(line)
    } else if (item || numbered) {
      if (paragraph.length || quote.length || table.length || (list.length && ordered !== !!numbered)) flush()
      ordered = !!numbered
      list.push((item ?? numbered)![1])
    } else if (quoted) {
      if (paragraph.length || list.length || table.length) flush()
      if (quoted[1]) quote.push(quoted[1])
    } else {
      if (list.length || quote.length || table.length) flush()
      paragraph.push(line)
    }
  }
  flush()
  if (code) html.push(codeBlock(code.lang, code.lines))
  if (display) html.push(`<div class="math">${tex(display.join('\n'), true)}</div>`)
  if (box) html.push(BOXES[box][1])
  if (inSection) html.push('</section>')
  return html.join('\n')
}
