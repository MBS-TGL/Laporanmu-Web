import { useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Empty,
  Progress,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  theme,
  type TableColumnsType,
} from 'antd'
import {
  CheckCircleOutlined,
  CloudUploadOutlined,
  FileExcelOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { AppModal } from '../../../shared/components/AppModal'
import { ModalFooter } from '../../../shared/components/ModalFooter'
import { UploadDropzone } from '../../../shared/components/UploadDropzone'
import { useIngestMachineAttendance } from './hooks'
import type { AttendanceMachine, IngestPayloadItem, ScanType } from './types'

interface ImportModalProps {
  open: boolean
  onClose: () => void
  machines: AttendanceMachine[]
}

/** Tebak kolom dari daftar nama header */
function autoDetectColumn(headers: string[], candidates: string[]): string | undefined {
  const norm = headers.map((h) => h.toLowerCase().trim().replace(/[^a-z0-9]/g, ''))
  for (const cand of candidates) {
    const idx = norm.findIndex((h) => h === cand || h.includes(cand))
    if (idx !== -1) return headers[idx]
  }
  return undefined
}

/** Normalisasi waktu dari berbagai format Excel/Fingerspot ke ISO string */
function parseTimestamp(raw: unknown): string | null {
  if (!raw) return null

  // Jika berupa Date object dari xlsx
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    return raw.toISOString()
  }

  // Jika berupa serial number Excel (contoh: 45234.3421)
  if (typeof raw === 'number') {
    const date = new Date((raw - (25567 + 2)) * 86400 * 1000)
    if (!isNaN(date.getTime())) return date.toISOString()
  }

  // Jika string
  const str = String(raw).trim()
  if (!str) return null

  // Format umum: YYYY-MM-DD HH:mm:ss atau DD/MM/YYYY HH:mm:ss atau DD-MM-YYYY HH:mm:ss
  const d1 = dayjs(str, ['YYYY-MM-DD HH:mm:ss', 'DD/MM/YYYY HH:mm:ss', 'DD-MM-YYYY HH:mm:ss', 'YYYY/MM/DD HH:mm:ss', 'HH:mm:ss'])
  if (d1.isValid()) return d1.toISOString()

  const d2 = dayjs(str)
  if (d2.isValid()) return d2.toISOString()

  return null
}

