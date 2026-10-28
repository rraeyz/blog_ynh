// Uçtan uca test: boş bir kuruluma karşı çalışır. Yapay zekâ ve Künye yerine sahte bir sunucu kullanır (token harcamaz).
// Kullanım: npm run build, sonra sunucuyu sahte servislere izin vererek başlat:
//   OPENROUTER_BASE_URL=http://127.0.0.1:3901/or/v1 BLOG_ALLOW_PRIVATE_URLS=1 npm start
// ve BASE_URL=http://localhost:3000 node --test tests/e2e.test.mjs
// Formlar JavaScript'siz yoldan (Next.js'in $ACTION_ID_ alanı) gönderilir; ek bağımlılık yok.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'

const B = process.env.BASE_URL || 'http://localhost:3000'
const FAKE_PORT = 3901
const FAKE = `http://127.0.0.1:${FAKE_PORT}`
const PASSWORD = 'e2e-sifre-12345'
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

// --- Sahte yapay zekâ (OpenAI uyumlu) + sahte Künye + örnek makale sayfası ---
const kunyeRequests = []
const subscribeRequests = []
const openRouterRequests = []
let aiCalls = 0
const selectionCalls = []
let lowFullTextChecks = 0 // bu kadar tam metin kontrolü düşük puan döner (yerine sıradakinin alınması)
const fake = http.createServer((req, res) => {
  let body = ''
  req.on('data', (chunk) => { body += chunk })
  req.on('end', () => {
    if (req.url === '/feed.xml') {
      res.writeHead(200, { 'Content-Type': 'application/rss+xml' })
      return res.end('<rss><channel><item><title>Beslemeden yazı</title><link>http://127.0.0.1:3901/makale</link><description>Kısa</description></item></channel></rss>')
    }
    if (req.url === '/makale') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      return res.end('<html><head><title>Örnek Makale</title></head><body><p>Bu makale kedilerin uykusunu inceliyor.</p></body></html>')
    }
    // Sıfırlamadan sonraki gibi büyük yığılma: 700 haber
    if (req.url === '/feed-cok.xml') {
      res.writeHead(200, { 'Content-Type': 'application/rss+xml' })
      return res.end(`<rss><channel>${Array.from({ length: 700 }, (_, i) => `<item><title>Yığın haberi ${i + 1}</title><link>${FAKE}/yigin/${i + 1}</link><description>Kısa ${i + 1}</description></item>`).join('')}</channel></rss>`)
    }
    if (req.url === '/v1/chat/completions' && body.includes('Bir bilim editörüsün')) {
      selectionCalls.push(body)
      const user = JSON.parse(body).messages[1].content
      const count = (user.match(/^\d+\. /gm) || []).length
      // İlk iki haber 7,8; kalanlar 5,5 (eşiğin altı). Son yazılanlardaki "Kediler"le aynı gelişme sayılan 3. haber tekrar
      // Tam metin kontrolü (tek haber): istenirse 3,3 döner
      if (count === 1 && lowFullTextChecks > 0) {
        lowFullTextChecks--
        res.writeHead(200, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ choices: [{ message: { content: '1 | 2 | 2 | 2 | 2 | diğer | -' } }], usage: { prompt_tokens: 100, completion_tokens: 10 } }))
      }
      const content = Array.from({ length: count }, (_, i) => `${i + 1} | ${i < 2 ? '4 | 4 | 4 | 4' : '3 | 3 | 3 | 3'} | diğer | ${i === 2 && user.includes('Son yazılanlar') ? 'Y' : '-'}`).join('\n')
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 100, completion_tokens: 50 } }))
    }
    if (req.url === '/v1/chat/completions') {
      aiCalls++
      // Başlıktan sonra boş satır yok (Gemini böyle yazıyordu); vurgu ve "Kısaca" maddeleri
      const content = JSON.stringify({ title: 'Kediler Neden Çok Uyur?', brief: 'Kediler günde 15 saat uyuyor.', highlights: ['Uyku enerji saklar', 'Avcılık için gerekli'], body: 'Giriş.\n## Ne yaptılar?\n<script>alert(1)</script> **önemli**\n> Büyük bulgu', category: 'uzay' })
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ choices: [{ message: { content: `İşte yazı:\n${content}` } }], usage: { prompt_tokens: 100, completion_tokens: 50 } }))
    }
    if (/^\/kaynak\d$/.test(req.url)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      return res.end('<html><head><title>Kaynak</title></head><body><p>Airy diski ders notu.</p></body></html>')
    }
    // Sahte OpenRouter kapak görseli (1x1 PNG)
    if (req.url === '/or/v1/images') {
      openRouterRequests.push({ auth: req.headers.authorization, body: JSON.parse(body) })
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ data: [{ b64_json: PNG, media_type: 'image/png' }], usage: { cost: 0.01 } }))
    }
    // Sahte OpenRouter: ders planı, araştırma, yazım, denetim, gökyüzü
    if (req.url === '/or/v1/chat/completions') {
      const request = JSON.parse(body)
      openRouterRequests.push({ auth: req.headers.authorization, body: request })
      const [system, user] = request.messages.map((m) => m.content)
      const cite = (n) => ({ type: 'url_citation', url_citation: { url: `${FAKE}/kaynak${n}`, title: `Ders notu ${n}` } })
      let content = ''
      let annotations = []
      if (system.includes('dersleri planlıyorsun')) {
        // Kapsamdaki tırnak eskiden JSON'u bozuyordu
        content = 'Araştırdım.\n1. temel | Kırınım ve Airy diski | "Airy diski" ve kırınım\n2. orta | Seeing | Atmosfer\n3. ileri | Zernike polinomları | Dalga cephesi'
      } else if (system.includes('araştırma asistanısın')) {
        if (!user.includes('Ders: Kaynaksız')) {
          annotations = [cite(1), cite(2), cite(3)]
          content = `Notlar: çözünürlük 1.22 λ/D [1].\nKaynaklar\n[4] Elle bulunan — ${FAKE}/kaynak4\n[5] Ölü — ${FAKE}/yok`
        } else content = 'Bir şey bulamadım.'
      } else if (system.includes('öğretim üyesisin')) {
        content = [
          'Önce notları okudum.',
          'Özet: Airy diski, dairesel bir açıklıktan geçen ışığın kırınım deseninin merkezidir.',
          'Önkoşul: 1',
          'Öğretilenler: kırınım, Airy diski',
          '',
          '## Nedir?',
          `Çözünürlük sınırı $\\theta = 1.22 \\lambda / D$ ile verilir.${user.includes('Ders: Denetimli') ? ' DENETIM-HATASI' : ''}`,
          '$$',
          'I(\\theta) = I_0 \\left( \\frac{2 J_1(x)}{x} \\right)^2',
          '$$',
          '## Nasıl kullanılır?',
          '1. Dalgaboyunu seç',
          '2. Açıklığı ölç',
          '',
          '| Teleskop | D (m) |',
          '|---|---|',
          '| VLT | 8.2 |',
          '```python',
          'import numpy as np',
          'theta = 1.22 * 500e-9 / 2.0',
          '```',
          '## Alıştırmalar',
          '1 m açıklıkta çözünürlük nedir?',
          ':::cozum',
          'Yaklaşık 0.13 yay saniyesi.',
          ':::',
          '## İleri okuma',
          `- [Ders notu](${FAKE}/kaynak1)`,
          `- [Elle bulunan sayfa](${FAKE}/kaynak4)`,
          `- [ölü kaynak](${FAKE}/yok)`,
        ].join('\n')
      } else if (system.includes('bilimsel editörüsün')) {
        content = user.includes('DENETIM-HATASI') ? 'ciddi | Nedir? | Katsayı yanlış | 1.22 olmalı' : 'SORUN YOK'
      } else if (system.includes('gözlemsel astronomi editörüsün')) {
        annotations = [cite(1)]
        const [from] = user.match(/\d{4}-\d{2}-\d{2}/)
        const day = (n) => new Date(Date.parse(from) + n * 86_400_000).toISOString().slice(0, 10)
        content = [
          `${day(2)} | 21:30 | yakinlasma | - | Ay ile Satürn yakınlaşıyor | Güneydoğuya bak`,
          `${day(0)} | - | meteor | - | Orionid <b>tepe</b> | Gece yarısından sonra`,
          `${day(1)} | 20:00 | ay-tutulmasi | - | Parçalı Ay tutulması | Doğuya bak`,
          `${day(40)} | - | diger | - | Aralık dışı | x`,
        ].join('\n')
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ choices: [{ message: { content, annotations } }], usage: { prompt_tokens: 1000, completion_tokens: 500 } }))
    }
    if (req.url === '/api/subscribe' && req.method === 'POST') {
      const ok = req.headers.authorization === 'Bearer kunye-anahtari'
      if (ok) subscribeRequests.push(JSON.parse(body))
      res.writeHead(ok ? 200 : 401, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify(ok ? { success: true, message: 'Bültene başarıyla abone oldunuz!' } : { error: 'Unauthorized' }))
    }
    if (req.url === '/api/admin/scheduled-newsletters' && req.method === 'POST') {
      kunyeRequests.push({ auth: req.headers.authorization, body: JSON.parse(body) })
      const ok = req.headers.authorization === 'Bearer kunye-anahtari'
      res.writeHead(ok ? 200 : 401, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify(ok ? { id: 1, status: 'pending' } : { error: 'Unauthorized' }))
    }
    res.writeHead(404).end()
  })
})
before(() => new Promise((resolve) => fake.listen(FAKE_PORT, '127.0.0.1', resolve)))
after(() => new Promise((resolve) => fake.close(resolve)))

