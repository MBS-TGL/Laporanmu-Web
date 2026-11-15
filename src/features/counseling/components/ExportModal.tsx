import dayjs from 'dayjs'
import { ExportModal as SharedExportModal, type ExportColumn, type ExportScope } from '../../../shared/export/ExportModal'
import { COUNSELING_EXPORT_LIMIT, fetchCounselingByIds, fetchCounselingForExport } from '../api'
import type { CounselingFilters, CounselingLog } from '../types'

/** Kolom ekspor — satu sumber untuk CSV & Excel agar kolomnya selalu sinkron */
const columns: ExportColumn<CounselingLog>[] = [
  { header: 'Tanggal', value: (log) => dayjs(log.date).format('DD/MM/YYYY') },
  { header: 'Jam', value: (log) => log.time },
  { header: 'Santri', value: (log) => log.student_name },
  { header: 'Kelas', value: (log) => log.class_name ?? '' },
  { header: 'Konselor', value: (log) => log.counselor_name },
  { header: 'Kategori', value: (log) => log.category },
  { header: 'Keluhan', value: (log) => log.complaint },
  { header: 'Diagnosis', value: (log) => log.diagnosis ?? '' },
  { header: 'Rencana Tindakan', value: (log) => log.action_plan ?? '' },
  { header: 'Urgensi', value: (log) => log.urgency },
  { header: 'Status', value: (log) => log.status },
]

type ExportScopeKey = 'filtered' | 'selected'

interface ExportModalProps {
  open: boolean
  onClose: () => void
  /** Filter aktif halaman — dipakai untuk lingkup "hasil filter" */
  filters: CounselingFilters
  selectedIds: string[]
  /** Lingkup terpilih saat modal dibuka (dari tombol header / bar massal) */
  defaultScope?: ExportScopeKey
  /** Perkiraan jumlah baris lingkup "hasil filter" */
  filteredCount: number
}

/** Ekspor sesi BK — wrapper tipis di atas shared ExportModal. */
export function ExportModal({
  open,
  onClose,
  filters,
  selectedIds,
  defaultScope = 'filtered',
  filteredCount,
}: ExportModalProps) {
  const scopes: ExportScope<CounselingLog>[] = [
    {
      key: 'filtered',
      label: `Hasil filter (${filteredCount})`,
      description: `Semua sesi yang cocok dengan pencarian & filter aktif saat ini (maks ${COUNSELING_EXPORT_LIMIT.toLocaleString('id-ID')} baris).`,
      count: filteredCount,
      getRows: () => fetchCounselingForExport(filters),
    },
    {
      key: 'selected',
      label: `Terpilih (${selectedIds.length})`,
      disabled: selectedIds.length === 0,
      count: selectedIds.length,
      getRows: () => fetchCounselingByIds(selectedIds),
    },
  ]

  return (
    <SharedExportModal<CounselingLog>
      open={open}
      onClose={onClose}
      title="Export Sesi BK"
      filename="sesi-bk"
      sheetName="Sesi BK"
      columns={columns}
      scopes={scopes}
      defaultScopeKey={defaultScope}
      auditTable="counseling_logs"
      auditSource="OPERATIONAL"
    />
  )
}
