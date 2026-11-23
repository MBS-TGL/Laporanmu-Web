/** Font stacks used across preview, print, and PDF — web fonts first for cross-platform parity. */
export const RAPORT_SERIF = "'Times New Roman', Times, serif"
export const RAPORT_AR_FONT = "'Amiri', 'Arial Unicode MS', serif"
export const RAPORT_SANS = "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif"

/** Google Fonts loaded for raport (preview, print window, Browserless PDF). */
export const RAPORT_FONT_LINKS = [
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400..800&family=Amiri:wght@400;700&display=block',
].map((href) => `<link rel="preconnect" href="https://fonts.googleapis.com">
   <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
   <link href="${href}" rel="stylesheet">`).join('\n')

/** Preload raport fonts in the current document before PDF capture. */
export const preloadRaportFonts = async () => {
  if (!document.fonts?.load) return
  try {
    await Promise.all([
      document.fonts.load('400 16px "Times New Roman"'),
      document.fonts.load('700 16px "Times New Roman"'),
      document.fonts.load('400 16px Amiri'),
      document.fonts.load('700 16px Amiri'),
      document.fonts.load('400 16px "Plus Jakarta Sans"'),
      document.fonts.load('700 16px "Plus Jakarta Sans"'),
    ])
    await document.fonts.ready
  } catch (e) {
    console.warn('[Raport] Font preload warning:', e)
  }
}