// --- Yardımcılar ---
let cookie = ''

async function get(path) {
  const res = await fetch(B + path, { headers: cookie ? { cookie } : {}, redirect: 'manual' })
  return { status: res.status, location: res.headers.get('location') || '', html: await res.text() }
}

const unescapeHtml = (text) => text.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

// Sayfadaki formlardan `pick` ile eşleşeni bulup gönderir (gizli alanlar dahil)
async function post(path, pick, fields = {}) {
  const page = await get(path)
  const forms = page.html.match(/<form[\s\S]*?<\/form>/g) || []
  const form = forms.find((f) => f.includes(pick))
  assert.ok(form, `${path} sayfasında "${pick}" formu yok`)
  const data = new FormData()
  for (const [, name, value] of form.matchAll(/<input type="hidden" name="([^"]+)"(?: value="([^"]*)")?/g)) data.append(name, unescapeHtml(value ?? ''))
  for (const [name, value] of Object.entries(fields)) data.set(name, value)
  return fetch(B + path, { method: 'POST', body: data, headers: cookie ? { cookie } : {}, redirect: 'manual' })
}

// Form gönderir ve yönlendirme adresini döner (panel işlemleri)
async function submit(path, pick, fields = {}) {
  const res = await post(path, pick, fields)
  const setCookie = res.headers.get('set-cookie') || ''
  const session = setCookie.match(/blog-session=([^;]*)/)
  if (session) cookie = session[1] ? `blog-session=${session[1]}` : ''
  const location = res.headers.get('location') || ''
  assert.ok([303, 307, 302].includes(res.status), `${pick}: beklenmeyen yanıt ${res.status}`)
  return decodeURIComponent(location)
}

