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
- `/egitim`: seriler ve sıralı dersler (`lib/lessons.ts`). Yapay zekâ konu seçmez: istekler, sonra müfredat sırası; seri sırası gelince derslere bölünür, müfredat bitince yeni seri önerilir.
- Seviyeler (`lib/levels.ts`): her seri konunun en temel noktasından başlar, dersler ilerledikçe yükselir (temel → orta → ileri, düşmez); tek derslik konu ve istekler "kapsamli" (tek derste temelden ileriye). Okur seviyeyi her yerde görür, `/egitim?seviye=` ile süzer.
- Süreklilik: her ders "Öğretilenler" satırını `covers`'a yazar; serinin sonraki dersi bunları "okurun bildikleri"nde alır. Bilinmeyen araçlar "Ön bilgiler"de öğretilir, denetim anlaşılırlığı da sınar.
- Sıra (`nextLesson`): önce istekler, sonra aynı anda yürüyen `ACTIVE`=2 seriden son dersi en eski yazılanınki.
- Ders üç aşama (`writeLesson`): araştırma (OpenRouter `openrouter:web_search`; en az 3 doğrulanmış kaynak şart) → yalnızca notlardan yazım → notlarla karşılaştırmalı denetim (JSON bulgular). Ciddi bulgu yoksa ve `lessonAutoPublish` açıksa yayımlanır, yoksa taslak + `review`. Açılmayan linkler metne döner.
- Müfredat: `ensureRoadmap` hep en az 2 bölünmemiş seri tutar; azalınca yapay zekâ alan (TRACKS), seviye ve son 30 günün önemli uzay/fizik haberlerine bakarak seri önerir.
- Formül ($...$, $$...$$) ve `:::cozum` blokları yalnızca derslerde açılır (`renderMarkdown(body, { math: true })`): haberlerde $ para birimi olabilir.

## Diğer
- Gökyüzü takvimi (`lib/sky.ts`): haftada bir (bülten gününde) önümüzdeki 35 gün araştırılır, `SkyEvent` tablosunda o aralık yenilenir; geçmiş aylar kalır. `/gokyuzu?ay=YYYY-MM` aylık takvim, türler, simgeler ve önem derecesi (`rank`: 3 kaçırma, 2 öne çıkan) `lib/skyKinds.ts`.
- Haftalık astronomi özeti sitede (`/astronomi-ozeti`, `lib/weekly.ts`): kaydedilmez, pazartesi–pazar haftası için veriden kurulur; e-postadaki özet o haftanın sayfasına bağlanır.
- Arama (`/ara`): yayımlananlar bellekte taranır (`searchScore`); büyürse FTS5.
- Ayarlar sekmeli; `saveSettingsAction` yalnızca `SETTINGS_SECTIONS[section]` alanlarını yazar. Yeni ayar: şema + bölüm listesi + `parse` + `backup.ts` FIELDS.

## Yapılacaklar (kullanıcı onayladı, sonraya)
- Next.js 16'ya geçiş (iki repo): Next 14'teki DoS açıkları ancak böyle kapanır; büyük kırıcı değişiklikler (async params/cookies, middleware → proxy), ayrı dalda ve tam testle.
- Ders görselleri/diyagramlar: maliyetli; ör. matplotlib/SVG üretimi ya da görsel modeli, derslerde şekil.
