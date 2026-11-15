import { useMemo, useState } from 'react'
import {
  App,
  Button,
  Collapse,
  Progress,
  Radio,
  Table,
  Typography,
  theme,
  type TableColumnsType,
} from 'antd'
import {
  CheckCircleOutlined,
  DownloadOutlined,
  FileAddOutlined,
  FileExcelOutlined,
  ImportOutlined,
} from '@ant-design/icons'
import { AnimatePresence, motion } from 'motion/react'
import { AppModal, MODAL_SIZE } from '../components/AppModal'
import { IconBox } from '../components/IconBox'
import { WizardSteps } from '../components/WizardSteps'
import { ModalNotice } from '../components/ModalNotice'
import { UploadDropzone } from '../components/UploadDropzone'
import { swapTransition, swapVariants } from '../motion'
import { readSheet, downloadCsvRows } from './readFile'
import { downloadXlsx } from '../export/download'

// ─── Tipe konfigurasi (lihat SKILLS.md §Skill 3) ────────────────────────────

export type ImportRowStatus = 'siap' | 'error' | 'duplikat'

export const IMPORT_STATUS_COLOR: Record<ImportRowStatus, string> = {
  siap: 'green',
  error: 'red',
  duplikat: 'orange',
}

/** Definisi kolom — dipakai untuk template & tabel preview. */
export interface ImportColumn {
  key: string
  header: string
  width?: number
}

/** Tampilan satu baris di tabel preview. */
export interface ImportPreviewRow {
  /** Nomor baris di file sumber */
  row: number
  status: ImportRowStatus
  message?: string
  /** Nilai sel, urut sesuai config.columns */
  cells: string[]
}

export interface ImportTemplate {
  /** Nama file tanpa ekstensi — wizard membuat versi .xlsx dan .csv */
  filename: string
  headers: string[]
  exampleRows: (string | number)[][]
}

export interface ImportRunContext {
  /** Pecah daftar jadi chunk untuk insert batch */
  chunk: <T>(items: T[], size: number) => T[][]
  /** Laporkan progres (jumlah baris selesai, total) */
  onProgress: (done: number, total: number) => void
}

export interface ImportResult {
  inserted: number
  skipped?: number
  failed?: { label: string; error: string }[]
}

export interface ImportWizardProps<R> {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  /** Label satuan baris, mis. "Kamar", "Siswa" — dipakai di tombol & ringkasan */
  entityLabel: string
  /** Kolom preview — urutan & header harus cocok dengan output previewCells */
  columns: ImportColumn[]
  /** Panduan format di langkah unggah (Alert info) */
  formatHint?: React.ReactNode
  /** Template unduhan; bila diisi wizard membuat tombol Unduh Template otomatis */
  template?: ImportTemplate
  /** Tipe file yang diterima (default .xlsx,.xls,.csv) */
  accept?: string
  maxFileMb?: number
  maxRows?: number
  /**
   * Baca file → tabel string. Default: readSheet (xlsx & csv).
   * Override bila format khusus (multi-sheet, dsb).
   */
  readRows?: (file: File) => Promise<string[][]>
  /**
   * Ubah tabel string → baris ter-parse (SEMUA baris, termasuk yang error).
   * Parser murni sebaiknya hidup di file xImportParse.ts + test vitest.
   */
  parse: (table: string[][], ctx: { maxRows: number }) => Promise<R[]> | R[]
  /** Status tiap baris hasil parse */
  getRowStatus: (row: R) => ImportRowStatus
  /** Pesan error/duplikat tiap baris (opsional) */
  getRowMessage?: (row: R) => string | undefined
  /** Sel preview, urut sesuai columns */
  previewCells: (row: R) => string[]
  /**
   * Jalankan impor untuk baris berstatus 'siap'. WAJIB insert per-chunk
   * lewat ctx.chunk dan melaporkan ctx.onProgress.
   */
  onSubmit: (ready: R[], ctx: ImportRunContext) => Promise<ImportResult>
  /** Dipanggil setelah impor sukses — tempat invalidate react-query */
  onFinished?: (result: ImportResult) => void
}

const DEFAULT_MAX_FILE_MB = 2
const DEFAULT_MAX_ROWS = 500

