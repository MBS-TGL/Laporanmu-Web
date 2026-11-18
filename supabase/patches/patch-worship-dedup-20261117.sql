-- ============================================================
-- Patch Worship Dedup (2026-11-17): bersihkan butir ibadah
-- ganda akibat label preset berubah tanpa menyentuh baris DB.
--
-- 1. Rename 2 butir doa ke label kanonik (target dipastikan
--    belum ada → aman dari unique index aktif).
-- 2. Soft-delete 8 butir legacy (3 sholat MBS/Al-Matsurat yang
--    padanan barunya sudah ada; 5 arbain/pilihan versi lama
--    tanpa padanan — 'Hadist arbain 1-5' punya 1 baris mastery
--    yang ikut tersembunyi, disetujui).
-- 3. Soft-delete 2 butir gabungan yang komponennya sudah ada.
-- 4. Renumber sort_order per kategori (hilangkan tabrakan
--    s50/s60/s70 akibat dua kali insert preset).
--
-- Idempoten: aman dijalankan ulang.
-- ============================================================

-- 1a. Rename doa istikharah (guard: hanya bila padanan belum ada)
update public.worship_items
set label = 'Doa Istikharah & Doa Pilihan (Kls 10-12)',
    updated_at = now()
where deleted_at is null
  and category = 'hafalan_doa'
  and label = 'Doa Istikharah & Doa Khusus Lanjutan (Kls 10-12)'
  and not exists (
    select 1 from public.worship_items w
    where w.category = 'hafalan_doa'
      and w.label = 'Doa Istikharah & Doa Pilihan (Kls 10-12)'
      and w.deleted_at is null
  );

-- 1b. Rename Wafa (guard: hanya bila padanan belum ada)
update public.worship_items
set label = 'Wafa: Tilawah Tartil Al-Qur''an',
    updated_at = now()
where deleted_at is null
  and category = 'hafalan_doa'
  and label = 'Wafa: Tilawah Tartil Al-Qur''an Sesuai Buku Wafa'
  and not exists (
    select 1 from public.worship_items w
    where w.category = 'hafalan_doa'
      and w.label = 'Wafa: Tilawah Tartil Al-Qur''an'
      and w.deleted_at is null
  );

-- 2a. Soft-delete 3 butir sholat versi lama (padanan baru sudah aktif)
update public.worship_items
set deleted_at = now(),
    updated_at = now()
where deleted_at is null
  and category = 'sholat'
  and label in (
    'Dzikir Setelah Sholat Maktubah (Buku MBS)',
    'Doa Setelah Sholat Maktubah (Buku MBS)',
    'Dzikir Pagi dan Petang (Al-Matsurat MBS)'
  );

-- 2b. Soft-delete 5 butir hafalan hadist versi lama (tanpa padanan)
update public.worship_items
set deleted_at = now(),
    updated_at = now()
where deleted_at is null
  and category = 'hafalan_hadist'
  and label in (
    'Hadist arbain 1-5',
    'Hadist arbain 6-10',
    'Hadist arbain 11-15',
    'Hadist pilihan bab akhlak',
    'Hadist pilihan bab ibadah'
  );

-- 3. Soft-delete butir gabungan yang semua komponennya sudah aktif
update public.worship_items c
set deleted_at = now(),
    updated_at = now()
where c.deleted_at is null
  and c.category = 'sholat'
  and (
    (c.label = 'Dzikir Setelah Sholat & Pagi-Petang'
      and exists (select 1 from public.worship_items a
                  where a.category = 'sholat' and a.label = 'Dzikir Setelah Sholat'
                    and a.deleted_at is null)
      and exists (select 1 from public.worship_items b
                  where b.category = 'sholat' and b.label = 'Dzikir Pagi dan Petang'
                    and b.deleted_at is null))
    or (c.label = 'Praktek Sujud Sahwi & Tilawah'
      and exists (select 1 from public.worship_items a
                  where a.category = 'sholat' and a.label = 'Praktek Sujud Sahwi (Sebab & Tata Cara)'
                    and a.deleted_at is null)
      and exists (select 1 from public.worship_items b
                  where b.category = 'sholat' and b.label = 'Praktek Sujud Tilawah (Ayat Sajdah & Doa)'
                    and b.deleted_at is null))
  );

-- 4. Renumber sort_order per kategori (10, 20, 30, …) dengan
--    urutan tampil yang sama dengan yang sudah terlihat di UI
--    (sort_order lama, lalu label sebagai tie-break)
with ranked as (
  select id,
         row_number() over (partition by category
                            order by sort_order, label) as rn
  from public.worship_items
  where deleted_at is null
)
update public.worship_items i
set sort_order = r.rn * 10,
    updated_at = now()
from ranked r
where i.id = r.id
  and i.sort_order is distinct from r.rn * 10;
