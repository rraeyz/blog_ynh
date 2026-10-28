# Blog (Merak Radarı)

Bilim haberlerini ve makaleleri (RSS/arXiv) çeker, yapay zekâyla Türkçe anlatım yazar, sitede yayımlar ve [Künye](https://github.com/rraeyz/kunye_ynh)'deki abonelere haftalık bülten olarak gönderir.

## Nasıl çalışır

1. **Kaynaklar:** İstediğin kadar kaynak: herhangi bir sitenin RSS/Atom beslemesi ya da arXiv kategori/arşiv linki (`https://arxiv.org/list/astro-ph.EP/new`). Her gün ayarlanan saatte (Türkiye saati) yeni haberler çekilir; daha önce görülenler tekrar eklenmez.
2. **Ön puan ve seçim:** Model her yeni habere başlık, tarih ve temizlenmiş özetin ilk 500 karakterinden bir kez **ön puan** verir: yenilik, etki, kanıt gücü ve okur için anlam (her biri 1-5). Toplamı kod hesaplar (etki %35, kanıt %25, yenilik %20, anlam %20; 1,0-10,0, ör. 7,4). Haberler birbirine göre değil, sabit ölçeğe göre puanlanır; 14 günden eski haberin yeniliği en fazla 2. Son 7 günde yazılanların ve listede aynı gelişmeyi anlatanların tekrarı atlanır. Eşiği geçenler yazılır: günde en az ve en fazla sayı, istisna eşiği (en fazla sınırını aşar, en çok 15), uzay haberleri için en az, normal en fazla ve önemlilerle en fazla sayı Ayarlar → Haberler'de. Ön puanı 3,0 ve altı olanlar hemen "Atlandı" olur; sınır dolduğu için kalanlar 3 gün aynı puanla bekler. Atlanan, hatalı ve silinen kayıtlar 30 gün sonra temizlenir.
3. **Yazı:** Model her haber için Türkçe bir yazı, konu (Uzay, Fizik, Teknoloji...) ve tam metinden aynı dört ölçütle önem puanı üretir. Ana sayfada **Yeni gelişmeler** (en yeni 5), **Öne çıkanlar** (en fazla 10; önem puanı eşiği (varsayılan 7,5) geçenler yayımlanınca kendiliğinden girer; eşik ve otomatik öne çıkarma Ayarlar → Haberler'de), konu sekmeleri ve `/konu/...` sayfaları var.
4. **Görseller:** NASA, ESA, ESO, NOIRLab ve ALMA haberlerinde kaynağın serbest lisanslı görseli; diğerlerinde OpenRouter anahtarı girilmişse yapay zekâyla temsili kapak (WebP'ye küçültülür, "Temsili görsel" yazar).
5. **Eğitim (`/egitim`):** Konunun en temel noktasından uzman seviyesine götüren, uzunluk sınırı olmayan ders serileri; her dersin seviyesi (Temel, Orta, İleri, tek derslik konularda Temelden ileriye) görünür ve sayfada seviyeye göre süzülebilir. Aynı anda iki seri sırayla ilerler; her ders öğrettiklerini kaydeder, sonraki ders bunları bilinen sayar. Bir ders: gerekiyorsa ön bilgiler, tanım, tarihçe, mantık, matematik, kullanım (konu gerektiriyorsa kod), çözülmüş örnek, sık hatalar, çözümlü alıştırmalar. Seçili günlerde sıradaki ders üç aşamada hazırlanır: **araştırma** (OpenRouter web araması; en az 3 doğrulanmış kaynak şart), notlardan **yazım**, notlarla karşılaştırmalı **denetim**. Denetim ciddi sorun bulmazsa ders kendiliğinden yayımlanır (ayardan kapatılabilir), bulursa bulgularıyla taslak kalır. Dersler "Başlamadan önce" önkoşul dersleri gösterir. Konu sırası: önce istekler, sonra müfredat; müfredatta hep en az 2 sıradaki seri tutulur, azalınca yapay zekâ alan dengesine, seviyeye ve son haftaların önemli haberlerine bakarak yeni seri ekler.
6. **Gökyüzü takvimi (`/gokyuzu`):** Aylık takvim (ileri/geri gezilir): Ay evreleri, tutulmalar, meteor yağmurları, yakınlaşmalar, gezegenler simgeleriyle işaretli; tutulma ve kuyruklu yıldız gibi kaçırılmaması gerekenler ile meteor yağmurları büyük ve renkli, ayın öne çıkanları takvimin üstünde, altında nasıl gözleneceği. Haftada bir önümüzdeki 5 hafta web'de araştırılır (kaynaklı); geçmiş aylar kalır. Ana sayfada bu haftanın olayları, bültende kısa bölüm.
7. **Arama (`/ara`):** Yazılarda ve derslerde; Türkçe harf duyarsız ("gokyuzu" = "Gökyüzü").
8. **Bülten:** Seçilen günde son 7 günün en önemli 7 yazısı (öne çıkanlar ve puan önce), o haftanın dersleri ve gökyüzü; Künye üzerinden blogun adıyla gönderilir. İsteğe bağlı ikinci bülten **Haftanın astronomi özeti**: yalnızca uzay ve fizik yazıları, dersler ve gökyüzü (ör. pazar, pazartesi dersinden önce). Aynı özet sitede de var (`/astronomi-ozeti`, her hafta için ayrı sayfa, arşivli; ek maliyeti yok). Önemli bir yazı "Abonelere gönder" ile hemen gönderilebilir.
9. **Abonelik kutusu:** Ana sayfada ve her yazının altında. Kayıt ve onay e-postası Künye'de; blogdan gelen aboneler bülten etiketiyle (boşsa "Blog") işaretlenir.
10. **Yedekleme:** Ayarlar → Yedek ve şifre: tam yedek (API anahtarları ve yapay zekâ kapakları dahil, şifre hariç; en fazla 200 MB) indirilir ve geri yüklenir. YunoHost yedeği her şeyi içerir.

## Maliyet (OpenRouter)

| İş | Sıklık | Yaklaşık |
|---|---|---|
| Haber yazıları (ör. Claude Haiku) | günde 5 | ayda 1-2 $ |
| Ders: yazım Sonnet, araştırma/plan/denetim Haiku (varsayılan) | haftada 2 | ders başına ~0,4-0,6 $ (hepsi Sonnet: ~1,0-1,5 $; hepsi Haiku: ~0,1-0,2 $) |
| Gökyüzü takvimi (yardımcı model) | haftada 1 | ~0,02 $ |
| Kapak görseli | serbest görseli olmayan yazı başına | 0,01 $ |

## Yapay zekâ

Claude (Anthropic), OpenAI, Google Gemini, DeepSeek, OpenRouter ya da OpenAI uyumlu herhangi bir adres (OpenCode, Ollama...). Ayarlar → Yapay zekâ.

Haberleri yazan model Ayarlar → Yapay zekâ'da. Dersler, gökyüzü takvimi ve kapaklar aynı sekmedeki OpenRouter anahtarını kullanır (ders modeli Ayarlar → Eğitim'de). Maliyet için: Ayarlar → Haberler'de yalnızca özet / tam metin ve haber başına karakter sınırı, Yapay zekâ'da aylık token sınırı var. Genel sayfasında bu ayki token kullanımı görünür; dene, karşılaştır, ayarla.

## Künye bağlantısı

1. Künye → Ayarlar → Güvenlik → **API anahtarı oluştur**.
2. Blog → Ayarlar → Bülten: Künye'nin adresi (`https://rraeyz.me`) ve bu anahtar.
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
