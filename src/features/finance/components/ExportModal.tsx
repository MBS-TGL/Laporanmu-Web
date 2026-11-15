import { ExportModal as SharedExportModal, type ExportColumn } from '../../../shared/export/ExportModal'

interface ExportModalProps<T> {
  open: boolean
  onClose: () => void
  title: string
  filename: string
  rows: T[]
  columns: ExportColumn<T>[]
  auditTable: string
}

/** Wrapper tipis shared ExportModal untuk tiga tab keuangan (rows sudah terfilter). */
export function ExportModal<T>({ open, onClose, title, filename, rows, columns, auditTable }: ExportModalProps<T>) {
  return (
    <SharedExportModal<T>
      open={open}
      onClose={onClose}
      title={title}
      filename={filename}
      auditTable={auditTable}
      scopes={[
        {
          key: 'all',
          label: 'Semua data tampilan',
          description: `${rows.length} baris`,
          count: rows.length,
          getRows: async () => rows,
        },
      ]}
      columns={columns}
    />
  )
}
