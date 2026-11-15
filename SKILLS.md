# Laporanmu-Web — SKILLS (Playbook untuk Agent)

Playbook tugas-tugas umum. Snippet di bawah adalah pola **resmi** — copy dulu, sesuaikan nama.
Kalau butuh contoh hidup: page CRUD lengkap = `features/subjects/`; page bertab = `features/counseling/CounselingPage.tsx` dan `features/students/StudentsPage.tsx`; detail drawer = `features/students/components/DetailDrawer.tsx`.

---

## Skill 1 — Menambah page CRUD baru

Struktur folder (WAJIB):

```
src/features/<domain>/
  XPage.tsx        # shell: PageHeader → StatChip row → FilterChips → Table (+ActionBar)
  api.ts           # semua panggilan supabase
  hooks.ts         # useQuery/useMutation + invalidate
  types.ts         # tipe domain + XFormValues
  components/
    XForm.tsx      # form (dipakai modal tambah/ubah)
    XModal.tsx     # AppModal pembungkus XForm
    XExportModal.tsx
```

**api.ts** — gunakan `softDelete`/`softDeleteMany` dari shared:

```ts
import { supabase } from '../../lib/supabase'
import { softDelete } from '../../shared/api/crud'
import type { X, XFormValues } from './types'

export async function fetchX(): Promise<X[]> {
  const { data, error } = await supabase.from('xs').select('*').is('deleted_at', null).order('name')
  if (error) throw error
  return (data ?? []) as X[]
}

export async function createX(values: XFormValues): Promise<X> {
  const { data, error } = await supabase.from('xs')
    .insert({ name: values.name.trim(), is_active: values.is_active })
    .select('*').single()
  if (error) throw error
  return data as X
}

export async function updateX(id: string, values: XFormValues): Promise<X> { /* insert → update + .eq('id') */ }
export async function deleteX(id: string): Promise<void> { return softDelete('xs', id) }
```

**hooks.ts** — react-query, invalidate semua key yang terdampak:

```ts
export function useXList() {
  return useQuery({ queryKey: ['x-list'], queryFn: fetchX, placeholderData: keepPreviousData })
}
export function useCreateX() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createX,
    onSuccess: (created) => {
      void logAudit({ action: 'INSERT', source: 'OPERATIONAL', tableName: 'xs', recordId: created.id, newData: created })
      void qc.invalidateQueries({ queryKey: ['x-list'] })
    },
  })
}
```

**XPage.tsx** — susunan visual standar (lihat `SubjectsPage.tsx` sebagai referensi):

```tsx
export function XPage() {
  const { profile, canWrite } = usePermissions()
  const rows = useXList()
  const shortcuts = useShortcuts({ items: [...], isBlocked: Boolean(modal) })
  return (
    <div>
      <PageHeader title="..." subtitle="..." extra={<Button icon={<PlusOutlined />} onClick={openAdd}>Tambah</Button>} />
      <StatChip ... />          {/* 3–5 chip ringkasan, klik = filter */}
      <FilterChips chips={activeFilters} />
      <Table rowSelection={canWrite ? { selectedRowKeys, onChange } : undefined} ... />
      {/* ActionBar data-driven: ukuran/varian/Popconfirm/loading dikunci di komponen.
          loading hanya di tombol pemicu (JANGAN dobel dgn okButtonProps), danger utk aksi destruktif. */}
      <ActionBar
        count={selected.length}
        onClear={() => setSelected([])}
        actions={[
          { key: 'export', label: 'Ekspor', icon: <ExportOutlined />, onClick: () => openExport('selected') },
          {
            key: 'archive',
            label: 'Arsipkan',
            icon: <DeleteOutlined />,
            variant: 'danger',
            hidden: !canWrite,
            loading: bulkDeleteMutation.isPending,
            confirm: { title: `Arsipkan ${selected.length} data terpilih?`, description: '...', okText: 'Ya, Arsipkan' },
            onClick: () => bulkArchive(selected),
          },
        ]}
      />
      <XModal open={...} onClose={...} />
      <XExportModal ... />
      <ShortcutsModal open={shortcuts.isOpen} onClose={shortcuts.close} sections={shortcuts.sections} />
    </div>
  )
}
```

Checklist selesai: route terdaftar di `core/router.tsx` (lazy + `<Suspense>` via helper `page()`), nav item di `shared/constants/navItems.tsx`, semua copy bahasa Indonesia, audit log untuk aksi tulis, role guard (`canWrite`/`canDelete` dari `usePermissions`).

---

## Skill 2 — Menambah tab di page besar (pola `?tab=`)

Fungsi se-domain = **1 page bertab**, URL-nya `?tab=`. Jangan bikin route baru per fungsi.

