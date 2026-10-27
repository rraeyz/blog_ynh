import { NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/auth'
import { createBackup, restoreBackup } from '@/lib/backup'

export const dynamic = 'force-dynamic'

const MAX_SIZE = 50 * 1024 * 1024

// GET: tam yedek indirilir
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const date = new Date().toISOString().slice(0, 10)
  return new NextResponse(JSON.stringify(await createBackup()), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="blog-yedek-${date}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}

// POST: Ayarlar sayfasındaki formdan yedek dosyası yüklenir, sonuç mesajıyla Ayarlar'a dönülür
export async function POST(request: NextRequest) {
  const back = (message: string) => NextResponse.redirect(new URL(`/admin/ayarlar?mesaj=${encodeURIComponent(message)}`, request.url), 303)
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // Başka siteden gönderilen form reddedilir (çerez zaten SameSite=Lax; ikinci kat)
  const origin = request.headers.get('origin')
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  if (origin && host && new URL(origin).host !== host) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const file = (await request.formData()).get('file')
    if (!(file instanceof File) || file.size === 0) return back('Yedek dosyası seç')
    if (file.size > MAX_SIZE) return back('Dosya çok büyük (en fazla 50 MB)')
    const counts = await restoreBackup(JSON.parse(await file.text()))
    return back(`Yedek yüklendi: ${counts.sources} kaynak, ${counts.papers} makale, ${counts.posts} yazı, ${counts.digests} bülten, ${counts.lessons} ders`)
  } catch (error) {
    return back(`Yüklenemedi: ${error instanceof SyntaxError ? 'dosya JSON değil' : String((error as Error).message || error).slice(0, 200)}`)
  }
}
