import { ExportModal as SharedExportModal, type ExportColumn, type ExportScope } from '../../../shared/export/ExportModal'
import { fetchPermitsByIds } from '../api'
import type { LeavePermit } from '../types'

/** Kolom ekspor — satu sumber untuk CSV & Excel agar kolomnya selalu sinkron */
const columns: ExportColumn<LeavePermit>[] = [
  { header: 'Kode Izin', value: (p) => p.id.slice(0, 8).toUpperCase() },
  { header: 'Santri', value: (p) => p.student?.name ?? '' },
  { header: 'Kode Santri', value: (p) => p.student?.registration_code ?? '' },
  { header: 'Kelas', value: (p) => p.student?.classes?.name ?? '' },
  { header: 'Tujuan', value: (p) => p.destination },
  { header: 'Keperluan', value: (p) => p.purpose },
  { header: 'Telepon', value: (p) => p.phone ?? '' },
  { header: 'Tanggal Keluar', value: (p) => p.leave_date },
  { header: 'Batas Kembali', value: (p) => p.return_deadline },
  { header: 'Status', value: (p) => p.status },
  { header: 'Penerbit', value: (p) => p.issuer?.name ?? '' },
  { header: 'Dibuat', value: (p) => p.created_at ?? '' },
]

type ExportScopeKey = 'filtered' | 'selected'

interface ExportModalProps {
  open: boolean
  onClose: () => void
  /** Baris hasil filter aktif halaman (in-memory) */
  filteredRows: LeavePermit[]
  selectedIds: string[]
  defaultScope?: ExportScopeKey
}

/** Ekspor izin keluar — wrapper tipis di atas shared ExportModal. */
export function ExportModal({ open, onClose, filteredRows, selectedIds, defaultScope = 'filtered' }: ExportModalProps) {
  const scopes: ExportScope<LeavePermit>[] = [
    {
      key: 'filtered',
      label: `Hasil filter (${filteredRows.length})`,
      description: 'Semua izin yang cocok dengan pencarian & filter aktif saat ini.',
      count: filteredRows.length,
      getRows: async () => filteredRows,
    },
    {
      key: 'selected',
      label: `Terpilih (${selectedIds.length})`,
      disabled: selectedIds.length === 0,
      count: selectedIds.length,
      getRows: () => fetchPermitsByIds(selectedIds),
    },
  ]

  return (
    <SharedExportModal<LeavePermit>
      open={open}
      onClose={onClose}
      title="Export Data Izin Keluar"
      filename="data-izin"
      sheetName="Izin Keluar"
      columns={columns}
      scopes={scopes}
      defaultScopeKey={defaultScope}
      auditTable="leave_permits"
      auditSource="OPERATIONAL"
    />
  )
}
