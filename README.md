# Blog (Merak Radarı)

Bilim haberlerini ve makaleleri (RSS/arXiv) çeker, yapay zekâyla Türkçe anlatım yazar, sitede yayımlar ve [Künye](https://github.com/rraeyz/kunye_ynh)'deki abonelere haftalık bülten olarak gönderir.

## Nasıl çalışır

1. **Kaynaklar:** İstediğin kadar kaynak: herhangi bir sitenin RSS/Atom beslemesi ya da arXiv kategori/arşiv linki (`https://arxiv.org/list/astro-ph.EP/new`). Her gün ayarlanan saatte (Türkiye saati) yeni haberler çekilir; daha önce görülenler tekrar eklenmez.
2. **Seçim:** Model bekleyen haberlerin başlık ve özetine bakıp en önemlilerini seçer ve hepsine 1-10 **ön puan** verir (Makaleler → Bekliyor bu puana göre sıralı). İlgi alanları öncelik verir; "en az kaçı astronomi/uzay" ayarı kodla garanti edilir. Seçilmeyenler 3 gün boyunca sonraki seçimlere yeniden girer, sonra "Atlandı" olur; atlanan, hatalı ve silinen kayıtlar 30 gün sonra temizlenir.
3. **Yazı:** Model her haber için Türkçe bir yazı, konu (Uzay, Fizik, Teknoloji...) ve önem puanı üretir. Ana sayfada **Yeni gelişmeler** (en yeni 5), **Öne çıkanlar** (elle, en fazla 10; 8+ puanlılar önerilir), konu sekmeleri ve `/konu/...` sayfaları var.
4. **Görseller:** NASA, ESA, ESO, NOIRLab ve ALMA haberlerinde kaynağın serbest lisanslı görseli; diğerlerinde OpenRouter anahtarı girilmişse yapay zekâyla temsili kapak (WebP'ye küçültülür, "Temsili görsel" yazar).
5. **Eğitim (`/egitim`):** Müfredattaki ders serileri. Seçili günlerde sıradaki ders web'de araştırılarak (OpenRouter web araması) yazılır; en az 3 doğrulanmış kaynak şart, açılmayan linkler silinir, formüller KaTeX, kodlar renkli. Dersler **taslak** gelir, onaylayınca yayımlanır. Yapay zekâ konu seçmez: önce istekler, sonra müfredat sırası; müfredat bitince çakışmayan yeni seri önerir.
6. **Bülten:** Seçilen günde son 7 günün en önemli 7 yazısı (öne çıkanlar ve puan önce) ve o haftanın dersleri; Künye üzerinden blogun adıyla gönderilir. Önemli bir yazı "Abonelere gönder" ile hemen gönderilebilir.
7. **Abonelik kutusu:** Ana sayfada ve her yazının altında. Kayıt ve onay e-postası Künye'de; blogdan gelen aboneler bülten etiketiyle (boşsa "Blog") işaretlenir.
8. **Yedekleme:** Ayarlar → Yedekleme: tam yedek (API anahtarları dahil, şifre hariç; yapay zekâ kapakları hariç) indirilir ve geri yüklenir. YunoHost yedeği her şeyi içerir.

## Yapay zekâ

Claude (Anthropic), OpenAI, Google Gemini, DeepSeek, OpenRouter ya da OpenAI uyumlu herhangi bir adres (OpenCode, Ollama...). Ayarlar → Yapay zekâ.

Maliyet için: **Okuma ve bütçe** bölümünde yalnızca özet / tam metin, makale başına karakter sınırı ve aylık token sınırı var. Genel sayfasında bu ayki token kullanımı görünür; dene, karşılaştır, ayarla.

## Künye bağlantısı

1. Künye → Ayarlar → Güvenlik → **API anahtarı oluştur**.
2. Blog → Ayarlar → Künye: Künye'nin adresi (`https://rraeyz.me`) ve bu anahtar.
3. Blog sitesindeki "Haftalık bültene abone ol" linki Künye'ye gider.

## Geliştirme

```bash
npm install
cp .env.example .env
npx prisma db push
npm run dev            # http://localhost:3000/admin/giris → ilk kurulumda şifre belirlenir
npm test               # birim testleri
# uçtan uca (sahte yapay zekâ, OpenRouter ve Künye ile, token harcamaz):
npm run build
OPENROUTER_BASE_URL=http://127.0.0.1:3901/or/v1 BLOG_ALLOW_PRIVATE_URLS=1 npm start   # ayrı terminalde, boş veritabanıyla
BASE_URL=http://localhost:3000 node --test tests/e2e.test.mjs
```

Yığın Künye ile aynı: Next.js 14, Prisma 7 + SQLite (better-sqlite3).
