#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */
// ============================================
// Basit otomatik migration
// ============================================
// Docker imajı build edilirken Prisma şemasından güncel bir template.db üretiliyor.
// Container her açıldığında bu script canlı veritabanını template ile karşılaştırır ve
// EKSİK olan tabloları, kolonları ve index'leri ekler. Veri silmez, kolon tipini değiştirmez.
// Böylece yeni sürümde şemaya eklenen alanlar mevcut kurulumlarda da otomatik oluşur.
//
// Kullanım: node db-migrate.js <template.db> <canlı.db>

const fs = require('fs')
const Database = require('better-sqlite3')

const [templatePath, livePath] = process.argv.slice(2)

if (!templatePath || !livePath) {
  console.error('Kullanım: node db-migrate.js <template.db> <live.db>')
  process.exit(1)
}

if (!fs.existsSync(templatePath) || !fs.existsSync(livePath)) {
  console.log('ℹ️  Migration atlandı: template veya database bulunamadı')
  process.exit(0)
}

const template = new Database(templatePath, { readonly: true })
const live = new Database(livePath)

const quote = (name) => `"${String(name).replace(/"/g, '""')}"`

const listObjects = (db, type) =>
  db
    .prepare("SELECT name, tbl_name, sql FROM sqlite_master WHERE type = ? AND sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'")
    .all(type)

const columnsOf = (db, table) => db.prepare(`PRAGMA table_info(${quote(table)})`).all()

// ALTER TABLE ADD COLUMN için kolon tanımı.
// SQLite, ADD COLUMN'da NOT NULL için sabit bir DEFAULT ister; CURRENT_TIMESTAMP gibi ifadelere izin vermez.
function columnDefinition(column) {
  const type = column.type || 'TEXT'
  const defaultValue = column.dflt_value
  const constantDefault = defaultValue !== null && !/CURRENT_|\(/i.test(defaultValue)

  if (column.notnull && constantDefault) {
    return `${quote(column.name)} ${type} NOT NULL DEFAULT ${defaultValue}`
  }
  if (constantDefault) {
    return `${quote(column.name)} ${type} DEFAULT ${defaultValue}`
  }
  if (column.notnull) {
    const fallback = /INT|REAL|NUM|BOOL|DEC|FLOAT|DOUBLE/i.test(type) ? '0' : /DATE|TIME/i.test(type) ? '0' : "''"
    return `${quote(column.name)} ${type} NOT NULL DEFAULT ${fallback}`
  }
  return `${quote(column.name)} ${type}`
}

const statements = []

const liveTables = new Set(listObjects(live, 'table').map((t) => t.name))
for (const table of listObjects(template, 'table')) {
  if (!liveTables.has(table.name)) {
    statements.push({ sql: table.sql, label: `tablo ${table.name}` })
    continue
  }
  const liveColumns = new Set(columnsOf(live, table.name).map((c) => c.name))
  for (const column of columnsOf(template, table.name)) {
    if (!liveColumns.has(column.name)) {
      statements.push({
        sql: `ALTER TABLE ${quote(table.name)} ADD COLUMN ${columnDefinition(column)}`,
        label: `kolon ${table.name}.${column.name}`,
      })
    }
  }
}

const liveIndexes = new Set(listObjects(live, 'index').map((i) => i.name))
for (const index of listObjects(template, 'index')) {
  if (!liveIndexes.has(index.name)) {
    statements.push({ sql: index.sql, label: `index ${index.name}` })
  }
}

if (statements.length === 0) {
  console.log('✅ Database şeması güncel')
  process.exit(0)
}

// Değişiklikten önce yedek al
const backupPath = `${livePath}.before-migrate-${new Date().toISOString().replace(/[:.]/g, '-')}`
live.close()
fs.copyFileSync(livePath, backupPath)
const db = new Database(livePath)

try {
  db.transaction(() => {
    for (const statement of statements) {
      console.log(`🔧 Ekleniyor: ${statement.label}`)
      db.exec(statement.sql)
    }
  })()
  console.log(`✅ Migration tamamlandı (${statements.length} değişiklik). Yedek: ${backupPath}`)
} catch (error) {
  console.error('❌ Migration başarısız, database değiştirilmedi:', error.message)
  process.exit(1)
} finally {
  db.close()
  template.close()
}
