import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Docker healthcheck ve YunoHost betikleri için: veri döndürmez, sadece uygulama + database ayakta mı
export async function GET() {
  try {
    await prisma.settings.count()
    return NextResponse.json({ status: 'ok' })
  } catch {
    return NextResponse.json({ status: 'error' }, { status: 503 })
  }
}
