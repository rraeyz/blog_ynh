# Künye ile aynı düzen: derleme aşaması + yalnızca çalışma dosyalarını içeren küçük imaj
FROM node:22-alpine AS builder

WORKDIR /app

# better-sqlite3 native modülü için derleme araçları
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./
RUN npm ci

COPY . .

# Prisma Client + boş şablon veritabanı (ilk açılışta kopyalanır, güncellemelerde db-migrate.js ile karşılaştırılır)
ENV DATABASE_URL="file:/app/prisma/dev.db"
RUN npx prisma generate && \
    npx prisma db push && \
    cp /app/prisma/dev.db /app/template.db && \
    rm /app/prisma/dev.db

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

# tzdata: TZ=Europe/Istanbul (conf/docker-compose.yml) günlük iş saatini Türkiye saatine göre çalıştırsın
RUN apk add --no-cache dumb-init tzdata

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# Uygulama simgeleri, service worker, çevrimdışı sayfa (standalone çıktısı public'i kendisi kopyalamaz)
COPY --from=builder /app/public ./public
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/template.db ./template.db

# Bundle dışında tutulan çalışma bağımlılıkları (next.config.js serverComponentsExternalPackages)
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=builder /app/node_modules/bcryptjs ./node_modules/bcryptjs
# sharp: yapay zekâ kapaklarını WebP'ye çevirir (lib/compress.ts); @img altında Alpine/ARM için hazır derlenmiş libvips
COPY --from=builder /app/node_modules/sharp ./node_modules/sharp
COPY --from=builder /app/node_modules/@img ./node_modules/@img
COPY --from=builder /app/node_modules/detect-libc ./node_modules/detect-libc
COPY --from=builder /app/node_modules/semver ./node_modules/semver

COPY docker-entrypoint.sh db-migrate.js db-backup.js ./
RUN chmod +x ./docker-entrypoint.sh && mkdir -p /app/prisma

EXPOSE 3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["/app/docker-entrypoint.sh"]
