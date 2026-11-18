-- ============================================================
-- Patch Thaharah Tarjih (2026-11-17): rinci butir thaharah
-- kelas 9-12 ke butir konkret Tuntunan Thaharah Majelis Tarjih
-- PWM DIY + HPT (Opsi C, konten disetujui user).
--
-- 1. Soft-delete 4 label generik lama kelas 9-12:
--    'Praktek Thaharah Sempurna', 'Fiqih Thaharah & Evaluasi
--    Wudhu', 'Thaharah & Mandi Wajib', 'Evaluasi Akhir Praktek
--    Thaharah Mandiri'. Mastery lama ikut tersembunyi (disetujui
--    user, pola sama dgn 'Hadist arbain 1-5').
-- 2. Insert 9 butir baru berpenanda (Kls 9) s.d. (Kls 12):
--    kelas 9 = praktek mandi wajib, kelas 10 = fiqih (air,
--    najis, hadats), kelas 11 = tayammum + kewajiban mandi,
--    kelas 12 = evaluasi akhir integratif. sort_order 120-200
--    menyambung setelah butir wudhu kelas 7 (10-110, hasil
--    patch-wudhu-tarjih-20261117.sql; tanpa patch itu pun 120+
--    tetap aman dari 10-90).
--
-- Catatan: label lama WAJIB tetap dihapus dari preset kode agar
-- "Muat Preset" tidak meng-insert ulang butir yang di-soft-delete
-- (dedupe hanya cocok baris aktif). Sudah dilakukan di presets.ts.
--
-- Idempoten: aman dijalankan ulang.
-- ============================================================

-- 1. Soft-delete 4 butir generik kelas 9-12
update public.worship_items
set deleted_at = now(),
    updated_at = now()
where deleted_at is null
  and category = 'wudhu'
  and label in (
    'Praktek Thaharah Sempurna',
    'Fiqih Thaharah & Evaluasi Wudhu',
    'Thaharah & Mandi Wajib',
    'Evaluasi Akhir Praktek Thaharah Mandiri'
  );

-- 2. Insert 9 butir thaharah kelas 9-12 (guard: hanya bila belum ada)
insert into public.worship_items (category, label, sort_order, is_preset)
select 'wudhu', v.label, v.sort_order, true
from (values
  ('Praktek Mandi Wajib: Tata Cara Runtut (Fardhu) (Kls 9)', 120),
  ('Mandi Wajib: Rukun Niat, Tertib & Menyela (Fardhu) (Kls 9)', 130),
  ('Macam-Macam Air: Mutlak & Muthayyam (Kls 10)', 140),
  ('Macam Najis: Mughallazhah, Mutawassithah, Mukhaffafah (Kls 10)', 150),
  ('Hadats Kecil & Besar serta Penghapusnya (Kls 10)', 160),
  ('Praktek Tayammum: Rukun & Tata Cara (Fardhu) (Kls 11)', 170),
  ('Tayammum: Syarat, Pembatal & Masa Berlaku (Kls 11)', 180),
  ('Keadaan yang Mewajibkan Mandi Wajib (Kls 11)', 190),
  ('Evaluasi Akhir Thaharah: Wudhu, Mandi Wajib & Tayammum (Kls 12)', 200)
) as v(label, sort_order)
where not exists (
  select 1 from public.worship_items w
  where w.category = 'wudhu'
    and w.label = v.label
    and w.deleted_at is null
);
