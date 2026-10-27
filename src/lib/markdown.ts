// Yazı gövdesi için küçük ve güvenli Markdown: ## / ### başlık, - liste, **kalın**, *italik*, `kod`, [metin](https://...).
// Önce tüm HTML kaçışlanır; yapay zekâ çıktısı sayfaya ham HTML olarak giremez. Saf fonksiyon: tests/unit.test.ts

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

function inline(text: string): string {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" rel="noopener noreferrer" target="_blank">$1</a>')
}

export function renderMarkdown(source: string): string {
  const html: string[] = []
  for (const block of source.replace(/\r\n/g, '\n').split(/\n{2,}/)) {
    const lines = block.split('\n').filter((line) => line.trim())
    if (lines.length === 0) continue
    const heading = lines[0].match(/^(#{2,3})\s+(.*)$/)
    if (heading && lines.length === 1) {
      const level = heading[1].length
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`)
    } else if (lines.every((line) => /^\s*[-*]\s+/.test(line))) {
      html.push(`<ul>${lines.map((line) => `<li>${inline(line.replace(/^\s*[-*]\s+/, ''))}</li>`).join('')}</ul>`)
    } else {
      html.push(`<p>${lines.map(inline).join('<br>')}</p>`)
    }
  }
  return html.join('\n')
}
