import { ExportModal as SharedExportModal, type ExportColumn, type ExportColumnPreset, type ExportScope } from '../../../shared/export/ExportModal'
import { fetchAllTeachers, fetchTeachersByIds } from '../api'
import type { Teacher, TeacherFilters } from '../types'
import { TEACHER_EMPLOYMENT_LABEL, TEACHER_STATUS_LABEL, TEACHER_TYPE_LABEL } from '../types'

/** Kolom ekspor — satu sumber untuk CSV & Excel agar kolomnya selalu sinkron */
const columns: ExportColumn<Teacher>[] = [
  { header: 'Nama', value: (t) => t.name },
  { header: 'NBM', value: (t) => t.nbm ?? '' },
  { header: 'NIP', value: (t) => t.nip ?? '' },
  { header: 'NUPTK', value: (t) => t.nuptk ?? '' },
  { header: 'NIK', value: (t) => t.nik ?? '' },
  { header: 'Mapel', value: (t) => t.subject ?? '' },
  { header: 'Jenis', value: (t) => (t.type ? TEACHER_TYPE_LABEL[t.type] : '') },
  { header: 'Status Pegawai', value: (t) => (t.employment_status ? TEACHER_EMPLOYMENT_LABEL[t.employment_status] : '') },
  { header: 'Gender', value: (t) => (t.gender === 'L' ? 'Laki-laki' : t.gender === 'P' ? 'Perempuan' : '') },
  { header: 'Status', value: (t) => TEACHER_STATUS_LABEL[t.status] },
  { header: 'Telepon', value: (t) => t.phone ?? '' },
  { header: 'Email', value: (t) => t.email ?? '' },
  { header: 'Tempat Lahir', value: (t) => t.birth_place ?? '' },
  { header: 'Tanggal Lahir', value: (t) => t.birth_date ?? '' },
  { header: 'Bergabung', value: (t) => t.join_date ?? '' },
  { header: 'Jam Mengajar', value: (t) => t.teaching_hours ?? '' },
  { header: 'Pendidikan Terakhir', value: (t) => t.last_education ?? '' },
  { header: 'Jurusan', value: (t) => t.major ?? '' },
  { header: 'Tahun Lulus', value: (t) => t.graduation_year ?? '' },
  { header: 'Hari Kerja', value: (t) => (t.work_days ?? []).join(', ') },
  { header: 'Fingerspot', value: (t) => t.fingerspot_name ?? '' },
  { header: 'Alamat', value: (t) => t.address ?? '' },
  { header: 'Catatan', value: (t) => t.notes ?? '' },
]

/** Paket kolom siap-pakai — pola preset shared ExportModal */
const presets: ExportColumnPreset[] = [
  { key: 'kontak', label: 'Kontak', columnKeys: ['Nama', 'Telepon', 'Email', 'Alamat'] },
  {
    key: 'kepegawaian',
    label: 'Kepegawaian',
    columnKeys: ['Nama', 'NBM', 'Status', 'Jenis', 'Status Pegawai', 'Bergabung', 'Jam Mengajar'],
  },
  {
    key: 'pribadi',
    label: 'Pribadi',
    columnKeys: ['Nama', 'Gender', 'Tempat Lahir', 'Tanggal Lahir', 'NIK', 'NIP', 'NUPTK'],
  },
  {
    key: 'pendidikan',
    label: 'Pendidikan',
    columnKeys: ['Nama', 'Pendidikan Terakhir', 'Jurusan', 'Tahun Lulus'],
  },
]

type ExportScopeKey = 'filtered' | 'selected'

interface ExportModalProps {
  open: boolean
  onClose: () => void
  /** Filter aktif halaman — dipakai untuk lingkup "hasil filter" */
  filters: Omit<TeacherFilters, 'page' | 'pageSize'>
  selectedIds: string[]
  /** Lingkup yang dipilih saat modal dibuka (dari menu / bar massal) */
  defaultScope?: ExportScopeKey
  /** Perkiraan jumlah baris lingkup "hasil filter" */
  filteredCount: number
}

/** Ekspor guru — wrapper tipis di atas shared ExportModal. */
export function ExportModal({
  open,
  onClose,
  filters,
  selectedIds,
  defaultScope = 'filtered',
  filteredCount,
}: ExportModalProps) {
  const scopes: ExportScope<Teacher>[] = [
    {
      key: 'filtered',
      label: `Hasil filter (${filteredCount})`,
      description: 'Semua guru yang cocok dengan pencarian & filter aktif saat ini.',
      count: filteredCount,
      getRows: () => fetchAllTeachers(filters),
    },
    {
      key: 'selected',
      label: `Terpilih (${selectedIds.length})`,
      disabled: selectedIds.length === 0,
      count: selectedIds.length,
      getRows: () => fetchTeachersByIds(selectedIds),
    },
  ]

  return (
    <SharedExportModal<Teacher>
      open={open}
      onClose={onClose}
      title="Export Data Guru"
      filename="data-guru"
      sheetName="Guru"
      columns={columns}
      presets={presets}
      scopes={scopes}
      defaultScopeKey={defaultScope}
      auditTable="teachers"
    />
  )
}
