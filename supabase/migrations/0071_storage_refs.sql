-- 0071: Perluas admin_storage_refs() dengan kolom URL storage modul lain.
-- Sebelumnya hanya profiles.avatar_url / students.photo_url / teachers.photo_url
-- sehingga foto/attachment modul lain (mis. lampiran tugas pembinaan) tidak
-- ikut dikenali saat orphan scan dan bisa salah dianggap file yatim.
-- Jalankan manual di dashboard SQL editor (BUKAN supabase db push).

create or replace function public.admin_storage_refs()
returns table (bucket text, path text)
language sql
stable
security invoker
set search_path = public
as $$
  select m[1], m[2]
  from (
    select regexp_match(url, '/storage/v1/object/(?:public|sign)/([^/]+)/([^?]+)') as m
    from (
      select avatar_url as url from public.profiles
      union all
      select photo_url from public.students
      union all
      select photo_url from public.teachers
      union all
      select attachment_url from public.suspension_tasks
      union all
      select unnest(photo_urls) from public.suspension_task_submissions
      union all
      select logo_url from public.school_settings
    ) src
    where url like '%/storage/v1/object/%'
  ) matched
$$;
