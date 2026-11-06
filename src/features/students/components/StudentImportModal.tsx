import { useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Select,
  Space,
  Statistic,
  Steps,
  Table,
  Tag,
  Upload,
} from 'antd'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DownloadOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import type { UploadFile } from 'antd'
import Papa from 'papaparse'
import { useQueryClient } from '@tanstack/react-query'
import { AppModal } from '../../../shared/components/AppModal'
import { importStudents, type ImportStudentPayload, type ImportStudentResult } from '../api'
import { useClassesBrief, useDormsBrief } from '../hooks'

const VALID_STATUSES = ['aktif', 'lulus', 'pindah', 'keluar']

interface ParsedRow {
  key: number
  name?: string
  registration_code?: string
  nisn?: string
  gender?: string
  status?: string
  phone?: string
  error?: string
}

const TEMPLATE_CSV = [
  'name,registration_code,nisn,gender,status,phone',
  'Ahmad Fulan,2026001,0012345678,L,aktif,081234567890',
  'Siti Fulanah,2026002,0012345679,P,aktif,',
].join('\n')

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'template-impor-siswa.csv'
  link.click()
  URL.revokeObjectURL(url)
}

function validateRows(rows: ParsedRow[]): ParsedRow[] {
  const seen = new Set<string>()
  return rows.map((row) => {
    const name = row.name?.trim()
    const code = row.registration_code?.trim()
    let error: string | undefined

    if (!name) error = 'Nama kosong'
    else if (!code) error = 'Kode registrasi kosong'
    else if (seen.has(code.toLowerCase())) error = 'Kode registrasi duplikat di file'
    else if (row.gender && !['L', 'P'].includes(row.gender.trim().toUpperCase()))
      error = 'Gender harus L atau P'
    else if (row.status && !VALID_STATUSES.includes(row.status.trim().toLowerCase()))
      error = 'Status tidak valid'

    if (code) seen.add(code.toLowerCase())
    return { ...row, name, registration_code: code, error }
  })
}

interface StudentImportModalProps {
  open: boolean
  onClose: () => void
}