/** Pecah array jadi chunk berukuran size (dipakai insert batch). */
export function chunkArray<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/**
 * Wizard impor Excel/CSV seragam: unggah + template → preview & validasi →
 * progres & hasil. Semua modal impor aplikasi WAJIB memakai ini —
 * parser/validasi domain tinggal di-plug lewat props.
 */
export function ImportWizard<R>({
  open,
  onClose,
  title,
  subtitle,
  entityLabel,
  columns,
  formatHint,
  template,
  accept = '.xlsx,.xls,.csv',
  maxFileMb = DEFAULT_MAX_FILE_MB,
  maxRows = DEFAULT_MAX_ROWS,
  readRows = readSheet,
  parse,
  getRowStatus,
  getRowMessage,
  previewCells,
  onSubmit,
  onFinished,
}: ImportWizardProps<R>) {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const [step, setStep] = useState(0)
  const [fileName, setFileName] = useState<string | null>(null)
  const [rows, setRows] = useState<R[]>([])
  const [previews, setPreviews] = useState<ImportPreviewRow[]>([])
  const [statusFilter, setStatusFilter] = useState<ImportRowStatus | 'all'>('all')
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [result, setResult] = useState<ImportResult | null>(null)

  const reset = () => {
    setStep(0)
    setFileName(null)
    setRows([])
    setPreviews([])
    setStatusFilter('all')
    setRunning(false)
    setProgress({ done: 0, total: 0 })
    setResult(null)
  }
  const resetAndClose = () => {
    reset()
    onClose()
  }

  const counts = useMemo(() => {
    const by = (s: ImportRowStatus) => previews.filter((p) => p.status === s).length
    return { all: previews.length, siap: by('siap'), error: by('error'), duplikat: by('duplikat') }
  }, [previews])

  const filteredPreviews = useMemo(
    () => (statusFilter === 'all' ? previews : previews.filter((p) => p.status === statusFilter)),
    [previews, statusFilter],
  )

  const readyRows = useMemo(() => {
    if (previews.length !== rows.length) return []
    return rows.filter((_, i) => previews[i].status === 'siap')
  }, [rows, previews])

  const downloadTemplateCsv = () => {
    if (!template) return
    downloadCsvRows(`${template.filename}.csv`, template.headers, template.exampleRows)
  }

  const downloadTemplateXlsx = async () => {
    if (!template) return
    await downloadXlsx(template.filename, 'Template', template.headers, template.exampleRows)
  }

  const handleFile = async (file: File) => {
    if (file.size > maxFileMb * 1024 * 1024) {
      message.error(`Ukuran file maksimal ${maxFileMb} MB`)
      return
    }
    try {
      const table = await readRows(file)
      const parsed = await parse(table, { maxRows })
      const nextPreviews = parsed.map((row, i) => ({
        row: i + 1,
        status: getRowStatus(row),
        message: getRowMessage?.(row),
        cells: previewCells(row),
      }))
      setFileName(file.name)
      setRows(parsed)
      setPreviews(nextPreviews)
      setStatusFilter('all')
      setResult(null)
      setProgress({ done: 0, total: 0 })
      setStep(1)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Gagal membaca file')
    }
  }

  const handleImport = async () => {
    setRunning(true)
    setStep(2)
    try {
      const res = await onSubmit(readyRows, {
        chunk: chunkArray,
        onProgress: (done, total) => setProgress({ done, total }),
      })
      setResult(res)
      onFinished?.(res)
    } catch (err) {
      message.error(err instanceof Error ? err.message : `Gagal mengimpor ${entityLabel.toLowerCase()}`)
      setRunning(false)
      setStep(1)
    }
  }

  const previewColumns: TableColumnsType<ImportPreviewRow> = [
    { title: 'Baris', dataIndex: 'row', key: 'row', width: 64 },
    ...columns.map((c, i) => ({
      title: c.header,
      key: c.key,
      width: c.width,
      render: (_: unknown, row: ImportPreviewRow) => row.cells[i] || '-',
    })),
    {
      title: 'Pesan',
      dataIndex: 'message',
      key: 'message',
      render: (v: string | undefined, row: ImportPreviewRow) =>
        v ? (
          <Typography.Text type={row.status === 'siap' ? 'warning' : 'danger'} style={{ fontSize: 12.5 }}>
            {v}
          </Typography.Text>
        ) : (
          '-'
        ),
    },
  ]

  return (
    <AppModal
      title={title}
      subtitle={subtitle}
      icon={<ImportOutlined />}
      open={open}
      onCancel={resetAndClose}
      onOk={step === 1 ? () => void handleImport() : resetAndClose}
      okText={step === 1 ? `Impor ${counts.siap} ${entityLabel}` : 'Selesai'}
      okButtonProps={step === 1 ? { disabled: counts.siap === 0, loading: running } : undefined}
      confirmLoading={running}
      width={step === 1 ? MODAL_SIZE.lg : MODAL_SIZE.md}
      destroyOnHidden
      maskClosable={false}
    >
      <WizardSteps
        current={step}
        items={[
          { title: 'Upload', description: 'Pilih file' },
          { title: 'Review', description: 'Validasi' },
          { title: 'Hasil', description: 'Selesai' },
        ]}
      />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          variants={swapVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={swapTransition}
          style={{ marginTop: 8 }}
        >
          {step === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <UploadDropzone
              accept={accept}
              maxCount={1}
              icon={<FileAddOutlined />}
              title="Klik atau seret file ke sini"
              hint={`Excel/CSV · Maksimal ${maxFileMb} MB · ${maxRows} baris pertama yang diproses`}
              beforeUpload={(file) => {
                void handleFile(file)
                return false
              }}
            />
            {template && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  background: token.colorFillQuaternary,
                  borderRadius: 10,
                  flexWrap: 'wrap',
                }}
              >
                <IconBox icon={<FileExcelOutlined />} size={36} />
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Template Impor {entityLabel}</div>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Isi sesuai format, lalu unggah kembali
                  </Typography.Text>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button size="small" icon={<DownloadOutlined />} onClick={() => void downloadTemplateXlsx()}>
                    Excel
                  </Button>
                  <Button size="small" onClick={downloadTemplateCsv}>
                    CSV
                  </Button>
                </div>
              </div>
            )}
            {formatHint && (
              <Collapse
                ghost
                size="small"
                items={[
                  {
                    key: 'tips',
                    label: 'Contoh struktur kolom & tips pengisian',
                    children: <div style={{ fontSize: 13 }}>{formatHint}</div>,
                  },
                ]}
              />
            )}
          </div>
        )}

      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Typography.Text>
              <b>{fileName}</b> · {counts.all} baris
            </Typography.Text>
            <Radio.Group
              size="small"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ImportRowStatus | 'all')}
              optionType="button"
              buttonStyle="solid"
              options={[
                { value: 'all', label: `Semua (${counts.all})` },
                { value: 'siap', label: `Siap (${counts.siap})` },
                { value: 'duplikat', label: `Duplikat (${counts.duplikat})` },
                { value: 'error', label: `Error (${counts.error})` },
              ]}
            />
          </div>

          {counts.duplikat > 0 && (
            <ModalNotice tone="warning" title={`${counts.duplikat} baris duplikat dilewati otomatis saat impor`} />
          )}

          <Table
            rowKey="row"
            size="small"
            columns={previewColumns}
            dataSource={filteredPreviews}
            pagination={{ pageSize: 8, showSizeChanger: false, hideOnSinglePage: true }}
            scroll={{ y: 320 }}
          />
        </div>
      )}

      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', padding: '12px 0' }}>
          {!result ? (
            <>
              <Progress
                percent={progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0}
                style={{ alignSelf: 'stretch' }}
              />
              <Typography.Text type="secondary">
                Mengimpor {progress.done}/{progress.total} baris…
              </Typography.Text>
            </>
          ) : (
            <>
              <CheckCircleOutlined style={{ fontSize: 48, color: '#10b981' }} />
              <Typography.Text strong style={{ fontSize: 16 }}>
                {result.inserted} {entityLabel.toLowerCase()} berhasil diimpor
                {result.skipped ? `, ${result.skipped} dilewati` : ''}
              </Typography.Text>
              {(result.failed?.length ?? 0) > 0 && (
                <div style={{ alignSelf: 'stretch' }}>
                  <ModalNotice tone="error" title={`${result.failed!.length} baris gagal`}>
                    {result.failed!.map((f) => `${f.label}: ${f.error}`).join('; ')}
                  </ModalNotice>
                </div>
              )}
            </>
          )}
        </div>
      )}
        </motion.div>
      </AnimatePresence>
    </AppModal>
  )
}
