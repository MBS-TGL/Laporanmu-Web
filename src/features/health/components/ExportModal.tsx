import { useState } from 'react'
import { Radio } from 'antd'
import { ExportModal as SharedExportModal, type ExportScope } from '../../../shared/export/ExportModal'
import { logAudit } from '../../../shared/utils/auditLogger'
import { exportRekamCsv, exportRekamXlsx, exportStokCsv, exportStokXlsx } from '../export'
import type { HealthLog, HealthMedicine } from '../types'

type ExportData = 'rekam' | 'stok'

interface ExportModalProps {
  open: boolean
  onClose: () => void
  /** Hasil filter aktif di tab rekam */
  filteredLogs: HealthLog[]
  /** Log terpilih via rowSelection */
  selectedLogs: HealthLog[]
  medicines: HealthMedicine[]
  /** Pemakaian obat 30 hari (medicine_id → qty) */
  usage: Map<string, number>
  today: string
}

/**
 * Ekspor rekam medis / stok obat — UI di shared ExportModal, unduhan lewat
 * escape hatch `onExport` karena rekam medis menghasilkan workbook 2 sheet
 * (detail + ringkasan) yang tidak bisa diekspresikan sebagai columns tunggal.
 */
export function ExportModal({
  open,
  onClose,
  filteredLogs,
  selectedLogs,
  medicines,
  usage,
  today,
}: ExportModalProps) {
  const [dataKind, setDataKind] = useState<ExportData>('rekam')

  const scopes: ExportScope<unknown>[] =
    dataKind === 'rekam'
      ? [
          {
            key: 'filtered',
            label: `Hasil filter (${filteredLogs.length})`,
            description: 'Semua rekam yang cocok dengan pencarian, periode, status & kelas aktif saat ini.',
            count: filteredLogs.length,
            getRows: async () => filteredLogs,
          },
          {
            key: 'selected',
            label: `Terpilih (${selectedLogs.length})`,
            disabled: selectedLogs.length === 0,
            count: selectedLogs.length,
            getRows: async () => selectedLogs,
          },
        ]
      : [
          {
            key: 'stok',
            label: 'Stok Obat',
            description: 'Ekspor stok mencakup pemakaian 30 hari terakhir dan penanda stok kritis.',
            count: medicines.length,
            getRows: async () => medicines,
          },
        ]

  return (
    <SharedExportModal<unknown>
      open={open}
      onClose={onClose}
      size="lg"
      title="Export Data Kesehatan"
      subtitle="Rekam medis atau stok obat, sesuai filter aktif"
      filename="data-kesehatan"
      columns={[]}
      scopes={scopes}
      alertDescription={
        dataKind === 'rekam'
          ? 'Excel berisi 2 sheet: detail rekam medis + ringkasan (status, kelas, keluhan, obat, tren).'
          : 'Ekspor mencakup seluruh data (tidak dibatasi pagination daftar).'
      }
      extra={
        <div>
          <Radio.Group
            value={dataKind}
            onChange={(e) => setDataKind(e.target.value as ExportData)}
            optionType="button"
            buttonStyle="solid"
            options={[
              { value: 'rekam', label: 'Rekam Medis' },
              { value: 'stok', label: 'Stok Obat' },
            ]}
          />
        </div>
      }
      onExport={async ({ format, scopeKey }) => {
        if (dataKind === 'stok') {
          if (format === 'csv') exportStokCsv(medicines, usage)
          else await exportStokXlsx(medicines, usage, today)
          void logAudit({
            action: 'EXPORT',
            source: 'OPERATIONAL',
            tableName: 'health_medicines',
            newData: { format, count: medicines.length },
          })
        } else {
          const rows = scopeKey === 'selected' ? selectedLogs : filteredLogs
          if (format === 'csv') exportRekamCsv(rows, today)
          else await exportRekamXlsx(rows, medicines, today)
          void logAudit({
            action: 'EXPORT',
            source: 'OPERATIONAL',
            tableName: 'health_logs',
            newData: { format, scope: scopeKey, count: rows.length },
          })
        }
      }}
    />
  )
}