async function waitFor(check, label) {
  for (let i = 0; i < 40; i++) {
    if (await check()) return
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  assert.fail(`zaman aşımı: ${label}`)
}

// --- Testler (sırayla, ortak durumla) ---

test('kurulum ve giriş', async () => {
  assert.match((await get('/admin')).location, /\/admin\/giris$/, 'girişsiz panel açılmamalı')
  assert.match((await get('/admin/ayarlar')).location, /\/admin\/giris$/)
  assert.match((await get('/admin/giris')).html, /İlk kurulum/)

  const fields = { password: PASSWORD, password2: PASSWORD, setupToken: process.env.SETUP_TOKEN || '' }
  if (process.env.SETUP_TOKEN) assert.match(await submit('/admin/giris', 'password2', { ...fields, setupToken: 'yanlis' }), /Kurulum anahtarı hatalı/)
  assert.match(await submit('/admin/giris', 'password2', { ...fields, password2: 'baska-sifre-123' }), /aynı değil/)
  assert.match(await submit('/admin/giris', 'password2', fields), /\/admin\/ayarlar/)
  assert.ok(cookie, 'kurulum oturum açmalı')
  assert.equal((await get('/admin')).status, 200)

  // Kurulum ikinci kez yapılamaz
  const saved = cookie
  cookie = ''
  assert.match((await get('/admin/giris')).html, /Yönetici girişi/)
  assert.match(await submit('/admin/giris', 'password', { password: 'yanlis-sifre' }), /Şifre hatalı/)
  assert.equal(cookie, '')
  cookie = saved
})

// Ayarlar sekme sekme kaydedilir; tarayıcı sekmedeki bütün alanları gönderir, test de öyle yapmalı (eksik alan boş sayılır)
const SETTINGS = {
  site: { siteTitle: 'Test Blog', siteDescription: '', siteUrl: 'https://blog.example.com' },
  'yapay-zeka': { aiProvider: 'custom', aiModel: 'test-model', aiBaseUrl: `${FAKE}/v1`, aiApiKey: 'ai-anahtari', imageApiKey: 'or-anahtari', monthlyTokenLimit: '0' },
  haberler: { readMode: 'abstract', maxInputChars: '8000', interests: '', postsPerDay: '2', postsMinPerDay: '1', scoreThreshold: '6', scoreExceptional: '9,5', spacePerDay: '1', spaceNormalPerDay: '2', spaceImportantScore: '7.5', spaceMaxPerDay: '4', dailyHour: '9', autoFeature: 'on', featureScore: '7,5', skyEnabled: 'on', imageModel: 'test/gorsel' },
  egitim: { lessonModel: 'test/ders-modeli', lessonHelperModel: 'test/yardimci', lessonDay: '1', lessonAutoPublish: 'on' },
  bulten: { kunyeUrl: FAKE, kunyeToken: 'kunye-anahtari', newsletterTag: '', digestWeekday: '1', astroDigestWeekday: '0' },
}
const saveSettings = (section, changes = {}) => submit(`/admin/ayarlar?bolum=${section}`, `name="section" value="${section}"`, { ...SETTINGS[section], ...changes })

test('ayarlar', async () => {
  for (const section of Object.keys(SETTINGS)) assert.match(await saveSettings(section), new RegExp(`bolum=${section}.*Ayarlar kaydedildi`))
  for (const section of ['yapay-zeka', 'bulten']) {
    const page = (await get(`/admin/ayarlar?bolum=${section}`)).html
    assert.ok(!/ai-anahtari|kunye-anahtari|or-anahtari/.test(page), 'gizli anahtarlar sayfada görünmemeli')
  }
  const news = (await get('/admin/ayarlar?bolum=haberler')).html
  assert.match(news, /name="autoFeature"[^>]*checked/)
  assert.match(news, /name="scoreExceptional"[^>]*value="9.5"/, 'virgüllü puan onda bir saklanır, geri gösterilir')
  assert.match(news, /name="spaceImportantScore"[^>]*value="7.5"/)
  assert.match(news, /name="featureScore"[^>]*value="7.5"/, 'öne çıkarma eşiği ayardan')
  assert.match(await saveSettings('bulten', { kunyeUrl: 'ftp://x' }), /http/)
  // Bir sekmeyi kaydetmek ötekileri değiştirmez
  assert.match((await get('/admin/ayarlar?bolum=site')).html, /value="Test Blog"/)
  assert.match((await get('/admin/ayarlar?bolum=yapay-zeka')).html, /value="test-model"/)
})

test('abonelik kutusu (Künye üzerinden)', async () => {
  const saved = cookie
  cookie = ''
  try {
    const page = (await get('/')).html
    assert.match(page, /id="abone"/, 'Künye bağlıyken kutu görünür')
    const ask = async (fields) => (await (await post('/', 'sub-email', fields)).text())
    assert.match(await ask({ email: 'gecersiz' }), /Geçerli bir e-posta/)
    assert.match(await ask({ email: 'bot@example.com', website: 'spam' }), /Teşekkürler/)
    assert.equal(subscribeRequests.length, 0, 'bot ve geçersiz adres Künye\'ye gitmez')
    assert.match(await ask({ email: 'okur@example.com' }), /başarıyla abone oldunuz/)
    assert.deepEqual(subscribeRequests, [{ email: 'okur@example.com', name: '', tag: 'Blog' }])
  } finally {
    cookie = saved
  }
})

test('kaynak ekleme', async () => {
  assert.match(await submit('/admin/kaynaklar', 'Kaynak ekle', { url: `${FAKE}/makale` }), /beslemesi bulunamadı/)
  assert.match(await submit('/admin/kaynaklar', 'Kaynak ekle', { url: 'https://arxiv.org/abs/2510.12345' }), /tek bir makalenin/)
  assert.match(await submit('/admin/kaynaklar', 'Kaynak ekle', { url: `${FAKE}/feed.xml` }), /Eklendi \(şu an 1 makale/)
  assert.match(await submit('/admin/kaynaklar', 'Kaynak ekle', { url: `${FAKE}/feed.xml` }), /zaten ekli/)
})

test('makaleleri sil, toplu atla ve sil', async () => {
  const tab = async (status) => (await get(`/admin/makaleler?durum=${status}`)).html
  const count = (label, n) => new RegExp(`${label}(<!-- -->)? · (<!-- -->)?${n}<`)
  const add = () => submit('/admin/makaleler', 'Ekle', { url: `${FAKE}/feed.xml` })
  assert.match(await add(), /Eklendi/)
  assert.match(await submit('/admin/makaleler?durum=new', 'Hepsini atla'), /1 makale atlandı/)
  assert.match(await submit('/admin/makaleler?durum=skipped', 'Hepsini sil'), /1 makale silindi/)
  assert.match(await tab('skipped'), count('Atlandı', 0))
  // Silinen makalenin kaydı kalır: elle yeniden eklenince geri gelir, tek tek de silinebilir
  await add()
  assert.match(await tab('new'), count('Bekliyor', 1))
  assert.match(await submit('/admin/makaleler?durum=new', '>Sil<'), /Silindi/)
  assert.match(await tab('new'), count('Bekliyor', 0))
})

let postId
test('makale → taslak yazı → yayın', async () => {
  assert.match(await submit('/admin/makaleler', 'Ekle', { url: `${FAKE}/makale` }), /Eklendi: Örnek Makale/)
  assert.match(await submit('/admin/makaleler', 'Yazıya dönüştür'), /arka planda/)
  await waitFor(async () => /Kediler Neden Çok Uyur/.test((await get('/admin/yazilar')).html), 'yazı üretimi')
  postId = (await get('/admin/yazilar')).html.match(/href="\/admin\/yazilar\/(\d+)"/)[1]

  // Taslak herkese açık değil
  const savedCookie = cookie
  cookie = ''
  assert.equal((await get('/yazi/kediler-neden-cok-uyur')).status, 404)
  cookie = savedCookie

  assert.match(await submit(`/admin/yazilar/${postId}`, 'Yayımla'), /Yayımlandı/)
  // Yeni yazının serbest görseli yok, OpenRouter anahtarı var: kapak kendiliğinden çizilir
  await waitFor(async () => /src="\/gorsel\/\d+-\d+\.webp"/.test((await get(`/admin/yazilar/${postId}`)).html), 'kapak görseli')
  assert.ok(openRouterRequests.some((r) => r.body.model === 'test/gorsel' && r.body.aspect_ratio === '16:9'))
  cookie = ''
  const page = await get('/yazi/kediler-neden-cok-uyur')
  assert.equal(page.status, 200)
  assert.ok(page.html.includes('&lt;script&gt;alert(1)&lt;/script&gt;') && !page.html.includes('<script>alert(1)'), 'model çıktısı kaçışlanmalı')
  assert.match(page.html, /<strong>önemli<\/strong>/)
  assert.match(page.html, /<h2 id="ne-yaptilar">Ne yaptılar\?<\/h2>/, 'başlık boş satırsız da çalışmalı')
  assert.match(page.html, /<blockquote>Büyük bulgu<\/blockquote>/)
  assert.match(page.html, /Kısaca[\s\S]*Uyku enerji saklar[\s\S]*Avcılık için gerekli/)
  const home = (await get('/')).html
  assert.match(home, /Yeni gelişmeler[\s\S]*Kediler Neden Çok Uyur\?[\s\S]*Kediler günde 15 saat uyuyor\.[\s\S]*Detaylar/)
  assert.match(home, /aria-label="Konular"[\s\S]*?href="\/konu\/uzay"[\s\S]*?Uzay</, 'konusu olan yazı üst menüde konu bağlantısı açar')
  assert.doesNotMatch(home, /href="\/konu\/saglik"/, 'yazısı olmayan konu menüde görünmez')
  const topic = (await get('/konu/uzay')).html
  assert.match(topic, /<h1[^>]*>Uzay<\/h1>[\s\S]*1(<!-- -->)? yazı[\s\S]*Kediler Neden Çok Uyur/)
  assert.match((await get('/konu/saglik')).html, /Bu konuda henüz yazı yok/)
  assert.equal((await get('/konu/olmayan')).status, 404)
  const rss = await get('/rss.xml')
  assert.match(rss.html, /<link>https:\/\/blog\.example\.com\/yazi\/kediler-neden-cok-uyur<\/link>/)
  cookie = savedCookie

  const usage = (await get('/admin')).html
  assert.match(usage, /300/, 'token kullanımı sayılmalı (tam metin puanı + yazım)')

  // Önem puanı 9: yayımlanınca kendiliğinden öne çıkar (ayar açık)
  cookie = ''
  assert.match((await get('/')).html, /Öne çıkanlar[\s\S]*★ Öne çıkan[\s\S]*Kediler Neden Çok Uyur/)
  cookie = savedCookie
  assert.match(await submit(`/admin/yazilar/${postId}`, 'Öne çıkanlardan kaldır'), /kaldırıldı/)
  assert.match((await get('/')).html, /Okuma köşesi/)
  // Kaldırılınca öneri rozeti görünür, elle yeniden öne çıkarılabilir
  assert.match((await get('/admin/yazilar')).html, /önem 7,8\/10[\s\S]*Öneri/, 'önem puanı yazmadan önce tam metinden')
  // Süzgeçler: konu, en az önem, durum, sıralama
  assert.match((await get('/admin/yazilar?durum=yayinda&konu=uzay&onem=7&sira=onem')).html, /1 yazı[\s\S]*Kediler Neden Çok Uyur/)
  assert.match((await get('/admin/yazilar?konu=saglik')).html, /Bu süzgece uyan yazı yok/)
  assert.match((await get('/admin/yazilar?durum=taslak')).html, /Bu süzgece uyan yazı yok/)
  assert.match(await submit(`/admin/yazilar/${postId}`, 'Öne çıkar'), /Öne çıkarıldı/)
  assert.match(await submit(`/admin/yazilar/${postId}`, 'Öne çıkanlardan kaldır'), /kaldırıldı/)
})

test('yazıyı abonelere gönder (Künye)', async () => {
  const digestUrl = await submit(`/admin/yazilar/${postId}`, 'Abonelere gönder')
  const digestPath = digestUrl.match(/\/admin\/bultenler\/\d+/)[0]
  assert.match(await submit(digestPath, 'Abonelere gönder'), /planlandı/)
  assert.equal(kunyeRequests.length, 1)
  const sent = kunyeRequests[0]
  assert.equal(sent.auth, 'Bearer kunye-anahtari')
  assert.equal(sent.body.subject, 'Kediler Neden Çok Uyur?')
  assert.match(sent.body.message, /Uzay<\/span>\n\*\*\[Kediler Neden Çok Uyur\?\]\(https:\/\/blog\.example\.com\/yazi\/kediler-neden-cok-uyur\)\*\*\nKediler günde 15 saat uyuyor\.\n\[Devamını oku →\]/)
  assert.match(sent.body.message, /<a href="https:\/\/blog\.example\.com" class="cta-button">/, 'site linki tıklanabilir buton')
  assert.equal(sent.body.fromName, 'Test Blog', 'gönderen adı blogun adı')
  assert.ok(new Date(sent.body.sendAt).getTime() > Date.now(), 'gelecekte bir zamana planlanmalı')
  assert.match(await submit(digestPath, 'Sil'), /silindi/)

  // Yanlış anahtar: hata panelde görünür
  await saveSettings('bulten', { kunyeToken: 'yanlis' })
  const second = await submit('/admin/bultenler', 'Son 7 günden')
  const secondPath = second.match(/\/admin\/bultenler\/\d+/)[0]
  assert.match(await submit(secondPath, 'Abonelere gönder'), /API anahtarı geçersiz/)

  // Abonelik başarısız olunca ziyaretçi genel mesaj görür, sebep panel günlüğüne yazılır
  const saved = cookie
  cookie = ''
  try {
    assert.match(await (await post('/', 'sub-email', { email: 'ikinci@example.com' })).text(), /Şu an abone olunamıyor/)
  } finally {
    cookie = saved
  }
  assert.match((await get('/admin')).html, /Abonelik başarısız: Künye yanıtı 401/)
})

test('yazıyı yapay zekâyla yeniden yaz', async () => {
  const before = aiCalls
  assert.match(await submit(`/admin/yazilar/${postId}`, 'yeniden yaz'), /Yeniden yazılıyor/)
  await waitFor(async () => /Yeniden yazım: .*yeniden yazıldı/.test((await get('/admin')).html), 'yeniden yazım')
  assert.equal(aiCalls, before + 1)
  const page = (await get(`/admin/yazilar/${postId}`)).html
  assert.match(page, /Yayından kaldır/, 'yayın durumu korunur')
  assert.equal((await get('/yazi/kediler-neden-cok-uyur')).status, 200, 'adres değişmez')
})

test('tam yedek ve geri yükleme', async () => {
  const download = async () => {
    const res = await fetch(`${B}/api/admin/yedek`, { headers: cookie ? { cookie } : {} })
    return { status: res.status, data: res.status === 200 ? await res.json() : null }
  }
  const saved = cookie
  cookie = ''
  assert.equal((await download()).status, 401, 'girişsiz yedek indirilemez')
  cookie = saved

  const { data: backup } = await download()
  assert.equal(backup.format, 'blog-backup')
  assert.ok(backup.posts.length >= 1 && backup.papers.length >= 1 && backup.sources.length >= 1)
  assert.equal(backup.settings.aiModel, 'test-model')
  assert.ok(!('passwordHash' in backup.settings), 'şifre yedeğe girmez')
  const image = backup.posts.find((p) => String(p.id) === postId).image
  assert.ok(backup.images[image], 'yapay zekâ kapağı yedekte')

  const upload = async (content) => {
    const data = new FormData()
    data.append('file', new Blob([content], { type: 'application/json' }), 'yedek.json')
    const res = await fetch(`${B}/api/admin/yedek`, { method: 'POST', body: data, headers: { cookie }, redirect: 'manual' })
    return decodeURIComponent(res.headers.get('location') || '')
  }
  assert.match(await upload('{"x":1}'), /bu blogun yedeği değil/)
  assert.match(await upload('bozuk'), /JSON değil/)
  assert.match(await upload(JSON.stringify({ ...backup, posts: 'yok' })), /bozuk/)

  // Yazıyı sil, yedekten geri getir
  assert.match(await submit(`/admin/yazilar/${postId}`, 'Sil'), /silindi/)
  assert.equal((await get(`/admin/yazilar/${postId}`)).status, 404)
  assert.equal((await get(`/gorsel/${image}`)).status, 404, 'silinen yazının kapağı da silinir')
  assert.match(await upload(JSON.stringify({ ...backup, images: { ...backup.images, '../../dev.db': 'eA==' } })), new RegExp(`Yedek yüklendi: ${backup.sources.length} kaynak, ${backup.papers.length} makale, ${backup.posts.length} yazı, .* 1 görsel`))
  assert.equal((await get(`/admin/yazilar/${postId}`)).status, 200, 'yazı geri gelmeli')
  const restored = await fetch(`${B}/gorsel/${image}`)
  assert.equal(restored.status, 200, 'kapak geri gelmeli')
  assert.match(restored.headers.get('content-type') || '', /image\/webp/)
  assert.equal((await get('/admin')).status, 200, 'oturum açık kalmalı')
})

test('görsel adresi yalnızca üretilen dosyaları verir', async () => {
  assert.equal((await get('/gorsel/..%2F..%2Fdev.db')).status, 404)
  assert.equal((await get('/gorsel/1-1.jpg')).status, 404)
})

test('yetkisiz form gönderimi reddedilir', async () => {
  const saved = cookie
  const html = (await get(`/admin/yazilar/${postId}`)).html
  cookie = ''
  const form = (html.match(/<form[\s\S]*?<\/form>/g) || []).find((f) => f.includes('Sil'))
  const data = new FormData()
  for (const [, name, value] of form.matchAll(/<input type="hidden" name="([^"]+)"(?: value="([^"]*)")?/g)) data.append(name, value ?? '')
  const res = await fetch(`${B}/admin/yazilar/${postId}`, { method: 'POST', body: data, redirect: 'manual' })
  assert.match(res.headers.get('location') || '', /\/admin\/giris/)
  cookie = saved
  assert.equal((await get(`/admin/yazilar/${postId}`)).status, 200, 'yazı silinmemeli')
  assert.ok(aiCalls >= 1)
})

test('eğitim: araştırma → yazım → denetim, otomatik yayın', async () => {
  const before = openRouterRequests.length
  assert.match(await submit('/admin/egitim', 'Sıradaki dersi şimdi yaz'), /araştırılıp yazılıyor/)
  await waitFor(async () => /Ders: (&quot;|")Kırınım ve Airy diski(&quot;|") yayımlandı \(denetim temiz\)/.test((await get('/admin')).html), 'ders yazımı')
  const admin = (await get('/admin/egitim')).html
  assert.match(admin, /Optik ve Görüntü Oluşumu[\s\S]*Optik ve enstrümantasyon · temel[\s\S]*Görüntü İşleme ve OpenCV/, 'başlangıç müfredatı alan ve seviyesiyle eklendi')
  assert.match((await get('/admin')).html, /(&quot;|")Optik ve Görüntü Oluşumu(&quot;|") serisi 3 derse bölündü/)
  const calls = openRouterRequests.slice(before)
  assert.equal(calls.length, 4, 'plan, araştırma, yazım, denetim')
  assert.ok(calls.every((r) => r.auth === 'Bearer or-anahtari'))
  assert.deepEqual(calls.map((r) => r.body.model), ['test/yardimci', 'test/yardimci', 'test/ders-modeli', 'test/yardimci'], 'yalnızca yazım ders modeliyle; plan, araştırma, denetim yardımcıyla')
  assert.deepEqual(calls.map((r) => r.body.tools?.[0]?.type ?? '-'), ['openrouter:web_search', 'openrouter:web_search', '-', '-'], 'yalnızca plan ve araştırma web araması yapar')
  assert.match(calls[2].body.messages[1].content, /ARAŞTIRMA NOTLARI:\nNotlar: çözünürlük/, 'yazım notlardan')
  assert.match(calls[3].body.messages[1].content, /DERS:\n## Nedir\?/, 'denetim yazılan dersi görür')

  const lessonId = (await get('/admin/egitim/seri/1')).html.match(/href="\/admin\/egitim\/ders\/(\d+)"/)[1]
  const lessonAdmin = (await get(`/admin/egitim/ders/${lessonId}`)).html
  assert.match(lessonAdmin, /Denetim sorun bulmadı/)
  assert.match(lessonAdmin, /Araştırma notları[\s\S]*çözünürlük/)
  const preview = lessonAdmin.match(/href="(\/egitim\/[^"]+)"/)[1]
  const saved = cookie
  cookie = ''
  try {
    const page = (await get(preview)).html
    assert.match(page, /class="katex"/, 'formüller KaTeX ile')
    assert.match(page, /hljs language-python/, 'kod bloğu renkli')
    assert.match(page, /<ol><li>Dalgaboyunu seç<\/li>/)
    assert.match(page, /<div class="table"><table>/)
    assert.match(page, /<details class="solution"><summary>Çözümü göster/)
    assert.match(page, /href="http:\/\/127\.0\.0\.1:3901\/kaynak1"/)
    assert.match(page, /href="http:\/\/127\.0\.0\.1:3901\/kaynak4"/, 'araştırmada bulunan, açılan link kalır')
    assert.ok(!page.includes(`${FAKE}/yok`) && page.includes('ölü kaynak'), 'açılmayan link metne döner')
    assert.match(page, /Bu dersin kaynakları[\s\S]*Ders notu 2[\s\S]*kaynak4/)
    assert.doesNotMatch(page, /Başlamadan önce/, 'önkoşul dersi yayında değilse kutu yok')
    const education = (await get('/egitim')).html
    assert.match(education, /Optik ve enstrümantasyon<\/h2>[\s\S]*Optik ve Görüntü Oluşumu[\s\S]*Temel → İleri[\s\S]*1(<!-- -->)? \/ (<!-- -->)?3(<!-- -->)? ders yayında/, 'alan başlığı, seviye aralığı')
    assert.match(page, /Temel<\/span>/, 'ders sayfasında seviye')
    assert.match((await get(preview.split('/').slice(0, 3).join('/'))).html, /Kırınım ve Airy diski[\s\S]*Temel[\s\S]*Seeing[\s\S]*Orta[\s\S]*Zernike polinomları[\s\S]*İleri/, 'seri sayfasında ders seviyeleri')
  } finally {
    cookie = saved
  }
})

test('eğitim: denetimde sorun çıkan ders taslak kalır, önkoşul kutusu', async () => {
  assert.match(await submit('/admin/egitim', 'Sıraya ekle', { title: 'Denetimli ders', scope: '', sourceUrls: '' }), /sıranın en önüne/)
  assert.match(await submit('/admin/egitim', 'Sıradaki dersi şimdi yaz'), /araştırılıp yazılıyor/)
  await waitFor(async () => /Ders: (&quot;|")Denetimli ders(&quot;|") taslak: denetim sorun buldu/.test((await get('/admin')).html), 'denetim')
  const admin = (await get('/admin/egitim')).html
  assert.match(admin, /İnceleme bekleyen dersler[\s\S]*Denetimli ders/)
  const lessonId = admin.match(/href="\/admin\/egitim\/ders\/(\d+)"[^>]*>Denetimli ders/)[1]
  const lessonAdmin = (await get(`/admin/egitim/ders/${lessonId}`)).html
  assert.match(lessonAdmin, /<strong>Ciddi<\/strong> · Nedir\?: Katsayı yanlış → 1\.22 olmalı/)
  const preview = lessonAdmin.match(/href="(\/egitim\/[^"]+)"/)[1]
  const saved = cookie
  cookie = ''
  try {
    assert.equal((await get(preview)).status, 404, 'taslak herkese kapalı')
    cookie = saved
    assert.match(await submit(`/admin/egitim/ders/${lessonId}`, 'Yayımla'), /Yayımlandı/)
    cookie = ''
    // Önkoşul listesinde 1 numara yayındaki "Kırınım ve Airy diski"
    assert.match((await get(preview)).html, /Başlamadan önce[\s\S]*href="\/egitim\/optik-ve-goruntu-olusumu\/kirinim-ve-airy-diski"/)
    const education = (await get('/egitim')).html
    assert.match(education, /Tek derslik konular[\s\S]*Denetimli ders[\s\S]*Temelden ileriye/, 'istenen ders tek derslik konu, kapsamlı seviye')
    const temel = (await get('/egitim?seviye=temel')).html
    assert.match(temel, /Temel dersler[\s\S]*Kırınım ve Airy diski/)
    assert.doesNotMatch(temel, /Denetimli ders/, 'seviye süzgeci')
  } finally {
    cookie = saved
  }

  // Yeterli kaynağı olmayan ders yazılmaz, hata listesine düşer
  assert.match(await submit('/admin/egitim', 'Sıraya ekle', { title: 'Kaynaksız ders', scope: '', sourceUrls: '' }), /sıranın en önüne/)
  assert.match(await submit('/admin/egitim', 'Sıradaki dersi şimdi yaz'), /araştırılıp yazılıyor/)
  await waitFor(async () => /Yazılamayan dersler[\s\S]*Kaynaksız ders[\s\S]*doğrulanmış kaynak/.test((await get('/admin/egitim')).html), 'kaynaksız ders reddi')
})

