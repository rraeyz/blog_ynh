// Uçtan uca test: boş bir kuruluma karşı çalışır. Yapay zekâ ve Künye yerine sahte bir sunucu kullanır (token harcamaz).
// Kullanım: npm run build && npm start (ayrı terminal), sonra BASE_URL=http://localhost:3000 node --test tests/e2e.test.mjs
// Formlar JavaScript'siz yoldan (Next.js'in $ACTION_ID_ alanı) gönderilir; ek bağımlılık yok.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'

const B = process.env.BASE_URL || 'http://localhost:3000'
const FAKE_PORT = 3901
const FAKE = `http://127.0.0.1:${FAKE_PORT}`
const PASSWORD = 'e2e-sifre-12345'

// --- Sahte yapay zekâ (OpenAI uyumlu) + sahte Künye + örnek makale sayfası ---
const kunyeRequests = []
const subscribeRequests = []
let aiCalls = 0
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
    if (req.url === '/v1/chat/completions') {
      aiCalls++
      // Başlıktan sonra boş satır yok (Gemini böyle yazıyordu); vurgu ve "Kısaca" maddeleri
      const content = JSON.stringify({ title: 'Kediler Neden Çok Uyur?', brief: 'Kediler günde 15 saat uyuyor.', highlights: ['Uyku enerji saklar', 'Avcılık için gerekli'], body: 'Giriş.\n## Ne yaptılar?\n<script>alert(1)</script> **önemli**\n> Büyük bulgu', category: 'uzay', importance: 9 })
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ choices: [{ message: { content: `İşte yazı:\n${content}` } }], usage: { prompt_tokens: 100, completion_tokens: 50 } }))
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

// Tarayıcı formdaki bütün alanları gönderir; test de öyle yapmalı (eksik alan boş sayılır)
const SETTINGS = {
  siteTitle: 'Test Blog',
  siteUrl: 'https://blog.example.com',
  aiProvider: 'custom',
  aiModel: 'test-model',
  aiBaseUrl: `${FAKE}/v1`,
  aiApiKey: 'ai-anahtari',
  readMode: 'abstract',
  maxInputChars: '8000',
  monthlyTokenLimit: '0',
  postsPerDay: '2',
  dailyHour: '9',
  digestWeekday: '1',
  kunyeUrl: FAKE,
  kunyeToken: 'kunye-anahtari',
}

test('ayarlar', async () => {
  const location = await submit('/admin/ayarlar', 'aiProvider', SETTINGS)
  assert.match(location, /Ayarlar kaydedildi/)
  const page = (await get('/admin/ayarlar')).html
  assert.ok(!page.includes('ai-anahtari') && !page.includes('kunye-anahtari'), 'gizli anahtarlar sayfada görünmemeli')
  assert.match(await submit('/admin/ayarlar', 'aiProvider', { ...SETTINGS, kunyeUrl: 'ftp://x' }), /http/)
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
  assert.match(home, /href="\/\?konu=uzay#yazilar"[^>]*>Uzay</, 'konusu olan yazı sekme açar')
  assert.match((await get('/?konu=uzay')).html, /Kediler Neden Çok Uyur/)
  assert.match((await get('/?konu=saglik')).html, /Bu konuda henüz yazı yok/)
  const rss = await get('/rss.xml')
  assert.match(rss.html, /<link>https:\/\/blog\.example\.com\/yazi\/kediler-neden-cok-uyur<\/link>/)
  cookie = savedCookie

  const usage = (await get('/admin')).html
  assert.match(usage, /150/, 'token kullanımı sayılmalı')

  // Yüksek puanlı yazı için öneri; öne çıkarılınca ana sayfada Öne çıkanlar
  assert.match((await get('/admin/yazilar')).html, /önem 9\/10[\s\S]*Öneri/)
  assert.match(await submit(`/admin/yazilar/${postId}`, 'Öne çıkar'), /Öne çıkarıldı/)
  cookie = ''
  assert.match((await get('/')).html, /Öne çıkanlar[\s\S]*★ Öne çıkan[\s\S]*Kediler Neden Çok Uyur/)
  cookie = savedCookie
  assert.match(await submit(`/admin/yazilar/${postId}`, 'Öne çıkanlardan kaldır'), /kaldırıldı/)
  assert.match((await get('/')).html, /Okuma köşesi/)
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
  await submit('/admin/ayarlar', 'aiProvider', { ...SETTINGS, aiApiKey: '', kunyeToken: 'yanlis' })
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
  assert.match(await upload(JSON.stringify(backup)), new RegExp(`Yedek yüklendi: ${backup.sources.length} kaynak, ${backup.papers.length} makale, ${backup.posts.length} yazı`))
  assert.equal((await get(`/admin/yazilar/${postId}`)).status, 200, 'yazı geri gelmeli')
  assert.equal((await get('/admin')).status, 200, 'oturum açık kalmalı')
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
