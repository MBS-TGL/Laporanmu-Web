import { useState, useMemo } from 'react'
import {
  App,
  Button,
  Progress,
  Radio,
  Space,
  Table,
  Tag,
  Upload,
  theme,
  type TableColumnsType,
} from 'antd'
import {
  CheckCircleOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  InboxOutlined,
  ImportOutlined,
} from '@ant-design/icons'
import Papa from 'papaparse'
import { AppModal } from '../../../shared/components/AppModal'
import { ModalNotice } from '../../../shared/components/ModalNotice'
import { formatDisplayName } from '../../../shared/utils/displayName'
import {
  checkAlumniDuplicate,
  validateAlumniRow,
  type DuplicateStatus,
} from '../alumniValidation'
import { useClassesBrief } from '../hooks'
import { useExistingAlumniKeys, useImportAlumni } from '../hooks'
import type { ImportAlumniRowPayload } from '../api'

const { Dragger } = Upload

interface Props {
  open: boolean
  onClose: () => void
}

interface ParsedAlumniRow {
  key: number
  raw_nama?: string
  raw_jenis_kelamin?: string
  raw_tahun_lulus?: string
  raw_nisn?: string
  raw_kelas_terakhir?: string
  raw_tanggal_lulus?: string
  raw_no_hp?: string

  // Validasi & Status
  status: DuplicateStatus
  error_message?: string
  name: string
  gender: 'L' | 'P'
  graduation_year: number
  nisn?: string
  last_class_id?: string
  last_class_name?: string
  graduated_at?: string
  phone?: string
}

const TEMPLATE_HEADERS = [
  'nama',
  'jenis_kelamin',
  'tahun_lulus',
  'nisn',
  'kelas_terakhir',
  'tanggal_lulus',
  'no_hp',
]

const SAMPLE_ROWS = [
  {
    nama: 'Ahmad Dahlan',
    jenis_kelamin: 'L',
    tahun_lulus: '2024',
    nisn: '0012345678',
    kelas_terakhir: '12 IPA 1',
    tanggal_lulus: '2024-05-15',
    no_hp: '081234567890',
  },
  {
    nama: 'Siti Walidah',
    jenis_kelamin: 'P',
    tahun_lulus: '2024',
    nisn: '0012345679',
    kelas_terakhir: '12 IPS 2',
    tanggal_lulus: '2024-05-15',
    no_hp: '081987654321',
  },
]

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function handleDownloadTemplateXlsx() {
  void import('xlsx').then((XLSX) => {
    const header = [...TEMPLATE_HEADERS]
    const data = SAMPLE_ROWS.map((row) => [
      row.nama,
      row.jenis_kelamin,
      row.tahun_lulus,
      row.nisn,
      row.kelas_terakhir,
      row.tanggal_lulus,
      row.no_hp,
    ])
    const ws = XLSX.utils.aoa_to_sheet([header, ...data])

    // Kunci kolom teks (nisn, tanggal_lulus, no_hp) agar angka 0 di depan tidak hilang
    const textCols = new Set(['nisn', 'tanggal_lulus', 'no_hp'])
    for (let c = 0; c < header.length; c++) {
      if (!textCols.has(header[c])) continue
      for (let r = 1; r <= data.length; r++) {
        const addr = XLSX.utils.encode_cell({ r, c })
        if (ws[addr]) ws[addr].z = '@'
      }
    }

    ws['!cols'] = header.map((h, c) => ({
      wch: Math.min(30, Math.max(h.length + 3, ...data.map((r) => String(r[c] ?? '').length + 3))),
    }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Alumni')
    XLSX.writeFile(wb, 'template-impor-alumni.xlsx')
  })
}

function handleDownloadTemplateCsv() {
  const csv = Papa.unparse({
    fields: TEMPLATE_HEADERS,
    data: SAMPLE_ROWS.map((r) => [
      r.nama,
      r.jenis_kelamin,
      r.tahun_lulus,
      r.nisn,
      r.kelas_terakhir,
      r.tanggal_lulus,
      r.no_hp,
    ]),
  })
  downloadCsv('template-impor-alumni.csv', csv)
}

function cellToString(val: unknown): string {
  if (val === null || val === undefined) return ''
  if (val instanceof Date) {
    const y = val.getFullYear()
    const m = String(val.getMonth() + 1).padStart(2, '0')
    const d = String(val.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return String(val).trim()
}

async function readFileRows(file: File): Promise<string[][]> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'xlsx' || ext === 'xls') {
    const XLSX = await import('xlsx')
    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: true,
      defval: '',
      blankrows: false,
    })
    return data.map((row) => row.map(cellToString))
  }

  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(file, {
      skipEmptyLines: true,
      complete: (res) => resolve(res.data.map((row) => row.map(cellToString))),
      error: (err) => reject(err),
    })
  })
}

