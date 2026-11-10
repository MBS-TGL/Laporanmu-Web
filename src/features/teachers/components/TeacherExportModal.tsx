import { useState } from 'react'
import { App, Alert, Button, Radio, Space, Typography } from 'antd'
import { ExportOutlined, FileExcelOutlined, FileTextOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { logAudit } from '../../../shared/utils/auditLogger'
import {
  downloadTeachersCsv,
  downloadTeachersXlsx,
  fetchAllTeachers,
  fetchTeachersByIds,
} from '../api'
import type { TeacherFilters } from '../types'

type ExportFormat = 'csv' | 'xlsx'
type ExportScope = 'filtered' | 'selected'

interface ExportModalProps {
  open: boolean
  onClose: () => void
  /** Filter aktif halaman — dipakai untuk lingkup "hasil filter" */
  filters: Omit<TeacherFilters, 'page' | 'pageSize'>
  selectedIds: string[]
  /** Lingkup yang dipilih saat modal dibuka (dari menu / bar massal) */
  defaultScope?: ExportScope
  /** Perkiraan jumlah baris lingkup "hasil filter" */
  filteredCount: number
}

export function TeacherExportModal({
  open,
  onClose,
  filters,
  selectedIds,
  defaultScope = 'filtered',
  filteredCount,
}: ExportModalProps) {
  const { message } = App.useApp()
  const [format, setFormat] = useState<ExportFormat>('xlsx')
  const [scope, setScope] = useState<ExportScope>(defaultScope)
  const [submitting, setSubmitting] = useState(false)

  // Sinkronkan lingkup dengan default terbaru tiap kali modal dibuka lagi
  // (pattern "adjust state saat prop berubah" — render-phase, bukan effect)
  const [prevDefaultScope, setPrevDefaultScope] = useState(defaultScope)
  if (defaultScope !== prevDefaultScope) {
    setPrevDefaultScope(defaultScope)
    setScope(defaultScope)
  }

  const scopeCount = scope === 'selected' ? selectedIds.length : filteredCount

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const rows =
        scope === 'selected'
          ? await fetchTeachersByIds(selectedIds)
          : await fetchAllTeachers(filters)
      if (rows.length === 0) {
        message.info('Tidak ada data untuk diekspor')
        return
      }
      if (format === 'csv') downloadTeachersCsv(rows)
      else await downloadTeachersXlsx(rows)
      void logAudit({
        action: 'EXPORT',
        source: 'MASTER',
        tableName: 'teachers',
        newData: { format, scope, count: rows.length },
      })
      message.success(`${rows.length} guru diekspor (${format === 'csv' ? 'CSV' : 'Excel'})`)
      onClose()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Gagal mengekspor data')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppModal
      open={open}
      onCancel={onClose}
      width={440}
      title="Export Data Guru"
      subtitle="Pilih format dan cakupan data yang diekspor"
      icon={<ExportOutlined />}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose}>Batal</Button>
          <Button type="primary" icon={<ExportOutlined />} loading={submitting} onClick={() => void handleSubmit()}>
            Ekspor
          </Button>
        </div>
      }
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
            Format
          </Typography.Text>
          <Radio.Group
            value={format}
            onChange={(e) => setFormat(e.target.value as ExportFormat)}
            optionType="button"
            buttonStyle="solid"
            options={[
              { value: 'xlsx', label: <span><FileExcelOutlined /> Excel (.xlsx)</span> },
              { value: 'csv', label: <span><FileTextOutlined /> CSV</span> },
            ]}
          />
        </div>
        <div>
          <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
            Cakupan
          </Typography.Text>
          <Radio.Group
            value={scope}
            onChange={(e) => setScope(e.target.value as ExportScope)}
            optionType="button"
            buttonStyle="solid"
            options={[
              { value: 'filtered', label: `Hasil filter (${filteredCount})` },
              {
                value: 'selected',
                label: `Terpilih (${selectedIds.length})`,
                disabled: selectedIds.length === 0,
              },
            ]}
          />
          {scope === 'filtered' && (
            <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
              Semua guru yang cocok dengan pencarian &amp; filter aktif saat ini.
            </Typography.Paragraph>
          )}
        </div>
        <Alert
          type="info"
          showIcon
          message={`${scopeCount} guru akan diekspor`}
          description="Ekspor mencakup seluruh data — tidak dibatasi pagination daftar."
          style={{ borderRadius: 10 }}
        />
      </Space>
    </AppModal>
  )
}
