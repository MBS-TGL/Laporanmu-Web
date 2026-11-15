import { useMemo, useState } from 'react'
import { Alert, App, Button, Checkbox, Space, Table, Tag, Tooltip, theme } from 'antd'
import { CheckOutlined, DownloadOutlined, FileExcelOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { ModalFooter } from '../../../shared/components/ModalFooter'
import { UploadDropzone } from '../../../shared/components/UploadDropzone'
import {
  downloadCsvRows,
  downloadErrorCsv,
  readSheet,
} from '../../../shared/import/readFile'
import { parsePresensiTable, type ParsedPresensiRow, type PresensiRosterEntry } from '../presensiParse'
import type { HalaqahAttendanceDays } from '../types'

const STATUS_ORDER_TEXT = ['H (Hadir)', 'S (Sakit)', 'I (Izin)', 'A (Alpa)', 'P (Pulang Awal)'].join(' · ')

interface ImportModalProps {
  open: boolean
  onClose: () => void
  year: number
  month: number
  daysInMonth: number
  roster: PresensiRosterEntry[]
  onApply: (merges: { studentId: string; days: HalaqahAttendanceDays }[], overwrite: boolean) => void
}

type ImportRowStatus = ParsedPresensiRow['status']

const STATUS_TAG: Record<ImportRowStatus, { color: string; label: string }> = {
  siap: { color: 'green', label: 'Siap' },
  tak_dikenal: { color: 'orange', label: 'Tak dikenal' },
  error: { color: 'red', label: 'Error' },
}

/** Impor presensi halaqah (grid Excel/CSV) → digabung ke draf grid, belum langsung simpan. */
export function ImportModal({
  open,
  onClose,
  year,
  month,
  daysInMonth,
  roster,
  onApply,
}: ImportModalProps) {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const [rows, setRows] = useState<ParsedPresensiRow[] | null>(null)
  const [skipped, setSkipped] = useState(0)
  const [fileName, setFileName] = useState('')
  const [parsing, setParsing] = useState(false)
  const [overwrite, setOverwrite] = useState(false)

  const reset = () => {
    setRows(null)
    setSkipped(0)
    setFileName('')
    setParsing(false)
    setOverwrite(false)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const readyRows = useMemo(() => (rows ?? []).filter((r) => r.status === 'siap'), [rows])
  const failedRows = useMemo(() => (rows ?? []).filter((r) => r.status !== 'siap'), [rows])

  const downloadTemplate = () => {
    const dayHeaders = Array.from({ length: daysInMonth }, (_, i) => String(i + 1))
    const sample = roster[0]
    downloadCsvRows(
      `template-presensi-halaqah-${month}-${year}`,
      ['Kode Registrasi', 'Nama', ...dayHeaders],
      [[sample?.registration_code ?? '', sample?.name ?? '', 'H', 'H', ...new Array(Math.max(0, daysInMonth - 2)).fill('')]],
    )
  }

  const handleFile = async (file: File) => {
    setParsing(true)
    setFileName(file.name)
    try {
      const table = await readSheet(file)
      const result = parsePresensiTable(table, { daysInMonth, roster })
      setRows(result.rows)
      setSkipped(result.skippedRows)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Gagal membaca file')
      setRows(null)
    }
    setParsing(false)
  }

  const handleApply = () => {
    // Gabung per santri — nilai hari yang sama: baris terakhir menang
    const byStudent = new Map<string, HalaqahAttendanceDays>()
    for (const r of readyRows) {
      if (!r.studentId) continue
      const base = overwrite ? {} : (byStudent.get(r.studentId) ?? {})
      byStudent.set(r.studentId, { ...base, ...r.days })
    }
    const merges = [...byStudent].map(([studentId, days]) => ({ studentId, days }))
    if (merges.length === 0) return
    onApply(merges, overwrite)
    reset()
    onClose()
  }

  const previewColumns = [
    {
      title: 'Baris',
      dataIndex: 'row',
      key: 'row',
      width: 60,
      render: (v: number) => <span style={{ color: token.colorTextTertiary }}>#{v}</span>,
    },
    {
      title: 'Identitas',
      dataIndex: 'identifier',
      key: 'identifier',
      width: 170,
      ellipsis: true,
    },
    {
      title: 'Dipetakan ke',
      dataIndex: 'studentName',
      key: 'studentName',
      width: 160,
      render: (v: string | null, r: ParsedPresensiRow) =>
        v ? (
          <span>
            {v} <Tag style={{ fontSize: 10, lineHeight: '14px', paddingInline: 4 }}>{r.matchBy}</Tag>
          </span>
        ) : (
          '-'
        ),
    },
    {
      title: 'Hari terisi',
      key: 'filled',
      width: 90,
      render: (_: unknown, r: ParsedPresensiRow) => Object.keys(r.days).length,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 170,
      render: (_: ImportRowStatus, r: ParsedPresensiRow) => (
        <Tooltip title={r.error}>
          <Tag color={STATUS_TAG[r.status].color}>{STATUS_TAG[r.status].label}</Tag>
          {r.error && <span style={{ fontSize: 11, color: token.colorTextTertiary }}>{r.error}</span>}
        </Tooltip>
      ),
    },
  ]

  return (
    <AppModal
      open={open}
      onCancel={handleClose}
      width={720}
      title="Impor Presensi"
      subtitle={`Format grid ${month}/${year}: hasil impor digabung ke draf grid, belum langsung disimpan`}
      icon={<FileExcelOutlined />}
      footer={
        <ModalFooter
          onCancel={handleClose}
          onOk={handleApply}
          okText={`Gabungkan (${readyRows.length})`}
          okIcon={<CheckOutlined />}
          okDisabled={readyRows.length === 0}
        />
      }
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          message="Format file"
          description={
            <div style={{ fontSize: 12 }}>
              Baris pertama = header. Harus ada kolom <b>Kode Registrasi</b> dan/atau <b>Nama</b>;
              kolom hari bernama angka <b>1..{daysInMonth}</b> (boleh diawali &quot;h&quot;). Nilai sel:{' '}
              {STATUS_ORDER_TEXT}.
              <div style={{ marginTop: 8 }}>
                <Button size="small" icon={<DownloadOutlined />} onClick={downloadTemplate}>
                  Unduh template CSV
                </Button>
              </div>
            </div>
          }
        />

        <UploadDropzone
          accept=".xlsx,.xls,.csv"
          beforeUpload={(file) => {
            void handleFile(file as unknown as File)
            return false
          }}
          disabled={parsing}
          title={fileName ? fileName : 'Klik atau seret file Excel/CSV ke sini'}
          hint={parsing ? 'Membaca file…' : '.xlsx, .xls, atau .csv'}
        />

        {rows && (
          <>
            <Space size={8} wrap>
              <Tag color="green">{readyRows.length} siap</Tag>
              {failedRows.length > 0 && <Tag color="orange">{failedRows.length} bermasalah</Tag>}
              {skipped > 0 && <Tag>{skipped} baris kosong dilewati</Tag>}
              {failedRows.length > 0 && (
                <Button
                  size="small"
                  onClick={() =>
                    downloadErrorCsv(
                      'impor-presensi-halaqah',
                      fileName,
                      failedRows.map((r) => ({
                        baris: r.row,
                        identitas: r.identifier,
                        detail: r.error ?? '',
                        alasan: r.status === 'error' ? 'Baris tidak valid' : 'Tidak cocok dengan anggota',
                      })),
                    )
                  }
                >
                  Unduh baris bermasalah (.csv)
                </Button>
              )}
            </Space>

            <Table
              rowKey="row"
              size="small"
              columns={previewColumns}
              dataSource={rows}
              pagination={{ pageSize: 8, showSizeChanger: false, showTotal: (t) => `Total ${t} baris` }}
              scroll={{ y: 320 }}
            />

            <Checkbox
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
            >
              Timpa sel yang sudah terisi di grid (nonaktif = hanya sel kosong yang diisi)
            </Checkbox>
          </>
        )}
      </Space>
    </AppModal>
  )
}
