import { ExportModal as SharedExportModal } from '../../../shared/export/ExportModal'
import { countWeekdays, summarizeDays } from '../../attendance/api'
import { STATUS_META, STATUS_ORDER } from '../../attendance/constants'
import type { HalaqahAttendanceDays, HalaqahSession } from '../types'

export interface PresensiExportRow {
  name: string
  className: string | null
  code: string
  days: HalaqahAttendanceDays
  note: string
}

interface ExportModalProps {
  open: boolean
  onClose: () => void
  year: number
  month: number
  session: HalaqahSession
  groupName: string
  rows: PresensiExportRow[]
}

const SESSION_LABEL: Record<HalaqahSession, string> = {
  mengaji: 'Mengaji Wafa',
  tahfidz: 'Tahfidz',
}

/** Ekspor grid presensi (grid hari + rekap status per anggota). */
export function ExportModal({
  open,
  onClose,
  year,
  month,
  session,
  groupName,
  rows,
}: ExportModalProps) {
  const daysInMonth = new Date(year, month, 0).getDate()
  const weekdays = countWeekdays(year, month)

  return (
    <SharedExportModal<PresensiExportRow>
      open={open}
      onClose={onClose}
      title="Ekspor Presensi Halaqah"
      subtitle={`${groupName} · ${SESSION_LABEL[session]} · ${month}/${year}`}
      filename={`presensi-halaqah-${month}-${year}`}
      sheetName="Presensi"
      auditTable="halaqah_attendance"
      auditSource="OPERATIONAL"
      columns={[
        { header: 'Nama', value: (r: PresensiExportRow) => r.name },
        { header: 'Kelas', value: (r: PresensiExportRow) => r.className ?? '' },
        { header: 'Kode Registrasi', value: (r: PresensiExportRow) => r.code },
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => ({
          header: String(day),
          value: (r: PresensiExportRow) => r.days[String(day)] ?? '',
        })),
        ...STATUS_ORDER.map((st) => ({
          header: STATUS_META[st].label,
          value: (r: PresensiExportRow) => summarizeDays(r.days)[st],
        })),
        {
          header: '% Hadir',
          value: (r: PresensiExportRow) => {
            const h = summarizeDays(r.days).H
            return weekdays > 0 ? `${Math.round((h / weekdays) * 100)}%` : '0%'
          },
        },
        { header: 'Catatan', value: (r: PresensiExportRow) => r.note },
      ]}
      scopes={[
        {
          key: 'grid',
          label: 'Presensi terpilih',
          description: `${rows.length} anggota · ${SESSION_LABEL[session]} ${month}/${year}`,
          count: rows.length,
          getRows: async () => rows,
        },
      ]}
    />
  )
}
