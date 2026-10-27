# YunoHost Kurulumu

Uygulama YunoHost üzerinde Docker container olarak çalışır (Künye ile aynı düzen). Kurulum, güncelleme ve geri yükleme betikleri kodu bu reponun `main` dalından çeker (`scripts/_common.sh`).

**Gereksinimler:** YunoHost 11.3 veya üstü, derleme sırasında ~1 GB RAM, ~500 MB disk. Docker kurulumda otomatik kurulur.

## 1. Kurulum

```bash
# Domaini ekleyin (DNS kaydı sunucuyu göstermeli) ve SSL sertifikası alın
sudo yunohost domain add blog.rraeyz.me
sudo yunohost domain cert install blog.rraeyz.me

sudo yunohost app install https://github.com/rraeyz/blog_ynh \
  --args "domain=blog.rraeyz.me&path=/&init_main_permission=visitors"
```

Bittiğinde:

1. `https://blog.rraeyz.me/admin/giris` adresini açın, kurulumun sonunda gösterilen **kurulum anahtarını** girip şifrenizi belirleyin (anahtarı kaybederseniz: `sudo yunohost app setting blog setup_token`).
2. **Ayarlar:** yapay zekâ sağlayıcısı, model ve API anahtarı; Künye adresi ve Künye'de oluşturduğunuz API anahtarı (Künye → Ayarlar → Güvenlik).
3. **Kaynaklar:** `https://arxiv.org/list/cs.AI/recent` gibi bir kategori linki.
4. **Genel → Şimdi tara ve yazı üret** ile ilk yazıları deneyin. Başlangıç için ucuz bir model (ör. `claude-haiku-5-5`) ve "yalnızca özet" önerilir.

> Yol olarak `/` kullanın; alt yola kurulum desteklenmiyor.

## 2. Güncelleme

```bash
sudo yunohost app upgrade blog -u https://github.com/rraeyz/blog_ynh --force
```

Yeni imaj derlenirken eski sürüm çalışmaya devam eder. Açılışta veritabanı şeması otomatik güncellenir (`db-migrate.js`, değişiklikten önce yedek alır).

## 3. Yedekleme

```bash
sudo yunohost backup create --apps blog
sudo yunohost backup restore <yedek-adı> --apps blog
```

Ayrıca her gün otomatik veritabanı yedeği: `/home/yunohost.app/blog/backup/db-YYYYMMDD.db` (son 7 gün).

## Veriler nerede?

| Yol | İçerik |
|---|---|
| `/home/yunohost.app/blog/prisma/dev.db` | Veritabanı (ayarlar, kaynaklar, makaleler, yazılar, bültenler) |
| `/home/yunohost.app/blog/.env` | Kurulum anahtarı |
| `/home/yunohost.app/blog/backup/` | Günlük veritabanı yedekleri |
| `/opt/yunohost/blog/` | Uygulama kodu ve `docker-compose.yml` (güncellemede yeniden oluşturulur) |

## Sorun giderme

```bash
sudo docker logs --tail 100 blog
curl -s http://127.0.0.1:$(sudo yunohost app setting blog port)/api/health
cd /opt/yunohost/blog && sudo docker-compose restart
```

- **Şifremi unuttum:** şifreyi silip kurulum ekranını yeniden açın (yazılar ve ayarlar korunur), sonra `/admin/giris` adresinde kurulum anahtarıyla yeni şifre belirleyin:
  ```bash
  sudo docker exec blog node -e "new (require('better-sqlite3'))('/app/prisma/dev.db').exec(\"UPDATE Settings SET passwordHash=''\")"
  ```
- **Yazı üretilmiyor:** panelde Genel → İş günlüğü'ne ve Makaleler → Hata sekmesine bakın (API anahtarı, model adı, aylık token sınırı).
