-- ============================================================
-- Patch Ibadah (2026-11-16): ganti label flag 'Modul Kerohanian'
-- → 'Modul Ibadah' (umpan balik user: istilah Kerohanian kurang
-- cocok). Route/flag/kode tetap /worship & module.spiritual.
-- ============================================================

update public.feature_flags
set label = 'Modul Ibadah',
    description = 'Kemahiran ibadah (wudhu, sholat, hafalan hadist & doa) + nilai bulanan per butir'
where key = 'module.spiritual';