test('eğitim: iki seri sırayla ilerler, öğretilenler sonraki derse geçer', async () => {
  const before = openRouterRequests.length
  assert.match(await submit('/admin/egitim', 'Sıradaki dersi şimdi yaz'), /araştırılıp yazılıyor/)
  await waitFor(async () => /Ders: (&quot;|")Kırınım ve Airy diski(&quot;|") yayımlandı[\s\S]*(&quot;|")Uyarlamalı Optik ve Koronagraflar(&quot;|") serisi 3 derse bölündü/.test((await get('/admin')).html), 'ikinci seri')
  assert.match((await get('/admin/egitim')).html, /Yürüyor[\s\S]*Yürüyor/, 'iki seri yürüyor')
  assert.match(await submit('/admin/egitim', 'Sıradaki dersi şimdi yaz'), /araştırılıp yazılıyor/)
  await waitFor(async () => /Ders: (&quot;|")Seeing(&quot;|") yayımlandı/.test((await get('/admin')).html), 'birinci serinin ikinci dersi')
  const writes = openRouterRequests.slice(before).filter((r) => r.body.messages[0].content.includes('öğretim üyesisin'))
  assert.equal(writes.length, 2)
  assert.doesNotMatch(writes[0].body.messages[1].content, /önceki derslerinde öğrendikleri/, 'yeni serinin ilk dersi')
  assert.match(writes[1].body.messages[1].content, /Bu dersin seviyesi: Orta[\s\S]*serinin önceki derslerinde öğrendikleri: kırınım, Airy diski/)
})

