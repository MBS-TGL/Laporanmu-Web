// Service worker Laporanmu — offline shell ringan.
// Strategi: navigasi & static asset same-origin → cache-first untuk file
// build ber-hash (/assets/), network-first untuk navigasi (fallback cache),
// SKIP semua request Supabase & cross-origin (data selalu segar saat online).
const CACHE = 'laporanmu-v1'
const ASSET_CACHE = 'laporanmu-assets-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE && k !== ASSET_CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  // Jangan sentuh API/Supabase — data portal harus selalu segar saat online
  if (url.origin !== self.location.origin) return

  // File build ber-hash: cache-first (ubah nama → cache key baru otomatis)
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      (async () => {
        const cached = await caches.open(ASSET_CACHE).then((c) => c.match(req))
        if (cached) return cached
        const res = await fetch(req)
        if (res.ok) await caches.open(ASSET_CACHE).then((c) => c.put(req, res.clone()))
        return res
      })(),
    )
    return
  }

  // Navigasi & ikon: network-first, fallback cache (halaman terakhir yang sukses)
  if (req.mode === 'navigate' || url.pathname === '/logo-icon.png' || url.pathname === '/favicon.png') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req)
          if (res.ok) await caches.open(CACHE).then((c) => c.put(req, res.clone()))
          return res
        } catch {
          const cached = await caches.open(CACHE).then((c) => c.match(req))
          if (cached) return cached
          throw new Error('Offline dan belum ada salinan halaman ini')
        }
      })(),
    )
  }
})
