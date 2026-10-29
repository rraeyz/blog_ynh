// Saf fonksiyonların testleri. Çalıştırma: npm test (Node 22.18+ TypeScript'i doğrudan çalıştırır)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { apiUrl, decodeEntities, feedImage, htmlToText, parseAtom, parseFeed, parseSourceUrl } from '../src/lib/arxiv.ts'
import { headings, inline, renderMarkdown } from '../src/lib/markdown.ts'
import { addDays, mondayOf, extractJson, markdownLinks, parseIssues, parseConcepts, parseLesson, parsePlan, parseScores, parseSkyEvents, pickDaily, weightedScore, cleanSummary, formatScore, DAILY_HARD_MAX, foldText, ftsQuery, slugify, unlink } from '../src/lib/text.ts'
import { isPrivateIp, safeFetch } from '../src/lib/net.ts'
import { levelRange } from '../src/lib/levels.ts'
import { catalogStages, FIRST_ROUND, nextTracks, pickStage, requirementsOf, stageDone, type StageState } from '../src/lib/curriculum.ts'
import { compressImage } from '../src/lib/compress.ts'
import { complete, RETRY_DELAYS } from '../src/lib/ai.ts'
import http from 'node:http'
import sharp from 'sharp'
import { categoryOf, coverOf, freeImage, periodLabel, readingMinutes, topicHue, topicLabel } from '../src/lib/topics.ts'

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

test('kapak görseli küçültülüp WebP olur', async () => {
  const png = await sharp({ create: { width: 2400, height: 1350, channels: 3, background: '#7c3aed' } }).png().toBuffer()
  const meta = await sharp(await compressImage(png)).metadata()
  assert.equal(meta.format, 'webp')
  assert.equal(meta.width, 1600)
})

test('JSON metninde kaçışsız satır sonu (Gemini)', () => {
  const raw = '{"title": "Başlık", "body": "Giriş.\n## Ne yaptılar?\n\tSatır \\"alıntı\\""}'
  assert.deepEqual(extractJson(raw), { title: 'Başlık', body: 'Giriş.\n## Ne yaptılar?\n\tSatır "alıntı"' })
})