```tsx
// XPage.tsx
import { useUrlTab } from '../../shared/hooks/useUrlTab'

const { tab, setTab } = useUrlTab('utama')   // tab default → URL bersih tanpa ?tab=
<Tabs
  activeKey={tab}
  onChange={setTab}
  items={[
    { key: 'utama', label: 'Utama', children: <MainTab /> },
    { key: 'arsip', label: 'Arsip', children: <ArchiveTab /> },
  ]}
/>

// Halaman yang SEMUA tab-nya harus deep-linkable (contoh: /attendance):
const { tab, setTab } = useUrlTab('students', { writeDefault: true }) // → ?tab=students
```

Aturan tab:
- Tab default TIDAK ditulis ke URL (url `/x` saja). Tab lain: `/x?tab=arsip`.
- Komponen tab ada di `features/<domain>/tabs/XTab.tsx`, tanpa PageHeader sendiri (PageHeader milik shell; title tab cukup `Typography.Title level={5}` bila perlu).
- Tab yang punya state sendiri (filter, page) tetap composable — jangan angkat state antar tab kecuali memang dipakai bersama.
- **Detail entity di dalam tab = Drawer**, bukan tab ketiga dan bukan route.
- **Aksi halaman di kanan PageHeader** (sejajar judul), bukan di tab bar: shell memasang host `<div ref={setActionsHost} style={{ display: 'flex', alignItems: 'center' }} />` sebagai `extra` PageHeader di dalam `TabActionsContext.Provider`; tab mengisi via `useTabActions(active, node)`. Tombol primary (Tambah X) selalu terakhir.

---

## Skill 3 — Impor Excel/CSV (WAJIB pakai ImportWizard)

Jangan pernah bikin modal impor baru dari nol. Parser/validasi domain ditulis di feature (boleh file `xImportParse.ts` + test), UI-nya dari shared (stepper bernomor + dropzone kustom + kartu template + collapse tips):

```tsx
<ImportWizard<StudentImportRow>
  open={open}
  onClose={close}
  title="Impor Siswa"
  entityLabel="Siswa"                     // label di tombol impor & ringkasan hasil
  columns={IMPORT_COLUMNS}                // { key, header, width? } — header tabel preview
  template={{                             // ImportTemplate object — wizard buat tombol Unduh Excel & CSV
    filename: 'template-impor-siswa',
    headers: IMPORT_COLUMNS.map((c) => c.header),
    exampleRows: [['Budi', 'Putra'], ...],
  }}
  formatHint={<ul><li>Tanggal format YYYY-MM-DD</li></ul>}   // render di collapse "Contoh struktur kolom"
  parse={(table, { maxRows }) => parseStudentTable(table, { maxRows })}  // (table: string[][], ctx) => Row[]
  getRowStatus={(row) => row.errors.length ? 'error' : 'siap'}   // 'siap' | 'error' | 'duplikat'
  getRowMessage={(row) => row.errors[0]}                          // opsional
  previewCells={(row) => [row.nama, row.gender]}                  // urut sesuai columns
  onSubmit={importStudents}             // (readyRows, { chunk, onProgress }) => Promise<ImportResult>
  onFinished={invalidateSemuaKey}       // tempat invalidateQueries
/>
```

- `parse` menerima **tabel string** (hasil baca file); wizard membaca file via `readSheet` dari `shared/import/readFile.ts` (xlsx & csv sekaligus) — override `readRows` hanya bila format khusus (multi-sheet, dsb). Jangan import `xlsx`/`papaparse` langsung di feature kecuali parse khusus.
- `onSubmit` WAJIB insert per-chunk lewat `ctx.chunk` + laporkan `ctx.onProgress(done, total)`.
- Parser murni ditaruh di file `xImportParse.ts` + test vitest (contoh: `features/dorms/importParse.ts` + `importParse.test.ts`).
- Modal width 520 (review 680) — dipilih wizard otomatis, jangan override.

### Impor kompleks (mapping kolom, Google Sheets, langkah kustom) — pakai WizardModal

Bila kebutuhan melebihi ImportWizard (auto-match mapping per kolom, sumber tambahan, expandable row, gate validasi antar langkah), JANGAN duplikasi chrome wizard manual — pakai primitive `shared/components/WizardModal.tsx` ("type wizard" di atas AppModal):

```tsx
<WizardModal
  title="Impor Data Siswa" icon={<ImportOutlined />} open={open} onCancel={close}
  destroyOnHidden width={800}
  current={step}                       // state step milik feature
  steps={[{ title: 'Upload', description: 'Pilih file' }, { title: 'Mapping', description: 'Atur kolom' }, ...]}
  footerByStep={(s) => s === 0 ? <Button>Batal</Button> : <Button onClick={next}>Lanjut</Button>}
>
  {step === 0 && <StepUpload />}       {/* transisi antar langkah otomatis */}
</WizardModal>
```

