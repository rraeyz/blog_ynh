# Blog (makale notları)

arXiv'den ya da verdiğin linklerden makaleleri çeker, yapay zekâyla Türkçe anlatım yazar, sitede yayımlar ve [Künye](https://github.com/rraeyz/kunye_ynh)'deki abonelere haftalık bülten olarak gönderir.

## Nasıl çalışır

1. **Kaynaklar:** arXiv kategori linki eklersin (`https://arxiv.org/list/cs.AI/recent`, birden fazla için `cs.AI+cs.LG`). Her gün ayarlanan saatte yeni makaleler çekilir.
2. **Seçim:** İlgi alanı yazdıysan model başlıklardan en uygun olanları seçer; yazmadıysan en yeniler alınır. Seçilmeyenler "Atlandı" olur.
3. **Yazı:** Model her makale için Türkçe bir yazı hazırlar (giriş, Ne yaptılar?, Neden önemli?, Sınırlamalar). Varsayılan olarak **taslak** bekler; Ayarlar'dan onaysız yayına alınabilir.
4. **Tek makale:** Makaleler sayfasından arXiv makale linki ya da herhangi bir sayfa linki ekleyip "Yazıya dönüştür" denebilir.
5. **Bülten:** Seçilen günde son 7 günün yazılarından bülten taslağı hazırlanır; Ayarlar'dan onaysız gönderime alınabilir. Önemli bir yazı haftayı beklemeden yazının sayfasındaki "Abonelere gönder" ile gönderilir.
6. **Gönderim Künye'den:** Abone listesi ve e-posta (SMTP) Künye'de kalır. Blog, Künye'nin API anahtarıyla bülteni Künye'ye planlar; Künye iki dakika içinde abonelere yollar.

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
# uçtan uca (sahte yapay zekâ ve sahte Künye ile, token harcamaz):
npm run build && npm start   # ayrı terminalde, boş veritabanıyla
BASE_URL=http://localhost:3000 node --test tests/e2e.test.mjs
```

Yığın Künye ile aynı: Next.js 14, Prisma 7 + SQLite (better-sqlite3).
