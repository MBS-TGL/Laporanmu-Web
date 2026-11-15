import { useMemo, useState, type CSSProperties } from 'react'
import {
  Alert,
  App,
  Button,
  Input,
  Popover,
  Progress,
  Segmented,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
  theme,
} from 'antd'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DownOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  GlobalOutlined,
  LinkOutlined,
  UploadOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { ModalFooter } from '../../../shared/components/ModalFooter'
import { UploadDropzone } from '../../../shared/components/UploadDropzone'
import { WizardSteps } from '../../../shared/components/WizardSteps'
import {
  useBulkCreateSchedules,
  useClassesBrief,
  useSubjectsBrief,
  useTeachersBrief,
} from '../hooks'
import {
  downloadScheduleTemplateXlsx,
  fetchGSheetsData,
  readFileToTable,
} from '../importExport'
import { matchClass, matchSubject, matchTeacher, type Option } from './importMatching'
import type { Schedule, ScheduleFormValues } from '../types'
import { DAY_LABELS } from '../SchedulesPage'

const { Text } = Typography

const DAYS: Record<string, number> = {
  senin: 1,
  selasa: 2,
  rabu: 3,
  kamis: 4,
  jumat: 5,
  sabtu: 6,
  minggu: 7,
  ahad: 7,
}

