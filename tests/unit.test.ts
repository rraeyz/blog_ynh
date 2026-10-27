// Saf fonksiyonların testleri. Çalıştırma: npm test (Node 22.18+ TypeScript'i doğrudan çalıştırır)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { apiUrl, decodeEntities, feedImage, htmlToText, parseAtom, parseFeed, parseSourceUrl } from '../src/lib/arxiv.ts'
import { headings, inline, renderMarkdown } from '../src/lib/markdown.ts'
import { extractJson, slugify } from '../src/lib/text.ts'
import { coverOf, freeImage, periodLabel, readingMinutes, topicHue, topicLabel } from '../src/lib/topics.ts'

test('konu etiketi, rengi, okuma süresi, dönem', () => {
  assert.equal(topicLabel('cs.AI'), 'Yapay Zekâ')
  assert.equal(topicLabel('astro-ph.GA'), 'Astrofizik', 'alt kategori bilinmiyorsa arşiv adı')
  assert.equal(topicLabel('www.nature.com'), 'nature.com')
  assert.equal(topicLabel(''), 'Makale')
  assert.equal(topicLabel('uzay'), 'Uzay', 'konu sekmesi')
  assert.equal(topicHue('uzay'), 262, 'konu sekmelerinin rengi sabit')
  assert.equal(topicHue('hep-th'), topicHue('hep-ph'), 'aynı etiket aynı renk')
  assert.ok(topicHue('cs.AI') >= 0 && topicHue('cs.AI') < 360)
  assert.equal(readingMinutes('kelime '.repeat(450)), 2)
  assert.equal(readingMinutes(''), 1)
  const now = new Date('2026-10-27T12:00:00Z')
  assert.equal(periodLabel(new Date('2026-10-25T12:00:00Z'), now), 'Bu hafta')
  assert.equal(periodLabel(new Date('2026-10-17T12:00:00Z'), now), 'Geçen hafta')
  assert.equal(periodLabel(new Date('2026-09-10T12:00:00Z'), now), 'Eylül 2026')
})

test('arXiv linkleri çözülür', () => {
  assert.deepEqual(parseSourceUrl('https://arxiv.org/list/cs.AI/recent'), { kind: 'category', categories: ['cs.AI'] })
  assert.deepEqual(parseSourceUrl('https://arxiv.org/list/cs.AI+cs.LG/new'), { kind: 'category', categories: ['cs.AI', 'cs.LG'] })
  assert.deepEqual(parseSourceUrl('https://rss.arxiv.org/rss/cs.CL'), { kind: 'category', categories: ['cs.CL'] })
  assert.deepEqual(parseSourceUrl('https://arxiv.org/archive/astro-ph'), { kind: 'category', categories: ['astro-ph'] })
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
  assert.match(apiUrl({ kind: 'category', categories: ['astro-ph', 'gr-qc', 'astro-ph.GA'] }), /search_query=cat:astro-ph\*\+OR\+cat:gr-qc\*\+OR\+cat:astro-ph\.GA&/, 'arşiv alt kategorileriyle aranır')
})

test('RSS ve Atom beslemeleri ayrıştırılır', () => {
  const rss = `<rss><channel><title>Site</title>
    <item><title><![CDATA[Yeni <b>keşif</b>]]></title><link>https://site.com/a</link>
      <description>&lt;p&gt;Özet &amp;amp; ayrıntı&lt;/p&gt;</description><pubDate>Tue, 27 Oct 2026 10:00:00 GMT</pubDate><dc:creator>Ada</dc:creator></item>
    <item><title>Linksiz</title></item>
    <item><title>Tehlikeli</title><link>javascript:alert(1)</link></item>
  </channel></rss>`
  const items = parseFeed(rss)
  assert.equal(items.length, 1)
  assert.deepEqual({ ...items[0], publishedAt: items[0].publishedAt.toISOString() }, {
    externalId: 'url:https://site.com/a', title: 'Yeni keşif', authors: 'Ada', abstract: 'Özet & ayrıntı', topic: 'site.com', url: 'https://site.com/a', publishedAt: '2026-10-27T10:00:00.000Z', imageUrl: '',
  })
  const atom = `<feed><entry><title>Atom yazısı</title><link rel="alternate" href="https://blog.org/x"/><link rel="self" href="https://blog.org/x.xml"/>
    <summary>Kısa</summary><updated>2026-10-26T08:00:00Z</updated><author><name>Bob</name></author></entry></feed>`
  const [entry] = parseFeed(atom)
  assert.equal(entry.url, 'https://blog.org/x')
  assert.equal(entry.authors, 'Bob')
  assert.equal(entry.abstract, 'Kısa')
})

