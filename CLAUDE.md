# Proje notları

Kardeş proje: `rraeyz/kunye_ynh` (link sayfası + abone listesi + SMTP). Bu uygulama abone tutmaz, e-posta göndermez; bültenleri Künye'nin `POST /api/admin/scheduled-newsletters` ucuna `Authorization: Bearer <Künye API anahtarı>` ile planlar (`src/lib/newsletter.ts`).

## Kurallar
- Arayüz metinleri ve yorumlar Türkçe. Yorum yalnızca kodun gösteremediği "neden" için.
- En küçük çalışan değişiklik; istenmeyen seçenek/soyutlama ekleme. Künye'deki kalıpları kopyala (yapı, Prisma 7 + better-sqlite3 adaptörü, instrumentation ile zamanlanmış işler).
- Yapay zekâ çıktısı güvenilmez veridir: sayfaya yalnızca `src/lib/markdown.ts` ile (önce HTML kaçışlanır) basılır.
- Claude çağrıları resmi SDK (`@anthropic-ai/sdk`) ile; diğer sağlayıcılar OpenAI uyumlu `/chat/completions` (`src/lib/ai.ts`).
- Uzun işler (yapay zekâ) panel isteğinde beklenmez: `runExclusive` ile arka planda, sonuç `job.log` günlüğüne.
- Formlar sunucu eylemleri (`src/app/admin/actions.ts`); her eylem `requireAdmin()` ile başlar.

