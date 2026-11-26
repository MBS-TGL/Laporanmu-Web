import { RAPORT_AR_FONT, RAPORT_SANS, RAPORT_SERIF } from './fonts'

const FONT_LINKS = [
  '<link rel="preconnect" href="https://fonts.googleapis.com">',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  '<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400..800&family=Amiri:wght@400;700&display=block" rel="stylesheet">',
].join('\n')

const pageSizeOf = (pageSize: 'a4' | 'f4') =>
  pageSize === 'f4' ? { w: '215mm', h: '330mm', at: '215mm 330mm' } : { w: '210mm', h: '297mm', at: 'A4' }

const padOf = (pageSize: 'a4' | 'f4') =>
  pageSize === 'f4' ? '8mm 10mm 2mm 20mm' : '4mm 10mm 2mm 20mm'

/**
 * CSS dasar dokumen cetak — terpisah dari CSS aplikasi supaya aturan `@page`
 * global app (A4 + margin 10mm) tidak ikut menimpa ukuran kertas raport.
 */
export function printBaseCss(pageSize: 'a4' | 'f4'): string {
  const page = pageSizeOf(pageSize)
  return `
    *, *::before, *::after { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
      font-family: ${RAPORT_SERIF};
      font-size: 11pt;
      line-height: 1.4;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    img { max-width: 100%; height: auto; }
    table { border-collapse: collapse; }
    .raport-card {
      position: relative;
      background: #fff !important;
      color: #000 !important;
      font-family: ${RAPORT_SERIF} !important;
      font-size: 11pt !important;
      line-height: 1.4 !important;
      width: ${page.w} !important;
      min-width: ${page.w} !important;
      height: ${page.h} !important;
      min-height: ${page.h} !important;
      margin: 0 !important;
      padding: ${padOf(pageSize)} !important;
      box-sizing: border-box !important;
      box-shadow: none !important;
      display: flex !important;
      flex-direction: column !important;
      page-break-after: always;
      break-after: page;
    }
    .raport-card:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    .raport-card-body { flex: 1 1 auto; min-height: 0; }
    .raport-card-footer { flex-shrink: 0; margin-top: auto; }
    .raport-print-metadata { font-family: ${RAPORT_SANS} !important; }
    .school-name-ar, .school-subtitle-ar, [dir="rtl"] {
      font-family: ${RAPORT_AR_FONT} !important;
      letter-spacing: normal !important;
    }
    .raport-signature-row {
      display: flex !important;
      flex-direction: row !important;
      justify-content: space-between !important;
      gap: 10px !important;
    }
    @page { size: ${page.at}; margin: 0; }
    @media print {
      html, body { width: ${page.w}; height: ${page.h}; }
      .raport-card { box-shadow: none !important; border: none !important; }
    }
  `
}

/** Path gambar relatif ("/logos/...") harus absolut agar tetap termuat di jendela cetak. */
function absolutizeAssets(html: string): string {
  return html.replace(/(src|href)="\/(?!\/)/g, `$1="${window.location.origin}/`)
}

export function buildPrintDocument(args: {
  cardsHtml: string
  pageSize: 'a4' | 'f4'
  title: string
}): string {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>${args.title}</title>
  ${FONT_LINKS}
  <style>${printBaseCss(args.pageSize)}</style>
</head>
<body>${absolutizeAssets(args.cardsHtml)}</body>
</html>`
}

/** Cetak lewat jendela mandiri (pola v1): preview dan hasil cetak memakai CSS yang sama. */
export function printCards(args: {
  cardsHtml: string
  pageSize: 'a4' | 'f4'
  title: string
}): boolean {
  const win = window.open('', '_blank')
  if (!win) return false
  win.document.write(buildPrintDocument(args))
  win.document.close()
  win.focus()
  const run = () => {
    win.print()
  }
  if (win.document.fonts?.ready) {
    win.document.fonts.ready
      .then(async () => {
        try {
          if (win.document.fonts.load) {
            await Promise.all([
              win.document.fonts.load('400 16px Amiri'),
              win.document.fonts.load('700 16px Amiri'),
            ])
          }
        } catch {
          // Abaikan bila load font spesifik gagal, lanjut print buffer
        }
        window.setTimeout(run, 400)
      })
      .catch(() => window.setTimeout(run, 600))
  } else {
    window.setTimeout(run, 600)
  }
  return true
}
