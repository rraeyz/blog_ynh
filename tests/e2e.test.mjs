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
let aiCalls = 0
const fake = http.createServer((req, res) => {
  let body = ''
  req.on('data', (chunk) => { body += chunk })
  req.on('end', () => {
    if (req.url === '/makale') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      return res.end('<html><head><title>Örnek Makale</title></head><body><p>Bu makale kedilerin uykusunu inceliyor.</p></body></html>')
    }
    if (req.url === '/v1/chat/completions') {
      aiCalls++
      const content = JSON.stringify({ title: 'Kediler Neden Çok Uyur?', excerpt: 'Kısa özet.', body: 'Giriş.\n\n## Ne yaptılar?\n\n<script>alert(1)</script> **önemli**' })
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ choices: [{ message: { content: `İşte yazı:\n${content}` } }], usage: { prompt_tokens: 100, completion_tokens: 50 } }))
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

// Sayfadaki formlardan `pick` ile eşleşeni bulup gönderir (gizli alanlar dahil). Yönlendirme adresini döner
async function submit(path, pick, fields = {}) {
  const page = await get(path)
  const forms = page.html.match(/<form[\s\S]*?<\/form>/g) || []
  const form = forms.find((f) => f.includes(pick))
  assert.ok(form, `${path} sayfasında "${pick}" formu yok`)
  const data = new FormData()
  for (const [, name, value] of form.matchAll(/<input type="hidden" name="([^"]+)"(?: value="([^"]*)")?/g)) data.append(name, value ?? '')
  for (const [name, value] of Object.entries(fields)) data.set(name, value)
  const res = await fetch(B + path, { method: 'POST', body: data, headers: cookie ? { cookie } : {}, redirect: 'manual' })
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

test('kaynak ekleme', async () => {
  assert.match(await submit('/admin/kaynaklar', 'Kaynak ekle', { url: 'https://example.com/x' }), /kategori linki/)
  assert.match(await submit('/admin/kaynaklar', 'Kaynak ekle', { url: 'https://arxiv.org/list/cs.AI/recent' }), /Eklendi: cs.AI/)
  assert.match(await submit('/admin/kaynaklar', 'Kaynak ekle', { url: 'https://arxiv.org/list/cs.AI/recent' }), /zaten ekli/)
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
  assert.match((await get('/')).html, /Kediler Neden Çok Uyur/)
  const rss = await get('/rss.xml')
  assert.match(rss.html, /<link>https:\/\/blog\.example\.com\/yazi\/kediler-neden-cok-uyur<\/link>/)
  cookie = savedCookie

  const usage = (await get('/admin')).html
  assert.match(usage, /150/, 'token kullanımı sayılmalı')
})

test('yazıyı abonelere gönder (Künye)', async () => {
  const digestUrl = await submit(`/admin/yazilar/${postId}`, 'Abonelere gönder')
  const digestPath = digestUrl.match(/\/admin\/bultenler\/\d+/)[0]
  assert.match(await submit(digestPath, 'Abonelere gönder'), /planlandı/)
  assert.equal(kunyeRequests.length, 1)
  const sent = kunyeRequests[0]
  assert.equal(sent.auth, 'Bearer kunye-anahtari')
  assert.equal(sent.body.subject, 'Kediler Neden Çok Uyur?')
  assert.match(sent.body.message, /\(https:\/\/blog\.example\.com\/yazi\/kediler-neden-cok-uyur\)/)
  assert.ok(new Date(sent.body.sendAt).getTime() > Date.now(), 'gelecekte bir zamana planlanmalı')
  assert.match(await submit(digestPath, 'Sil'), /silindi/)

  // Yanlış anahtar: hata panelde görünür
  await submit('/admin/ayarlar', 'aiProvider', { ...SETTINGS, aiApiKey: '', kunyeToken: 'yanlis' })
  const second = await submit('/admin/bultenler', 'Son 7 günden')
  const secondPath = second.match(/\/admin\/bultenler\/\d+/)[0]
  assert.match(await submit(secondPath, 'Abonelere gönder'), /API anahtarı geçersiz/)
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
