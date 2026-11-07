# Laporanmu-Web — Catatan untuk Agent

## Dev server
- **Selalu gunakan `localhost:5174` untuk proyek ini.** Server dev sudah berjalan di port tersebut (dimiliki user).
- Jangan menjalankan `npm run dev` sendiri kecuali port 5174 mati dan user memintanya.
- Port 5173 & 5199 dipakai proyek Laporanmu **versi lama (V1)** — jangan tertukar.
- Verifikasi visual/fitur: arahkan browser ke `http://localhost:5174`.

## Konteks proyek
- React 19 + Vite + AntD v6 + Supabase + TanStack Query, tanpa Tailwind (inline style + `src/index.css`).
- Halaman publik: `/` (landing), `/check`, `/verify`, `/suspension/:token`, `/login` — shell bersama di `src/features/public/PublicShell.tsx`, kartu portal di `PortalSplitCard.tsx`.
- Semua copy UI berbahasa Indonesia.