test('geçici sağlayıcı hatasında yeniden denenir', async () => {
  RETRY_DELAYS.splice(0, RETRY_DELAYS.length, 10, 10)
  let calls = 0
  const server = http.createServer((req, res) => {
    req.resume()
    req.on('end', () => {
      calls++
      if (calls === 1) return res.writeHead(503, { 'Content-Type': 'application/json' }).end('{"error":{"message":"overloaded"}}')
      // OpenRouter: 200 ama boş metin (sağlayıcı yanıtı kesti)
      if (calls === 2) return res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"choices":[{"message":{"content":null},"finish_reason":"error","error":{"message":"provider"}}]}')
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ choices: [{ message: { content: 'tamam' } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }))
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const settings = { aiProvider: 'custom', aiModel: 'm', aiApiKey: '', aiBaseUrl: `http://127.0.0.1:${(server.address() as { port: number }).port}` } as never
  try {
    assert.equal((await complete(settings, 's', 'u')).text, 'tamam')
    assert.equal(calls, 3)
  } finally {
    server.close()
  }
})

test('puan: dört ölçütün ağırlıklı toplamı, onda bir', () => {
  assert.equal(weightedScore({ yenilik: 5, etki: 5, kanit: 5, anlam: 5 }), 100)
  assert.equal(weightedScore({ yenilik: 1, etki: 1, kanit: 1, anlam: 1 }), 10)
  assert.equal(weightedScore({ yenilik: 4, etki: 3, kanit: 4, anlam: 3 }), 65)
  assert.ok(weightedScore({ yenilik: 3, etki: 5, kanit: 3, anlam: 3 }) > weightedScore({ yenilik: 5, etki: 3, kanit: 3, anlam: 3 }), 'etki yenilikten ağır')
  assert.equal(formatScore(65), '6,5')
  assert.equal(formatScore(80), '8,0')
})

test('ön puan yanıtı satır satır', () => {
  const text = 'İşte puanlar:\n1 | 4 | 3 | 4 | 3 | uzay | -\n- 2 | 5 | 5 | 5 | 5 | diğer | Y\n3 | 2 | 2 | 3 | 2 | Diğer | 1\n3 | 1 | 1 | 1 | 1 | uzay | -\n9 | 3 | 3 | 3 | 3 | uzay | -\n4 | 6 | 3 | 3 | 3 | uzay | -\n**5** | 3 | 3 | 3 | 3 | Uzay | 5'
  assert.deepEqual(parseScores(text, 5), [
    { index: 0, criteria: { yenilik: 4, etki: 3, kanit: 4, anlam: 3 }, space: true, repeat: null },
    { index: 1, criteria: { yenilik: 5, etki: 5, kanit: 5, anlam: 5 }, space: false, repeat: 'written' },
    { index: 2, criteria: { yenilik: 2, etki: 2, kanit: 3, anlam: 2 }, space: false, repeat: 0 },
    { index: 4, criteria: { yenilik: 3, etki: 3, kanit: 3, anlam: 3 }, space: true, repeat: null },
  ], 'ikinci kez gelen numara, liste dışı numara ve 1-5 dışı puan düşer; kendine tekrar sayılmaz')
  assert.deepEqual(parseScores('| 1 | 4 | 3 | 4 | 3 | uzay | - |', 1), [{ index: 0, criteria: { yenilik: 4, etki: 3, kanit: 4, anlam: 3 }, space: true, repeat: null }], 'tablo biçimindeki satır')
})

test('seçime giden özetten kalıp sözler atılır', () => {
  assert.equal(cleanSummary('Astronomers found X.  Image credit: NASA/JPL-Caltech. The post Big find appeared first on Universe Today.'), 'Astronomers found X.')
  assert.equal(cleanSummary('Some text here. Read more »'), 'Some text here.')
  assert.equal(cleanSummary('A photo of the plane. (Image credit: Satellite image ©2026 Vantor) A U.S. team saw it.'), 'A photo of the plane. A U.S. team saw it.')
  assert.equal(cleanSummary('Salinity rose sharply. Read full article Comments'), 'Salinity rose sharply.')
  assert.equal(cleanSummary('A result [&#8230;]'), 'A result')
  assert.equal(cleanSummary('Credits to the team matter. Data show 3.5 K.'), 'Credits to the team matter. Data show 3.5 K.', 'iki noktasız "credits" dokunulmaz')
})

test('günlük seçim: eşik, en az/en fazla, istisna, uzay sınırları', () => {
  const o = { min: 3, max: 5, threshold: 60, exceptional: 85, spaceMin: 1, spaceNormal: 2, spaceMax: 4, spaceImportant: 75 }
  const items = (scores: number[], space = false) => scores.map((score) => ({ score, space }))
  const scores = (picked: Array<{ score: number; space: boolean }>) => picked.map((p) => `${p.space ? 'U' : ''}${p.score}`).join(' ')
  const pick = (list: Array<{ score: number; space: boolean }>, extra = {}) => scores(pickDaily(list, { ...o, spaceMin: 0, ...extra }))
  assert.equal(pick(items([55, 90, 80, 70, 65, 40])), '90 80 70 65', 'eşiği geçenler')
  assert.equal(pick(items([70, 50, 40, 35, 0])), '70 50 40', 'eşiği geçen azsa en iyilerle en aza')
  assert.equal(pick(items([95, 90, 88, 86, 80, 78]), { max: 3 }), '95 90 88 86', 'istisna puanlı en fazla sınırını aşar')
  assert.equal(pickDaily(items(Array(20).fill(90)), { ...o, exceptional: 85 }).length, DAILY_HARD_MAX)
  assert.equal(pick([...items([80, 78, 70, 65], true), ...items([60])]), 'U80 U78 60', 'önemli uzay haberleri normal sınıra takılmaz, önemsizi takılır')
  assert.equal(pick([...items([70, 68, 66], true), ...items([50])]), 'U70 U68 50', 'normalde en fazla 2 uzay')
  assert.equal(pick(items([90, 88, 86, 84, 82], true)), 'U90 U88 U86 U84', 'önemlilerle de en fazla 4 uzay')
  assert.equal(scores(pickDaily([...items([90, 80, 70]), ...items([40], true)], { ...o, max: 3 })), '90 80 U40', 'en az 1 uzay: sondaki diğer haberin yerine')
  assert.equal(scores(pickDaily([...items([90, 88, 86]), ...items([40], true)], { ...o, max: 3, exceptional: 85 })), '90 88 86', 'istisna puanlının yerine uzay geçmez')
  assert.equal(scores(pickDaily([...items([90, 80]), ...items([0], true)], o)), '90 80', 'puansız uzay haberi alınmaz')
  const tied = [70, 70, 70, 70].map((score, n) => ({ score, space: false, n }))
  assert.deepEqual(pickDaily(tied, { ...o, max: 2 }).map((p) => p.n), [0, 1], 'eşit puanda giriş sırası (en yeni önce) korunur')
})

test('yazarın konusu tanınır, tanınmazsa Bilim', () => {
  assert.equal(categoryOf('fizik'), 'fizik')
  assert.equal(categoryOf(' Sağlık '), 'saglik')
  assert.equal(categoryOf('Yapay zeka'), 'yapay-zeka')
  assert.equal(categoryOf('Dünya ve İklim'), 'dunya')
  assert.equal(categoryOf('Biyoloji'), 'biyoloji')
  assert.equal(categoryOf('fizik, teknoloji'), 'fizik', 'birden çoksa ilki')
  assert.equal(categoryOf('teknoloji / fizik'), 'teknoloji')
  assert.equal(categoryOf('astrofizik'), 'bilim', 'kelimenin parçası sayılmaz')
  assert.equal(categoryOf('kuantum'), 'bilim')
  assert.equal(categoryOf(undefined), 'bilim')
})

test('arama: Türkçe katlama, kelime başı, başlık önde (FTS5)', async () => {
  assert.equal(ftsQuery('Kara DEL'), '"kara"* "del"*')
  assert.equal(ftsQuery('IRAF "ışık" OR -x*'), '"iraf"* "isik"* "or"* "x"*', 'tırnak ve işleçler sorguyu bozamaz')
  assert.equal(ftsQuery('  ;; '), '')
  const Database = (await import('better-sqlite3')).default
  const db = new Database(':memory:')
  db.exec("CREATE VIRTUAL TABLE SearchIndex USING fts5(kind UNINDEXED, ref UNINDEXED, title, body, tokenize='unicode61 remove_diacritics 2')")
  const add = db.prepare('INSERT INTO SearchIndex VALUES (?, ?, ?, ?)')
  add.run('post', 1, foldText('Modelleme'), foldText('Işık eğrisi ve Gökyüzü'))
  add.run('post', 2, foldText('Işık Eğrisi Modelleme'), foldText('yıldız'))
  add.run('post', 3, foldText('Koronagraf'), foldText('yok'))
  const find = (q: string) => db.prepare('SELECT ref FROM SearchIndex WHERE SearchIndex MATCH ? ORDER BY bm25(SearchIndex, 0, 0, 10, 1)').all(ftsQuery(q)).map((r) => (r as { ref: number }).ref)
  assert.deepEqual(find('ışık eğrisi'), [2, 1], 'başlıkta geçen önde')
  assert.deepEqual(db.prepare('SELECT ref FROM SearchIndex WHERE SearchIndex MATCH ?').all(`title : (${ftsQuery('işık egri')})`).map((r) => (r as { ref: number }).ref), [2], 'yalnızca başlıkta arama (önce bunlar gösterilir)')
  assert.deepEqual(find('gokyuzu'), [1], 'Türkçe harfsiz yazılan bulunur')
  assert.deepEqual(find('egri'), [2, 1], 'kelime başı yeter')
  assert.deepEqual(find('koronagraf spektrum'), [], 'her kelime geçmeli')
})

test('ders: kod bloğu ve formüller', () => {
  const html = renderMarkdown('## Matematiği\nAiry diski: $\\theta = 1.22 \\lambda / D$ ve **kalın**.\n$$\nF = \\frac{a}{b}\n$$\n```python\nimport numpy as np\nx = 1 < 2\n```\n```iraf\nimexam <b>\n```', { math: true })
  assert.match(html, /class="katex"/, 'satır içi formül KaTeX ile')
  assert.match(html, /<div class="math"><span class="katex-display">/, 'ayrı satırdaki formül')
  assert.match(html, /<pre><code class="hljs language-python">[\s\S]*hljs-keyword[\s\S]*&lt;/, 'bilinen dil renklenir, kaçışlanır')
  assert.match(html, /<code class="hljs language-iraf">imexam &lt;b&gt;/, 'bilinmeyen dil düz ama kaçışlı')
  assert.match(html, /<strong>kalın<\/strong>/)
  // Haber yazılarında $ para birimi: formül açılmaz
  assert.doesNotMatch(renderMarkdown('Fiyatı $5 ile $10 arası'), /katex/)
  assert.match(renderMarkdown('```\nkapanmamış blok'), /<pre><code class="hljs">kapanmamış blok<\/code><\/pre>/)
  assert.doesNotMatch(renderMarkdown('$<img src=x onerror=alert(1)>$', { math: true }), /<img/, 'formül içi HTML çalışmaz')
})

test('ders: numaralı liste, tablo, açılır çözüm', () => {
  const html = renderMarkdown('1. Bias çıkar\n2. Flat ile böl\n\n| Filtre | λ (nm) |\n|---|---|\n| V | **551** |\n\n## Alıştırmalar\nSoru\n:::cozum\nCevap $x=2$\n:::\nSonra', { math: true })
  assert.match(html, /<ol><li>Bias çıkar<\/li><li>Flat ile böl<\/li><\/ol>/)
  assert.match(html, /<div class="table"><table><thead><tr><th>Filtre<\/th><th>λ \(nm\)<\/th><\/tr><\/thead><tbody><tr><td>V<\/td><td><strong>551<\/strong><\/td><\/tr><\/tbody><\/table><\/div>/)
  assert.match(html, /<details class="solution"><summary>Çözümü göster<\/summary>\s*<p>Cevap <span class="katex">[\s\S]*<\/p>\s*<\/details>\s*<p>Sonra/)
  assert.doesNotMatch(renderMarkdown(':::cozum\nA\n:::'), /<details/, 'haberlerde çözüm bloğu yok')
  assert.doesNotMatch(renderMarkdown('| <b>x</b> |\n|---|\n| y |'), /<b>/, 'tablo hücresi kaçışlanır')
})

test('ders kutuları ve anahtarla bağlantılar', () => {
  const links = { 'fotometri/temel': { title: 'Fotometri · Temel', href: '/egitim/fotometri/aki-ve-kadir' }, 'kavram/bessel': { title: 'Bessel', href: null } }
  const html = renderMarkdown('## Mantığı\n:::bilmen\nAkı **toplam** enerjidir; bkz. [[fotometri/temel|fotometri]].\n:::\n:::hesap\n$m = -2.5 \\log F$\n:::\n:::merak\n## Türetme\nUzun [[kavram/bessel]] ve [[yok/anahtar|bilinmeyen]]\n:::cozum\nkapatılmamış kutu\n:::\n## Sonra', { math: true, links })
  assert.match(html, /<aside class="box box-bilmen"><p class="box-title">Bilmen gereken<\/p>\s*<p>Akı <strong>toplam<\/strong> enerjidir; bkz\. <a href="\/egitim\/fotometri\/aki-ve-kadir">fotometri<\/a>\.<\/p>\s*<\/aside>/)
  assert.match(html, /<aside class="box box-hesap">[\s\S]*class="katex"[\s\S]*<\/aside>/)
  assert.match(html, /<details class="box box-merak"><summary>Merak edene <span>· ezberlemen gerekmez<\/span><\/summary>\s*<h2 id="turetme">Türetme<\/h2>\s*<p>Uzun Bessel <span class="later">\(ileride\)<\/span> ve bilinmeyen<\/p>\s*<\/details>\s*<details class="solution">/, 'yazılmamış ders "ileride", bilinmeyen anahtar düz metin; kapanmayan kutuyu yenisi kapatır')
  assert.equal((html.match(/<section>/g) ?? []).length, 2, 'kutu içindeki başlık bölüm açmaz')
  assert.doesNotMatch(renderMarkdown(':::bilmen\nA\n:::'), /<aside/, 'haberlerde kutu yok')
  assert.match(renderMarkdown('[[fotometri/temel|ölçüm]]', { math: true }), /^<p>ölçüm<\/p>$/, 'bağlantı listesi verilmezse düz metin')
})

test('müfredat kataloğu tutarlı', () => {
  const stages = catalogStages()
  const keys = new Set(stages.map((s) => s.key))
  assert.equal(keys.size, stages.length, 'anahtarlar tekil')
  for (const s of stages) for (const r of s.requires.split(',').filter(Boolean)) assert.ok(keys.has(r), `${s.key} → ${r}`)
  for (const key of FIRST_ROUND) assert.ok(key.endsWith('/temel'), key)
  // Döngü yok: her blok bir gün yazılabilir
  const states = stages.map((s, i) => ({ ...s, id: i + 1, seriesId: s.series === 'kavramlar' ? 0 : [...new Set(stages.map((x) => x.series))].indexOf(s.series) + 1, approved: true, planned: false, pending: 0 }))
  const history: string[] = []
  for (let n = 0; n < stages.length; n++) {
    const done = FIRST_ROUND.every((k) => stageDone(states.find((s) => s.key === k)!))
    const stage = nextTracks(history, done).map((t) => pickStage(states, t)).find(Boolean)
    assert.ok(stage, `${n}. blokta sıra tıkandı`)
    stage!.planned = true
    history.unshift(stage!.track)
  }
  assert.ok(states.every(stageDone))
})

test('müfredat sırası: hat dönüşümü, önkoşul, yarım blok', () => {
  assert.deepEqual(nextTracks([], false)[0], 'uygulama', 'ilk ders uygulama')
  assert.notEqual(nextTracks(['uygulama'], false)[0], 'uygulama')
  assert.equal(nextTracks(['astronomi', 'uygulama'], false)[0], 'uygulama', 'ilk turda iki dersten biri')
  assert.notEqual(nextTracks(['astronomi', 'temel', 'uygulama'], true)[0], 'uygulama')
  assert.equal(nextTracks(['astronomi', 'temel', 'astronomi', 'uygulama'], true)[0], 'uygulama', 'sonra dört dersten biri')
  assert.deepEqual(nextTracks(['uygulama'], true).slice(0, 3), ['astronomi', 'temel', 'kavram'])
  assert.deepEqual(nextTracks(['astronomi', 'uygulama'], true).slice(0, 3), ['temel', 'astronomi', 'kavram'])
  assert.deepEqual(nextTracks(['kavram', 'temel', 'astronomi', 'temel', 'astronomi'], true).slice(0, 2), ['uygulama', 'astronomi'], 'beşlik dönüşüm başa döner')

  const st = (key: string, track: string, level: string, seriesId: number, position: number, extra: Partial<StageState> = {}): StageState => ({ key, track, level, seriesId, position, id: position, requires: '', approved: true, planned: false, pending: 0, ...extra })
  const stages = [
    st('yildizlar/temel', 'astronomi', 'temel', 1, 10, { planned: true }),
    st('yildizlar/orta', 'astronomi', 'orta', 1, 20, { requires: 'isi/orta' }),
    st('galaksiler/temel', 'astronomi', 'temel', 2, 30),
    st('degisim/orta', 'temel', 'orta', 3, 5, { planned: true }),
    st('isi/temel', 'temel', 'temel', 4, 40),
    st('isi/orta', 'temel', 'orta', 4, 50),
  ]
  assert.deepEqual(requirementsOf(stages[1], stages), ['yildizlar/temel', 'degisim/orta', 'isi/orta'], 'serinin önceki aşaması, seviyenin matematiği, katalog')
  assert.equal(pickStage(stages, 'astronomi')?.key, 'isi/temel', 'bekleyen bloğun zincirinin başı öne çekilir')
  stages[4].planned = true
  assert.equal(pickStage(stages, 'astronomi')?.key, 'isi/orta')
  stages[5].planned = true
  assert.equal(pickStage(stages, 'astronomi')?.key, 'yildizlar/orta', 'önkoşul bitince bloğa dönülür')
  stages[2].planned = true
  stages[2].pending = 2
  assert.equal(pickStage(stages, 'astronomi')?.key, 'galaksiler/temel', 'yarım kalan blok önce biter')
  stages[2].approved = false
  assert.equal(pickStage(stages, 'astronomi')?.key, 'yildizlar/orta', 'onaysız blok sıraya girmez')
  assert.equal(pickStage(stages, 'kavram'), null)
})

test('ders aşamalarının satır yanıtları', () => {
  assert.deepEqual(parsePlan('Araştırdım:\n1. DERS | Işık "dalga"dır | Faz, girişim | yarık\n- **ders** | Seeing |\nbozuk satır\nKonu | Yanlış işaret | x'), [
    { title: 'Işık "dalga"dır', scope: 'Faz, girişim | yarık' },
    { title: 'Seeing', scope: '' },
  ])
  assert.deepEqual(parsePlan('| DERS | Seeing | atmosfer |'), [{ title: 'Seeing', scope: 'atmosfer' }], 'tablo biçimindeki satır')
  assert.deepEqual(parseIssues('ciddi | Nedir? | "1.22" yerine 1.12 | 1.22\n- Küçük | Özet | eksik\nnot: başka'), {
    issues: [{ major: true, where: 'Nedir?', problem: '"1.22" yerine 1.12', fix: '1.22' }, { major: false, where: 'Özet', problem: 'eksik', fix: '' }],
    readable: true,
  })
  assert.deepEqual(parseIssues('SORUN YOK'), { issues: [], readable: true })
  assert.deepEqual(parseIssues('Her şey güzel görünüyor.'), { issues: [], readable: false }, 'biçimsiz yanıt temiz sayılmaz')
  assert.deepEqual(parseConcepts('Öneriler:\nKAVRAM | Kütleçekim "dalgaları" | LIGO haberi\n- kavram | Kozmik ışın |\nYOK'), [
    { title: 'Kütleçekim "dalgaları"', reason: 'LIGO haberi' },
    { title: 'Kozmik ışın', reason: '' },
  ])
  assert.deepEqual(parseConcepts('YOK'), [])
})

test('ders seviyeleri: aralık', () => {
  assert.equal(levelRange(['temel', 'ileri', 'orta']), 'Temel → İleri')
  assert.equal(levelRange(['orta', 'orta']), 'Orta')
  assert.equal(levelRange(['kapsamli']), 'Temelden ileriye')
  assert.equal(levelRange(['']), '')
})

test('gökyüzü takvimi ve arama', () => {
  const text = [
    'İşte takvim:',
    '2026-10-30 | 21:00 | yakinlasma | - | Ay ve Satürn | Güneydoğu; "parlak" | dürbün',
    '- 2026-10-28 | gece | uydurma | önemli | **Orionid** |',
    '2026-11-20 | - | meteor | - | Aralık dışı | x',
    '30 Ekim | - | meteor | - | Bozuk tarih | x',
    '2026-10-29 | - | meteor | - |  | başlıksız',
    'bozuk satır',
  ].join('\n')
  assert.deepEqual(parseSkyEvents(text, '2026-10-27', '2026-11-02'), [
    { date: '2026-10-28', time: '', kind: 'diger', rank: 2, title: 'Orionid', detail: '' },
    { date: '2026-10-30', time: '21:00', kind: 'yakinlasma', rank: 1, title: 'Ay ve Satürn', detail: 'Güneydoğu; "parlak" | dürbün' },
  ])
  assert.equal(parseSkyEvents('| 2026-10-28 | - | meteor | önemli | Orionid | |', '2026-10-27', '2026-11-02')[0]?.title, 'Orionid', 'tablo biçimindeki satır')
  assert.equal(mondayOf('2026-10-28'), '2026-10-26', 'çarşambanın pazartesisi')
  assert.equal(mondayOf('2026-11-01'), '2026-10-26', 'pazar haftanın son günü')
  assert.equal(mondayOf('2026-10-26'), '2026-10-26')
  assert.equal(addDays('2026-12-30', 3), '2027-01-02')
})

test('ders çıktısı, linkler ve iç ağ adresleri', () => {
  assert.deepEqual(parseLesson('Araştırdım.\nÖzet: Airy diski kırınımdır.\nÖnkoşul: [[fotometri/temel]], kavram/nyquist-piksel-olcegi\nÖğretilenler: kırınım, Airy diski\n\n## Nedir?\nMetin'), { excerpt: 'Airy diski kırınımdır.', body: '## Nedir?\nMetin', prerequisites: ['fotometri/temel', 'kavram/nyquist-piksel-olcegi'], covers: 'kırınım, Airy diski' })
  assert.deepEqual(parseLesson('Özet: X\nÖnkoşul: yok\n## Nedir?\nA')?.prerequisites, [])
  assert.equal(parseLesson('Başlıksız metin'), null)
  const body = 'Bak [ESO](https://eso.org/a) ve [yok](https://x.com/404) ve tekrar [ESO](https://eso.org/a)'
  assert.deepEqual(markdownLinks(body), ['https://eso.org/a', 'https://x.com/404'])
  assert.equal(unlink(body, new Set(['https://x.com/404'])), 'Bak [ESO](https://eso.org/a) ve yok ve tekrar [ESO](https://eso.org/a)')
  for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.1.5', '172.20.0.1', '169.254.169.254', '::1', '::ffff:127.0.0.1', 'fd00::1', '0.0.0.0']) assert.ok(isPrivateIp(ip), ip)
  for (const ip of ['8.8.8.8', '172.32.0.1', '2606:4700::1111']) assert.ok(!isPrivateIp(ip), ip)
})

test('safeFetch: iç ağ engellenir, yönlendirmeler denetlenir', async () => {
  const server = http.createServer((req, res) => {
    if (req.url === '/yonlendir') return res.writeHead(302, { Location: '/hedef' }).end()
    if (req.url === '/dongu') return res.writeHead(302, { Location: '/dongu' }).end()
    res.writeHead(200).end('tamam')
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  try {
    delete process.env.BLOG_ALLOW_PRIVATE_URLS
    await assert.rejects(safeFetch(`${base}/hedef`), /iç ağ/, '127.0.0.1 engellenir')
    await assert.rejects(safeFetch('http://[::1]:1/'), /iç ağ/)
    await assert.rejects(safeFetch('file:///etc/passwd'), /http/)
    process.env.BLOG_ALLOW_PRIVATE_URLS = '1'
    const response = await safeFetch(`${base}/yonlendir`)
    assert.equal(await response.text(), 'tamam', 'yönlendirme izlenir')
    await assert.rejects(safeFetch(`${base}/dongu`), /yönlendirme/)
  } finally {
    delete process.env.BLOG_ALLOW_PRIVATE_URLS
    server.close()
  }
})
