// Yazı gövdesi için küçük ve güvenli Markdown: ## / ### başlık, - liste, > vurgu kutusu, **kalın**, *italik*, `kod`,
// [metin](https://...), ```dil kod blokları```. Derslerde ayrıca $formül$ ve $$formül$$ (KaTeX).
// Önce tüm HTML kaçışlanır; yapay zekâ çıktısı sayfaya ham HTML olarak giremez (KaTeX ve highlight.js de kaçışlar).
// Satır satır işlenir: modeller başlıktan sonra boş satır bırakmayabilir. Saf fonksiyon: tests/unit.test.ts
import katex from 'katex'
import hljs from 'highlight.js/lib/common'
import { slugify } from './text.ts'

// Haber yazılarında $ işareti para birimi olabilir; formül yalnızca derslerde açılır
type Options = { math?: boolean }

const tex = (source: string, displayMode: boolean) => katex.renderToString(source, { displayMode, throwOnError: false })

function codeBlock(lang: string, lines: string[]): string {
  const code = lines.join('\n')
  const body = lang && hljs.getLanguage(lang) ? hljs.highlight(code, { language: lang }).value : escapeHtml(code)
  return `<pre><code class="hljs${lang ? ` language-${escapeHtml(lang)}` : ''}">${body}</code></pre>`
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

// Tek satırlık metin için (ör. "Kısaca" maddeleri): kalın, italik, kod ve link; HTML kaçışlanır
export function inline(text: string, { math }: Options = {}): string {
  // Formüller önce yer tutucuya alınır: içlerindeki * ve _ kalın/italik sanılmasın
  const formulas: string[] = []
  const source = math ? text.replace(/\$([^$\s](?:[^$]*?[^$\s])?)\$/g, (_, f: string) => `\u0000${formulas.push(f) - 1}\u0000`) : text
  return escapeHtml(source)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" rel="noopener noreferrer" target="_blank">$1</a>')
    .replace(/\u0000(\d+)\u0000/g, (_, i: string) => tex(formulas[Number(i)], false))
}

// İçindekiler için: "## Ne yaptılar?" → { id: 'ne-yaptilar', text: 'Ne yaptılar?' }
export function headings(source: string): Array<{ id: string; text: string }> {
  return Array.from(source.matchAll(/^##\s+(.+)$/gm), (m) => ({ id: slugify(m[1]), text: m[1].trim() }))
}

// Her "##" bölümü <section> içine alınır: sayfada numaralı ve farklı renkte kartlar olarak gösterilir
export function renderMarkdown(source: string, options: Options = {}): string {
  const html: string[] = []
  let code: { lang: string; lines: string[] } | null = null
  let display: string[] | null = null
  let inSection = false
  let paragraph: string[] = []
  let list: string[] = []
  let quote: string[] = []
  const flush = () => {
    const md = (text: string) => inline(text, options)
    if (paragraph.length) html.push(`<p>${paragraph.map(md).join('<br>')}</p>`)
    if (list.length) html.push(`<ul>${list.map((item) => `<li>${md(item)}</li>`).join('')}</ul>`)
    if (quote.length) html.push(`<blockquote>${quote.map(md).join('<br>')}</blockquote>`)
    paragraph = []
    list = []
    quote = []
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
    const heading = line.match(/^(#{2,3})\s+(.+)$/)
    const item = line.match(/^[-*]\s+(.+)$/)
    const quoted = line.match(/^>\s?(.*)$/)
    if (!line) flush()
    else if (heading) {
      flush()
      const level = heading[1].length
      if (level === 2) {
        if (inSection) html.push('</section>')
        html.push('<section>')
        inSection = true
      }
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
  if (code) html.push(codeBlock(code.lang, code.lines))
  if (display) html.push(`<div class="math">${tex(display.join('\n'), true)}</div>`)
  if (inSection) html.push('</section>')
  return html.join('\n')
}
