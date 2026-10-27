import sharp from 'sharp'

// Görsel modelleri çoğunlukla 1-2 MB PNG döndürür; sayfada kart başına bu kadar indirilmesin diye
// en fazla 1600 px genişliğe küçültülüp WebP'ye çevrilir (~100-200 KB)
export async function compressImage(input: Buffer): Promise<Buffer> {
  return sharp(input).resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer()
}
