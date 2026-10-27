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
- Uçtan uca: `npm run build`, boş veritabanıyla `npm start`, sonra `BASE_URL=... node --test tests/e2e.test.mjs`
- Bulut oturumunda Node `fetch` proxy'yi kendiliğinden kullanmaz: sunucuyu `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt` ile başlat.

## Yapılacaklar
- YunoHost paketi (Künye'deki `manifest.toml`, `conf/`, `scripts/`, Dockerfile düzeni).
