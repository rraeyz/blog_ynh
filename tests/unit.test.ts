// Saf fonksiyonların testleri. Çalıştırma: npm test (Node 22.18+ TypeScript'i doğrudan çalıştırır)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { apiUrl, decodeEntities, htmlToText, parseAtom, parseSourceUrl } from '../src/lib/arxiv.ts'
import { renderMarkdown } from '../src/lib/markdown.ts'
import { extractJson, slugify } from '../src/lib/text.ts'

test('arXiv linkleri çözülür', () => {
  assert.deepEqual(parseSourceUrl('https://arxiv.org/list/cs.AI/recent'), { kind: 'category', categories: ['cs.AI'] })
  assert.deepEqual(parseSourceUrl('https://arxiv.org/list/cs.AI+cs.LG/new'), { kind: 'category', categories: ['cs.AI', 'cs.LG'] })
  assert.deepEqual(parseSourceUrl('https://rss.arxiv.org/rss/cs.CL'), { kind: 'category', categories: ['cs.CL'] })
  assert.deepEqual(parseSourceUrl('https://arxiv.org/abs/2510.12345v2'), { kind: 'paper', id: '2510.12345' })
  assert.deepEqual(parseSourceUrl('https://arxiv.org/pdf/2510.12345.pdf'), { kind: 'paper', id: '2510.12345' })
  assert.deepEqual(parseSourceUrl('https://www.arxiv.org/html/2510.12345v1'), { kind: 'paper', id: '2510.12345' })
  assert.deepEqual(parseSourceUrl('https://arxiv.org/abs/hep-th/9901001'), { kind: 'paper', id: 'hep-th/9901001' })
  assert.deepEqual(parseSourceUrl('https://example.com/yazi'), { kind: 'web', url: 'https://example.com/yazi' })
  assert.equal(parseSourceUrl('https://arxiv.org/'), null)
  assert.equal(parseSourceUrl('javascript:alert(1)'), null)
  assert.equal(parseSourceUrl('bir şey'), null)
})

test('arXiv API adresi', () => {
  assert.equal(
    apiUrl({ kind: 'category', categories: ['cs.AI', 'cs.LG'] }, 50),
    'https://export.arxiv.org/api/query?search_query=cat:cs.AI+OR+cat:cs.LG&sortBy=submittedDate&sortOrder=descending&max_results=50',
  )
  assert.equal(apiUrl({ kind: 'paper', id: '2510.12345' }), 'https://export.arxiv.org/api/query?id_list=2510.12345')
})

test('Atom yanıtı ayrıştırılır', () => {
  const xml = `<feed><entry>
    <id>http://arxiv.org/abs/2510.12345v3</id>
    <published>2026-10-20T17:59:00Z</published>
    <title>Attention &amp; Memory:
      A Study</title>
    <summary>  We show &lt;b&gt;things&lt;/b&gt;.  </summary>
    <author><name>Ada Lovelace</name></author><author><name>Alan Turing</name></author>
  </entry><entry><id>broken</id><title>x</title></entry></feed>`
  const papers = parseAtom(xml)
  assert.equal(papers.length, 1)
  assert.equal(papers[0].externalId, 'arxiv:2510.12345')
  assert.equal(papers[0].title, 'Attention & Memory: A Study')
  assert.equal(papers[0].abstract, 'We show <b>things</b>.')
  assert.equal(papers[0].authors, 'Ada Lovelace, Alan Turing')
  assert.equal(papers[0].url, 'https://arxiv.org/abs/2510.12345')
  assert.equal(papers[0].publishedAt.toISOString(), '2026-10-20T17:59:00.000Z')
})

test('HTML metne çevrilir', () => {
  assert.equal(htmlToText('<html><script>x()</script><p>Merhaba&nbsp;<b>dünya</b></p><p>İkinci</p></html>'), 'Merhaba dünya\nİkinci')
  assert.equal(decodeEntities('&#x1F600;&#65;&bilinmeyen;'), '😀A&bilinmeyen;')
})

test('Markdown güvenli biçimde HTML olur', () => {
  assert.equal(
    renderMarkdown('Giriş **kalın** ve *italik*\n\n## Ne yaptılar?\n\n- bir\n- iki'),
    '<p>Giriş <strong>kalın</strong> ve <em>italik</em></p>\n<h2>Ne yaptılar?</h2>\n<ul><li>bir</li><li>iki</li></ul>',
  )
  assert.equal(renderMarkdown('<script>alert(1)</script>'), '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>')
  assert.equal(renderMarkdown('[a](javascript:alert(1))'), '<p>[a](javascript:alert(1))</p>', 'yalnızca http(s) linkleri')
  assert.equal(
    renderMarkdown('[makale](https://arxiv.org/abs/1?a=1&b="2")'),
    '<p><a href="https://arxiv.org/abs/1?a=1&amp;b=&quot;2&quot;" rel="noopener noreferrer" target="_blank">makale</a></p>',
  )
})

test('slug ve JSON ayıklama', () => {
  assert.equal(slugify('Yapay Zekâ Öğreniyor: Şaşırtıcı Çığır!'), 'yapay-zeka-ogreniyor-sasirtici-cigir')
  assert.equal(slugify('İstanbul'), 'istanbul')
  assert.deepEqual(extractJson('Tabii:\n```json\n{"title": "A", "body": "{x}"}\n```'), { title: 'A', body: '{x}' })
  assert.deepEqual(extractJson('[3, 1]'), [3, 1])
  assert.throws(() => extractJson('JSON yok'))
})