function parseDay(v: string): number | null {
  const t = v.trim().toLowerCase().replace(/['’`]/g, '')
  if (DAYS[t]) return DAYS[t]
  const n = Number(t)
  return Number.isInteger(n) && n >= 1 && n <= 7 ? n : null
}

function parseTime(v: string): string | null {
  const m = v.trim().match(/^(\d{1,2})[:.](\d{2})(?::\d{2})?$/)
  if (!m) return null
  const h = Number(m[1])
  const mi = Number(m[2])
  if (h > 23 || mi > 59) return null
  return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`
}

const SCHEDULE_FIELDS = [
  { key: 'day', label: 'Hari', required: true, aliases: ['hari', 'day', 'hari kbm'] },
  { key: 'start_time', label: 'Jam Mulai', required: true, aliases: ['mulai', 'jam mulai', 'start', 'start time', 'waktu mulai'] },
  { key: 'end_time', label: 'Jam Selesai', required: true, aliases: ['selesai', 'jam selesai', 'end', 'end time', 'waktu selesai'] },
  { key: 'class_name', label: 'Kelas', required: true, aliases: ['kelas', 'nama kelas', 'class', 'rombongan belajar', 'rombel'] },
  { key: 'subject_name', label: 'Mata Pelajaran', required: true, aliases: ['mapel', 'mata pelajaran', 'pelajaran', 'subject'] },
  { key: 'teacher_name', label: 'Pengajar / Guru', required: false, aliases: ['pengajar', 'guru', 'ustadz', 'ustadzah', 'teacher', 'nama guru'] },
  { key: 'room', label: 'Ruang', required: false, aliases: ['ruang', 'ruangan', 'room', 'lab', 'tempat'] },
  { key: 'notes', label: 'Keterangan', required: false, aliases: ['keterangan', 'catatan', 'notes', 'ket'] },
] as const

type ScheduleFieldKey = (typeof SCHEDULE_FIELDS)[number]['key']
type Mapping = Partial<Record<ScheduleFieldKey, number>>

interface ParsedScheduleRow {
  key: number
  line: number
  day_raw?: string
  day?: number
  start_time?: string
  end_time?: string
  class_name?: string
  subject_name?: string
  teacher_name?: string
  room?: string
  notes?: string
  // Resolved IDs
  class_id?: string
  subject_id?: string
  teacher_id?: string
  error?: string
  conflictWarning?: string
}

interface ImportModalProps {
  open: boolean
  existing: Schedule[]
  onClose: () => void
}

function normHeader(value: string) {
  return value
    .replace(/^\ufeff/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function autoMatchHeaders(headers: string[]): Mapping {
  const normalized = headers.map(normHeader)
  const used = new Set<number>()
  const mapping: Mapping = {}
  for (const field of SCHEDULE_FIELDS) {
    const names = new Set([field.key, ...field.aliases].map(normHeader))
    const index = normalized.findIndex((h, i) => !used.has(i) && names.has(h))
    if (index >= 0) {
      mapping[field.key] = index
      used.add(index)
    }
  }
  return mapping
}

export function ImportModal({ open, existing, onClose }: ImportModalProps) {
  const { token } = theme.useToken()
  const { message } = App.useApp()

  const classesQ = useClassesBrief()
  const subjectsQ = useSubjectsBrief()
  const teachersQ = useTeachersBrief()
  const bulkCreateMutation = useBulkCreateSchedules()

  const classOpts = useMemo(() => (classesQ.data ?? []) as Option[], [classesQ.data])
  const subjectOpts = useMemo(() => (subjectsQ.data ?? []) as Option[], [subjectsQ.data])
  const teacherOpts = useMemo(() => (teachersQ.data ?? []) as Option[], [teachersQ.data])

  const [step, setStep] = useState<0 | 1 | 2 | 3>(0)
  const [sheetSource, setSheetSource] = useState<'file' | 'gsheets'>('file')
  const [gsheetsUrl, setGsheetsUrl] = useState('')
  const [reading, setReading] = useState(false)
  const [fetchingSheet, setFetchingSheet] = useState(false)

  const [fileName, setFileName] = useState('')
  const [fileHeaders, setFileHeaders] = useState<string[]>([])
  const [fileRows, setFileRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Mapping>({})
  const [reviewFilter, setReviewFilter] = useState<'all' | 'ok' | 'error' | 'conflict'>('all')

  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null)
  const [importResults, setImportResults] = useState<{ row_index: number; ok: boolean; error: string | null }[]>([])

  const reset = () => {
    setStep(0)
    setSheetSource('file')
    setGsheetsUrl('')
    setReading(false)
    setFetchingSheet(false)
    setFileName('')
    setFileHeaders([])
    setFileRows([])
    setMapping({})
    setReviewFilter('all')
    setImportProgress(null)
    setImportResults([])
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleRawTable = (table: string[][], sourceName: string) => {
    if (table.length < 2) {
      message.error('File / Sheet kosong atau tidak memiliki baris data')
      return
    }
    const headers = table[0].map((h, i) => (h ? String(h).trim() : `Kolom ${i + 1}`))
    const rows = table.slice(1).filter((r) => r.some((c) => String(c).trim() !== ''))

    setFileName(sourceName)
    setFileHeaders(headers)
    setFileRows(rows)
    setMapping(autoMatchHeaders(headers))
    setStep(1)
  }

  const handleFile = async (file: File) => {
    setReading(true)
    try {
      const table = await readFileToTable(file)
      handleRawTable(table, file.name)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Gagal membaca file')
    } finally {
      setReading(false)
    }
  }

  const handleFetchGSheets = async () => {
    if (!gsheetsUrl.trim()) return
    setFetchingSheet(true)
    try {
      const table = await fetchGSheetsData(gsheetsUrl.trim())
      handleRawTable(table, 'Google Sheets')
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Gagal mengambil data Google Sheets')
    } finally {
      setFetchingSheet(false)
    }
  }

  // Parse & validasi baris berdasarkan mapping
  const parsedRows: ParsedScheduleRow[] = useMemo(() => {
    if (step < 2) return []

    // Kumpulan existing key untuk deteksi duplikasi: `class_id|day|start`
    const existingKeys = new Set(existing.map((s) => `${s.class_id}|${s.day_of_week}|${s.start_time.slice(0, 5)}`))
    const inBatchKeys = new Set<string>()

    return fileRows.map((raw, idx) => {
      const line = idx + 2
      const getVal = (k: ScheduleFieldKey) => {
        const colIdx = mapping[k]
        return colIdx !== undefined && colIdx < raw.length ? raw[colIdx].trim() : ''
      }

      const dayRaw = getVal('day')
      const startRaw = getVal('start_time')
      const endRaw = getVal('end_time')
      const className = getVal('class_name')
      const subjectName = getVal('subject_name')
      const teacherName = getVal('teacher_name')
      const room = getVal('room')
      const notes = getVal('notes')

      const day = parseDay(dayRaw)
      const start = parseTime(startRaw)
      const end = parseTime(endRaw)

      let error: string | undefined

      if (!day) {
        error = `Hari "${dayRaw}" tidak valid (gunakan Senin..Minggu)`
      } else if (!start || !end) {
        error = 'Format jam tidak valid (contoh: 07:30)'
      } else if (start >= end) {
        error = 'Jam selesai harus lebih akhir dari jam mulai'
      } else if (!className) {
        error = 'Nama kelas wajib diisi'
      } else if (!subjectName) {
        error = 'Nama mapel wajib diisi'
      }

      // Match entity ke DB options
      const matchedC = className ? matchClass(className, classOpts) : null
      const matchedS = subjectName ? matchSubject(subjectName, subjectOpts) : null
      const matchedT = teacherName ? matchTeacher(teacherName, teacherOpts) : null

      if (!error) {
        if (!matchedC?.id) {
          error = `Kelas "${className}" tidak ditemukan di master data`
        } else if (!matchedS?.id) {
          error = `Mapel "${subjectName}" tidak ditemukan di master data`
        }
      }

      let conflictWarning: string | undefined
      if (!error && matchedC?.id && day && start) {
        const key = `${matchedC.id}|${day}|${start}`
        if (existingKeys.has(key)) {
          conflictWarning = 'Sudah ada jadwal untuk kelas dan jam ini di database (duplikasi)'
        } else if (inBatchKeys.has(key)) {
          conflictWarning = 'Duplikasi dengan baris lain di dalam file impor ini'
        }
        inBatchKeys.add(key)
      }

      return {
        key: idx,
        line,
        day_raw: dayRaw,
        day: day ?? undefined,
        start_time: start ?? undefined,
        end_time: end ?? undefined,
        class_name: className,
        subject_name: subjectName,
        teacher_name: teacherName,
        room,
        notes,
        class_id: matchedC?.id,
        subject_id: matchedS?.id,
        teacher_id: matchedT?.id,
        error,
        conflictWarning,
      }
    })
  }, [fileRows, mapping, step, existing, classOpts, subjectOpts, teacherOpts])

  const validRows = useMemo(() => parsedRows.filter((r) => !r.error), [parsedRows])
  const errorCount = parsedRows.filter((r) => Boolean(r.error)).length
  const conflictCount = parsedRows.filter((r) => Boolean(r.conflictWarning)).length

  const shownRows = useMemo(() => {
    switch (reviewFilter) {
      case 'ok':
        return parsedRows.filter((r) => !r.error)
      case 'error':
        return parsedRows.filter((r) => Boolean(r.error))
      case 'conflict':
        return parsedRows.filter((r) => Boolean(r.conflictWarning))
      case 'all':
      default:
        return parsedRows
    }
  }, [parsedRows, reviewFilter])

  const executeImport = () => {
    if (validRows.length === 0) {
      message.error('Tidak ada baris data valid untuk diimpor')
      return
    }

    const payload: ScheduleFormValues[] = validRows.map((r) => ({
      class_id: r.class_id!,
      subject_id: r.subject_id,
      teacher_id: r.teacher_id,
      day_of_week: r.day!,
      start_time: r.start_time!,
      end_time: r.end_time!,
      room: r.room || undefined,
      notes: r.notes || undefined,
    }))

    setStep(3)
    setImportProgress({ done: 0, total: payload.length })

      bulkCreateMutation.mutate(payload, {
      onSuccess: (count) => {
        setImportProgress({ done: count, total: payload.length })
        setImportResults(
          validRows.map((r) => ({
            row_index: r.line,
            ok: true,
            error: null,
          })),
        )
        message.success(`${count} jadwal KBM berhasil diimpor`)
      },
      onError: (err: Error) => {
        setImportResults([
          {
            row_index: 0,
            ok: false,
            error: err.message || 'Gagal menyimpan batch jadwal',
          },
        ])
        message.error(err.message || 'Gagal mengimpor jadwal')
      },
    })
  }

  // Content Popover referensi master data
  const referencePopoverContent = (
    <div style={{ maxWidth: 360, maxHeight: 300, overflowY: 'auto' }}>
      <Typography.Title level={5} style={{ margin: '0 0 6px', fontSize: 13 }}>
        Daftar Kelas Valid ({classOpts.length}):
      </Typography.Title>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
        {classOpts.map((c) => (
          <Tag key={c.id}>{c.name}</Tag>
        ))}
      </div>
      <Typography.Title level={5} style={{ margin: '0 0 6px', fontSize: 13 }}>
        Daftar Mapel ({subjectOpts.length}):
      </Typography.Title>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {subjectOpts.slice(0, 20).map((s) => (
          <Tag key={s.id}>{s.name}</Tag>
        ))}
        {subjectOpts.length > 20 && <Tag>+{subjectOpts.length - 20} mapel lainnya</Tag>}
      </div>
    </div>
  )

  const cardStyle: CSSProperties = {
    background: '#fafbfc',
    border: '1px solid #eef0f3',
    borderRadius: 8,
    padding: 12,
  }

  return (
    <AppModal
      open={open}
      onCancel={handleClose}
      size="xl"
      title="Import Jadwal KBM"
      subtitle="Unggah jadwal dari file Excel / CSV atau Google Sheets dengan pemetaan kolom otomatis"
      icon={<UploadOutlined />}
      footer={
        step === 1 ? (
          <ModalFooter
            left={<Button onClick={() => setStep(0)}>Kembali</Button>}
            onCancel={handleClose}
            onOk={() => setStep(2)}
            okText="Lanjut ke Pratinjau"
            okDisabled={
              mapping.day === undefined ||
              mapping.start_time === undefined ||
              mapping.end_time === undefined ||
              mapping.class_name === undefined ||
              mapping.subject_name === undefined
            }
          />
        ) : step === 2 ? (
          <ModalFooter
            left={<Button onClick={() => setStep(1)}>Atur Kolom</Button>}
            onCancel={handleClose}
            onOk={executeImport}
            okText={`Impor Sekarang (${validRows.length} Baris)`}
            okIcon={<UploadOutlined />}
            okLoading={bulkCreateMutation.isPending}
            okDisabled={validRows.length === 0}
          />
        ) : (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={handleClose}>{step === 3 ? 'Selesai' : 'Batal'}</Button>
          </div>
        )
      }
    >
      <WizardSteps
        current={step}
        items={[
          { title: 'Sumber Data' },
          { title: 'Pemetaan Kolom' },
          { title: 'Validasi & Preview' },
          { title: 'Hasil' },
        ]}
      />

      {/* STEP 0: Upload File / Google Sheets */}
      {step === 0 && (
        <Space direction="vertical" orientation="vertical" size="middle" style={{ width: '100%' }}>
          <Segmented
            block
            value={sheetSource}
            onChange={(v) => setSheetSource(v as 'file' | 'gsheets')}
            options={[
              { label: 'Upload File (Excel / CSV)', value: 'file', icon: <FileExcelOutlined /> },
              { label: 'Google Sheets (Tautan Publik)', value: 'gsheets', icon: <LinkOutlined /> },
            ]}
          />

          {sheetSource === 'file' ? (
            <Spin spinning={reading} tip="Membaca file...">
              <UploadDropzone
                accept=".xlsx,.xls,.csv"
                disabled={reading}
                beforeUpload={(file) => {
                  void handleFile(file as unknown as File)
                  return false
                }}
                title="Klik atau seret file ke sini"
                hint="Mendukung .xlsx, .xls, dan .csv dengan baris pertama sebagai nama kolom"
              />
            </Spin>
          ) : (
            <div style={{ ...cardStyle, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <GlobalOutlined style={{ fontSize: 24, color: token.colorPrimary }} />
                <div>
                  <div style={{ fontWeight: 600 }}>Ambil Data dari Google Sheets</div>
                  <Text type="secondary" style={{ fontSize: 12.5 }}>
                    Pastikan sheet berstatus publik ("Siapa saja yang memiliki link sebagai Pelihat")
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
            </div>
          )}

          <div
            style={{
              ...cardStyle,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <FileExcelOutlined style={{ fontSize: 20, color: '#16a34a' }} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: token.colorTextSecondary }}>TEMPLATE RESMI</div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Template Format Jadwal KBM</div>
              </div>
              <Popover trigger="click" placement="bottomLeft" content={referencePopoverContent}>
                <Button size="small">
                  Referensi Kelas &amp; Mapel <DownOutlined />
                </Button>
              </Popover>
            </div>

            <Button
              icon={<DownloadOutlined />}
              onClick={() =>
                downloadScheduleTemplateXlsx(
                  classOpts.map((c) => c.name),
                  subjectOpts.map((s) => s.name),
                  teacherOpts.map((t) => t.name),
                )
              }
            >
              Unduh Template Excel
            </Button>
          </div>
        </Space>
      )}

      {/* STEP 1: Pemetaan Kolom */}
      {step === 1 && (
        <Space direction="vertical" orientation="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message={`File "${fileName}" — Terdeteksi ${fileRows.length} baris data`}
            description="Periksa dan cocokkan kolom file dengan atribut jadwal sistem di bawah. Kolom bertanda * wajib dipetakan."
          />

          <Table
            size="small"
            pagination={false}
            rowKey="key"
            dataSource={[...SCHEDULE_FIELDS]}
            columns={[
              {
                title: 'Atribut Jadwal',
                key: 'label',
                render: (_, r) => (
                  <span>
                    <b>{r.label}</b> {r.required && <span style={{ color: 'red' }}>*</span>}
                  </span>
                ),
              },
              {
                title: 'Kolom di File Anda',
                key: 'mapping',
                render: (_, r) => (
                  <Select
                    placeholder="Pilih kolom..."
                    allowClear={!r.required}
                    style={{ width: '100%' }}
                    value={mapping[r.key]}
                    onChange={(v) =>
                      setMapping((prev) => ({
                        ...prev,
                        [r.key]: v,
                      }))
                    }
                    options={fileHeaders.map((h, i) => ({
                      value: i,
                      label: `${h} (Kolom ${i + 1})`,
                    }))}
                  />
                ),
              },
              {
                title: 'Contoh Nilai Baris 1',
                key: 'sample',
                render: (_, r) => {
                  const idx = mapping[r.key]
                  if (idx === undefined || !fileRows[0] || idx >= fileRows[0].length) {
                    return <Text type="secondary">—</Text>
                  }
                  return <Text code>{fileRows[0][idx] || '(kosong)'}</Text>
                },
              },
            ]}
          />
        </Space>
      )}

      {/* STEP 2: Validasi & Pratinjau */}
      {step === 2 && (
        <Space direction="vertical" orientation="vertical" size="middle" style={{ width: '100%' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <div style={{ ...cardStyle, borderLeft: '3px solid #6366f1' }}>
              <div style={{ fontSize: 12, color: token.colorTextSecondary }}>Total Baris</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{parsedRows.length}</div>
            </div>
            <div style={{ ...cardStyle, borderLeft: '3px solid #22c55e' }}>
              <div style={{ fontSize: 12, color: token.colorTextSecondary }}>Siap Impor</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#16a34a' }}>{validRows.length}</div>
            </div>
            <div style={{ ...cardStyle, borderLeft: `3px solid ${errorCount > 0 ? '#ef4444' : '#cbd5e1'}` }}>
              <div style={{ fontSize: 12, color: token.colorTextSecondary }}>Bermasalah</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: errorCount > 0 ? '#dc2626' : undefined }}>
                {errorCount}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Segmented
              value={reviewFilter}
              onChange={(v) => setReviewFilter(v as any)}
              options={[
                { label: `Semua (${parsedRows.length})`, value: 'all' },
                { label: `Siap (${validRows.length})`, value: 'ok' },
                { label: `Bermasalah (${errorCount})`, value: 'error' },
                { label: `Bentrok (${conflictCount})`, value: 'conflict' },
              ]}
            />
          </div>

          <Table<ParsedScheduleRow>
            size="small"
            rowKey="key"
            dataSource={shownRows}
            pagination={{ pageSize: 8, showSizeChanger: false }}
            scroll={{ x: true }}
            columns={[
              {
                title: 'Baris',
                dataIndex: 'line',
                width: 65,
                render: (v) => `#${v}`,
              },
              {
                title: 'Hari / Waktu',
                key: 'time',
                width: 140,
                render: (_, r) => (
                  <div>
                    <Tag color="purple">{r.day ? DAY_LABELS[r.day] : r.day_raw || '?'}</Tag>
                    <div style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
                      {r.start_time || '?'} – {r.end_time || '?'}
                    </div>
                  </div>
                ),
              },
              {
                title: 'Kelas',
                dataIndex: 'class_name',
                width: 100,
                render: (v, r) => (
                  <Tag color={r.class_id ? 'blue' : 'red'}>{v || '-'}</Tag>
                ),
              },
              {
                title: 'Mapel',
                dataIndex: 'subject_name',
                render: (v, r) => (
                  <span style={{ fontWeight: 500, color: r.subject_id ? undefined : '#ef4444' }}>
                    {v || '-'}
                  </span>
                ),
              },
              {
                title: 'Pengajar',
                dataIndex: 'teacher_name',
                render: (v) => v ? <span>{v}</span> : <Text type="secondary">(kosong)</Text>,
              },
              {
                title: 'Status Validasi',
                key: 'status',
                width: 170,
                render: (_, r) => {
                  if (r.error) {
                    return (
                      <Tooltip title={r.error}>
                        <Tag color="error" icon={<CloseCircleOutlined />}>
                          Error
                        </Tag>
                        <span style={{ fontSize: 11, color: '#dc2626' }}>{r.error}</span>
                      </Tooltip>
                    )
                  }
                  if (r.conflictWarning) {
                    return (
                      <Tooltip title={r.conflictWarning}>
                        <Tag color="warning" icon={<WarningOutlined />}>
                          Bentrok
                        </Tag>
                        <span style={{ fontSize: 11, color: '#d97706' }}>Duplikasi/Bentrok</span>
                      </Tooltip>
                    )
                  }
                  return (
                    <Tag color="success" icon={<CheckCircleOutlined />}>
                      Siap
                    </Tag>
                  )
                },
              },
            ]}
          />
        </Space>
      )}

      {/* STEP 3: Laporan Hasil */}
      {step === 3 && (
        <Space direction="vertical" orientation="vertical" size="middle" style={{ width: '100%' }}>
          {importProgress && (
            <div style={{ ...cardStyle, textAlign: 'center', padding: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                Proses Impor Data Selesai
              </div>
              <Progress
                percent={Math.round((importProgress.done / Math.max(1, importProgress.total)) * 100)}
                status={importResults.some((r) => !r.ok) ? 'exception' : 'success'}
              />
              <div style={{ marginTop: 12, fontSize: 13, color: token.colorTextSecondary }}>
                {importProgress.done} dari {importProgress.total} jadwal berhasil masuk ke database.
              </div>
            </div>
          )}

          {importResults.length > 0 && (
            <Table
              size="small"
              rowKey="row_index"
              dataSource={importResults}
              pagination={{ pageSize: 8 }}
              columns={[
                { title: 'Baris', dataIndex: 'row_index', width: 80, render: (v) => `#${v}` },
                {
                  title: 'Status',
                  dataIndex: 'ok',
                  width: 100,
                  render: (v) => (v ? <Tag color="success">Berhasil</Tag> : <Tag color="error">Gagal</Tag>),
                },
                {
                  title: 'Keterangan',
                  dataIndex: 'error',
                  render: (v) => v || 'Jadwal tersimpan di database',
                },
              ]}
            />
          )}
        </Space>
      )}
    </AppModal>
  )
}
