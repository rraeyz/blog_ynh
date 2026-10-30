// Yalnızca bağlantı yokken açılan sayfaya yedek gösterir. İçerik önbelleğe alınmaz: okur hep güncel haberi görür
const CACHE = 'cevrimdisi-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add('/cevrimdisi.html')))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return
  event.respondWith(fetch(event.request).catch(() => caches.match('/cevrimdisi.html')))
})