test('gökyüzü takvimi', async () => {
  assert.match(await submit('/admin', 'Gökyüzü takvimini güncelle'), /araştırılıyor/)
  await waitFor(async () => /Gökyüzü takvimi \(elle\): .* 3(<!-- -->)? olay/.test((await get('/admin')).html), 'gökyüzü')
  const saved = cookie
  cookie = ''
  try {
    const home = (await get('/')).html
    assert.match(home, /Bu hafta gökyüzünde[\s\S]*🌠[\s\S]*Orionid &lt;b&gt;tepe&lt;\/b&gt;[\s\S]*✨[\s\S]*Ay ile Satürn yakınlaşıyor/, 'tarih sırasıyla, simgeli, kaçışlı')
    assert.doesNotMatch(home, /Aralık dışı/)
    // Bugün her zaman bu ayın takviminde: gün hücresi simgeli ve olayın ayrıntısına bağlı
    const page = (await get('/gokyuzu')).html
    assert.match(page, /href="#gun-\d{4}-\d{2}-\d{2}"[^>]*aria-label="[^"]*Orionid[\s\S]*Meteor yağmuru/)
    assert.match(page, /id="gun-[\s\S]*Orionid &lt;b&gt;tepe&lt;\/b&gt;[\s\S]*Gece yarısından sonra/)
    assert.match(page, /kaynakları[\s\S]*kaynak1/)
    assert.match(page, /aria-label="Bu ayın öne çıkanları"[\s\S]*Kaçırma[\s\S]*Parçalı Ay tutulması[\s\S]*Öne çıkan[\s\S]*Orionid/, 'önemli olaylar takvimin üstünde, önem sırasıyla')
    assert.match(page, /border-amber-400[^"]*"[^>]*>[\s\S]{0,400}Ay tutulması/, 'tutulma günü belirgin')
    const next = page.match(/href="\/gokyuzu\?ay=(\d{4}-\d{2})"[^>]*>[^<]*→/)[1]
    assert.equal((await get(`/gokyuzu?ay=${next}`)).status, 200, 'sonraki aya geçilir')
    assert.match((await get('/gokyuzu?ay=1999-01')).html, /Bu ay için kayıtlı olay yok/)
    assert.equal((await get('/gokyuzu?ay=bozuk')).status, 200, 'bozuk ay bu aya döner')
  } finally {
    cookie = saved
  }
})

test('haftanın astronomi özeti', async () => {
  assert.match(await submit('/admin', 'Astronomi özetini şimdi hazırla'), /hazırlanıyor/)
  await waitFor(async () => /Astronomi özeti \(elle\): taslak özet hazır/.test((await get('/admin')).html), 'astronomi özeti')
  const list = (await get('/admin/bultenler')).html
  const digestId = list.match(/href="\/admin\/bultenler\/(\d+)"[^>]*>Haftanın astronomi özeti/)?.[1]
  assert.ok(digestId, 'özet bültenler listesinde')
  const body = unescapeHtml((await get(`/admin/bultenler/${digestId}`)).html)
  assert.match(body, /Haftanın astronomi ve fizik gündemi: 1 gelişme/)
  assert.match(body, /Kediler Neden Çok Uyur/, 'uzay yazısı girer')
  assert.match(body, /Bu haftanın dersleri[\s\S]*Kırınım ve Airy diski/)
  assert.match(body, /Bu hafta gökyüzünde[\s\S]*\*\*Parçalı Ay tutulması \(kaçırma\)\*\*[\s\S]*Ay ile Satürn yakınlaşıyor[\s\S]*\/gokyuzu/)
  assert.match(body, /href="https:\/\/blog\.example\.com\/astronomi-ozeti\/\d{4}-\d{2}-\d{2}" class="cta-button">Haftanın özetini sitede oku/)

  // Sitede de: haftalık özet sayfası veriden kurulur
  const saved = cookie
  cookie = ''
  try {
    const list = (await get('/astronomi-ozeti')).html
    assert.match(list, /Bu hafta · [\s\S]*Kediler Neden Çok Uyur/)
    const week = list.match(/href="(\/astronomi-ozeti\/\d{4}-\d{2}-\d{2})"/)[1]
    const page = (await get(week)).html
    assert.match(page, /Bu haftanın gelişmeleri[\s\S]*Kediler Neden Çok Uyur[\s\S]*Bu haftanın dersleri[\s\S]*Kırınım ve Airy diski[\s\S]*Bu hafta gökyüzünde[\s\S]*Orionid/)
    assert.equal((await get('/astronomi-ozeti/2099-01-05')).status, 404, 'gelecek hafta yok')
    assert.equal((await get('/astronomi-ozeti/2026-10-28')).status, 404, 'pazartesi olmayan gün')
  } finally {
    cookie = saved
  }
})

test('site içi arama', async () => {
  const saved = cookie
  cookie = ''
  try {
    assert.match((await get('/ara?q=KEDİLER')).html, /Yazılar[\s\S]*href="\/yazi\/kediler-neden-cok-uyur"/)
    assert.match((await get('/ara?q=airy%20kirinim')).html, /Dersler[\s\S]*Kırınım ve Airy diski/, 'Türkçe harfsiz de bulur')
    // Üstteki kutunun anlık önerileri
    const live = JSON.parse((await get('/api/ara?q=kedi')).html).results
    assert.ok(live.some((r) => r.kind === 'Yazı' && r.href === '/yazi/kediler-neden-cok-uyur'), 'yazdıkça eşleşen yazı')
    assert.deepEqual(JSON.parse((await get('/api/ara?q=k')).html).results, [], 'tek harfte aranmaz')
    assert.match((await get('/')).html, /href="\/ara"[^>]*aria-label="Ara"|aria-label="Ara"[^>]*href="\/ara"/, 'JavaScript yoksa simge arama sayfasını açar')
    const none = (await get('/ara?q=%3Cscript%3Ezzz')).html
    assert.match(none, /&lt;script&gt;zzz(&quot;|")? için sonuç yok/)
  } finally {
    cookie = saved
  }
})

test('günlük iş: büyük yığılmada bütün haberler parça parça puanlanır, eşiği geçenler yazılır', async () => {
  selectionCalls.length = 0
  lowFullTextChecks = 2 // ilk puan ve çıtanın altında kalınca yapılan ikinci puan
  assert.match(await submit('/admin/kaynaklar', 'Kaynak ekle', { url: `${FAKE}/feed-cok.xml` }), /Eklendi/)
  assert.match(await submit('/admin', 'Şimdi tara ve yazı üret'), /arka planda/)
  await waitFor(async () => /Günlük iş \(elle\):/.test((await get('/admin')).html), 'günlük iş')
  const log = (await get('/admin')).html
  // 700 haber 100'lük parçalarla bir kez puanlanır; eşiği (6,0) geçen 7,8'liklerden günde en fazla 2 yazı
  assert.match(log, /Günlük iş: 70\d yeni makale puanlandı \(tekrar olan \d+ tanesi atlandı\); \d+ adayın \d+ tanesi eşiği geçti, 2 tanesi seçildi/)
  const shown = selectionCalls.map((b) => (JSON.parse(b).messages[1].content.match(/^\d+\. /gm) || []).length)
  assert.ok(shown.every((n) => n <= 100) && shown.reduce((a, b) => a + b, 0) >= 700, `her haber bir kez gösterildi: ${shown}`)
  assert.match(selectionCalls[0], /Son yazılanlar:\\n- Örnek Makale/, 'son 7 günde yazılanlar tekrar denetimi için gider')
  assert.match((await get('/admin/makaleler?durum=skipped')).html, /Son 7 günde yazılan bir haberin tekrarı/)
  assert.match((await get('/admin/makaleler?durum=new')).html, /ön puan (<!-- -->)?7,8(<!-- -->)?\/10/)
  // İlk seçilenin tam metin puanı düşük: yazılmaz, yerine sıradaki; yine 2 yazı
  assert.match(log, /tam metin puanı 3,3 \(ön puan 7,8\), yazılmadı; yerine sıradaki/)
  assert.match(log, /Günlük iş \(elle\): 70\d yeni makale, 2 yazı (taslak|yayımlandı)/, 'yine 2 yazı')
  assert.match(log, /Günlük iş: yazı 2 (yayımlandı|taslak) \(önem 7,8\)/)
  assert.match((await get('/admin/makaleler?durum=skipped')).html, /Tam metin puanı 3,3, çıta 5,5: yazılmadı/)
})
