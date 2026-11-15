import { ExportModal, type ExportColumn } from '../../../shared/export/ExportModal'

interface KeuanganExportModalProps<T> {
  open: boolean
  onClose: () => void
  title: string
  filename: string
  rows: T[]
  columns: ExportColumn<T>[]
  auditTable: string
}

/** Wrapper tipis shared ExportModal untuk tiga tab keuangan (rows sudah terfilter). */
export function KeuanganExportModal<T>({ open, onClose, title, filename, rows, columns, auditTable }: KeuanganExportModalProps<T>) {
  return (
    <ExportModal<T>
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
