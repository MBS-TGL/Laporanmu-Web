import { useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Progress,
  Row,
  Space,
  Table,
  Tag,
  Typography,
  theme,
  type TableColumnsType,
} from 'antd'
import {
  CheckCircleOutlined,
  FileExcelOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import { AppModal } from '../../../shared/components/AppModal'
import { ModalFooter } from '../../../shared/components/ModalFooter'
import { UploadDropzone } from '../../../shared/components/UploadDropzone'
import { useTeachers } from '../hooks'
import { useSaveTeacherAttendance } from './hooks'
import type { TeacherAttendancePayload } from './types'

dayjs.extend(customParseFormat)

interface LogModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

interface ParsedAttendanceRow {
  teacherId: string
  teacherName: string
  nip?: string | null
  date: string // YYYY-MM-DD
  scanIn?: string | null
  scanOut?: string | null
  status: 'hadir'
  note?: string
}

function normalizeStr(s: unknown): string {
  return String(s ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Parse tanggal berbagai format Fingerspot ke YYYY-MM-DD */
function parseDateStrToIso(raw: unknown): string | null {
  if (!raw) return null

  // Jika date object dari Excel
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    return dayjs(raw).format('YYYY-MM-DD')
  }

  // Jika serial number Excel (contoh: 45234)
  if (typeof raw === 'number') {
    const d = new Date((raw - (25567 + 2)) * 86400 * 1000)
    if (!isNaN(d.getTime())) return dayjs(d).format('YYYY-MM-DD')
  }

  const str = String(raw).trim()
  if (!str) return null

  // Format umum Fingerspot: DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD
  const formats = ['DD-MM-YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', 'YYYY/MM/DD', 'D-M-YYYY', 'D/M/YYYY']
  for (const fmt of formats) {
    const parsed = dayjs(str, fmt, true)
    if (parsed.isValid()) return parsed.format('YYYY-MM-DD')
  }

  const fallback = dayjs(str)
  if (fallback.isValid()) return fallback.format('YYYY-MM-DD')

  return null
}

/** Ambil string jam yang bersih */
function formatTimeString(raw: unknown): string | null {
  if (!raw) return null
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    return dayjs(raw).format('HH:mm:ss')
  }
  const str = String(raw).trim()
  if (!str) return null
  // Format jam: HH:mm:ss atau HH:mm
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(str)) {
    return str
  }
  return str
}

