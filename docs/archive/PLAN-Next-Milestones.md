# PLAN: Next Milestones (Penyempurnaan Tiga Pilar)

> Dokumen acuan roadmap pengerjaan lanjutan Laporanmu-Web:
> 1. Keamanan & Deployment Edge Function `create-user` (Pondasi Akun Staf)
> 2. Dashboard Admin & Kesehatan Sistem (Observabilitas & UX Admin)
> 3. Modul Operasional Pesantren Pengganti Sidikmu (Notifikasi WA & Portal Wali)
>
> Prioritas: **P0** Celah keamanan / bug nyata, **P1** Penting operasional, **P2** Penyempurnaan UX & performa, **P3** Nice-to-have.

---

## 1. Edge Function `create-user` (Pondasi Akun Staf)

### Analisis & Latar Belakang
- **Lokasi file**: `supabase/functions/create-user/index.ts` (Active versi 7 di Edge).
- **Frontend**: `src/features/admin/UsersPage.tsx` (`CreateUserModal.tsx`).
- **Isu saat ini**: Header CORS masih permisif `'Access-Control-Allow-Origin': '*'`. Perlu diselaraskan dengan standar keamanan origin tunggal/whitelist yang sudah diterapkan pada `ai-proxy` v9.

### Checklist Tindakan
- [x] **1.1 Hardening CORS (P0)**:
  - Terapkan helper `resolveAllowedOrigin(req)` dan `corsHeaders(origin)` membaca secret `APP_ORIGIN` (default: `http://localhost:5174,https://laporanmu.my.id`).
  - Tolak preflight `OPTIONS` dan request non-whitelist dengan HTTP 403 Forbidden.
- [x] **1.2 Standardisasi Respon & Pesan Error (P1)**:
  - Tangani format respon JSON seragam `{ error: string }`.
  - Pastikan pesan penolakan role atau email duplikat berbahasa Indonesia ramah pengguna.
- [x] **1.3 Deployment & Verifikasi (P1)**:
  - Deploy: `npx supabase functions deploy create-user --project-ref ieckbzhpjehgwpjgdrwk --yes` (Active v8).
  - Uji via `curl`:
    - OPTIONS dengan origin valid (`http://localhost:5174`) -> 200 OK.
    - OPTIONS dengan origin asing (`https://evil.com`) -> 403 Forbidden.
    - POST tanpa header Authorization -> 401 Unauthorized.
  - Verifikasi di UI `UsersPage`: modal pembuatan akun staf baru berfungsi mulus tanpa me-reset sesi browser admin.

---

## 2. Dashboard Admin & Kesehatan Sistem (`/admin?tab=summary`)

### Analisis & Latar Belakang
- **Lokasi file**: `src/features/admin/DashboardPage.tsx`, `src/features/admin/components/SystemHealth.tsx`.
- **Backend**: RPC `admin_table_stats()`, `admin_integrity_checks()`, `admin_trash_items()` (migrasi 0062).
- **Isu saat ini**:
  1. StatChip menampilkan strip `–` saat query awal berjalan, memicu layout shift.
  2. Pie chart baris tabel terdistorsi oleh tingginya volume baris `audit_logs` (log historis).
  3. Status maintenance hanya bisa diatur di tab Flags; pengembang butuh toggle darurat langsung di ringkasan kesehatan sistem.

### Checklist Tindakan
- [x] **2.1 Skeleton Loading StatChip (P1)**:
  - Tambahkan skeleton state halus pada komponen StatChip saat `statsQuery.isLoading` pertama kali dibuka agar tampilan stabil tanpa layout shift.
- [x] **2.2 Pembersihan Distribusi Pie Chart (P2)**:
  - Exclude atau kelompokkan tabel log historis (`audit_logs`, `api_request_log`) ke kategori terpisah atau toggle khusus, agar tabel data santri, pelanggaran, nilai, dan SPP terlihat jelas proporsinya.
- [x] **2.3 Quick Toggle Mode Pemeliharaan (P1)**:
  - Di kartu "Kesehatan Sistem" (`SystemHealth.tsx`), sediakan Switch darurat mode maintenance khusus jika user memiliki role `developer`.
  - Lengkapi dengan `Popconfirm` AntD untuk mencegah ketidaksengajaan.
- [x] **2.4 Polish & Responsivitas Mobile (P2)**:
  - Verifikasi grid widget pada viewport smartphone (390px) dan tablet (768px) sesuai skill `antislop-layoutmobile`.
  - Pastikan `npm run build` dan unit test admin tetap 100% lulus.

---

## 3. Modul Operasional Pesantren (Pengganti Penuh Sidikmu)

### Analisis & Latar Belakang
- **Referensi**: `docs/PRD-Sidikmu-Replacement.md` (Penggantian sistem Sidikmu v2.0).
- Modul CBT, Rapor Semester, Tabungan ber-PIN, dan Presensi Mesin sudah siap.
- Prioritas operasional harian yang membutuhkan penyempurnaan alur komunikasi adalah:
  1. Integrasi notifikasi WhatsApp otomatis untuk transaksi santri dan surat BK.
  2. Penyempurnaan portal publik `/check` agar nyaman dibuka orang tua dari handphone.

### Checklist Tindakan
- [x] **3.1 Audit Notifikasi WhatsApp Otomatis (P1)**:
  - Cek integrasi toggle di Pengaturan WA (`wa_settings`):
    - Surat resmi BK diterbitkan -> kirim nomor surat & link verifikasi QR `/verify?token=...`.
    - Mutasi tabungan (setor/tarik) -> kirim rincian saldo akhir ke nomor wali santri.
  - Pastikan helper `resolveGuardianPhone` selalu memprioritaskan: Wali -> Ibu -> Ayah -> Nomor Santri.
  - Pastikan sifat pengiriman *fire-and-forget* (tidak memblokir transaksi database jika gateway WA lambat/gagal).
- [x] **3.2 Penyempurnaan Portal Wali Santri (`/check`) (P2)**:
  - Pastikan panel tabungan santri dan rincian SPP (`SppPanel`) tampil rapi di layar HP (390px).
  - Pastikan santri dengan status skorsing atau pembinaan aktif memunculkan badge dan panduan yang jelas bagi wali.

---

## Matriks Pelaksanaan & Verifikasi

| Tahap | Fokus Utama | Target File | Output / Bukti Selesai |
|---|---|---|---|
| **Tahap 1** | Edge Function `create-user` | `supabase/functions/create-user/index.ts` | Edge Function v8 active, CORS aman 403/200, invite staf normal |
| **Tahap 2** | Dashboard Admin & Health | `src/features/admin/DashboardPage.tsx`, `SystemHealth.tsx` | Skeleton loading mulus, pie chart proporsional, quick toggle dev |
| **Tahap 3** | Notifikasi WA & Portal Wali | `src/features/public/CheckPage.tsx`, `guardianPhone.ts`, `wa-settings` | Alur WhatsApp terverifikasi, portal wali responsif mobile 390px |
