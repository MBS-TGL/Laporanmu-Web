// Kompres gambar via canvas → data URL base64 (target < 500 KB / foto).
// Sesuai batas RPC submit_suspension_task: maks 2 MB/foto setelah base64.

const TARGET_BYTES = 450 * 1024 // sedikit di bawah batas RPC

async function fileToImage(file: File): Promise<HTMLImageElement> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Gagal membaca file'))
    reader.readAsDataURL(file)
  })
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      img.src = dataUrl
      if (img.complete) resolve(img)
      else img.onload = () => resolve(img)
    }
    img.onerror = () => reject(new Error('Format gambar tidak didukung'))
    img.src = dataUrl
  })
}

function canvasToDataUrl(img: HTMLImageElement, maxSide: number, quality: number): string {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas tidak tersedia')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', quality)
}

function base64Bytes(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1] ?? ''
  return Math.round((base64.length * 3) / 4)
}

// Hasil: data URL "data:image/jpeg;base64,..." terkompres < 500 KB
export async function compressImage(file: File): Promise<string> {
  const img = await fileToImage(file)

  // turunkan kualitas → lalu dimensi jika masih besar
  for (const quality of [0.72, 0.6, 0.5, 0.4]) {
    for (const maxSide of [1600, 1280, 1024, 800]) {
      const dataUrl = canvasToDataUrl(img, maxSide, quality)
      if (base64Bytes(dataUrl) <= TARGET_BYTES) return dataUrl
    }
  }
  const fallback = canvasToDataUrl(img, 640, 0.35)
  if (base64Bytes(fallback) > TARGET_BYTES) {
    throw new Error('Foto terlalu besar untuk dikompres. Coba foto lain.')
  }
  return fallback
}
