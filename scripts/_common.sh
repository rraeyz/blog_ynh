#!/bin/bash

#=================================================
# COMMON VARIABLES AND HELPERS
#=================================================

# Kaynak kodun çekildiği repo
source_repo="https://github.com/rraeyz/blog_ynh.git"
source_branch="main"

# Kaynak kodu GitHub'dan çekip install_dir'e kopyalar.
# install_dir'deki docker-compose.yml şablondan yeniden üretildiği için korunmaz.
fetch_app_source() {
    local tmp_dir
    [ -n "${install_dir:-}" ] || ynh_die --message="install_dir tanımlı değil"
    tmp_dir=$(mktemp -d)

    # --quiet: git ilerleme mesajlarını stderr'e yazar, YunoHost bunları "Warning" olarak gösteriyordu
    git clone --quiet --depth 1 --branch "$source_branch" "$source_repo" "$tmp_dir/src"
    rm -rf "$tmp_dir/src/.git"
    # Repodaki docker-compose.yml düz Docker kurulumu içindir; YunoHost kendi dosyasını conf/ şablonundan
    # üretir. Kopyalanırsa üretilen dosyanın üstüne yazıp "manually modified" uyarısına yol açıyordu.
    rm -f "$tmp_dir/src/docker-compose.yml"

    mkdir -p "$install_dir"
    # Eski dosyaları temizle (silinen dosyalar build'e karışmasın), sonra yenisini kopyala
    find "$install_dir" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
    cp -a "$tmp_dir/src/." "$install_dir/"

    rm -rf "$tmp_dir"
}

# Uygulama /api/health'e yanıt verene kadar bekler (en fazla ~3 dakika)
wait_for_app() {
    local i
    for i in $(seq 1 90); do
        if curl --silent --fail --max-time 3 "http://127.0.0.1:$port/api/health" > /dev/null; then
            return 0
        fi
        sleep 2
    done
    ynh_print_warn --message="Uygulama 3 dakika içinde yanıt vermedi. Logları kontrol edin: docker logs $app"
    return 0
}

# Günlük database yedeği (cron). Çalışan SQLite dosyası cp/cat ile değil, container içindeki
# db-backup.js (SQLite çevrimiçi yedekleme API'si) ile tutarlı şekilde kopyalanır.
# Yedekler $data_dir/backup altında, son 7 gün saklanır.
setup_backup_cron() {
    mkdir -p "$data_dir/backup"
    cat > "/etc/cron.daily/$app-backup" << EOF2
#!/bin/bash
set -e
stamp=\$(date +%Y%m%d)
docker exec $app node /app/db-backup.js /app/prisma/backups/db-\$stamp.db
mv -f "$data_dir/prisma/backups/db-\$stamp.db" "$data_dir/backup/db-\$stamp.db"
find "$data_dir/backup" -name "db-*.db" -mtime +7 -delete
EOF2
    chmod +x "/etc/cron.daily/$app-backup"
}

# YunoHost yedeği için database'in tutarlı anlık kopyasını $data_dir/prisma/backup-snapshot.db'ye alır.
# Container çalışmıyorsa (veya eski imajda db-backup.js yoksa) dosya doğrudan kopyalanır
# (container kapalıyken yazma olmadığı için bu güvenlidir).
snapshot_database() {
    local snapshot="$data_dir/prisma/backup-snapshot.db"
    rm -f "$snapshot"
    if docker exec "$app" node /app/db-backup.js /app/prisma/backup-snapshot.db 2>/dev/null; then
        return 0
    fi
    if [ -f "$data_dir/prisma/dev.db" ]; then
        cp "$data_dir/prisma/dev.db" "$snapshot"
    fi
}
