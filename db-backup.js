#!/usr/bin/env node
// ============================================
// Tutarlı database yedeği
// ============================================
// Çalışan bir SQLite dosyasını cp/cat ile kopyalamak, o anda yazma yapılıyorsa bozuk yedek
// üretebilir. SQLite'ın çevrimiçi yedekleme API'si uygulama çalışırken de tutarlı kopya alır.
//
// Kullanım: node db-backup.js <hedef.db> [kaynak.db]

const fs = require('fs')
const path = require('path')
const Database = require('better-sqlite3')

const target = process.argv[2]
const source = process.argv[3] || '/app/prisma/dev.db'

if (!target) {
  console.error('Kullanım: node db-backup.js <hedef.db> [kaynak.db]')
  process.exit(1)
}

if (!fs.existsSync(source)) {
  console.error(`Kaynak database bulunamadı: ${source}`)
  process.exit(1)
}

fs.mkdirSync(path.dirname(target), { recursive: true })
const tmp = `${target}.tmp`

const db = new Database(source, { readonly: true, fileMustExist: true })
db.backup(tmp)
  .then(() => {
    db.close()
    // Yedeğin sağlam olduğunu doğrula, sonra yerine taşı (yarım dosya hiç oluşmaz)
    const check = new Database(tmp, { readonly: true })
    const result = check.pragma('integrity_check', { simple: true })
    check.close()
    if (result !== 'ok') throw new Error(`integrity_check: ${result}`)
    fs.renameSync(tmp, target)
    console.log(`✅ Yedek alındı: ${target}`)
    // Admin panelindeki "Site durumu" kartı son yedeğin zamanını buradan okur.
    // Yazılamasa da yedek geçerlidir; bu yüzden hata yutulur.
    try {
      fs.writeFileSync(path.join(path.dirname(source), '.last-backup'), JSON.stringify({ at: new Date().toISOString() }))
    } catch {}
  })
  .catch((error) => {
    try { fs.unlinkSync(tmp) } catch {}
    console.error('❌ Yedekleme başarısız:', error.message)
    process.exit(1)
  })
