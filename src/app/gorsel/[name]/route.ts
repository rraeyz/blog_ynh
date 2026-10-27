import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { IMAGE_DIR, IMAGE_NAME } from '@/lib/images'

const TYPES: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

// Yapay zekâ kapakları; dosya adı değişince yeni adres olur, o yüzden uzun önbellek
export async function GET(_request: Request, { params }: { params: { name: string } }) {
  if (!IMAGE_NAME.test(params.name)) return new Response('Bulunamadı', { status: 404 })
  try {
    const file = await readFile(path.join(IMAGE_DIR, params.name))
    return new Response(file, { headers: { 'Content-Type': TYPES[params.name.split('.').pop()!], 'Cache-Control': 'public, max-age=31536000, immutable' } })
  } catch {
    return new Response('Bulunamadı', { status: 404 })
  }
}