export function StudentImportModal({ open, onClose }: StudentImportModalProps) {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [step, setStep] = useState(0)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [results, setResults] = useState<ImportStudentResult[]>([])
  const [classId, setClassId] = useState<string>()
  const [dormId, setDormId] = useState<string>()
  const [submitting, setSubmitting] = useState(false)
  const [fileName, setFileName] = useState<string>()

  const classesQuery = useClassesBrief()
  const dormsQuery = useDormsBrief()

  const validRows = useMemo(() => rows.filter((r) => !r.error), [rows])
  const okCount = results.filter((r) => r.ok).length
  const failCount = results.length - okCount

  const reset = () => {
    setStep(0)
    setRows([])
    setResults([])
    setClassId(undefined)
    setDormId(undefined)
    setSubmitting(false)
    setFileName(undefined)
  }

  const handleClose = () => {
    onClose()
    // reset setelah modal tertutup agar transisi tidak terlihat
    setTimeout(reset, 200)
  }

  const parseFile = (file: UploadFile) => {
    if (!file.originFileObj) return false
    Papa.parse<Record<string, string>>(file.originFileObj, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const parsed: ParsedRow[] = result.data.map((row, index) => ({
          key: index + 1,
          name: row.name?.trim(),
          registration_code: row.registration_code?.trim(),
          nisn: row.nisn?.trim() || undefined,
          gender: row.gender?.trim().toUpperCase() || undefined,
          status: row.status?.trim().toLowerCase() || undefined,
          phone: row.phone?.trim() || undefined,
        }))
        if (parsed.length === 0) {
          message.error('File CSV kosong atau formatnya tidak sesuai')
          return
        }
        setRows(validateRows(parsed))
        setFileName(file.name)
        setStep(1)
      },
      error: () => message.error('Gagal membaca file CSV'),
    })
    return false // cegah upload otomatis antd
  }

  const handleImport = async () => {
    if (!classId) {
      message.warning('Pilih kelas terlebih dahulu')
      return
    }
    setSubmitting(true)
    try {
      const payload: ImportStudentPayload[] = validRows.map((row) => ({
        name: row.name as string,
        registration_code: row.registration_code as string,
        class_id: classId,
        gender: row.gender,
        status: row.status,
        phone: row.phone,
        nisn: row.nisn,
        dorm_id: dormId,
      }))
      const res = await importStudents(payload)
      setResults(res)
      void queryClient.invalidateQueries({ queryKey: ['students'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setStep(2)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Gagal mengimpor siswa')
    } finally {
      setSubmitting(false)
    }
  }

  const previewColumns = [
    { title: '#', dataIndex: 'key', key: 'key', width: 50 },
    { title: 'Nama', dataIndex: 'name', key: 'name', render: (v?: string) => v || '-' },
    {
      title: 'Kode Registrasi',
      dataIndex: 'registration_code',
      key: 'registration_code',
      render: (v?: string) => v || '-',
    },
    { title: 'Gender', dataIndex: 'gender', key: 'gender', width: 80, render: (v?: string) => v || '-' },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 90, render: (v?: string) => v || 'aktif' },
    {
      title: 'Status Validasi',
      dataIndex: 'error',
      key: 'error',
      render: (v?: string) =>
        v ? <Tag color="red">{v}</Tag> : <Tag color="green">Siap impor</Tag>,
    },
  ]

  const resultColumns = [
    { title: 'Baris', dataIndex: 'row_index', key: 'row_index', width: 70 },
    {
      title: 'Hasil',
      dataIndex: 'ok',
      key: 'ok',
      width: 100,
      render: (v: boolean) =>
        v ? <Tag icon={<CheckCircleOutlined />} color="success">Berhasil</Tag> : <Tag icon={<CloseCircleOutlined />} color="error">Gagal</Tag>,
    },
    { title: 'Keterangan', dataIndex: 'error', key: 'error', render: (v: string | null) => v || 'Tersimpan' },
  ]

  return (
    <AppModal
      title="Impor Siswa dari CSV"
      open={open}
      onCancel={handleClose}
      width={720}
      footer={
        step === 0 ? (
          <Button onClick={handleClose}>Batal</Button>
        ) : step === 1 ? (
          <Space>
            <Button onClick={() => setStep(0)}>Kembali</Button>
            <Button
              type="primary"
              loading={submitting}
              disabled={validRows.length === 0 || !classId}
              onClick={() => void handleImport()}
            >
              Impor {validRows.length} Siswa
            </Button>
          </Space>
        ) : (
          <Button type="primary" onClick={handleClose}>
            Selesai
          </Button>
        )
      }
    >
      <Steps
        size="small"
        current={step}
        style={{ marginBottom: 24 }}
        items={[{ title: 'Unggah' }, { title: 'Pratinjau' }, { title: 'Hasil' }]}
      />

      {step === 0 && (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message="Format kolom CSV"
            description={
              <Space direction="vertical" size={4}>
                <span>
                  Wajib: <b>name</b>, <b>registration_code</b>. Opsional: <b>nisn</b>,{' '}
                  <b>gender</b> (L/P), <b>status</b> (aktif/lulus/pindah/keluar), <b>phone</b>.
                </span>
                <Button type="link" size="small" icon={<DownloadOutlined />} onClick={downloadTemplate} style={{ padding: 0 }}>
                  Unduh template CSV
                </Button>
              </Space>
            }
          />
          <Space wrap size="middle">
            <Select
              placeholder="Kelas untuk semua baris *"
              style={{ minWidth: 220 }}
              value={classId}
              loading={classesQuery.isPending}
              onChange={setClassId}
              options={(classesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            />
            <Select
              placeholder="Asrama (opsional)"
              allowClear
              style={{ minWidth: 200 }}
              value={dormId}
              loading={dormsQuery.isPending}
              onChange={setDormId}
              options={(dormsQuery.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
            />
          </Space>
          <Upload.Dragger
            accept=".csv"
            maxCount={1}
            beforeUpload={() => false}
            onChange={({ fileList }) => {
              if (fileList.length > 0) parseFile(fileList[fileList.length - 1])
            }}
            onRemove={() => {
              setRows([])
              setFileName(undefined)
            }}
          >
            <p className="ant-upload-drag-icon">
              <UploadOutlined />
            </p>
            <p className="ant-upload-text">Klik atau seret file CSV ke sini</p>
          </Upload.Dragger>
        </Space>
      )}

      {step === 1 && (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            type={rows.some((r) => r.error) ? 'warning' : 'success'}
            showIcon
            message={`File "${fileName}" — ${validRows.length} baris siap impor, ${rows.length - validRows.length} baris bermasalah (akan dilewati)`}
          />
          <Table<ParsedRow>
            rowKey="key"
            size="small"
            columns={previewColumns}
            dataSource={rows}
            pagination={{ pageSize: 8 }}
            scroll={{ x: true }}
          />
        </Space>
      )}

      {step === 2 && (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Space size="large">
            <Statistic title="Berhasil" value={okCount} valueStyle={{ color: '#3f8600' }} />
            <Statistic title="Gagal" value={failCount} valueStyle={{ color: '#cf1322' }} />
          </Space>
          {failCount > 0 && (
            <Alert type="warning" showIcon message="Perbaiki baris yang gagal lalu impor ulang dengan kode registrasi yang sama." />
          )}
          <Table<ImportStudentResult>
            rowKey="row_index"
            size="small"
            columns={resultColumns}
            dataSource={results}
            pagination={{ pageSize: 8 }}
          />
        </Space>
      )}
    </AppModal>
  )
}
