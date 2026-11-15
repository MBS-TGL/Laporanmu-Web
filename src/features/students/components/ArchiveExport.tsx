import dayjs from 'dayjs'
import { ExportModal, type ExportColumn } from '../../../shared/export/ExportModal'
import { GENDER_LABEL } from '../status'
import type { Student } from '../types'

const COLUMNS: ExportColumn<Student>[] = [
  { header: 'Nama', value: (s) => s.name },
  { header: 'Kode Registrasi', value: (s) => s.registration_code },
  { header: 'NISN', value: (s) => s.nisn },
  { header: 'Kelas', value: (s) => s.classes?.name ?? null },
  { header: 'Gender', value: (s) => (s.gender ? GENDER_LABEL[s.gender] : null) },
  {
    header: 'Dihapus',
    value: (s) => (s.deleted_at ? dayjs(s.deleted_at).format('DD MMM YYYY HH:mm') : null),
  },
  {
    header: 'Lama Arsip (hari)',
    value: (s) => (s.deleted_at ? Math.floor(dayjs().diff(dayjs(s.deleted_at), 'day', true)) : null),
  },
]

interface ArchiveExportProps {
  open: boolean
  onClose: () => void
  /** Baris yang sedang tampil (sudah lolos filter) */
  filteredRows: Student[]
  /** Baris yang dipilih user di tabel */
  selectedRows: Student[]
}

/** Ekspor daftar arsip siswa — wrapper shared ExportModal (kolom + cakupan saja) */
export function ArchiveExport({ open, onClose, filteredRows, selectedRows }: ArchiveExportProps) {
  const hasSelection = selectedRows.length > 0

  return (
    <ExportModal<Student>
      open={open}
      onClose={onClose}
      title="Ekspor Arsip Siswa"
      filename="arsip-siswa"
      sheetName="Arsip Siswa"
      columns={COLUMNS}
      auditTable="students"
      defaultScopeKey={hasSelection ? 'selected' : 'filtered'}
      scopes={[
        {
          key: 'filtered',
          label: 'Data tampilan',
          description: `Seluruh baris yang sedang tampil setelah filter (${filteredRows.length} baris).`,
          count: filteredRows.length,
          getRows: () => Promise.resolve(filteredRows),
        },
        {
          key: 'selected',
          label: 'Baris terpilih',
          description: `Hanya ${selectedRows.length} baris yang dicentang di tabel.`,
          count: selectedRows.length,
          disabled: !hasSelection,
          getRows: () => Promise.resolve(selectedRows),
        },
      ]}
    />
  )
}