- Mobile tetap bottom sheet (turun dari AppModal); gate validasi & alur tetap milik feature (WizardModal tanpa state).
- Contoh konsumen: `students/components/ImportModal.tsx` (parser murni di `importParse.ts` + test). Dropzone langkah upload pakai kelas `.import-dragger`/`.import-dropzone` biar seragam dengan ImportWizard.

## Skill 4 — Export (WAJIB pakai ExportModal) & Scan (WAJIB pakai ScanModal)

Modal ekspor seragam: kartu cakupan + pratinjau 5 baris otomatis + pemilih kolom (opsional preset) + nama file kustom (validasi karakter ilegal) + info ekspor terakhir dari audit log + transisi antar cakupan.

```tsx
<XExportModal open={open} onClose={close} />   // di feature, wrapper tipis:
<ExportModal<Student>
  title="Export Data Siswa" filename="data-siswa"   // tanggal otomatis ditambahkan
  columns={[{ key: 'name', header: 'Nama', value: (s) => s.name }, ...]}  // key dipakai preset
  scopes={[{ key: 'filtered', label: `Hasil filter (${n})`, count: n, getRows: () => fetchAll(filters), icon? }, ...]}
  presets={[{ key: 'contact', label: 'Kontak & Wali', columnKeys: ['name', 'phone', 'guardian'] }]}  // opsional (pilot: students)
  auditTable="students"     // → logAudit EXPORT + baris "Terakhir diekspor …" otomatis
/>
```

- ExportModal menangani fetch baris pratinjau per cakupan (useQuery key `['export-modal-rows', …]`, refetch tiap buka modal), pilihan XLSX/CSV, unduh, loading, `logAudit`, dan invalidasi `['audit','last-export',table]` setelah ekspor. Feature hanya define kolom + scopes (+ preset bila relevan).
- Escape hatch `onExport` (mis. workbook multi-sheet, dipakai ExportModal): audit & info ekspor terakhir **ditangani pemanggil** — jangan lupa `logAudit` sendiri.
- Kolom < 1 dipilih → tombol Ekspor disabled + pesan inline; cakupan tanpa data → empty state.
- Ukuran modal pakai **token `size`** (`sm`=480 / `md`=520 / `lg`=680 / `xl`=800, didefinisi di `AppModal.tsx`); `width` piksel hanya escape hatch untuk nilai non-standar. ExportModal default `md`; layout **action-bar**: body satu kolom full-width (Cakupan segmented → Kolom chip auto-fill → Pratinjau scroll y=84) dan **footer berisi nama file + Excel/CSV + Batal/Ekspor** (slot `left` ModalFooter) — semua kontrol selalu terlihat tanpa scroll di semua ukuran.
- Scan kamera QR:

```tsx
<ScanModal
  open={open} onClose={close}
  title="Scan Kartu Santri"
  hint="Arahkan QR di kartu ke kamera"
  onScan={async (code) => { /* lookup + catat; lempar Error bila gagal */ }}
  cooldownMs={1500}   // anti dobel-scan
/>
```

- Kamera/manual-input diseragamkan oleh `shared/scan` (useQrScanner). Feature hanya memberi handler. Bila butuh kamera di luar modal, pakai hook `useQrScanner` langsung.

## Skill 5 — Menambah nav item / redirect alias

- Nav item: edit **hanya** `src/shared/constants/navItems.tsx` (sumber tunggal Sidebar + Topbar search). Pilih icon dari `@ant-design/icons`, `desc` wajib (dipakai search).
- Route: daftarkan di `core/router.tsx` dengan lazy import + helper `page()`.
- URL lama yang berubah: tambahkan ke tabel `ALIAS_REDIRECTS` di router — **jangan** hapus begitu saja; bookmark harus tetap hidup.
- Jangan pernah hardcode link menu di halaman; pakai `navigate()` / `<Link>` ke path route.

## Skill 6 — Membuka detail siswa dari modul lain

Semua modul yang menampilkan nama santri WAJIB bisa membuka detail siswa (drawer global):

```tsx
import { useStudentDetail } from '../students/useStudentDetail'

const { open } = useStudentDetail()
<Button type="link" onClick={() => open(studentId)}>{nama}</Button>
```

Provider (`features/students/DetailProvider.tsx`) sudah terpasang di `MainLayout` — JANGAN bikin instance DetailDrawer sendiri di halaman baru. Halaman yang butuh aksi Edit (mis. StudentsPage) boleh pakai instance sendiri dengan `onEdit`.
Data ringkasan lintas-modul (poin, gate, raport, audit) untuk drawer dikonsumsi via `useStudentOverview(studentId, enabled)` dari `features/students/useStudentOverview.ts` — jangan fetch lintas-feature manual.