export function AlumniImport({ open, onClose }: Props) {
  const { message } = App.useApp()
  const { token } = theme.useToken()

  // Steps: 0 = Upload & Template, 1 = Preview & Filter, 2 = Selesai
  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [parsedRows, setParsedRows] = useState<ParsedAlumniRow[]>([])
  const [fileName, setFileName] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'baru' | 'duplikat' | 'error'>('all')
  const [progress, setProgress] = useState<{ processed: number; total: number } | null>(null)
  const [importSummary, setImportSummary] = useState<{ successful: number; failed: number } | null>(
    null,
  )

  const classesQuery = useClassesBrief()
  const existingKeysQuery = useExistingAlumniKeys(open)
  const importMutation = useImportAlumni()

  const classesList = useMemo(() => classesQuery.data ?? [], [classesQuery.data])
  const existingKeys = useMemo(() => existingKeysQuery.data ?? [], [existingKeysQuery.data])

  const resetState = () => {
    setStep(0)
    setParsedRows([])
    setFileName('')
    setStatusFilter('all')
    setProgress(null)
    setImportSummary(null)
  }

  const handleModalClose = () => {
    if (importMutation.isPending) return
    resetState()
    onClose()
  }

  const handleFileSelected = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      message.error('Ukuran file maksimal 2 MB')
      return false
    }

    try {
      const tableData = await readFileRows(file)
      if (tableData.length < 2) {
        message.error('File tidak memiliki baris data')
        return false
      }

      if (tableData.length > 5001) {
        message.error('Maksimal 5.000 baris data per impor')
        return false
      }

      const rawHeaders = tableData[0].map((h) =>
        h.toLowerCase().replace(/[^a-z0-9_]/g, '').trim(),
      )

      // Pemetaan kolom fleksibel
      const colMap = {
        nama: rawHeaders.findIndex((h) => h.includes('nama') || h.includes('name')),
        gender: rawHeaders.findIndex(
          (h) => h.includes('jenis') || h.includes('gender') || h === 'jk' || h === 'l_p',
        ),
        tahun: rawHeaders.findIndex((h) => h.includes('tahun') || h.includes('angkatan') || h === 'year'),
        nisn: rawHeaders.findIndex((h) => h.includes('nisn')),
        kelas: rawHeaders.findIndex((h) => h.includes('kelas') || h.includes('class')),
        tanggal: rawHeaders.findIndex(
          (h) => h.includes('tanggal') || h.includes('tgl') || h.includes('graduated_at'),
        ),
        hp: rawHeaders.findIndex(
          (h) => h.includes('hp') || h.includes('wa') || h.includes('telepon') || h.includes('phone'),
        ),
      }

      if (colMap.nama === -1) {
        message.error('Kolom "nama" tidak ditemukan dalam file')
        return false
      }

      // Pelacakan duplikat batch internal
      const batchSeenKeys = {
        nisnSet: new Set<string>(),
        nameYearSet: new Set<string>(),
      }

      const rows: ParsedAlumniRow[] = []

      for (let i = 1; i < tableData.length; i++) {
        const row = tableData[i]
        // Abaikan baris kosong
        if (row.every((cell) => !cell || cell.trim() === '')) continue

        const rawNama = colMap.nama >= 0 ? row[colMap.nama] : ''
        const rawGender = colMap.gender >= 0 ? row[colMap.gender] : ''
        const rawTahun = colMap.tahun >= 0 ? row[colMap.tahun] : ''
        const rawNisn = colMap.nisn >= 0 ? row[colMap.nisn] : ''
        const rawKelas = colMap.kelas >= 0 ? row[colMap.kelas] : ''
        const rawTanggal = colMap.tanggal >= 0 ? row[colMap.tanggal] : ''
        const rawHp = colMap.hp >= 0 ? row[colMap.hp] : ''

        // 1. Validasi format
        const valRes = validateAlumniRow(
          {
            name: rawNama,
            gender: rawGender,
            graduation_year: rawTahun,
            nisn: rawNisn,
            class_name: rawKelas,
            graduated_at: rawTanggal,
            phone: rawHp,
          },
          classesList,
        )

        let status: DuplicateStatus = 'baru'
        let errorMessage = valRes.error

        if (!valRes.isValid) {
          status = 'error'
        } else {
          // 2. Cek duplikasi
          const dupRes = checkAlumniDuplicate(
            {
              name: valRes.normalized.name,
              graduation_year: valRes.normalized.graduation_year,
              nisn: valRes.normalized.nisn,
            },
            existingKeys,
            batchSeenKeys,
          )

          if (dupRes.isDuplicate) {
            status = 'duplikat'
            errorMessage = dupRes.reason
          } else {
            // Catat ke memori batch agar baris berikutnya terdeteksi duplikat
            if (valRes.normalized.nisn) {
              batchSeenKeys.nisnSet.add(valRes.normalized.nisn)
            } else {
              const compKey = `${valRes.normalized.name.toLowerCase().replace(/[^a-z0-9]/g, '')}_${valRes.normalized.graduation_year}`
              batchSeenKeys.nameYearSet.add(compKey)
            }
          }
        }

        rows.push({
          key: i,
          raw_nama: rawNama,
          raw_jenis_kelamin: rawGender,
          raw_tahun_lulus: rawTahun,
          raw_nisn: rawNisn,
          raw_kelas_terakhir: rawKelas,
          raw_tanggal_lulus: rawTanggal,
          raw_no_hp: rawHp,

          status,
          error_message: errorMessage,
          name: valRes.normalized.name,
          gender: valRes.normalized.gender,
          graduation_year: valRes.normalized.graduation_year,
          nisn: valRes.normalized.nisn,
          last_class_id: valRes.normalized.last_class_id,
          last_class_name: valRes.normalized.last_class_name,
          graduated_at: valRes.normalized.graduated_at,
          phone: valRes.normalized.phone,
        })
      }

      setFileName(file.name)
      setParsedRows(rows)
      setStep(1)
      return false
    } catch (err: unknown) {
      console.error(err)
      message.error(err instanceof Error ? err.message : 'Gagal memproses file')
      return false
    }
  }

  const counts = useMemo(() => {
    let baru = 0
    let duplikat = 0
    let error = 0
    for (const r of parsedRows) {
      if (r.status === 'baru') baru++
      else if (r.status === 'duplikat') duplikat++
      else if (r.status === 'error') error++
    }
    return { total: parsedRows.length, baru, duplikat, error }
  }, [parsedRows])

  const filteredRows = useMemo(() => {
    if (statusFilter === 'all') return parsedRows
    return parsedRows.filter((r) => r.status === statusFilter)
  }, [parsedRows, statusFilter])

  const handleDownloadErrorCsv = () => {
    const errorRows = parsedRows.filter((r) => r.status === 'error')
    if (errorRows.length === 0) return
    const csv = Papa.unparse({
      fields: [...TEMPLATE_HEADERS, 'alasan_error'],
      data: errorRows.map((r) => [
        r.raw_nama ?? '',
        r.raw_jenis_kelamin ?? '',
        r.raw_tahun_lulus ?? '',
        r.raw_nisn ?? '',
        r.raw_kelas_terakhir ?? '',
        r.raw_tanggal_lulus ?? '',
        r.raw_no_hp ?? '',
        r.error_message ?? '',
      ]),
    })
    downloadCsv(`baris-error-${fileName || 'alumni'}.csv`, csv)
  }

  const handleStartImport = () => {
    const toImport = parsedRows.filter((r) => r.status === 'baru')
    if (toImport.length === 0) {
      message.warning('Tidak ada baris data berstatus Baru yang siap diimpor')
      return
    }

    const payloads: ImportAlumniRowPayload[] = toImport.map((r) => ({
      name: r.name,
      gender: r.gender,
      graduation_year: r.graduation_year,
      nisn: r.nisn,
      last_class_id: r.last_class_id,
      graduated_at: r.graduated_at,
      phone: r.phone,
    }))

    setProgress({ processed: 0, total: payloads.length })

    importMutation.mutate(
      {
        rows: payloads,
        onProgress: (proc, tot) => setProgress({ processed: proc, total: tot }),
      },
      {
        onSuccess: (results) => {
          const successful = results.filter((r) => r.ok).length
          const failed = results.filter((r) => !r.ok).length
          setImportSummary({ successful, failed })
          setStep(2)
        },
        onError: (err: Error) => {
          message.error(err.message || 'Gagal menyimpan data alumni ke server')
        },
      },
    )
  }

  const columns: TableColumnsType<ParsedAlumniRow> = [
    {
      title: 'Status',
      key: 'status',
      width: 110,
      render: (_, r) => {
        if (r.status === 'baru') return <Tag color="success">Siap Impor</Tag>
        if (r.status === 'duplikat') return <Tag color="warning">Duplikat</Tag>
        return <Tag color="error">Error</Tag>
      },
    },
    {
      title: 'Nama',
      dataIndex: 'name',
      key: 'name',
      render: (v, r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{v ? formatDisplayName(v) : r.raw_nama || '-'}</div>
          {r.error_message && (
            <div style={{ fontSize: 12, color: r.status === 'error' ? token.colorError : token.colorWarning }}>
              {r.error_message}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Gender',
      dataIndex: 'gender',
      key: 'gender',
      width: 80,
      render: (v, r) => v ?? r.raw_jenis_kelamin ?? '-',
    },
    {
      title: 'Tahun',
      dataIndex: 'graduation_year',
      key: 'graduation_year',
      width: 80,
      render: (v, r) => v ?? r.raw_tahun_lulus ?? '-',
    },
    {
      title: 'NISN',
      dataIndex: 'nisn',
      key: 'nisn',
      width: 120,
      render: (v, r) => v ?? r.raw_nisn ?? '-',
    },
    {
      title: 'Kelas Terakhir',
      key: 'last_class',
      width: 140,
      render: (_, r) => r.last_class_name ?? r.raw_kelas_terakhir ?? '-',
    },
    {
      title: 'Tgl Lulus',
      dataIndex: 'graduated_at',
      key: 'graduated_at',
      width: 110,
      render: (v, r) => v ?? r.raw_tanggal_lulus ?? '-',
    },
    {
      title: 'No HP',
      dataIndex: 'phone',
      key: 'phone',
      width: 120,
      render: (v, r) => v ?? r.raw_no_hp ?? '-',
    },
  ]

  return (
    <AppModal
      title="Import Data Alumni"
      subtitle="Dari Excel/CSV: hasil masuk ke daftar alumni, bukan langsung tersimpan"
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
              marginBottom: 18,
              border: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 6 }}>1. Unduh Template File</div>
            <div style={{ fontSize: 13, color: token.colorTextSecondary, marginBottom: 12 }}>
              Gunakan format template yang sudah disediakan. Kolom NISN, No HP, dan Tanggal dikunci
              sebagai teks agar angka awalan 0 tidak hilang.
            </div>
            <Space wrap>
              <Button icon={<FileExcelOutlined />} onClick={handleDownloadTemplateXlsx}>
                Unduh Template Excel (.xlsx)
              </Button>
              <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplateCsv}>
                Unduh Template CSV (.csv)
              </Button>
            </Space>
          </div>

          <div style={{ fontWeight: 600, marginBottom: 8 }}>2. Pilih File Alumni</div>
          <Dragger
            name="file"
            multiple={false}
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            beforeUpload={handleFileSelected}
            showUploadList={false}
            style={{ padding: '24px 0', background: token.colorFillAlter }}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined style={{ fontSize: 44, color: token.colorPrimary }} />
            </p>
            <p className="ant-upload-text" style={{ fontWeight: 600 }}>
              Klik atau tarik file CSV / Excel ke area ini
            </p>
            <p className="ant-upload-hint" style={{ color: token.colorTextSecondary, fontSize: 12 }}>
              Maksimal 2 MB atau 5.000 baris per file. Duplikat akan otomatis dideteksi dan dilewati.
            </p>
          </Dragger>
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
                Pratinjau Data: {fileName}
              </div>
              <div style={{ fontSize: 13, color: token.colorTextSecondary }}>
                Total: <strong>{counts.total}</strong> baris ·{' '}
                <span style={{ color: token.colorSuccessTextActive }}>
                  {counts.baru} siap impor
                </span>{' '}
                ·{' '}
                <span style={{ color: token.colorWarningTextActive }}>
                  {counts.duplikat} duplikat (dilewati)
                </span>{' '}
                ·{' '}
                <span style={{ color: token.colorErrorTextActive }}>
                  {counts.error} error
                </span>
              </div>
            </div>

            <Radio.Group
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              size="small"
              buttonStyle="solid"
            >
              <Radio.Button value="all">Semua ({counts.total})</Radio.Button>
              <Radio.Button value="baru">Siap ({counts.baru})</Radio.Button>
              <Radio.Button value="duplikat">Duplikat ({counts.duplikat})</Radio.Button>
              <Radio.Button value="error">Error ({counts.error})</Radio.Button>
            </Radio.Group>
          </div>

          {counts.error > 0 && (
            <div style={{ marginBottom: 12 }}>
              <ModalNotice
                tone="error"
                title={`Terdapat ${counts.error} baris dengan format tidak valid`}
                action={
                  <Button size="small" danger onClick={handleDownloadErrorCsv} icon={<DownloadOutlined />}>
                    Unduh Baris Error (.csv)
                  </Button>
                }
              >
                Baris yang bermasalah tidak akan dimasukkan ke sistem.
              </ModalNotice>
            </div>
          )}

          <Table<ParsedAlumniRow>
            columns={columns}
            dataSource={filteredRows}
            pagination={{ pageSize: 8, showSizeChanger: false, size: 'small' }}
            size="small"
            scroll={{ x: 750 }}
            style={{ marginBottom: 16 }}
          />

          {progress && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span>Menyimpan alumni ke database...</span>
                <span>{progress.processed} / {progress.total}</span>
              </div>
              <Progress
                percent={Math.round((progress.processed / progress.total) * 100)}
                status="active"
              />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
            <Button onClick={resetState} disabled={importMutation.isPending}>
              Ganti File
            </Button>
            <Space>
              <Button onClick={handleModalClose} disabled={importMutation.isPending}>
                Batal
              </Button>
              <Button
                type="primary"
                icon={<ImportOutlined />}
                disabled={counts.baru === 0 || importMutation.isPending}
                loading={importMutation.isPending}
                onClick={handleStartImport}
              >
                Impor {counts.baru} Alumni
              </Button>
            </Space>
          </div>
        </div>
      )}

      {step === 2 && importSummary && (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <CheckCircleOutlined style={{ fontSize: 56, color: token.colorSuccess, marginBottom: 16 }} />
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            Proses Impor Selesai
          </div>
          <p style={{ color: token.colorTextSecondary, marginBottom: 20 }}>
            Sebanyak <strong>{importSummary.successful}</strong> data alumni berhasil disimpan ke sistem.
            {importSummary.failed > 0 && (
              <span style={{ color: token.colorError }}>
                {' '}({importSummary.failed} baris gagal).
              </span>
            )}
            {counts.duplikat > 0 && (
              <span> {counts.duplikat} baris duplikat dilewati.</span>
            )}
          </p>

          <Button type="primary" onClick={handleModalClose}>
            Selesai
          </Button>
        </div>
      )}
    </AppModal>
  )
}
