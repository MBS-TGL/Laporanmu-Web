import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import {
  App,
  Button,
  Collapse,
  Input,
  Popover,
  Progress,
  Segmented,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  Upload,
  theme,
  type TableColumnsType,
} from 'antd'
import {
  CheckCircleFilled,
  DownloadOutlined,
  DownOutlined,
  FileAddOutlined,
  FileExcelOutlined,
  GlobalOutlined,
  ImportOutlined,
  LinkOutlined,
  TableOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import Papa from 'papaparse'
import dayjs from 'dayjs'
import { WizardModal } from '../../../shared/components/WizardModal'
import { IconBox } from '../../../shared/components/IconBox'
import { ModalFooter } from '../../../shared/components/ModalFooter'
import { ModalNotice } from '../../../shared/components/ModalNotice'
import { ModalSection } from '../../../shared/components/ModalSection'
import { UploadDropzone } from '../../../shared/components/UploadDropzone'
import { readSheet } from '../../../shared/import/readFile'
import { logAudit } from '../../../shared/utils/auditLogger'
import { supabase } from '../../../lib/supabase'
import { updateMedicineStock, type NewHealthLogRow } from '../api'
import { useBulkInsertHealthLogs, useStudentRoster } from '../hooks'
import { STATUS_LABEL } from '../constants'
import {
  FIELDS,
  SAMPLE_COLUMNS,
  autoMatch,
  columnLetter,
  downloadTemplate,
  parseLogTable,
  sampleValues,
  type FieldKey,
  type ImportRowStatus,
  type Mapping,
  type ParsedLogRow,
} from '../importParse'
import { downloadErrorCsv, type ErrorCsvRow } from '../importFile'
import type { HealthLog, HealthMedicine } from '../types'

const { Text } = Typography

interface LogImportModalProps {
  open: boolean
  onClose: () => void
  medicines: HealthMedicine[]
  /** Semua log dimuat — dipakai untuk deteksi duplikat terhadap DB */
  logs: HealthLog[]
  /** sumber data aktif saat modal dibuka (default: upload file) */
  initialSource?: 'file' | 'gsheets'
}

type ReviewFilter = 'all' | ImportRowStatus

interface HealthImportResult {
  successful: number
  failed: number
}

interface DeductionInfo {
  name: string
  qty: number
}

/** Impor rekam medis — pola WizardModal students: Upload → Mapping → Review → Hasil. */
export function ImportModal({ open, onClose, medicines, logs, initialSource = 'file' }: LogImportModalProps) {
  const { message } = App.useApp()
  const { token } = theme.useToken()

  const [step, setStep] = useState(0)
  const [fileName, setFileName] = useState<string>()
  const [reading, setReading] = useState(false)
  const [sheetSource, setSheetSource] = useState<'file' | 'gsheets'>('file')
  const [gsheetsUrl, setGsheetsUrl] = useState('')
  const [fetchingSheet, setFetchingSheet] = useState(false)
  const [headers, setHeaders] = useState<string[]>([])
  const [fileRows, setFileRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Mapping>({})
  const [autoKeys, setAutoKeys] = useState<Set<FieldKey>>(new Set())
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all')
  const [results, setResults] = useState<HealthImportResult | null>(null)
  const [deductions, setDeductions] = useState<DeductionInfo[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null)

  const rosterQuery = useStudentRoster(open)
  const bulkMutation = useBulkInsertHealthLogs()

  const roster = useMemo(() => rosterQuery.data ?? [], [rosterQuery.data])
  const rosterPending = rosterQuery.isPending

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

  // buka langsung pada sumber yang diminta — pola penyesuaian state saat render
  const [prevOpen, setPrevOpen] = useState(false)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setSheetSource(initialSource)
  }

  // Pemetaan kolom → parser murni (error ditangkap; langkah Review selalu
  // sudah memenuhi kolom wajib sehingga parse tidak melempar di sana)
  const parsed = useMemo<{ rows: ParsedLogRow[] }>(() => {
    if (fileRows.length === 0) return { rows: [] }
    try {
      return parseLogTable([headers, ...fileRows], mapping, {
        today: dayjs().format('YYYY-MM-DD'),
        roster,
        medicines: medicines.map((m) => ({ id: m.id, name: m.name, unit: m.unit })),
        existingKeys,
      })
    } catch {
      return { rows: [] }
    }
  }, [headers, fileRows, mapping, roster, medicines, existingKeys])

  const rows = parsed.rows
  const readyRows = useMemo(() => rows.filter((r) => r.rowStatus === 'siap'), [rows])
  const counts = useMemo(() => {
    let duplikat = 0
    let takDikenal = 0
    let error = 0
    for (const r of rows) {
      if (r.rowStatus === 'duplikat') duplikat++
      else if (r.rowStatus === 'tak_dikenal') takDikenal++
      else if (r.rowStatus === 'error') error++
    }
    return { total: rows.length, duplikat, takDikenal, error }
  }, [rows])
  const shownRows = useMemo(() => {
    if (reviewFilter === 'all') return rows
    return rows.filter((r) => r.rowStatus === reviewFilter)
  }, [rows, reviewFilter])

  const mappedCount = FIELDS.filter((f) => mapping[f.key] !== undefined).length
  const missingRequired = [
    mapping.keluhan === undefined && 'Keluhan',
    mapping.kode === undefined && mapping.nama === undefined && 'Kode / Nama (salah satu)',
  ].filter(Boolean) as string[]

  const reset = () => {
    setStep(0)
    setFileName(undefined)
    setReading(false)
    setSheetSource('file')
    setGsheetsUrl('')
    setFetchingSheet(false)
    setHeaders([])
    setFileRows([])
    setMapping({})
    setAutoKeys(new Set())
    setReviewFilter('all')
    setResults(null)
    setDeductions([])
    setSubmitting(false)
    setImportProgress(null)
  }

  const handleClose = () => {
    if (submitting) return
    onClose()
    // reset setelah modal tertutup agar transisi tidak terlihat
    setTimeout(reset, 200)
  }

  const applyTable = (table: string[][], name: string) => {
    const head = (table[0] ?? []).map((h) => h.replace(/^\ufeff/, '').trim())
    const body = table.slice(1).filter((row) => row.some((c) => c.trim() !== ''))
    if (head.length === 0 || body.length === 0) {
      message.error('Data kosong atau formatnya tidak sesuai (baris pertama harus berisi judul kolom)')
      return
    }
    const matched = autoMatch(head)
    setHeaders(head)
    setFileRows(body)
    setMapping(matched)
    setAutoKeys(new Set(Object.keys(matched) as FieldKey[]))
    setFileName(name)
    setStep(1)
  }

  const handleFile = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      message.error('Ukuran file maksimal 2 MB')
      return
    }
    setReading(true)
    try {
      const table = await readSheet(file)
      applyTable(table, file.name)
    } catch {
      message.error('Gagal membaca file. Pastikan file berformat .csv atau .xlsx yang valid')
    } finally {
      setReading(false)
    }
  }

  const handleFetchGSheets = async () => {
    const match = gsheetsUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
    if (!match) {
      message.error('Tautan tidak valid. Gunakan tautan Google Sheets yang benar.')
      return
    }
    // hormati #gid= di URL supaya tab tertentu bisa dipilih; tanpa gid = sheet pertama
    const gid = gsheetsUrl.match(/[#&?]gid=([0-9]+)/)?.[1]
    setFetchingSheet(true)
    try {
      const res = await fetch(
        `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv${gid ? `&gid=${gid}` : ''}`,
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = (await res.text()).trim()
      // respons HTML berarti sheet tidak dibagikan secara publik
      if (text.startsWith('<')) throw new Error('bukan csv')
      const parsedCsv = Papa.parse<string[]>(text, { skipEmptyLines: true })
      applyTable(
        parsedCsv.data.map((row) => row.map((c) => String(c ?? ''))),
        'Google Sheets',
      )
    } catch {
      message.error(
        'Gagal mengambil data sheet. Pastikan sheet dibagikan sebagai "Siapa saja yang memiliki link" dapat melihat.',
      )
    } finally {
      setFetchingSheet(false)
    }
  }

  const changeMapping = (field: FieldKey, index?: number) => {
    setMapping((prev) => {
      const next = { ...prev }
      if (index === undefined) delete next[field]
      else next[field] = index
      return next
    })
    setAutoKeys((prev) => {
      const next = new Set(prev)
      next.delete(field)
      return next
    })
  }

  const handleDownloadErrorCsv = () => {
    const errorRows: ErrorCsvRow[] = rows
      .filter((r) => r.rowStatus !== 'siap')
      .map((r) => ({
        baris: r.row,
        identitas: r.identifier,
        detail: [r.studentName, r.date, r.time, r.complaint, r.medicineName].filter(Boolean).join(' · '),
        alasan: r.error ?? r.rowStatus,
      }))
    downloadErrorCsv('baris-error-impor-rekam-medis', fileName ?? 'impor', errorRows)
  }

  const handleImport = async () => {
    if (readyRows.length === 0) {
      message.warning('Tidak ada baris berstatus Siap untuk diimpor')
      return
    }
    setSubmitting(true)
    const medicineById = new Map(medicines.map((m) => [m.id, m]))
    try {
      const payload: NewHealthLogRow[] = readyRows.map((r) => {
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
      const { data: userData } = await supabase.auth.getUser()
      const createdBy = userData.user?.id ?? null
      setImportProgress({ done: 0, total: payload.length })
      const res = await bulkMutation.mutateAsync({
        rows: payload.map((r) => ({ ...r, created_by: createdBy })),
        onProgress: (processed, total) => setImportProgress({ done: processed, total }),
      })

      // Deduksi stok hanya untuk baris yang benar-benar masuk
      const failedIdx = new Set(res.errors.map((e) => e.row))
      const totals = new Map<string, number>()
      readyRows.forEach((r, idx) => {
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
      void logAudit({
        action: 'INSERT',
        source: 'OPERATIONAL',
        tableName: 'health_logs',
        newData: { imported: res.successful, failed: res.failed, file: fileName, stockDeductions: applied },
      })
      setResults({ successful: res.successful, failed: res.failed })
      setDeductions(applied)
      setStep(3)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Gagal mengimpor rekam medis')
    } finally {
      setSubmitting(false)
      setImportProgress(null)
    }
  }

  // -------------------------------------------------------------------------
  // Potongan UI
  // -------------------------------------------------------------------------

  const card: CSSProperties = {
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadiusLG,
    background: token.colorBgContainer,
  }

  const referenceContent = (
    <div style={{ width: 320, maxWidth: 'calc(100vw - 48px)', maxHeight: 260, overflowY: 'auto', padding: 4 }}>
      {medicines.length === 0 ? (
        <div style={{ padding: '16px 12px', fontSize: 12.5, color: token.colorTextSecondary, textAlign: 'center' }}>
          Belum ada stok obat.
        </div>
      ) : (
        medicines.map((m) => (
          <div key={m.id} className="ref-row" style={{ padding: '5px 10px', fontSize: 12.5 }}>
            {m.name}{' '}
            <span style={{ color: token.colorTextTertiary }}>
              ({m.stock} {m.unit})
            </span>
          </div>
        ))
      )}
    </div>
  )

  const columnStructure = (
    <div style={{ ...card, overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          padding: '10px 16px',
          background: token.colorFillAlter,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Text strong style={{ fontSize: 12, letterSpacing: 0.4 }}>
          <TableOutlined style={{ marginRight: 8, color: token.colorPrimary }} />
          CONTOH ISI FILE EXCEL
        </Text>
        <Text style={{ fontSize: 12, color: token.colorSuccess, fontWeight: 600, whiteSpace: 'nowrap' }}>
          <CheckCircleFilled style={{ marginRight: 6 }} />
          Pencocokan otomatis
        </Text>
      </div>
      {/* bayangan di tepi kiri/kanan muncul otomatis bila tabel bisa digeser */}
      <div
        style={{
          overflowX: 'auto',
          backgroundColor: token.colorBgContainer,
          backgroundRepeat: 'no-repeat',
          backgroundSize: '32px 100%, 32px 100%, 12px 100%, 12px 100%',
          backgroundPosition: '0 0, 100% 0, 0 0, 100% 0',
          backgroundAttachment: 'local, local, scroll, scroll',
          backgroundImage: `linear-gradient(to right, ${token.colorBgContainer}, transparent), linear-gradient(to left, ${token.colorBgContainer}, transparent), radial-gradient(farthest-side at 0 50%, rgba(0,0,0,0.14), transparent), radial-gradient(farthest-side at 100% 50%, rgba(0,0,0,0.14), transparent)`,
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <tbody>
            {/* baris 1 = judul kolom, persis seperti di Excel */}
            <tr>
              <td
                style={{
                  width: 36,
                  textAlign: 'center',
                  fontSize: 13,
                  color: token.colorTextTertiary,
                  background: token.colorFillTertiary,
                  borderBottom: `2px solid ${token.colorBorder}`,
                }}
              >
                1
              </td>
              {SAMPLE_COLUMNS.map((col) => (
                <td
                  key={col.key}
                  title={col.required ? 'Wajib diisi' : 'Opsional'}
                  style={{
                    padding: '9px 14px',
                    borderLeft: `1px solid ${token.colorBorderSecondary}`,
                    borderBottom: `2px solid ${token.colorBorder}`,
                    background: token.colorFillTertiary,
                    fontSize: 13,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {col.label}
                  {col.required && <span style={{ color: token.colorError, marginLeft: 3 }}>*</span>}
                </td>
              ))}
            </tr>
            {[0, 1].map((r) => (
              <tr key={r}>
                <td
                  style={{
                    textAlign: 'center',
                    fontSize: 13,
                    color: token.colorTextTertiary,
                    background: token.colorFillAlter,
                    borderTop: r === 0 ? undefined : `1px solid ${token.colorBorderSecondary}`,
                  }}
                >
                  {r + 2}
                </td>
                {SAMPLE_COLUMNS.map((col) => (
                  <td
                    key={col.key}
                    style={{
                      padding: '9px 14px',
                      borderLeft: `1px solid ${token.colorBorderSecondary}`,
                      borderTop: r === 0 ? undefined : `1px solid ${token.colorBorderSecondary}`,
                      fontSize: 13,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {col.values[r]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          padding: '8px 16px',
          borderTop: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Text type="secondary" style={{ fontSize: 12 }}>
          <span style={{ color: token.colorError }}>*</span> Wajib diisi. Baris 1 adalah judul kolom, urutan
          bebas.{FIELDS.length - SAMPLE_COLUMNS.length > 0 ? ` ${FIELDS.length - SAMPLE_COLUMNS.length} kolom opsional lain ada di Template Excel.` : ''}
        </Text>
        <Space size={4}>
          <Tag style={{ margin: 0 }}>.xlsx</Tag>
          <Tag style={{ margin: 0 }}>.csv</Tag>
        </Space>
      </div>
    </div>
  )

  const fieldSelectStatus = (f: (typeof FIELDS)[number]) => {
    if ('required' in f && f.required && mapping[f.key] === undefined) return 'error' as const
    // pasangan identitas: cukup salah satu terpetakan
    if ((f.key === 'kode' || f.key === 'nama') && mapping.kode === undefined && mapping.nama === undefined)
      return 'error' as const
    return undefined
  }

  const mappingColumns = [
    {
      title: 'Data Rekam Medis',
      key: 'field',
      width: 190,
      render: (_: unknown, f: (typeof FIELDS)[number]) => (
        <Space size={6} wrap>
          <Text strong>{f.label}</Text>
          {'required' in f && f.required ? <Tag color="red" style={{ margin: 0 }}>Wajib</Tag> : null}
        </Space>
      ),
    },
    {
      title: 'Kolom di File',
      key: 'column',
      width: 250,
      render: (_: unknown, f: (typeof FIELDS)[number]) => (
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="Tidak dipetakan"
          style={{ width: '100%' }}
          status={fieldSelectStatus(f)}
          value={mapping[f.key]}
          onChange={(v: number | undefined) => changeMapping(f.key, v)}
          options={headers.map((h, i) => ({
            value: i,
            label: `${columnLetter(i)}: ${h || '(tanpa judul)'}`,
          }))}
        />
      ),
    },
    {
      title: 'Contoh Data',
      key: 'sample',
      render: (_: unknown, f: (typeof FIELDS)[number]) => {
        const values = sampleValues(fileRows, mapping[f.key])
        return values.length ? (
          <Text type="secondary" ellipsis style={{ maxWidth: 200 }}>
            {values.join(', ')}
          </Text>
        ) : (
          '-'
        )
      },
    },
    {
      title: '',
      key: 'status',
      width: 110,
      render: (_: unknown, f: (typeof FIELDS)[number]) => {
        if (mapping[f.key] === undefined) return null
        return autoKeys.has(f.key) ? (
          <Tag color="green" style={{ margin: 0 }}>
            Otomatis
          </Tag>
        ) : (
          <Tag color="blue" style={{ margin: 0 }}>
            Manual
          </Tag>
        )
      },
    },
  ]

  const previewColumns: TableColumnsType<ParsedLogRow> = [
    { title: '#', dataIndex: 'row', key: 'row', width: 50 },
    {
      title: 'Status',
      dataIndex: 'rowStatus',
      key: 'rowStatus',
      width: 110,
      render: (_: unknown, r: ParsedLogRow) => {
        if (r.rowStatus === 'siap') return <Tag color="success">Siap</Tag>
        if (r.rowStatus === 'duplikat') return <Tag color="default">Duplikat</Tag>
        if (r.rowStatus === 'tak_dikenal') return <Tag color="warning">Tak dikenal</Tag>
        return <Tag color="error">Error</Tag>
      },
    },
    {
      title: 'Identitas (file)',
      dataIndex: 'identifier',
      key: 'identifier',
      width: 140,
      render: (v: string) => (
        <span style={{ fontSize: 12.5, fontFamily: 'monospace' }}>{v}</span>
      ),
    },
    {
      title: 'Santri',
      key: 'student',
      render: (_: unknown, r: ParsedLogRow) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.studentName ?? '-'}</div>
          {r.matchBy && r.rowStatus === 'siap' && (
            <span style={{ fontSize: 11.5, color: token.colorTextTertiary }}>
              cocok via {r.matchBy} · {r.className ?? '-'}
            </span>
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
      render: (_: unknown, r: ParsedLogRow) => (
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
      render: (_: unknown, r: ParsedLogRow) => (
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
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (v: ParsedLogRow['status']) => <span style={{ fontSize: 12.5 }}>{STATUS_LABEL[v]}</span>,
      responsive: ['lg'],
    },
  ]

  const statCard = (label: string, value: number, color?: string) => (
    <div style={{ ...card, padding: '12px 16px', flex: 1, minWidth: 120 }}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {label}
      </Text>
      <div style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.2, color }}>{value}</div>
    </div>
  )

  const pickFileButton = (
    <Upload
      accept=".csv,.xlsx,.xls"
      showUploadList={false}
      disabled={reading}
      beforeUpload={(file) => {
        void handleFile(file)
        return false
      }}
    >
      <Button type="primary" icon={<UploadOutlined />} loading={reading}>
        Pilih File
      </Button>
    </Upload>
  )

  const footerByStep = (s: number): ReactNode => {
    if (s === 0) {
      // ok-nya tombol Pilih File ber-bungkus Upload, bukan Button biasa, sehingga
      // komposisi footer dijaga manual mengikuti bentuk ModalFooter
      return (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button onClick={handleClose}>Batal</Button>
          {pickFileButton}
        </div>
      )
    }
    if (s === 1) {
      return (
        <ModalFooter
          left={<Button onClick={() => setStep(0)}>Ganti File</Button>}
          onOk={() => setStep(2)}
          okText="Lanjut ke Review"
          okDisabled={missingRequired.length > 0 || rosterPending}
        />
      )
    }
    if (s === 2) {
      return (
        <ModalFooter
          left={
            <Button onClick={() => setStep(1)} disabled={submitting}>
              Kembali
            </Button>
          }
          onOk={() => void handleImport()}
          okText={`Impor ${readyRows.length} Rekam`}
          okLoading={submitting}
          okDisabled={readyRows.length === 0}
        />
      )
    }
    return <ModalFooter onOk={handleClose} okText="Selesai" />
  }

  return (
    <WizardModal
      title="Impor Rekam Medis"
      subtitle="Unggah rekam kunjungan dari file Excel, CSV, atau Google Sheets. Santri & obat dicocokkan otomatis, stok terpotong otomatis."
      icon={<ImportOutlined />}
      open={open}
      onCancel={handleClose}
      destroyOnHidden
      size="xl"
      current={step}
      footerByStep={footerByStep}
      steps={[
        { title: 'Upload', description: 'Pilih file' },
        { title: 'Mapping', description: 'Atur kolom' },
        { title: 'Review', description: 'Validasi' },
        { title: 'Hasil', description: 'Selesai' },
      ]}
    >
      {step === 0 && (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Segmented
            value={sheetSource}
            onChange={(v) => setSheetSource(v as 'file' | 'gsheets')}
            options={[
              { label: 'Upload File', value: 'file', icon: <FileExcelOutlined /> },
              { label: 'Google Sheets', value: 'gsheets', icon: <LinkOutlined /> },
            ]}
          />

          {sheetSource === 'file' ? (
            <Spin spinning={reading} tip="Membaca file...">
              <UploadDropzone
                accept=".csv,.xlsx,.xls"
                multiple={false}
                disabled={reading}
                icon={<FileAddOutlined />}
                title="Klik atau seret file ke sini"
                hint="Mendukung .csv dan .xlsx, maksimal 2 MB"
                beforeUpload={(file) => {
                  void handleFile(file)
                  return false
                }}
              />
            </Spin>
          ) : (
            <div style={{ ...card, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <IconBox icon={<GlobalOutlined />} size={36} />
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>Sinkronisasi data via Google Sheets</div>
                  <Text type="secondary" style={{ fontSize: 12.5 }}>
                    Tempel tautan sheet publik, sistem akan mengambil baris pertama sebagai judul kolom
                  </Text>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Input
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={gsheetsUrl}
                  onChange={(e) => setGsheetsUrl(e.target.value)}
                  onPressEnter={() => void handleFetchGSheets()}
                  disabled={fetchingSheet}
                />
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  loading={fetchingSheet}
                  disabled={!gsheetsUrl.trim()}
                  onClick={() => void handleFetchGSheets()}
                >
                  Ambil Data
                </Button>
              </div>
              <div style={{ marginTop: 12 }}>
                <ModalNotice tone="info" title="Sheet harus publik">
                  {'Di Google Sheets: Bagikan → Akses umum → pilih "Siapa saja yang memiliki link" (Pelihat). Secara default sheet pertama yang dibaca; untuk tab tertentu, salin tautan saat berada di tab tersebut (URL akan menyertakan #gid=…).'}
                </ModalNotice>
              </div>
            </div>
          )}

          <ModalSection
            icon={<FileExcelOutlined />}
            title="Data referensi"
            desc="Obat"
            trailing={
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Popover trigger="click" placement="bottomLeft" content={referenceContent}>
                  <Button>
                    Obat valid <Tag color="processing" style={{ margin: '0 4px 0 6px' }}>{medicines.length}</Tag>
                    <DownOutlined />
                  </Button>
                </Popover>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => downloadTemplate({ medicines: medicines.map((m) => m.name) })}
                >
                  Unduh Template Excel
                </Button>
              </div>
            }
          />

          <Collapse
            ghost
            items={[
              {
                key: 'sample',
                label: 'Contoh isi file Excel & tips pengisian',
                children: (
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    {columnStructure}
                    <ModalNotice tone="info" title="Tips Excel">
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>
                        Hapus 2 baris contoh di template sebelum mengisi data Anda.
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        <li>
                          Kode atau nama santri harus cocok dengan Data Santri — bila kolom Kode kosong, nama
                          dipakai untuk mencocokkan (nama harus unik).
                        </li>
                        <li>
                          Tanggal kosong = hari ini dan tidak boleh tanggal masa depan; jam kosong = 08:00.
                          Status: UKS, asrama, atau kembali (kosong = kembali KBM).
                        </li>
                        <li>
                          Obat harus sesuai nama di stok (kosong = tanpa obat); jumlah angka, kosong = 1 bila
                          ada obat. Stok obat terpotong otomatis saat impor.
                        </li>
                      </ul>
                    </ModalNotice>
                  </Space>
                ),
              },
            ]}
          />
        </Space>
      )}

      {step === 1 && (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <ModalNotice
            tone={missingRequired.length > 0 || rosterPending ? 'warning' : 'success'}
            title={`File "${fileName}": ${fileRows.length} baris data, ${mappedCount} dari ${FIELDS.length} kolom terpetakan`}
          >
            {rosterPending
              ? 'Menyiapkan data santri & daftar obat…'
              : missingRequired.length > 0
                ? `Belum dipetakan: ${missingRequired.join(', ')}`
                : 'Semua kolom wajib sudah terpetakan. Periksa kolom lain jika perlu, lalu lanjut ke Review.'}
          </ModalNotice>
          <Table<(typeof FIELDS)[number]>
            rowKey="key"
            size="small"
            columns={mappingColumns}
            dataSource={[...FIELDS]}
            pagination={false}
            scroll={{ y: 300 }}
          />
        </Space>
      )}

      {step === 2 && (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {importProgress && (
            <div style={{ ...card, padding: '12px 16px' }}>
              <Text strong style={{ fontSize: 13 }}>
                Mengimpor {importProgress.done} dari {importProgress.total} baris…
              </Text>
              <Progress
                percent={Math.round((importProgress.done / Math.max(1, importProgress.total)) * 100)}
                status="active"
              />
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {statCard('Total baris', counts.total)}
            {statCard('Siap impor', readyRows.length, token.colorSuccess)}
            {statCard('Duplikat (dilewati)', counts.duplikat, counts.duplikat > 0 ? token.colorWarning : undefined)}
            {statCard('Tak dikenal', counts.takDikenal, counts.takDikenal > 0 ? token.colorWarning : undefined)}
            {statCard('Bermasalah (dilewati)', counts.error, counts.error > 0 ? token.colorError : undefined)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Segmented
              value={reviewFilter}
              onChange={(v) => setReviewFilter(v as ReviewFilter)}
              options={[
                { label: `Semua (${counts.total})`, value: 'all' },
                { label: `Siap (${readyRows.length})`, value: 'siap' },
                { label: `Duplikat (${counts.duplikat})`, value: 'duplikat' },
                { label: `Tak dikenal (${counts.takDikenal})`, value: 'tak_dikenal' },
                { label: `Bermasalah (${counts.error})`, value: 'error' },
              ]}
            />
            {counts.total - readyRows.length > 0 && (
              <Button size="small" icon={<DownloadOutlined />} onClick={handleDownloadErrorCsv}>
                Unduh baris bermasalah (.csv)
              </Button>
            )}
          </div>
          <Table<ParsedLogRow>
            rowKey="row"
            size="small"
            columns={previewColumns}
            dataSource={shownRows}
            pagination={{ pageSize: 8, showSizeChanger: false }}
            scroll={{ x: true }}
            onRow={(row) => ({
              style:
                row.rowStatus === 'error'
                  ? { background: token.colorErrorBg }
                  : row.rowStatus === 'duplikat'
                    ? { background: token.colorFillAlter }
                    : row.rowStatus === 'tak_dikenal'
                      ? { background: token.colorWarningBg }
                      : undefined,
            })}
          />
        </Space>
      )}

      {step === 3 && results && (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {statCard('Berhasil', results.successful, token.colorSuccess)}
            {statCard('Gagal', results.failed, results.failed > 0 ? token.colorError : undefined)}
          </div>
          {results.failed > 0 && (
            <ModalNotice
              tone="warning"
              title="Perbaiki baris yang gagal lalu impor ulang — kunjungan yang sudah masuk akan terdeteksi duplikat."
            />
          )}
          {deductions.length > 0 && (
            <ModalNotice tone="info" title="Stok obat terpotong otomatis">
              <div style={{ fontSize: 12.5 }}>
                {deductions.map((d) => (
                  <div key={d.name}>
                    {d.name} ({d.qty} unit)
                  </div>
                ))}
              </div>
            </ModalNotice>
          )}
        </Space>
      )}
    </WizardModal>
  )
}
