# Rencana Kerja: Rapikan Penamaan & Konsistensi Rapor Pondok (ID/AR)

Dokumen ini disusun berdasarkan hasil eksplorasi kode riil (Fase 0) dan arahan keputusan user:
1. Gelar akademik (S.Pd., M.Pd., Lc., dll.) dibersihkan di versi Arab (hanya nama murni).
2. Titimangsa di atas tanda tangan ditiadakan (mengikuti format asli Excel dan Raport Bulanan, tanggal cetak sudah di footer).
3. Nama jenis rapor ke-2 dikunci: **"Rapor Ujian Tulis"** (Arab: **"تقرير الاختبار التحريري"**).

---

## Daftar Pekerjaan per Berkas & Urutan Eksekusi

### 1. `src/features/report-cards/print/predicates.ts`
- **Tujuan**: Menghilangkan karakter `<` pada skala predikat praktik.
- **Perubahan**:
  - Ganti `range: '< 80'` pada `ORAL_PRACTICAL_SCALE` baris Predikat C menjadi `range: '0 - 79'`.
  - Rentang angka murni tanpa `<` atau `>` agar tidak membingungkan arah baca RTL pada versi Arab (Arab: `٠ - ٧٩`).
- **Risiko**: Rendah (hanya string tampilan skala).

### 2. `src/features/report-cards/print/translit.ts`
- **Tujuan**: Memperbaiki terjemahan kelas putra/putri dan membersihkan gelar akademik Latin pada versi Arab.
- **Perubahan**:
  - Ubah pemetaan kata kelas di `KELAS_KATA`:
    - `'putra': 'بنين'` (sebelumnya fonetik `'بوتر'`)
    - `'putri': 'بنات'` (sebelumnya fonetik `'بوتري'`)
  - Tambahkan fungsi pembersih gelar Latin sebelum ditransliterasi ke Arab:
    - Regex mendeteksi gelar umum (contoh: `, S.Pd.`, `, M.Pd.`, `, S.Ag.`, `, Lc.`, `, S.Kom.`, `, S.E.`, `, M.Ag.`, `, S.T.`, `Ir. `, `Drs. `, `H. `, `Hj. `) agar nama Arab tidak memunculkan singkatan fonetik aneh seperti `"س.فد."`.
- **Risiko**: Rendah. Diuji via unit test `adapters.test.ts`.

### 3. `src/features/report-cards/print/PrintCard.tsx`
- **Tujuan**: Memastikan kode verifikasi (No. Rapor) di footer tidak terbalik arah di versi Arab.
- **Perubahan**:
  - Bungkus nilai `reportNo` pada footer dengan `<span dir="ltr" style={{ unicodeBidi: 'isolate' }}>{reportNo}</span>` agar format nomor (seperti `RPT/VIIA/...`) tetap dibaca kiri-ke-kanan dengan benar pada kontainer `direction: rtl`.
- **Risiko**: Nol.

### 4. `src/features/report-cards/components/SetupBar.tsx`
- **Tujuan**: Mengatasi tampilan teks dropdown "Jenis Rapor" yang tampak abu-abu pucat.
- **Perubahan**:
  - Tambahkan style eksplisit atau pastikan select render item memiliki kontras tinggi (`color: '#0f172a'`, `fontWeight: 600`) pada trigger select, sehingga teks yang sudah terpilih terlihat tegas dan tidak menyerupai placeholder.
- **Risiko**: Nol.

---

## Verifikasi & Pengujian
1. Jalankan unit test `npm test` untuk memastikan `adapters.test.ts` dan tes lainnya tetap 100% lulus.
2. Jalankan build typecheck `npm run build`.
3. Jalankan linter `npx eslint src/features/report-cards`.
4. Verifikasi tidak ada karakter `<` atau `>` tersisa di rentang skala nilai (`grep`).