export function LogModal({ open, onClose, onSuccess }: LogModalProps) {
  const { message } = App.useApp()
  const { token } = theme.useToken()

  const [fileList, setFileList] = useState<File[]>([])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- setter dipakai di alur proses, nilai belum ditampilkan di UI
  const [, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const [parsedRows, setParsedRows] = useState<ParsedAttendanceRow[]>([])
  const [unmatchedNames, setUnmatchedNames] = useState<string[]>([])

  // Ambil data seluruh guru aktif untuk pencocokan NIP & Nama
  const teachersQuery = useTeachers({ page: 1, pageSize: 1000 })
  const allTeachers = useMemo(
    () => (teachersQuery.data?.data ?? []).filter((t) => t.status === 'active'),
    [teachersQuery.data],
  )

  const saveMutation = useSaveTeacherAttendance()

  const handleReset = () => {
    setFileList([])
    setParsedRows([])
    setUnmatchedNames([])
    setProgress(0)
    setUploading(false)
  }

  const handleClose = () => {
    if (uploading) return
    handleReset()
    onClose()
  }

  const processFile = async (file: File) => {
    setLoading(true)
    try {
      // Dynamic import: chunk xlsx (~490 KB) hanya terunduh saat file diproses.
      const XLSX = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
      const firstSheetName = wb.SheetNames[0]
      if (!firstSheetName) {
        message.error('File Excel tidak memiliki sheet data')
        setLoading(false)
        return
      }

      const ws = wb.Sheets[firstSheetName]
      const rawMatrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' })

      if (rawMatrix.length < 2) {
        message.warning('File tidak memiliki data yang cukup')
        setLoading(false)
        return
      }

      // 1. Cari baris header yang mengandung kata kunci Fingerspot ("Nama" & "Tanggal")
      let headerRowIdx = -1
      for (let i = 0; i < Math.min(rawMatrix.length, 10); i++) {
        const row = rawMatrix[i] || []
        const rowStr = row.map((c) => String(c).toLowerCase()).join(' ')
        if (rowStr.includes('nama') && (rowStr.includes('tanggal') || rowStr.includes('date'))) {
          headerRowIdx = i
          break
        }
      }

      if (headerRowIdx === -1) {
        throw new Error('Header kolom "Nama" dan "Tanggal" tidak ditemukan di 10 baris pertama file')
      }

      const headers = (rawMatrix[headerRowIdx] || []).map((h) => normalizeStr(h))
      const namaColIdx = headers.findIndex((h) => h === 'nama' || h.includes('nama'))
      const nipColIdx = headers.findIndex((h) => h === 'nip' || h.includes('nip'))
      const tglColIdx = headers.findIndex((h) => h === 'tanggal' || h.includes('tanggal') || h.includes('date'))

      // Kolom scan jam (Scan 1, Scan 2, Scan 3, Scan 4, dsb)
      const scanColIndices: number[] = []
      headers.forEach((h, idx) => {
        if (h.includes('scan') || h.includes('jam') || h.includes('masuk') || h.includes('pulang')) {
          scanColIndices.push(idx)
        }
      })

      // Buat lookup map guru dari database
      const teacherByNip = new Map<string, (typeof allTeachers)[0]>()
      const teacherByName = new Map<string, (typeof allTeachers)[0]>()

      for (const t of allTeachers) {
        if (t.nip) teacherByNip.set(normalizeStr(t.nip), t)
        if (t.nbm) teacherByNip.set(normalizeStr(t.nbm), t) // jika Fingerspot pakai NBM sebagai NIP
        teacherByName.set(normalizeStr(t.name), t)
      }

      const results: ParsedAttendanceRow[] = []
      const unmatchedSet = new Set<string>()

      // 2. Baca baris data setelah header
      for (let r = headerRowIdx + 1; r < rawMatrix.length; r++) {
        const row = rawMatrix[r] || []
        const rawName = String(row[namaColIdx] ?? '').trim()
        if (!rawName) continue

        const rawNip = nipColIdx !== -1 ? String(row[nipColIdx] ?? '').trim() : ''
        const rawDate = tglColIdx !== -1 ? row[tglColIdx] : null
        const dateIso = parseDateStrToIso(rawDate)

        if (!dateIso) continue

        // Cocokkan guru: Prioritas 1 NIP, Prioritas 2 Nama
        let matchedTeacher = rawNip ? teacherByNip.get(normalizeStr(rawNip)) : undefined
        if (!matchedTeacher) {
          matchedTeacher = teacherByName.get(normalizeStr(rawName))
        }

        if (!matchedTeacher) {
          unmatchedSet.add(rawNip ? `${rawName} (${rawNip})` : rawName)
          continue
        }

        // Kumpulkan jam scan di baris ini
        const validScanTimes: string[] = []
        for (const colIdx of scanColIndices) {
          const formatted = formatTimeString(row[colIdx])
          if (formatted) validScanTimes.push(formatted)
        }

        // Jika tidak ada scan sama sekali -> LEWATI (sesuai instruksi user)
        if (validScanTimes.length === 0) continue

        const scanIn = validScanTimes[0]
        const scanOut = validScanTimes.length > 1 ? validScanTimes[validScanTimes.length - 1] : undefined

        let note = ''
        if (scanIn && scanOut && scanIn !== scanOut) {
          note = `Masuk: ${scanIn.slice(0, 5)} | Pulang: ${scanOut.slice(0, 5)}`
        } else if (scanIn) {
          note = `Scan: ${scanIn.slice(0, 5)}`
        }

        results.push({
          teacherId: matchedTeacher.id,
          teacherName: matchedTeacher.name,
          nip: matchedTeacher.nip || matchedTeacher.nbm,
          date: dateIso,
          scanIn,
          scanOut,
          status: 'hadir',
          note,
        })
      }

      setFileList([file])
      setParsedRows(results)
      setUnmatchedNames([...unmatchedSet])

      if (results.length > 0) {
        message.success(`Berhasil memetakan ${results.length} log kehadiran guru`)
      } else {
        message.warning('File terbaca, namun tidak ada jam scan yang cocok dengan guru di sistem')
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Gagal memproses file Fingerspot')
    } finally {
      setLoading(false)
    }
  }

  // Ringkasan data yang terbaca
  const stats = useMemo(() => {
    if (parsedRows.length === 0) return null
    const uniqueTeachers = new Set(parsedRows.map((r) => r.teacherId)).size
    const dates = [...new Set(parsedRows.map((r) => r.date))].sort()
    return {
      totalRows: parsedRows.length,
      teacherCount: uniqueTeachers,
      startDate: dates[0]!,
      endDate: dates[dates.length - 1]!,
    }
  }, [parsedRows])

  // Pratinjau 5 baris pertama
  const previewRows = useMemo(() => {
    return parsedRows.slice(0, 6).map((r, i) => ({ key: i, ...r }))
  }, [parsedRows])

  const previewColumns: TableColumnsType<ParsedAttendanceRow> = [
    {
      title: 'Guru / Pegawai',
      key: 'name',
      render: (_, r) => (
        <div>
          <span style={{ fontWeight: 600 }}>{r.teacherName}</span>
          {r.nip && (
            <div style={{ fontSize: 11, color: token.colorTextTertiary }}>NIP: {r.nip}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Tanggal',
      dataIndex: 'date',
      key: 'date',
      width: 120,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Jam Masuk',
      dataIndex: 'scanIn',
      key: 'scanIn',
      width: 100,
      render: (v) => (v ? <Tag color="green">{v.slice(0, 5)}</Tag> : '—'),
    },
    {
      title: 'Jam Pulang',
      dataIndex: 'scanOut',
      key: 'scanOut',
      width: 100,
      render: (v) => (v ? <Tag color="blue">{v.slice(0, 5)}</Tag> : '—'),
    },
    {
      title: 'Status Hasil',
      key: 'status',
      width: 100,
      render: () => <Tag color="success">Hadir</Tag>,
    },
  ]

  // Eksekusi simpan massal ke teacher_attendance
  const handleExecuteImport = async () => {
    if (parsedRows.length === 0) return

    setUploading(true)
    setProgress(0)

    // Ubah ke format payload yang diharapkan API
    const payloads: TeacherAttendancePayload[] = parsedRows.map((r) => ({
      teacher_id: r.teacherId,
      date: r.date,
      status: 'hadir',
      note: r.note || null,
    }))

    const chunkSize = 200
    const totalChunks = Math.ceil(payloads.length / chunkSize)

    try {
      for (let i = 0; i < totalChunks; i++) {
        const chunk = payloads.slice(i * chunkSize, (i + 1) * chunkSize)
        await saveMutation.mutateAsync(chunk)
        const percent = Math.round(((i + 1) / totalChunks) * 100)
        setProgress(percent)
      }

      message.success(`Sukses menyimpan ${payloads.length} data kehadiran guru!`)
      if (onSuccess) onSuccess()
      handleClose()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Gagal menyimpan data absensi guru')
    } finally {
      setUploading(false)
    }
  }

  return (
    <AppModal
      open={open}
      onCancel={handleClose}
      width={700}
      title="Impor Log Fingerspot Guru & Karyawan"
      subtitle="Unggah file rekap Excel (.xls / .xlsx) hasil ekspor dari aplikasi Fingerspot Personel."
      icon={<FileExcelOutlined />}
      footer={
        <ModalFooter
          left={
            parsedRows.length > 0 ? (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Total: <b>{parsedRows.length} scan hadir</b> siap disimpan
              </Typography.Text>
            ) : undefined
          }
          onCancel={handleClose}
          cancelText="Tutup"
          cancelDisabled={uploading}
          onOk={handleExecuteImport}
          okText={`Simpan ke Absensi (${parsedRows.length})`}
          okIcon={<CheckCircleOutlined />}
          okDisabled={parsedRows.length === 0}
          okLoading={uploading}
        />
      }
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {/* Drop Zone */}
        {parsedRows.length === 0 ? (
          <div>
            <UploadDropzone
              accept=".xls,.xlsx,.csv"
              beforeUpload={(file) => {
                void processFile(file as unknown as File)
                return false
              }}
              title="Klik atau seret file Excel Fingerspot ke sini"
              hint="Format didukung: Absen Guru Karyawan - [Bulan].xls langsung dari Fingerspot Personel."
            />
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Space>
                <FileExcelOutlined style={{ color: token.colorSuccess, fontSize: 20 }} />
                <Typography.Text strong>{fileList[0]?.name}</Typography.Text>
                <Tag color="success">{parsedRows.length} record</Tag>
              </Space>
              <Button size="small" onClick={handleReset} disabled={uploading}>
                Ganti File
              </Button>
            </div>

            {/* Statistik Ringkas */}
            {stats && (
              <Row gutter={[12, 12]} style={{ marginBottom: 14 }}>
                <Col xs={12} sm={8}>
                  <Card size="small" style={{ borderRadius: 10, background: token.colorSuccessBg, borderColor: token.colorSuccessBorder }}>
                    <div style={{ fontSize: 11.5, color: token.colorSuccessTextActive }}>Total Record Hadir</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: token.colorSuccessTextActive }}>
                      {stats.totalRows}
                    </div>
                  </Card>
                </Col>
                <Col xs={12} sm={8}>
                  <Card size="small" style={{ borderRadius: 10, background: token.colorPrimaryBg, borderColor: token.colorPrimaryBorder }}>
                    <div style={{ fontSize: 11.5, color: token.colorPrimaryTextActive }}>Guru Terpetakan</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: token.colorPrimaryTextActive }}>
                      {stats.teacherCount} guru
                    </div>
                  </Card>
                </Col>
                <Col xs={24} sm={8}>
                  <Card size="small" style={{ borderRadius: 10, background: token.colorBgLayout, borderColor: token.colorBorderSecondary }}>
                    <div style={{ fontSize: 11.5, color: token.colorTextSecondary }}>Rentang Tanggal</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: token.colorText, marginTop: 4 }}>
                      {dayjs(stats.startDate).format('DD MMM')} – {dayjs(stats.endDate).format('DD MMM YYYY')}
                    </div>
                  </Card>
                </Col>
              </Row>
            )}

            {/* Warning Guru Unmatched bila ada */}
            {unmatchedNames.length > 0 && (
              <Alert
                type="warning"
                showIcon
                icon={<WarningOutlined />}
                style={{ borderRadius: 10, marginBottom: 14 }}
                message={`${unmatchedNames.length} nama di file tidak ditemukan di database master guru`}
                description={
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    Pastikan nama atau NIP guru di master guru sama persis. Nama yang dilewati:{' '}
                    <b>{unmatchedNames.slice(0, 4).join(', ')}</b>
                    {unmatchedNames.length > 4 ? ` dan ${unmatchedNames.length - 4} lainnya` : ''}.
                  </div>
                }
              />
            )}

            {/* Pratinjau Tabel */}
            <Typography.Text strong style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
              Pratinjau 6 Baris Pertama yang Terbaca:
            </Typography.Text>
            <Table<ParsedAttendanceRow>
              size="small"
              pagination={false}
              columns={previewColumns}
              dataSource={previewRows}
            />
          </div>
        )}

        {/* Progress Bar Upload */}
        {uploading && (
          <div style={{ marginTop: 8 }}>
            <Typography.Text style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>
              Menyimpan data kehadiran ke database... ({progress}%)
            </Typography.Text>
            <Progress percent={progress} status="active" />
          </div>
        )}

        <Alert
          type="info"
          showIcon
          style={{ borderRadius: 10 }}
          message="Ketentuan Impor Fingerspot"
          description="Hanya tanggal yang memiliki jam scan (minimal Scan 1) yang akan ditandai Hadir (H). Hari yang tidak memiliki jam scan akan dilewati sehingga Anda dapat mengisi izin/sakit/tugas luar secara manual bila diperlukan."
        />
      </Space>
    </AppModal>
  )
}
