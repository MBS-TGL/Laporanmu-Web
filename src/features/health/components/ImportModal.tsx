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
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useQueryClient } from '@tanstack/react-query'
import { AppModal } from '../../../shared/components/AppModal'
import { ModalFooter } from '../../../shared/components/ModalFooter'
import { UploadDropzone } from '../../../shared/components/UploadDropzone'
import { logAudit } from '../../../shared/utils/auditLogger'
import { supabase } from '../../../lib/supabase'
import { updateMedicineStock } from '../api'
import { useBulkInsertHealthLogs, useStudentRoster } from '../hooks'
import { STATUS_LABEL } from '../constants'
import { parseLogTable, type ImportRowStatus, type ParsedLogRow } from '../importParse'
import {
  downloadErrorCsv,
  downloadLogTemplateCsv,
  downloadLogTemplateXlsx,
  readFileRows,
  type ErrorCsvRow,
} from '../importFile'
import type { NewHealthLogRow } from '../api'
import type { HealthLog, HealthMedicine } from '../types'

interface LogImportModalProps {
  open: boolean
  onClose: () => void
  medicines: HealthMedicine[]
  /** Semua log dimuat — dipakai untuk deteksi duplikat terhadap DB */
  logs: HealthLog[]
}

interface PreviewRow extends ParsedLogRow {
  key: number
}

type StatusFilter = 'all' | ImportRowStatus

interface DeductionInfo {
  name: string
  qty: number
}