export function ImportModal({ open, onClose, machines }: ImportModalProps) {
  const { message } = App.useApp()
  const { token } = theme.useToken()

  const [selectedMachineId, setSelectedMachineId] = useState<string | undefined>(
    () => machines.find((m) => m.is_active)?.id ?? machines[0]?.id,
  )

  const [fileList, setFileList] = useState<File[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([])

  // Mapping kolom
  const [uidCol, setUidCol] = useState<string | undefined>()
  const [timeCol, setTimeCol] = useState<string | undefined>()
  const [statusCol, setStatusCol] = useState<string | undefined>()

  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const ingestMutation = useIngestMachineAttendance()
  const selectedMachine = machines.find((m) => m.id === selectedMachineId)

  const handleReset = () => {
    setFileList([])
    setHeaders([])
    setRawRows([])
    setUidCol(undefined)
    setTimeCol(undefined)
    setStatusCol(undefined)
    setProgress(0)
    setUploading(false)
  }

  const handleClose = () => {
    if (uploading) return
    handleReset()
    onClose()
  }

  // Parse file menggunakan SheetJS / XLSX — dynamic import agar chunk xlsx
  // (~490 KB) hanya terunduh saat file benar-benar diproses.
  const processFile = async (file: File) => {
    try {
      const XLSX = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
      const firstSheetName = wb.SheetNames[0]
      if (!firstSheetName) {
        message.error('File Excel tidak memiliki lembar data (sheet kosong)')
        return
      }

      const ws = wb.Sheets[firstSheetName]
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

      if (json.length === 0) {
        message.warning('Sheet pertama tidak memiliki data baris')
        return
      }

      const detectedHeaders = Object.keys(json[0] || {})
      setHeaders(detectedHeaders)
      setRawRows(json)

      // Auto detect kolom umum Fingerspot Personel
      const foundUid = autoDetectColumn(detectedHeaders, ['pin', 'userid', 'noid', 'uid', 'id', 'no', 'badgenumber'])
      const foundTime = autoDetectColumn(detectedHeaders, ['waktu', 'tanggal', 'scan', 'time', 'datetime', 'jam', 'checktime'])
      const foundStatus = autoDetectColumn(detectedHeaders, ['status', 'state', 'inout', 'type', 'tipe'])

      setUidCol(foundUid)
      setTimeCol(foundTime)
      setStatusCol(foundStatus)

      setFileList([file])
      message.success(`Berhasil membaca ${json.length} baris data dari "${file.name}"`)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Gagal membaca file Excel/CSV')
    }
  }

  // Siapkan item yang valid untuk di-ingest
  const validPayload = useMemo<IngestPayloadItem[]>(() => {
    if (!uidCol || !timeCol || rawRows.length === 0) return []

    const out: IngestPayloadItem[] = []
    for (const row of rawRows) {
      const uidRaw = String(row[uidCol] ?? '').trim()
      const timeIso = parseTimestamp(row[timeCol])

      if (!uidRaw || !timeIso) continue

      let scanType: ScanType = 'check_in'
      if (statusCol) {
        const sRaw = String(row[statusCol] ?? '').toLowerCase()
        if (sRaw.includes('out') || sRaw.includes('pulang') || sRaw.includes('keluar')) {
          scanType = 'check_out'
        }
      }

      out.push({
        user_id: uidRaw,
        time: timeIso,
        type: scanType,
      })
    }
    return out
  }, [rawRows, uidCol, timeCol, statusCol])

  // Pratinjau 5 baris pertama
  const previewRows = useMemo(() => {
    return validPayload.slice(0, 5).map((item, idx) => ({
      key: idx,
      ...item,
    }))
  }, [validPayload])

  const previewColumns: TableColumnsType<IngestPayloadItem> = [
    {
      title: 'PIN / User ID',
      dataIndex: 'user_id',
      key: 'user_id',
      render: (v) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: 'Waktu Scan',
      dataIndex: 'time',
      key: 'time',
      render: (v) => dayjs(v).format('DD/MM/YYYY HH:mm:ss'),
    },
    {
      title: 'Tipe',
      dataIndex: 'type',
      key: 'type',
      render: (v) => (
        <Tag color={v === 'check_out' ? 'orange' : 'green'}>
          {v === 'check_out' ? 'Pulang' : 'Masuk'}
        </Tag>
      ),
    },
  ]

  // Eksekusi Ingest bertahap (chunking per 500 baris)
  const handleExecuteImport = async () => {
    if (!selectedMachine) {
      message.warning('Pilih mesin presensi terlebih dahulu')
      return
    }

    if (validPayload.length === 0) {
      message.warning('Tidak ada baris data valid yang dapat diimpor')
      return
    }

    setUploading(true)
    setProgress(0)

    const chunkSize = 500
    const totalChunks = Math.ceil(validPayload.length / chunkSize)
    let totalInserted = 0
    let totalMatched = 0

    try {
      for (let i = 0; i < totalChunks; i++) {
        const chunk = validPayload.slice(i * chunkSize, (i + 1) * chunkSize)
        const res = await ingestMutation.mutateAsync({
          serialNo: selectedMachine.serial_no,
          apiKey: selectedMachine.api_key,
          logs: chunk,
        })

        totalInserted += res.inserted
        totalMatched += res.matched

        const percent = Math.round(((i + 1) / totalChunks) * 100)
        setProgress(percent)
      }

      message.success(
        `Sukses mengimpor ${totalInserted} log scan! (${totalMatched} santri otomatis terpetakan)`,
      )
      handleClose()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Gagal mengirimkan log mesin ke server')
    } finally {
      setUploading(false)
    }
  }

  const columnOptions = useMemo(() => {
    return headers.map((h) => ({ value: h, label: h }))
  }, [headers])

  return (
    <AppModal
      open={open}
      onCancel={handleClose}
      size="lg"
      title="Impor Log Mesin (Offline / Flashdisk)"
      subtitle="Unggah file ekspor Excel/CSV dari mesin Fingerspot atau aplikasi Fingerspot Personel."
      icon={<CloudUploadOutlined />}
      footer={
        <ModalFooter
          left={
            validPayload.length > 0 ? (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Siap impor: <b>{validPayload.length}</b> dari {rawRows.length} baris
              </Typography.Text>
            ) : undefined
          }
          onCancel={handleClose}
          cancelText="Tutup"
          cancelDisabled={uploading}
          onOk={handleExecuteImport}
          okText={`Impor ke Database (${validPayload.length})`}
          okIcon={<CheckCircleOutlined />}
          okDisabled={validPayload.length === 0 || !selectedMachine}
          okLoading={uploading}
        />
      }
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {/* Pilih Mesin */}
        <div>
          <Typography.Text strong style={{ display: 'block', marginBottom: 6 }}>
            1. Asosiasikan dengan Mesin Presensi:
          </Typography.Text>
          <Select
            placeholder="Pilih Mesin"
            style={{ width: '100%' }}
            value={selectedMachineId}
            onChange={setSelectedMachineId}
            options={machines.map((m) => ({
              value: m.id,
              label: `${m.name} (${m.serial_no})${m.location ? ` — ${m.location}` : ''}`,
            }))}
          />
        </div>

        {/* Upload Zone */}
        {rawRows.length === 0 ? (
          <div>
            <Typography.Text strong style={{ display: 'block', marginBottom: 6 }}>
              2. Pilih File Excel / CSV Hasil Unduhan Flashdisk:
            </Typography.Text>
            <UploadDropzone
              accept=".xls,.xlsx,.csv"
              beforeUpload={(file) => {
                void processFile(file as unknown as File)
                return false
              }}
              title="Klik atau seret file Excel/CSV ke area ini"
              hint="Mendukung file ekspor `.xls`, `.xlsx`, atau `.csv` dari Fingerspot Personel."
            />
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Space>
                <FileExcelOutlined style={{ color: token.colorSuccess, fontSize: 18 }} />
                <Typography.Text strong>{fileList[0]?.name}</Typography.Text>
                <Tag color="success">{rawRows.length} baris</Tag>
              </Space>
              <Button size="small" onClick={handleReset} disabled={uploading}>
                Ganti File
              </Button>
            </div>

            {/* Pemetaan Kolom */}
            <Card size="small" title="2. Pemetaan Kolom File" style={{ borderRadius: 10, marginBottom: 12 }}>
              <Row gutter={[12, 12]}>
                <Col xs={24} sm={8}>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                    Kolom PIN / ID Mesin <span style={{ color: token.colorError }}>*</span>
                  </label>
                  <Select
                    style={{ width: '100%' }}
                    placeholder="Pilih kolom PIN"
                    value={uidCol}
                    onChange={setUidCol}
                    options={columnOptions}
                  />
                </Col>
                <Col xs={24} sm={8}>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                    Kolom Waktu / Tanggal <span style={{ color: token.colorError }}>*</span>
                  </label>
                  <Select
                    style={{ width: '100%' }}
                    placeholder="Pilih kolom Waktu"
                    value={timeCol}
                    onChange={setTimeCol}
                    options={columnOptions}
                  />
                </Col>
                <Col xs={24} sm={8}>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                    Kolom Status / Tipe <span style={{ color: token.colorTextTertiary }}>(opsional)</span>
                  </label>
                  <Select
                    allowClear
                    style={{ width: '100%' }}
                    placeholder="Auto (Masuk)"
                    value={statusCol}
                    onChange={setStatusCol}
                    options={columnOptions}
                  />
                </Col>
              </Row>
            </Card>

            {/* Preview Tabel */}
            {validPayload.length > 0 ? (
              <div>
                <Typography.Text strong style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                  Pratinjau 5 Baris Pertama yang Terbaca:
                </Typography.Text>
                <Table<IngestPayloadItem>
                  size="small"
                  pagination={false}
                  columns={previewColumns}
                  dataSource={previewRows}
                />
              </div>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Pastikan kolom PIN dan Waktu sudah dipilih dengan benar agar data terbaca"
              />
            )}
          </div>
        )}

        {/* Progress Bar saat upload */}
        {uploading && (
          <div style={{ marginTop: 8 }}>
            <Typography.Text style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>
              Mengirim log scan ke database... ({progress}%)
            </Typography.Text>
            <Progress percent={progress} status="active" />
          </div>
        )}

        <Alert
          type="info"
          showIcon
          style={{ borderRadius: 10 }}
          message="Cara Kerja Mesin Offline"
          description="Log scan mentah akan masuk ke database dan langsung dicocokkan otomatis ke santri berdasarkan NIS, NISN, atau Kode Registrasi. Setelah selesai diimpor, klik tombol 'Sinkronkan ke Absensi' untuk memasukkan tanda Hadir (H) ke buku absensi harian."
        />
      </Space>
    </AppModal>
  )
}
