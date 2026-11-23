import {
  ExportModal as SharedExportModal,
  type ExportColumn,
  type ExportColumnPreset,
  type ExportScope,
} from '../../../shared/export/ExportModal'
import { fetchAllStudents, fetchStudentsByIds } from '../api'
import type { Student, StudentFilters } from '../types'

/** Kolom ekspor — satu sumber untuk CSV & Excel agar kolomnya selalu sinkron */
const columns: ExportColumn<Student>[] = [
  { key: 'name', header: 'Nama', value: (s) => s.name },
  { key: 'reg_code', header: 'Kode Registrasi', value: (s) => s.registration_code },
  { key: 'nisn', header: 'NISN', value: (s) => s.nisn ?? '' },
  { key: 'nis', header: 'NIS', value: (s) => s.nis ?? '' },
  { key: 'gender', header: 'Gender', value: (s) => s.gender ?? '' },
  { key: 'status', header: 'Status', value: (s) => s.status },
  { key: 'class', header: 'Kelas', value: (s) => s.classes?.name ?? '' },
  { key: 'dorm', header: 'Asrama', value: (s) => s.dorms?.name ?? '' },
  { key: 'points', header: 'Poin', value: (s) => s.total_points },
  { key: 'phone', header: 'Telepon', value: (s) => s.phone ?? '' },
  { key: 'guardian', header: 'Wali', value: (s) => s.guardian_name ?? '' },
]

/** Paket kolom — satu klik memilih subset (pilot preset di modul siswa) */
const presets: ExportColumnPreset[] = [
  { key: 'all', label: 'Data lengkap', columnKeys: columns.map((c) => c.key!) },
  { key: 'contact', label: 'Kontak & Wali', columnKeys: ['name', 'reg_code', 'phone', 'guardian'] },
  { key: 'academic', label: 'Akademik', columnKeys: ['name', 'class', 'dorm', 'status', 'points'] },
]

type ExportScopeKey = 'filtered' | 'selected'

interface ExportModalProps {
  open: boolean
  onClose: () => void
  /** Filter aktif halaman — dipakai untuk lingkup "hasil filter" */
  filters: Omit<StudentFilters, 'page' | 'pageSize'>
  selectedIds: string[]
  /** Lingkup yang dipilih saat modal dibuka (dari menu / bar massal) */
  defaultScope?: ExportScopeKey
  /** Perkiraan jumlah baris lingkup "hasil filter" */
  filteredCount: number
}

/** Ekspor siswa — wrapper tipis di atas shared ExportModal (pola ArchiveExport). */
export function ExportModal({
  open,
  onClose,
  filters,
  selectedIds,
  defaultScope = 'filtered',
  filteredCount,
}: ExportModalProps) {
  const scopes: ExportScope<Student>[] = [
    {
      key: 'filtered',
      label: `Hasil filter (${filteredCount})`,
      description: 'Semua siswa yang cocok dengan pencarian & filter aktif saat ini.',
      count: filteredCount,
      getRows: () => fetchAllStudents(filters),
    },
    {
      key: 'selected',
      label: `Terpilih (${selectedIds.length})`,
      disabled: selectedIds.length === 0,
      count: selectedIds.length,
      getRows: () => fetchStudentsByIds(selectedIds),
    },
  ]

  return (
    <SharedExportModal<Student>
      size="xl"
      open={open}
      onClose={onClose}
      title="Ekspor Data Santri"
      filename="data-siswa"
      sheetName="Santri"
      columns={columns}
      scopes={scopes}
      presets={presets}
      defaultScopeKey={defaultScope}
      auditTable="students"
    />
  )
}
