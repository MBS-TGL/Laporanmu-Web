-- Kolom kop raport versi cetak (port PrintCard v1).
-- Semua kolom opsional: aplikasi memakai fallback bila null.

alter table public.school_settings
  add column if not exists school_name_ar text,
  add column if not exists school_subtitle_ar text,
  add column if not exists school_address_line1 text,
  add column if not exists school_address_line2 text,
  add column if not exists logo_url text,
  add column if not exists headmaster_name_id text,
  add column if not exists headmaster_name_ar text,
  add column if not exists headmaster_title_id text,
  add column if not exists headmaster_title_ar text,
  add column if not exists pengasuh_name_id text,
  add column if not exists pengasuh_name_ar text,
  add column if not exists report_color_primary text,
  add column if not exists report_color_secondary text,
  add column if not exists report_labels jsonb not null default '{}'::jsonb,
  add column if not exists app_domain text;

-- Seed hanya bila masih kosong agar konfigurasi sekolah tidak tertimpa.
update public.school_settings
set
  school_name = case
    when school_name ilike '%boarding school%' and school_name not ilike '%(MBS)%'
      then replace(school_name, 'Boarding School', 'Boarding School (MBS)')
    else school_name
  end,
  school_name_ar = coalesce(nullif(school_name_ar, ''), 'معهد محمدية الإسلامي تانجول'),
  school_subtitle_ar = coalesce(
    nullif(school_subtitle_ar, ''),
    'المجلس التعليمي للمرحلتين الابتدائية والمتوسطة التابع للرئاسة الفرعية للجمعية المحمدية'
  ),
  school_address_line1 = coalesce(
    nullif(school_address_line1, ''),
    nullif(school_address, ''),
    'Jl. Pemandian No. 88 Dusun Krajan II Patemon Tanggul Jember 68155'
  ),
  school_address_line2 = coalesce(
    nullif(school_address_line2, ''),
    'Asrama Tahfidz Al-Qur''an Bambu Kuning Jl. Teratai No. 11 Tanggul Jember 68155'
  ),
  logo_url = coalesce(nullif(logo_url, ''), '/logos/logo-mbs.png'),
  headmaster_name_id = coalesce(nullif(headmaster_name_id, ''), nullif(headmaster_name, ''), 'Khoirul Anwar, S.Pd.'),
  headmaster_title_id = coalesce(
    nullif(headmaster_title_id, ''),
    'Pengasuh' || chr(10) || 'Muhammadiyah Boarding School Tanggul'
  ),
  headmaster_title_ar = coalesce(nullif(headmaster_title_ar, ''), 'مدير معهد محمدية الإسلامي تانجول'),
  pengasuh_name_id = coalesce(nullif(pengasuh_name_id, ''), nullif(caretaker_name, ''), 'Ir. H. M. Ali Maksum'),
  pengasuh_name_ar = coalesce(nullif(pengasuh_name_ar, ''), 'إير. الحاج محمد علي مقصوم'),
  report_color_primary = coalesce(nullif(report_color_primary, ''), nullif(color_primary, ''), '#1a5c35'),
  report_color_secondary = coalesce(nullif(report_color_secondary, ''), nullif(color_secondary, ''), '#c8a400'),
  app_domain = coalesce(nullif(app_domain, ''), 'laporanmu.my.id')
where id = true;
