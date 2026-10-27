#!/bin/sh
set -e

# İlk kurulumda veritabanını şablondan oluştur (data_dir/prisma klasörü volume olarak bağlı)
if [ ! -f /app/prisma/dev.db ]; then
  echo "📦 İlk kurulum: veritabanı şablondan oluşturuluyor"
  cp /app/template.db /app/prisma/dev.db
fi

# Yeni sürümde şemaya eklenen tablo/kolonları mevcut veritabanına ekle (veri silinmez)
node /app/db-migrate.js /app/template.db /app/prisma/dev.db || echo "⚠️  Migration başarısız, mevcut şema ile devam ediliyor"

echo "🚀 Sunucu başlatılıyor"
exec node server.js
