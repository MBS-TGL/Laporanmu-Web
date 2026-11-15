import { ExportModal as SharedExportModal } from '../../../shared/export/ExportModal'
import type { CbtQuestion } from '../types'

interface ExportModalProps {
  open: boolean
  onClose: () => void
  /** Baris sesuai filter aktif saat ini. */
  rows: CbtQuestion[]
  /** Seluruh bank soal (dipakai scope "Semua"). */
  allRows: CbtQuestion[]
  selected: string[]
}

/** Ekspor bank soal (XLSX/CSV) — wrapper tipis shared ExportModal. */
export function ExportModal({ open, onClose, rows, allRows, selected }: ExportModalProps) {
  return (
    <SharedExportModal<CbtQuestion>
      open={open}
      onClose={onClose}
      title="Export Bank Soal"
      filename="bank-soal-cbt"
      auditTable="cbt_questions"
      scopes={[
        {
          key: 'filtered',
          label: 'Data tampilan',
          description: `${rows.length} soal sesuai filter aktif`,
          count: rows.length,
          getRows: async () => rows,
        },
        {
          key: 'selected',
          label: 'Baris terpilih',
          description: `${selected.length} soal dicentang`,
          count: selected.length,
          disabled: selected.length === 0,
          getRows: async () => allRows.filter((q) => selected.includes(q.id)),
        },
        {
          key: 'all',
          label: 'Semua bank soal',
          description: `${allRows.length} soal`,
          count: allRows.length,
          getRows: async () => allRows,
        },
      ]}
      columns={[
        { header: 'Soal', value: (q) => q.question },
        { header: 'Kelas', value: (q) => q.class_subject?.class?.name ?? '' },
        { header: 'Mapel', value: (q) => q.class_subject?.subject?.name ?? '' },
        {
          header: 'Opsi',
          value: (q) => q.options.map((o) => `${o.key}. ${o.text}`).join(' | '),
        },
        { header: 'Kunci', value: (q) => q.answer_key },
        { header: 'Poin', value: (q) => String(q.points) },
        { header: 'Pembahasan', value: (q) => q.explanation ?? '' },
      ]}
    />
  )
}