test('beslemedeki görsel ve lisansı', () => {
  assert.equal(feedImage('<item><enclosure url="https://cdn.eso.org/a.jpg" length="0" type="image/jpeg"/></item>', ''), 'https://cdn.eso.org/a.jpg')
  assert.equal(feedImage('<item><media:content url="https://x.com/v.mp4" type="video/mp4"/><media:thumbnail url="https://x.com/t.jpg?a=1&amp;b=2"/></item>', ''), 'https://x.com/t.jpg?a=1&b=2', 'video atlanır, &amp; çözülür')
  assert.equal(feedImage('<item></item>', '&lt;p&gt;&lt;img src="https://www.nasa.gov/r.png"&gt;'), 'https://www.nasa.gov/r.png', 'kaçışlanmış açıklamadaki ilk resim')
  assert.equal(feedImage('<item><enclosure url="http://x.com/a.jpg" type="image/jpeg"/></item>', ''), '', 'https olmayan alınmaz')
  assert.equal(feedImage('<item><enclosure url="https://x.com/a.mp3" type="audio/mpeg"/></item>', ''), '')
  const [item] = parseFeed('<rss><channel><item><title>T</title><link>https://www.eso.org/n/1</link><enclosure url="https://cdn.eso.org/b.jpg" type="image/jpeg"/></item></channel></rss>')
  assert.equal(item.imageUrl, 'https://cdn.eso.org/b.jpg')

  assert.deepEqual(freeImage({ url: 'https://science.nasa.gov/x', imageUrl: 'https://i.nasa.gov/a.jpg' }), { src: 'https://i.nasa.gov/a.jpg', credit: 'NASA' })
  assert.equal(freeImage({ url: 'https://www.popsci.com/x', imageUrl: 'https://www.popsci.com/GettyImages-1.jpg' }), null, 'telifli olabilecek görsel gösterilmez')
  assert.equal(freeImage({ url: 'https://notnasa.gov.evil.com/x', imageUrl: 'https://e.com/a.jpg' }), null)
  assert.deepEqual(coverOf({ image: '3-1.jpg', paper: { url: 'https://www.popsci.com/x', imageUrl: 'https://p.com/a.jpg' } }), { src: '/gorsel/3-1.jpg', credit: 'Temsili görsel, yapay zekâyla üretildi', ai: true })
  assert.equal(coverOf({ image: '3-1.jpg', paper: { url: 'https://www.eso.org/x', imageUrl: 'https://cdn.eso.org/a.jpg' } })?.ai, false, 'kaynağın serbest görseli önce gelir')
  assert.equal(coverOf({ image: '', paper: null }), null)
})

test('Atom yanıtı ayrıştırılır', () => {
  const xml = `<feed><entry>
    <id>http://arxiv.org/abs/2510.12345v3</id>
    <published>2026-10-20T17:59:00Z</published>
    <title>Attention &amp; Memory:
      A Study</title>
    <summary>  We show &lt;b&gt;things&lt;/b&gt;.  </summary>
    <author><name>Ada Lovelace</name></author><author><name>Alan Turing</name></author>
    <arxiv:primary_category xmlns:arxiv="http://arxiv.org/schemas/atom" term="cs.AI" scheme="http://arxiv.org/schemas/atom"/>
  </entry><entry><id>broken</id><title>x</title></entry></feed>`
  const papers = parseAtom(xml)
  assert.equal(papers.length, 1)
  assert.equal(papers[0].externalId, 'arxiv:2510.12345')
  assert.equal(papers[0].title, 'Attention & Memory: A Study')
  assert.equal(papers[0].abstract, 'We show <b>things</b>.')
  assert.equal(papers[0].authors, 'Ada Lovelace, Alan Turing')
  assert.equal(papers[0].url, 'https://arxiv.org/abs/2510.12345')
  assert.equal(papers[0].topic, 'cs.AI')
  assert.equal(papers[0].publishedAt.toISOString(), '2026-10-20T17:59:00.000Z')
})

test('HTML metne çevrilir', () => {
  assert.equal(htmlToText('<html><script>x()</script><p>Merhaba&nbsp;<b>dünya</b></p><p>İkinci</p></html>'), 'Merhaba dünya\nİkinci')
  assert.equal(decodeEntities('&#x1F600;&#65;&bilinmeyen;'), '😀A&bilinmeyen;')
})

test('Markdown güvenli biçimde HTML olur', () => {
  assert.equal(
    renderMarkdown('Giriş **kalın** ve *italik*\n\n## Ne yaptılar?\n\n- bir\n- iki'),
    '<p>Giriş <strong>kalın</strong> ve <em>italik</em></p>\n<section>\n<h2 id="ne-yaptilar">Ne yaptılar?</h2>\n<ul><li>bir</li><li>iki</li></ul>\n</section>',
  )
  // Modeller başlıktan/listeden sonra boş satır bırakmayabilir (Gemini çıktısındaki hata)
  assert.equal(
    renderMarkdown('Giriş.\n## Neden önemli?\nBu çalışma önemli.\n> En önemli bulgu\n- madde\nSon.'),
    '<p>Giriş.</p>\n<section>\n<h2 id="neden-onemli">Neden önemli?</h2>\n<p>Bu çalışma önemli.</p>\n<blockquote>En önemli bulgu</blockquote>\n<ul><li>madde</li></ul>\n<p>Son.</p>\n</section>',
  )
  assert.equal(renderMarkdown('> <img src=x onerror=alert(1)>'), '<blockquote>&lt;img src=x onerror=alert(1)&gt;</blockquote>')
  assert.equal(inline('yaklaşık **1 milyar yıl** <b>'), 'yaklaşık <strong>1 milyar yıl</strong> &lt;b&gt;')
  assert.equal(renderMarkdown('## A\nx\n### alt\ny\n## B\nz'), '<section>\n<h2 id="a">A</h2>\n<p>x</p>\n<h3 id="alt">alt</h3>\n<p>y</p>\n</section>\n<section>\n<h2 id="b">B</h2>\n<p>z</p>\n</section>', 'her ## yeni bölüm')
  assert.deepEqual(headings('Giriş\n## Ne yaptılar?\nmetin\n### alt\n## Sınırlamalar'), [{ id: 'ne-yaptilar', text: 'Ne yaptılar?' }, { id: 'sinirlamalar', text: 'Sınırlamalar' }])
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
