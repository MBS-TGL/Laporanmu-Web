-- 0061: Policy SELECT storage.buckets (perbaikan tab Media "Belum ada bucket")
-- storage.buckets ber-RLS tanpa policy select, jadi storage.listBuckets() dengan
-- JWT user login selalu return array kosong walau bucket ada (dashboard Supabase
-- tampil karena service role). Isolasi file per-bucket tetap di policy
-- storage.objects (0059); policy ini hanya membuka daftar bucket.
-- Penerapan: dashboard SQL editor, JANGAN `supabase db push` (catatan 0059).
create policy buckets_select_authenticated
  on storage.buckets for select
  to authenticated
  using (true);
