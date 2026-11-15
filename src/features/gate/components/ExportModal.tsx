import dayjs from 'dayjs'
import { ExportModal as SharedExportModal, type ExportColumn, type ExportScope } from '../../../shared/export/ExportModal'
import { GATE_EXPORT_LIMIT, fetchGateLogsByIds, fetchGateLogsForExport } from '../api'
import type { GateLog, GateLogFilters } from '../types'

/** Kolom ekspor — satu sumber untuk CSV & Excel agar kolomnya selalu sinkron */
const columns: ExportColumn<GateLog>[] = [
  { header: 'Waktu', value: (log) => dayjs(log.occurred_at).format('DD/MM/YYYY HH:mm') },
  { header: 'Nama', value: (log) => log.student?.name ?? '' },
  { header: 'Kode Registrasi', value: (log) => log.student?.registration_code ?? '' },
  { header: 'Kelas', value: (log) => log.student?.classes?.name ?? '' },
  { header: 'Arah', value: (log) => (log.direction === 'exit' ? 'Keluar' : 'Masuk') },
  { header: 'Catatan', value: (log) => log.note ?? '' },
  { header: 'Dicatat Oleh', value: (log) => log.recorder?.name ?? '' },
]

type ExportScopeKey = 'filtered' | 'selected'

interface ExportModalProps {
  open: boolean
  onClose: () => void
  /** Filter aktif halaman — dipakai untuk lingkup "hasil filter" */
  filters: Omit<GateLogFilters, 'page' | 'pageSize'>
  selectedIds: string[]
  /** Lingkup terpilih saat modal dibuka (dari tombol header / bar massal) */
  defaultScope?: ExportScopeKey
  /** Perkiraan jumlah baris lingkup "hasil filter" */
  filteredCount: number
}

/** Ekspor log gerbang — wrapper tipis di atas shared ExportModal. */
export function ExportModal({
  open,
  onClose,
  filters,
  selectedIds,
  defaultScope = 'filtered',
  filteredCount,
}: ExportModalProps) {
  const scopes: ExportScope<GateLog>[] = [
    {
      key: 'filtered',
      label: `Hasil filter (${filteredCount})`,
      description: `Semua log yang cocok dengan pencarian & filter aktif saat ini (maks ${GATE_EXPORT_LIMIT.toLocaleString('id-ID')} baris).`,
      count: filteredCount,
      getRows: () => fetchGateLogsForExport(filters),
    },
    {
      key: 'selected',
      label: `Terpilih (${selectedIds.length})`,
      disabled: selectedIds.length === 0,
      count: selectedIds.length,
      getRows: () => fetchGateLogsByIds(selectedIds),
    },
  ]

  return (
    <SharedExportModal<GateLog>
      size="lg"
      open={open}
      onClose={onClose}
      title="Export Log Gerbang"
      filename="log-gerbang"
      sheetName="Log Gerbang"
      columns={columns}
      scopes={scopes}
      defaultScopeKey={defaultScope}
      auditTable="gate_logs"
      auditSource="OPERATIONAL"
    />
  )
}
