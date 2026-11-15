import { ExportModal as SharedExportModal, type ExportColumn, type ExportScope } from '../../../shared/export/ExportModal'
import { DAY_LABELS } from '../SchedulesPage'
import type { Schedule } from '../types'

/** Kolom ekspor — satu sumber untuk CSV & Excel agar kolomnya selalu sinkron */
const columns: ExportColumn<Schedule>[] = [
  { header: 'Hari', value: (s) => DAY_LABELS[s.day_of_week] ?? s.day_of_week },
  { header: 'Mulai', value: (s) => (s.start_time ? s.start_time.slice(0, 5) : '') },
  { header: 'Selesai', value: (s) => (s.end_time ? s.end_time.slice(0, 5) : '') },
  { header: 'Kelas', value: (s) => s.classes?.name ?? '' },
  { header: 'Tingkat', value: (s) => s.classes?.grade ?? '' },
  { header: 'Mata Pelajaran', value: (s) => s.subjects?.name ?? '' },
  { header: 'Pengajar', value: (s) => s.teachers?.name ?? '' },
  { header: 'Ruang', value: (s) => s.room ?? '' },
  { header: 'Keterangan', value: (s) => s.notes ?? '' },
]

interface ExportModalProps {
  open: boolean
  onClose: () => void
  activeLevelName: string // 'SMP' | 'SMA'
  filteredSchedules: Schedule[]
  levelSchedules: Schedule[]
  allSchedules: Schedule[]
  conflictSchedules: Schedule[]
}

/** Ekspor jadwal KBM — wrapper tipis di atas shared ExportModal (filename per-cakupan). */
export function ExportModal({
  open,
  onClose,
  activeLevelName,
  filteredSchedules,
  levelSchedules,
  allSchedules,
  conflictSchedules,
}: ExportModalProps) {
  const scopes: ExportScope<Schedule>[] = [
    {
      key: 'filtered',
      label: `Hasil filter (${filteredSchedules.length})`,
      description: 'Hanya jadwal yang sedang tampil di layar sesuai pencarian dan filter kelas/hari.',
      count: filteredSchedules.length,
      getRows: async () => filteredSchedules,
    },
    {
      key: 'level',
      label: `Semua jadwal ${activeLevelName} (${levelSchedules.length})`,
      description: `Seluruh jadwal kelas jenjang ${activeLevelName} tanpa terpengaruh filter baris.`,
      count: levelSchedules.length,
      getRows: async () => levelSchedules,
    },
    ...(conflictSchedules.length > 0
      ? [
          {
            key: 'conflicts',
            label: `Hanya jadwal tabrakan (${conflictSchedules.length})`,
            description: 'Khusus jadwal yang bermasalah untuk dianalisis dan dibagikan ke kurikulum.',
            count: conflictSchedules.length,
            getRows: async () => conflictSchedules,
          },
        ]
      : []),
    {
      key: 'all',
      label: `Semua jadwal, SMP & SMA (${allSchedules.length})`,
      description: 'Seluruh database jadwal KBM lintas seluruh jenjang sekolah.',
      count: allSchedules.length,
      getRows: async () => allSchedules,
    },
  ]

  return (
    <SharedExportModal<Schedule>
      open={open}
      onClose={onClose}
      size="xl"
      title="Export Jadwal KBM"
      subtitle="Unduh data jadwal mengajar dalam format Excel atau CSV"
      filename={(scopeKey) => `jadwal-kbm-${scopeKey}`}
      sheetName="Jadwal KBM"
      columns={columns}
      scopes={scopes}
      auditTable="schedules"
      auditSource="OPERATIONAL"
    />
  )
}
