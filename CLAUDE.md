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
- Dersler OpenRouter'da `openrouter:web_search` aracıyla araştırılarak yazılır; en az 3 doğrulanmış kaynak şart, açılmayan linkler metne döner. Dersler taslak gelir, yönetici yayımlar.
- Formül ($...$, $$...$$) yalnızca derslerde açılır (`renderMarkdown(body, { math: true })`): haberlerde $ para birimi olabilir.
