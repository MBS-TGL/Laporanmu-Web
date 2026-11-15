import { useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Progress,
  Radio,
  Space,
  Table,
  Tag,
  theme,
  type TableColumnsType,
} from 'antd'
import {
  CheckCircleOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  ImportOutlined,
  SwapOutlined,
} from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { ModalFooter } from '../../../shared/components/ModalFooter'
import { UploadDropzone } from '../../../shared/components/UploadDropzone'
import { logAudit } from '../../../shared/utils/auditLogger'
import { useBulkUpsertMedicines } from '../hooks'
import { parseMedicineTable, type ParsedMedicineRow } from '../importParse'
import {
  downloadErrorCsv,
  downloadMedicineTemplateCsv,
  downloadMedicineTemplateXlsx,
  readFileRows,
  type ErrorCsvRow,
} from '../importFile'
import type { MedicineUpsertPayload } from '../api'
import type { HealthMedicine } from '../types'

interface MedicineModalProps {
  open: boolean
  onClose: () => void
  medicines: HealthMedicine[]
}

interface PreviewRow extends ParsedMedicineRow {
  key: number
}

type StatusFilter = 'all' | ParsedMedicineRow['rowStatus']

/**
 * Impor stok obat dengan upsert-by-nama: nama yang sudah ada → diperbarui,
 * nama baru → ditambahkan. Cocok untuk migrasi catatan stok manual.
 */