## Skill 7 — Motion (library `motion`, dial MOTION 2)

Library: **`motion`** (`motion/react`) — sudah terpasang. Dial & aturan: `DESIGN.md` §Motion. Primitif: `src/shared/motion.ts`.

**Aturan singkat:**
- Durasi ≤0.25s, easing `EASE` dari `shared/motion`. Jangan animasikan interior AntD (Modal/Drawer/Tabs).
- **Jangan loop `infinite`** (R-19). CSS keyframes play-once saja (contoh: `.tb-bell-shake`).
- `MotionConfig reducedMotion="user"` sudah dibungkus di `core/providers.tsx` — motion.js otomatis hormati OS reduce-motion; CSS keyframes wajib masuk blok `@media (prefers-reduced-motion: reduce)` di `index.css`.
- Import primitif, jangan hardcode angka:

```tsx
import { motion, AnimatePresence } from 'motion/react'
import { routeEnter, routeExit, shellVariants, shellTransition, bulkBarVariants, bulkBarTransition } from '../../shared/motion'
```

**Pola yang sudah ada (jangan bikin ulang):**

| Efek | Lokasi | Pola |
|---|---|---|
| Transisi route | `MaintenanceGate.tsx` | `AnimatePresence mode="wait" initial={false}` + `key={location.pathname}` pada `useOutlet()` wrapper; exit 0.12s / enter 0.18s |
| Entrance shell publik | `PublicShell.tsx` | `variants={shellVariants} initial="initial" animate="animate"` (label string — hindari error tipe `Variant` vs `TargetAndTransition`) |
| Entrance shell guardian/404 | `GuardianPage.tsx` / `router.tsx` | inline `initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}` |
| Rail sidebar aktif | `Sidebar.tsx` | `motion.span layoutId={railId}` — `railId` dari `useId()` **per instance** (Sider desktop ≠ Drawer mobile); item popover **tanpa** railId |
| Bulk bar | `ActionBar.tsx` | `AnimatePresence` + `bulkBarVariants` (`x:'-50%'` menggantikan transform di style) |
| Entrance halaman bertab | `ShellMotion.tsx` | bungkus shell dengan `<ShellStagger>` lalu tiap bagian (PageHeader, Tabs, konten) dengan `<ShellItem>` — stagger 60ms, primitif `pageShell*` |
| Mount fade-up komponen | `StatChip.tsx`, `FilterChips.tsx` | `motion.create('button')` (StatChip tetap semantik button) + `pageShellItemVariants`/`microTransition`, self-driven `initial="initial" animate="animate"` |
| Konten drawer fade-up saat open | `students/DetailDrawer.tsx`, `classes/ClassDrawer.tsx` | motion.div `pageShellItemVariants` + `shellTransition` di dalam Drawer (menganimasikan konten kita, bukan interior AntD) |

**Gotcha tipe:** prop `initial`/`animate` langsung dari `shellVariants.initial` gagal typecheck (`Variant` = bisa `TargetResolver`). Pakai pola `variants={...} initial="label" animate="label"`.

## Skill 8 — Konvensi kecil yang sering dilupakan

- Copy UI bahasa Indonesia; tanggal via `dayjs`; uang tanpa desimal.
- Konfirmasi aksi: **Popconfirm inline adalah DEFAULT untuk semua konfirmasi** (di ActionBar cukup isi field `confirm` — komponen yang membungkus Popconfirm). `modal.confirm` HANYA untuk trigger non-tombol: item menu dropdown, Select/DatePicker, guard programatik alur scan, konten kaya >320px, konfirmasi di dalam modal lain. Copy tombol konfirmasi SELALU pola "Ya, <verba>" ("Ya, Hapus", "Ya, Pulihkan", "Ya, Batalkan") + cancelText "Batal". Label dropdown aksi pakai helper `actionMenuLabel(title, desc, shortcut?)` dari shared/components/ActionMenu. Popconfirm tidak punya auto-loading tombol OK — di luar ActionBar pakai `okButtonProps={{ loading: mutation.isPending }}`; DI DALAM ActionBar loading hanya di field `loading` aksi (jangan dobel).
- Warna pakai token tema AntD (`token.colorPrimary` dst) — hex mentah hanya untuk aksen khusus yang sudah ada.
- `useUrlTab`, `useDebounce` untuk search input; `placeholderData: keepPreviousData` untuk list berfilter.
- Query keys konvensional: `['<domain>']`, `['<domain>', 'detail', id]`, `['<domain>', filters]`.
- TS strict + `noUnusedLocals`: hapus import yang tidak terpakai, jangan biarkan `_var` kecuali parameter.
- Test vitest hanya untuk logika murni (parser, distribusi, validasi) — colocated `<nama>.test.ts`.