## Doğrulama
- `npx tsc --noEmit && npx next lint && npm test`
- Uçtan uca: `npm run build`, boş veritabanıyla `OPENROUTER_BASE_URL=http://127.0.0.1:3901/or/v1 BLOG_ALLOW_PRIVATE_URLS=1 npm start` (sahte yapay zekâ/OpenRouter/Künye sunucusu 127.0.0.1:3901'de; iç ağ adresleri normalde `lib/net.ts` ile engellenir), sonra `BASE_URL=... node --test tests/e2e.test.mjs`
- Bulut oturumunda Node `fetch` proxy'yi kendiliğinden kullanmaz: sunucuyu `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt` ile başlat.

## Eğitim bölümü
- Müfredat `lib/curriculum.ts`te (ders kitabına/üniversite programına bağlı değil): dört hat (uygulama, astronomi, temel bilim, kavram); seri = konu, aşamaları (Temel → Orta → İleri) bloktur (`Stage`). Katalog veritabanına yalnızca eklenir (`seedCurriculum`): anahtarlar (`fotometri/orta`, `kavram/nyquist-piksel-olcegi`) kalıcıdır, değiştirme ve silme; yeni konu yeni anahtar. Sıra panelden (blok sayfası) değişir.
- Sıra (`nextLesson`, saf kısmı `nextTracks` + `pickStage`): önce istekler (Tek Dersler); sonra uygulama ilk turda (`FIRST_ROUND`) her 2 dersten biri, sonra her 4 dersten biri; kalanlar Astronomi → Temel → Astronomi → Temel → Kavram. Haftaya değil ders sayısına bağlı (`writtenAt`). Hat bloklarını sırayla işler, yarım blok önce biter; blok sırası gelince araştırılıp derslere bölünür (`planStage`; kavram tek ders, yapay zekâsız).
- Önkoşul (`requirementsOf`): serinin önceki aşaması + seviye tanımı (astronomi/temel bilimde orta → `degisim/orta`, ileri → `dalgalar/orta`) + `REQUIRES`. Önkoşulu bitmemiş blok atlanır, önce onu bekleten zincirin başındaki hazır blok yazılır. Atlanan blok (planned, dersi yok) bitmiş sayılır.
- Seviyeler matematikle tanımlı (`lib/levels.ts`, `LEVEL_GUIDE`): temel lise matematiği, orta türev/integral, ileri Fourier/KTD/kuantum/çıkarım; kavram ve istekler "kapsamli". Denetim iki yönlü (fazla zor / sulandırılmış).
- Süreklilik: her ders "Öğretilenler"i `covers`'a yazar; sonraki dersler serinin önceki dersleri ve bloğun başka serilerdeki önkoşullarının `covers`'ını "okurun bildikleri"nde alır.
- Ders yapısı: "Bu dersten aklında kalacaklar", kutular `:::bilmen`, `:::hesap`, `:::merak` (ezber gerekmez), `:::cozum`; sonda "Bağlantılı kavramlar". Kutular ve formül yalnızca derslerde açılır (`renderMarkdown(body, { math: true, links })`): haberlerde $ para birimi olabilir. Anlam metinde, görünüş CSS'te: tasarım değişince ders yeniden yazılmaz.
- Dersler arası bağlantı adresle değil anahtarla: `[[anahtar|metin]]`, sayfada `lessonLinks()` ile çözülür (yayımlanmamışsa "(ileride)"); önkoşullar da anahtar (`Lesson.prerequisites`). Yazara `BAĞLANTI LİSTESİ`, `TERMS` (sabit Türkçe terimler) ve `NOTATION` verilir; denetim terimleri de görür.
- Modeller: yazım `lessonModel` (Sonnet), araştırma, plan, denetim, kavram önerisi ve gökyüzü `lessonHelperModel` (Haiku); maliyetin çoğu araştırmanın okuduğu sayfalardan gelir.
- Ders üç aşama (`writeLesson`): araştırma (OpenRouter `openrouter:web_search`; en az 3 doğrulanmış kaynak şart) → yalnızca notlardan yazım → notlarla karşılaştırmalı denetim. Model yanıtları (plan, denetim, kavram önerisi, gökyüzü) JSON değil "|" ile ayrılmış satırlar (`parsePlan` "DERS |", `parseIssues`, `parseConcepts` "KAVRAM |", `parseSkyEvents`): bir tırnak bütün yanıtı bozmasın; okunamayan denetim yayımlatmaz. Ciddi bulgu yoksa ve `lessonAutoPublish` açıksa yayımlanır, yoksa taslak + `review`. Açılmayan linkler metne döner.
- "Haberin arkasındaki bilim": haftada bir (ders gününde) önemli uzay/fizik haberlerinde geçen, listede olmayan kavramlar onaysız blok olarak önerilir (`approved` false); panelde onaylanınca kavram sırasının başına geçer.
- Site: `/egitim` hatlara göre seriler, Kavramlar A–Z (`/egitim/kavramlar`), istenen dersler; seri sayfası aşamalara göre, bölünmemiş aşama yol haritası olarak.

## Diğer
- Gökyüzü takvimi (`lib/sky.ts`): haftada bir (bülten gününde) önümüzdeki 35 gün araştırılır, `SkyEvent` tablosunda o aralık yenilenir; geçmiş aylar kalır. `/gokyuzu?ay=YYYY-MM` aylık takvim, türler, simgeler ve önem derecesi (`rank`: 3 kaçırma, 2 öne çıkan) `lib/skyKinds.ts`.
- Haftalık astronomi özeti sitede (`/astronomi-ozeti`, `lib/weekly.ts`): kaydedilmez, pazartesi–pazar haftası için veriden kurulur; e-postadaki özet o haftanın sayfasına bağlanır.
- Haber puanları (`writer.ts`, `text.ts`): ön puan (başlık + tarih + `cleanSummary` ile temizlenmiş özetin 500 karakteri, yalnızca seçim) ve önem puanı (yazmadan önce tam metinden, aynı istemle; `featureScore` ve üstü öne çıkar) aynı dört ölçütle (yenilik, etki, kanıt, anlam; 1-5) verilir, toplamı kod hesaplar (`weightedScore`). Mutlak: haberler birbirine göre puanlanmaz. Ölçütler sonuç odaklı; iki istisna: büyük tesis/görev projeleri (teleskop, gözlemevi, görev, hızlandırıcı) kilometre taşında (onay, bütçe, ilk ışık, fırlatma) ve gerçekleşince katacağına göre puanlanır ("henüz sonuç yok" sınırı yalnızca laboratuvar düzeneğine); Türkiye'deki bilim ve uzay gelişmeleri okur için anlamda en az 4 (okur Türkiye'de). Onda bir tam sayı saklanır (74 = 7,4; `formatScore`). Her haber bir kez puanlanır (`score` 0 = puansız), ön puan satır satır (`parseScores`); seçim kodda (`pickDaily`: eşik, en az/en fazla, istisna, uzay sınırları). Tekrarlar: son 7 günde yazılanların başlıkları ön puana (yalnızca kendi 100'lük grubundaki tekrarı görür) ve günlük işte yazmadan önceki tam metin puanına (o gün yazılanlar dahil) gider; tekrar olan yazılmaz, yerine sıradaki. Tam metin puanı çıtanın (eşik; "en az"ı tamamlayan haberde kendi ön puanı) 0,5 altındaysa bir kez daha puanlanıp ortalanır, yine altındaysa yazılmaz (`LowScore`) ve seçim onsuz yeniden yapılır (günde en fazla `fullTextReplace`). Ters yön: yer kaldıysa eşiğin 1,0 altına kadar olanların tam metnine bakılır, eşiği geçen yazılır (günde en fazla `fullTextPromote`; kotalar için aday eşikte sayılır).
- Konular (`lib/topics.ts` CATEGORIES): yazar seçer, `categoryOf` anahtar/etiketi harf farkı gözetmeden tanır, tanımazsa "bilim" (yazı konusuz kalmaz). Biyoloji (canlılar, hayvan davranışı, evrim) Sağlık'tan (tıp) ayrı.
- Arama (`/ara`, `lib/search.ts`): SQLite FTS5 dizini (Prisma şemasında yok, ilk aramada kurulur); yayımlananların sayısı ya da son güncellemesi değişince baştan kurulur. Metin `foldText` ile katlanır, sorgu `ftsQuery` (kelime başı); bütün kelimeleri başlığında geçenler önce. Üstteki kutu (`SearchBox`) yazdıkça `/api/ara`dan öneri gösterir, Enter `/ara?q=`ye gider.
- Panel listeleri (Makaleler, Yazılar) 100'lük sayfalar (`admin/Pager.tsx`); listedeki düğmeler `BackTo` ile bulunduğu adresi gönderir, eylem `returnTo` ile oraya döner (yalnızca panel liste adresleri kabul edilir).
- Tema (`app/ThemeToggle.tsx`, site ve panel sağ üst): Otomatik (cihaza göre, varsayılan) → Açık → Koyu; seçim localStorage `tema`, `<html class="light|dark">`. Tailwind `darkMode` iki seçicili: cihaz koyu ve `.light` yok ya da `.dark` var; Otomatik JavaScript'siz çalışır, seçimi layout.tsx'teki betik boyamadan önce uygular. Elle yazılan koyu CSS de aynı iki koşulu kullanmalı (globals.css).
- Ayarlar sekmeli; `saveSettingsAction` yalnızca `SETTINGS_SECTIONS[section]` alanlarını yazar. Yeni ayar: şema + bölüm listesi + `parse` + `backup.ts` FIELDS.

## Yapılacaklar (kullanıcı onayladı, sonraya)
- Next.js 16'ya geçiş (iki repo): Next 14'teki DoS açıkları ancak böyle kapanır; büyük kırıcı değişiklikler (async params/cookies, middleware → proxy), ayrı dalda ve tam testle.
- Ders görselleri/diyagramlar: maliyetli; ör. matplotlib/SVG üretimi ya da görsel modeli, derslerde şekil.