/** Impor rekam kunjungan dari Excel/CSV — cocokkan santri via kode/nama, obat via nama. */
export function ImportModal({ open, onClose, medicines, logs }: LogImportModalProps) {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const qc = useQueryClient()

  const rosterQuery = useStudentRoster(open)
  const bulkMutation = useBulkInsertHealthLogs()

  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [parsedRows, setParsedRows] = useState<PreviewRow[]>([])
  const [fileName, setFileName] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState({ processed: 0, total: 0 })
  const [result, setResult] = useState<{ successful: number; failed: number } | null>(null)
  const [deductions, setDeductions] = useState<DeductionInfo[]>([])

  const resetState = () => {
    setStep(0)
    setParsedRows([])
    setFileName('')
    setStatusFilter('all')
    setProgress({ processed: 0, total: 0 })
    setResult(null)
    setDeductions([])
  }

  const handleModalClose = () => {
    if (busy) return
    resetState()
    onClose()
  }

  // Kunci duplikat DB: santri|tanggal|jam|keluhan — sama dengan parser
  const existingKeys = useMemo(
    () =>
      new Set(
        logs
          .filter((l) => l.student_id)
          .map((l) => `${l.student_id}|${l.date}|${l.time}|${l.complaint.trim().toLowerCase()}`),
      ),
    [logs],
  )

  const handleFileSelected = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      message.error('Ukuran file maksimal 2 MB')
      return false
    }
    const roster = rosterQuery.data
    if (!roster) {
      message.warning('Data santri masih dimuat, coba lagi sesaat lagi')
      return false
    }
    setBusy(true)
    try {
      const table = await readFileRows(file)
      if (table.length < 2) {
        message.error('File tidak memiliki baris data')
        return false
      }
      const { rows } = parseLogTable(table, {
        today: dayjs().format('YYYY-MM-DD'),
        roster,
        medicines: medicines.map((m) => ({ id: m.id, name: m.name, unit: m.unit })),
        existingKeys,
      })
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
    let siap = 0
    let duplikat = 0
    let takDikenal = 0
    let error = 0
    for (const r of parsedRows) {
      if (r.rowStatus === 'siap') siap++
      else if (r.rowStatus === 'duplikat') duplikat++
      else if (r.rowStatus === 'tak_dikenal') takDikenal++
      else error++
    }
    return { total: parsedRows.length, siap, duplikat, takDikenal, error }
  }, [parsedRows])

  const filteredRows = useMemo(() => {
    if (statusFilter === 'all') return parsedRows
    return parsedRows.filter((r) => r.rowStatus === statusFilter)
  }, [parsedRows, statusFilter])

  const handleDownloadErrorCsv = () => {
    const errorRows: ErrorCsvRow[] = parsedRows
      .filter((r) => r.rowStatus !== 'siap')
      .map((r) => ({
        baris: r.row,
        identitas: r.identifier,
        detail: [r.studentName, r.date, r.time, r.complaint, r.medicineName].filter(Boolean).join(' · '),
        alasan: r.error ?? r.rowStatus,
      }))
    downloadErrorCsv('baris-error-impor-rekam-medis', fileName, errorRows)
  }

  const handleApply = () => {
    const siap = parsedRows.filter((r) => r.rowStatus === 'siap')
    if (siap.length === 0) {
      message.warning('Tidak ada baris berstatus Siap untuk diimpor')
      return
    }
    const medicineById = new Map(medicines.map((m) => [m.id, m]))

    const rows: NewHealthLogRow[] = siap.map((r) => {
      const med = r.medicineId ? medicineById.get(r.medicineId) ?? null : null
      return {
        date: r.date,
        time: r.time,
        student_id: r.studentId,
        student_name: r.studentName ?? r.identifier,
        class_name: r.className,
        complaint: r.complaint,
        diagnosis: r.diagnosis || null,
        treatment: r.treatment || null,
        medicine_id: med?.id ?? null,
        medicine_name: med ? `${med.name} (${r.medicineQty} ${med.unit})` : null,
        medicine_qty: med ? r.medicineQty : 0,
        status: r.status,
        created_by: null,
      }
    })

    setProgress({ processed: 0, total: rows.length })
    setBusy(true)
    void supabase.auth.getUser().then(({ data: userData }) => {
      const createdBy = userData.user?.id ?? null
      bulkMutation.mutate(
        {
          rows: rows.map((r) => ({ ...r, created_by: createdBy })),
          onProgress: (processed, total) => setProgress({ processed, total }),
        },
        {
          onSuccess: async (res) => {
            // Deduksi stok hanya untuk baris yang benar-benar masuk
            const failedIdx = new Set(res.errors.map((e) => e.row))
            const totals = new Map<string, number>()
            siap.forEach((r, idx) => {
              if (failedIdx.has(idx) || !r.medicineId || r.medicineQty <= 0) return
              totals.set(r.medicineId, (totals.get(r.medicineId) ?? 0) + r.medicineQty)
            })
            const applied: DeductionInfo[] = []
            for (const [medId, qty] of totals) {
              const med = medicineById.get(medId)
              if (!med) continue
              try {
                await updateMedicineStock(medId, Math.max(0, med.stock - qty))
                applied.push({ name: med.name, qty })
              } catch {
                message.warning(`Gagal mengurangi stok ${med.name}, sesuaikan manual`)
              }
            }
            void qc.invalidateQueries({ queryKey: ['health'] })
            void logAudit({
              action: 'INSERT',
              source: 'OPERATIONAL',
              tableName: 'health_logs',
              newData: { imported: res.successful, failed: res.failed, file: fileName, stockDeductions: applied },
            })
            setResult({ successful: res.successful, failed: res.failed })
            setDeductions(applied)
            setStep(2)
          },
          onError: (err: Error) => message.error(err.message || 'Gagal mengimpor rekam medis'),
          onSettled: () => setBusy(false),
        },
      )
    })
  }

  const columns: TableColumnsType<PreviewRow> = [
    {
      title: 'Status',
      key: 'status',
      width: 105,
      render: (_, r) => {
        if (r.rowStatus === 'siap') return <Tag color="success">Siap</Tag>
        if (r.rowStatus === 'duplikat') return <Tag color="default">Duplikat</Tag>
        if (r.rowStatus === 'tak_dikenal') return <Tag color="warning">Tak dikenal</Tag>
        return <Tag color="error">Error</Tag>
      },
    },
    {
      title: 'Identitas (file)',
      key: 'identifier',
      width: 140,
      render: (_, r) => <span style={{ fontSize: 12.5, fontFamily: 'monospace' }}>{r.identifier}</span>,
    },
    {
      title: 'Santri',
      key: 'student',
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.studentName ?? '-'}</div>
          {r.matchBy && r.rowStatus === 'siap' && (
            <span style={{ fontSize: 11.5, color: token.colorTextTertiary }}>cocok via {r.matchBy} · {r.className ?? '-'}</span>
          )}
          {r.error && (
            <div style={{ fontSize: 12, color: r.rowStatus === 'error' ? token.colorError : token.colorWarning }}>
              {r.error}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Waktu',
      key: 'when',
      width: 105,
      render: (_, r) => (
        <span style={{ fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }}>
          {r.date || '-'}
          <br />
          {r.time}
        </span>
      ),
    },
    {
      title: 'Keluhan',
      key: 'complaint',
      render: (_, r) => (
        <span style={{ fontSize: 12.5 }}>
          {r.complaint || '-'}
          {r.medicineName && (
            <Tag style={{ marginInlineStart: 6, fontSize: 11 }}>
              {r.medicineName} ×{r.medicineQty}
            </Tag>
          )}
        </span>
      ),
    },
    {
      title: 'Status Akhir',
      key: 'statusAkhir',
      width: 110,
      render: (_, r) => <span style={{ fontSize: 12.5 }}>{STATUS_LABEL[r.status]}</span>,
      responsive: ['lg'],
    },
  ]

  return (
    <AppModal
      title="Import Rekam Medis"
      subtitle="Dari Excel/CSV: kunjungan ditambahkan langsung, stok obat terpotong otomatis"
      icon={<ImportOutlined />}
      open={open}
      onCancel={handleModalClose}
      width={step === 1 ? 920 : 640}
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
              Kolom: kode, nama, tanggal (kosong = hari ini), jam, keluhan, diagnosis, penanganan, obat,
              jumlah, status. Santri dicocokkan via <strong>kode registrasi</strong> lalu <strong>nama</strong>;
              obat dicocokkan dari nama stok dan <strong>stok otomatis terpotong</strong>. Status: UKS,
              asrama, kembali/sembuh (kosong = kembali KBM).
            </div>
            <Space wrap>
              <Button icon={<FileExcelOutlined />} onClick={() => downloadLogTemplateXlsx(dayjs().format('YYYY-MM-DD'))}>
                Template Excel
              </Button>
              <Button icon={<DownloadOutlined />} onClick={() => downloadLogTemplateCsv(dayjs().format('YYYY-MM-DD'))}>
                Template CSV
              </Button>
            </Space>
          </div>

          <div style={{ fontWeight: 600, marginBottom: 8 }}>2. Pilih File Rekam Medis</div>
          <UploadDropzone
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            beforeUpload={(file) => handleFileSelected(file as unknown as File)}
            disabled={busy}
            title="Klik atau tarik file CSV / Excel ke area ini"
            hint="Maksimal 2 MB. Pratinjau ditampilkan dulu, tidak ada data masuk sebelum kamu konfirmasi."
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
                <strong>{counts.siap}</strong> siap · {counts.duplikat} duplikat ·{' '}
                <span style={{ color: token.colorWarningTextActive }}>{counts.takDikenal} tak dikenal</span> ·{' '}
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
              <Radio.Button value="siap">Siap ({counts.siap})</Radio.Button>
              <Radio.Button value="duplikat">Duplikat ({counts.duplikat})</Radio.Button>
              <Radio.Button value="tak_dikenal">Tak dikenal ({counts.takDikenal})</Radio.Button>
              <Radio.Button value="error">Error ({counts.error})</Radio.Button>
            </Radio.Group>
          </div>

          {counts.error + counts.takDikenal + counts.duplikat > 0 && (
            <Alert
              type={counts.siap === 0 ? 'error' : 'warning'}
              showIcon
              style={{ marginBottom: 12 }}
              message="Sebagian baris bermasalah dan tidak akan diimpor"
              description={
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>
                    {counts.takDikenal > 0 && `${counts.takDikenal} baris tidak cocok dengan santri manapun. `}
                    {counts.duplikat > 0 && `${counts.duplikat} baris sudah ada di rekam medis. `}
                    {counts.error > 0 && `${counts.error} baris format/tanggal/obat tidak valid.`}
                  </span>
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
            scroll={{ x: 760 }}
            style={{ marginBottom: 14 }}
          />

          {busy && (
            <div style={{ marginBottom: 12 }}>
              <Progress
                percent={progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0}
                status="active"
              />
              <span style={{ fontSize: 12, color: token.colorTextTertiary }}>
                Mengimpor {progress.processed}/{progress.total} baris…
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
            okText={`Impor ${counts.siap} Rekam`}
            okIcon={<ImportOutlined />}
            okDisabled={counts.siap === 0}
            okLoading={busy}
          />
        </div>
      )}

      {step === 2 && result && (
        <div style={{ padding: '24px 8px', textAlign: 'center' }}>
          <CheckCircleOutlined style={{ fontSize: 48, color: token.colorSuccess }} />
          <div style={{ fontWeight: 700, fontSize: 17, margin: '12px 0 4px' }}>
            {result.successful} rekam medis berhasil diimpor
          </div>
          <div style={{ fontSize: 13, color: token.colorTextSecondary, marginBottom: 12 }}>
            {result.failed > 0 ? `${result.failed} baris gagal (lihat detail di pratinjau / unduh baris bermasalah).` : 'Semua baris berhasil masuk.'}
          </div>
          {deductions.length > 0 && (
            <div
              style={{
                background: token.colorFillAlter,
                border: `1px solid ${token.colorBorderSecondary}`,
                borderRadius: 8,
                padding: 12,
                marginBottom: 16,
                textAlign: 'left',
                fontSize: 12.5,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Stok obat terpotong otomatis:</div>
              {deductions.map((d) => (
                <div key={d.name}>
                  {d.name} ({d.qty} unit)
                </div>
              ))}
            </div>
          )}
          <Button type="primary" onClick={handleModalClose}>
            Selesai
          </Button>
        </div>
      )}
    </AppModal>
  )
}