export function MedicineModal({ open, onClose, medicines }: MedicineModalProps) {
  const { message } = App.useApp()
  const { token } = theme.useToken()

  const bulkMutation = useBulkUpsertMedicines()

  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [parsedRows, setParsedRows] = useState<PreviewRow[]>([])
  const [fileName, setFileName] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState({ processed: 0, total: 0 })
  const [result, setResult] = useState<{ inserted: number; updated: number; failed: number } | null>(null)

  const resetState = () => {
    setStep(0)
    setParsedRows([])
    setFileName('')
    setStatusFilter('all')
    setProgress({ processed: 0, total: 0 })
    setResult(null)
  }

  const handleModalClose = () => {
    if (busy) return
    resetState()
    onClose()
  }

  const handleFileSelected = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      message.error('Ukuran file maksimal 2 MB')
      return false
    }
    setBusy(true)
    try {
      const table = await readFileRows(file)
      if (table.length < 2) {
        message.error('File tidak memiliki baris data')
        return false
      }
      const { rows } = parseMedicineTable(table, medicines.map((m) => ({ id: m.id, name: m.name })))
      setFileName(file.name)
      setParsedRows(rows.map((r, i) => ({ ...r, key: i })))
      setStep(1)
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Gagal memproses file')
    } finally {
      setBusy(false)
    }
    return false
  }

  const counts = useMemo(() => {
    let baru = 0
    let perbarui = 0
    let error = 0
    for (const r of parsedRows) {
      if (r.rowStatus === 'baru') baru++
      else if (r.rowStatus === 'perbarui') perbarui++
      else error++
    }
    return { total: parsedRows.length, baru, perbarui, error }
  }, [parsedRows])

  const filteredRows = useMemo(() => {
    if (statusFilter === 'all') return parsedRows
    return parsedRows.filter((r) => r.rowStatus === statusFilter)
  }, [parsedRows, statusFilter])

  const handleDownloadErrorCsv = () => {
    const errorRows: ErrorCsvRow[] = parsedRows
      .filter((r) => r.rowStatus === 'error')
      .map((r) => ({
        baris: r.row,
        identitas: r.name || '(tanpa nama)',
        detail: [r.category, r.stock, r.unit, r.minStock].filter((v) => v !== '' && v !== 0).join(' · '),
        alasan: r.error ?? '',
      }))
    downloadErrorCsv('baris-error-impor-stok-obat', fileName, errorRows)
  }

  const handleApply = () => {
    const ok = parsedRows.filter((r) => r.rowStatus !== 'error')
    if (ok.length === 0) {
      message.warning('Tidak ada baris valid untuk diimpor')
      return
    }
    const payloads: MedicineUpsertPayload[] = ok.map((r) => ({
      row: r.row,
      id: r.existingId,
      values: {
        name: r.name,
        category: r.category || undefined,
        stock: r.stock,
        unit: r.unit,
        min_stock: r.minStock,
        description: r.description || undefined,
      },
    }))

    setProgress({ processed: 0, total: payloads.length })
    setBusy(true)
    bulkMutation.mutate(
      { payloads, onProgress: (processed, total) => setProgress({ processed, total }) },
      {
        onSuccess: (res) => {
          void logAudit({
            action: 'SYNC',
            source: 'OPERATIONAL',
            tableName: 'health_medicines',
            newData: { inserted: res.inserted, updated: res.updated, failed: res.failed, file: fileName },
          })
          setResult({ inserted: res.inserted, updated: res.updated, failed: res.failed })
          setStep(2)
        },
        onError: (err: Error) => message.error(err.message || 'Gagal mengimpor obat'),
        onSettled: () => setBusy(false),
      },
    )
  }

  const columns: TableColumnsType<PreviewRow> = [
    {
      title: 'Status',
      key: 'status',
      width: 100,
      render: (_, r) => {
        if (r.rowStatus === 'baru') return <Tag color="success">Baru</Tag>
        if (r.rowStatus === 'perbarui') return <Tag color="processing">Perbarui</Tag>
        return <Tag color="error">Error</Tag>
      },
    },
    {
      title: 'Nama Obat',
      key: 'name',
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.name || '-'}</div>
          {r.error && <div style={{ fontSize: 12, color: token.colorError }}>{r.error}</div>}
        </div>
      ),
    },
    { title: 'Kategori', dataIndex: 'category', key: 'category', width: 150, render: (v) => v || '-', responsive: ['md'] },
    {
      title: 'Stok',
      key: 'stock',
      width: 90,
      render: (_, r) => (
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          {r.stock} {r.unit}
        </span>
      ),
    },
    { title: 'Min.', dataIndex: 'minStock', key: 'minStock', width: 60, responsive: ['lg'] },
    { title: 'Keterangan', dataIndex: 'description', key: 'description', ellipsis: true, responsive: ['xl'] },
  ]

  return (
    <AppModal
      title="Import Stok Obat"
      subtitle="Nama yang sudah ada diperbarui, nama baru ditambahkan (upsert by nama)"
      icon={<SwapOutlined />}
      open={open}
      onCancel={handleModalClose}
      width={step === 1 ? 860 : 640}
      footer={null}
      destroyOnHidden
    >
      {step === 0 && (
        <div style={{ padding: '8px 0' }}>
          <div
            style={{
              background: token.colorFillAlter,
              padding: 16,
              borderRadius: 8,
              marginBottom: 16,
              border: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 6 }}>1. Unduh Template</div>
            <div style={{ fontSize: 13, color: token.colorTextSecondary, marginBottom: 12 }}>
              Kolom: nama, kategori, stok, satuan (tablet/botol/tube/sachet), min, keterangan. Jika{' '}
              <strong>nama obat sudah ada di stok</strong>, datanya diperbarui dengan nilai di file; jika
              belum, obat baru ditambahkan. Stok di file menggantikan stok saat ini.
            </div>
            <Space wrap>
              <Button icon={<FileExcelOutlined />} onClick={downloadMedicineTemplateXlsx}>
                Template Excel
              </Button>
              <Button icon={<DownloadOutlined />} onClick={downloadMedicineTemplateCsv}>
                Template CSV
              </Button>
            </Space>
          </div>

          <div style={{ fontWeight: 600, marginBottom: 8 }}>2. Pilih File Stok Obat</div>
          <UploadDropzone
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            beforeUpload={(file) => handleFileSelected(file as unknown as File)}
            disabled={busy}
            title="Klik atau tarik file CSV / Excel ke area ini"
            hint="Maksimal 2 MB. Pratinjau ditampilkan dulu, tidak ada perubahan sebelum kamu konfirmasi."
          />
          {busy && <Progress percent={70} status="active" style={{ marginTop: 12 }} />}
        </div>
      )}

      {step === 1 && (
        <div style={{ padding: '4px 0' }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 14,
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>
                Pratinjau: {fileName} <Tag color="processing">{counts.total} baris</Tag>
              </div>
              <div style={{ fontSize: 13, color: token.colorTextSecondary }}>
                <strong>{counts.baru}</strong> baru · <strong>{counts.perbarui}</strong> diperbarui ·{' '}
                <span style={{ color: token.colorErrorTextActive }}>{counts.error} error</span>
              </div>
            </div>

            <Radio.Group
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              size="small"
              buttonStyle="solid"
            >
              <Radio.Button value="all">Semua ({counts.total})</Radio.Button>
              <Radio.Button value="baru">Baru ({counts.baru})</Radio.Button>
              <Radio.Button value="perbarui">Perbarui ({counts.perbarui})</Radio.Button>
              <Radio.Button value="error">Error ({counts.error})</Radio.Button>
            </Radio.Group>
          </div>

          {counts.error > 0 && (
            <Alert
              type={counts.baru + counts.perbarui === 0 ? 'error' : 'warning'}
              showIcon
              style={{ marginBottom: 12 }}
              message="Sebagian baris bermasalah dan akan dilewati"
              description={
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>{counts.error} baris tidak valid (stok/satuan/nama).</span>
                  <Button size="small" danger onClick={handleDownloadErrorCsv} icon={<DownloadOutlined />}>
                    Unduh Baris Bermasalah (.csv)
                  </Button>
                </div>
              }
            />
          )}

          <Table<PreviewRow>
            columns={columns}
            dataSource={filteredRows}
            pagination={{ pageSize: 8, showSizeChanger: false, size: 'small' }}
            size="small"
            scroll={{ x: 640 }}
            style={{ marginBottom: 14 }}
          />

          {busy && (
            <div style={{ marginBottom: 12 }}>
              <Progress
                percent={progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0}
                status="active"
              />
              <span style={{ fontSize: 12, color: token.colorTextTertiary }}>
                Memproses {progress.processed}/{progress.total} baris…
              </span>
            </div>
          )}

          <ModalFooter
            left={
              <Button onClick={resetState} disabled={busy}>
                Ganti File
              </Button>
            }
            onCancel={handleModalClose}
            onOk={handleApply}
            okText={`Impor ${counts.baru + counts.perbarui} Obat`}
            okIcon={<ImportOutlined />}
            okDisabled={counts.baru + counts.perbarui === 0}
            okLoading={busy}
          />
        </div>
      )}

      {step === 2 && result && (
        <div style={{ padding: '24px 8px', textAlign: 'center' }}>
          <CheckCircleOutlined style={{ fontSize: 48, color: token.colorSuccess }} />
          <div style={{ fontWeight: 700, fontSize: 17, margin: '12px 0 4px' }}>
            {result.inserted} obat baru · {result.updated} diperbarui
          </div>
          <div style={{ fontSize: 13, color: token.colorTextSecondary, marginBottom: 16 }}>
            {result.failed > 0 ? `${result.failed} baris gagal disimpan.` : 'Semua baris berhasil diproses.'}
          </div>
          <Button type="primary" onClick={handleModalClose}>
            Selesai
          </Button>
        </div>
      )}
    </AppModal>
  )
}
