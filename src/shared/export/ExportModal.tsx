import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  App,
  Button,
  Input,
  Radio,
  Segmented,
  Skeleton,
  Table,
  Typography,
  theme,
  type TableColumnsType,
} from 'antd'
import {
  CheckOutlined,
  ExportOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  HistoryOutlined,
} from '@ant-design/icons'
import { AnimatePresence, motion } from 'motion/react'
import { AppModal, type ModalSize } from '../components/AppModal'
import { ModalFooter } from '../components/ModalFooter'
import { ModalNotice } from '../components/ModalNotice'
import { ModalSection } from '../components/ModalSection'
import {
  pageShellItemTransition,
  pageShellItemVariants,
  pageShellVariants,
  swapTransition,
  swapVariants,
} from '../motion'
import { logAudit } from '../utils/auditLogger'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { downloadCsv, downloadXlsx, type ExportCell } from './download'
import { useLastExport } from './useLastExport'

export interface ExportColumn<T> {
  /** Identitas kolom untuk pemilih kolom (default: header). */
  key?: string
  header: string
  value: (row: T) => ExportCell
}

/** Cakupan data yang diekspor — contoh: hasil filter vs baris terpilih. */
export interface ExportScope<T> {
  key: string
  label: string
  description?: string
  disabled?: boolean
  /** Perkiraan jumlah baris — ditampilkan di kartu cakupan */
  count?: number
  /** Ikon kartu (default mengikuti key: filtered/selected/lainnya). */
  icon?: ReactNode
  getRows: () => Promise<T[]>
}

/** Paket kolom siap-pakai untuk pemilih kolom (mis. "Kontak & Wali"). */
export interface ExportColumnPreset {
  key: string
  label: string
  /** Kolom yang dipilih preset — cocokkan dengan ExportColumn.key ?? header. */
  columnKeys: string[]
}

export type ExportFormat = 'csv' | 'xlsx'

interface ExportModalProps<T> {
  open: boolean
  onClose: () => void
  /** Lebar modal (default 520 — sama dengan ImportWizard). */
  /** Ukuran modal (default 'md' = 520 — sama dengan ImportWizard). */
  size?: ModalSize
  title: string
  subtitle?: string
  /** Nama file dasar tanpa ekstensi & tanggal (tanggal ditambahkan otomatis). Bisa fungsi per-cakupan. */
  filename: string | ((scopeKey: string) => string)
  /** Nama sheet Excel. */
  sheetName?: string
  columns: ExportColumn<T>[]
  scopes: ExportScope<T>[]
  /** Paket kolom siap-pakai (opsional) — chip di atas grid pilih kolom. */
  presets?: ExportColumnPreset[]
  defaultScopeKey?: string
  /** Tabel utama untuk logAudit — bila diisi, ekspor tercatat di audit log & info ekspor terakhir aktif. */
  auditTable?: string
  /** Sumber audit (default 'MASTER'). */
  auditSource?: 'SYSTEM' | 'OPERATIONAL' | 'MASTER' | 'SECURITY' | 'AUTH'
  /** Kontrol tambahan di atas kartu cakupan — mis. pemilih jenis data (rekam/stok). */
  extra?: ReactNode
  /** Escape hatch: ganti unduhan default (mis. workbook multi-sheet). Audit dilakukan pemanggil. */
  onExport?: (args: { format: ExportFormat; scopeKey: string; rows: T[] }) => Promise<void>
  /** Catatan kecil tambahan di bawah pratinjau. */
  alertDescription?: string
}

const PREVIEW_ROWS = 5
const PREVIEW_COLUMNS = 4
const ILLEGAL_FILENAME = /[\\/:*?"<>|]/

function formatDateId(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatLabel(format: string | null): string {
  if (format === 'xlsx') return 'Excel'
  if (format === 'csv') return 'CSV'
  return format ?? ''
}

/**
 * Modal ekspor seragam: kartu cakupan + pratinjau data + pemilih kolom (dengan
 * preset opsional) + nama file & format, unduh, catat audit. Feature hanya
 * mendefinisikan kolom + sumber baris — lihat SKILLS.md §Skill 4.
 * Modal ekspor feature baru WAJIB memakai ini, bukan AppModal mentah.
 */
export function ExportModal<T>({
  open,
  onClose,
  size = 'md',
  title,
  subtitle,
  filename,
  sheetName = 'Data',
  columns,
  scopes,
  defaultScopeKey,
  auditTable,
  auditSource = 'MASTER',
  presets,
  extra,
  onExport,
  alertDescription,
}: ExportModalProps<T>) {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const queryClient = useQueryClient()
  const initialScope = defaultScopeKey ?? scopes[0]?.key ?? ''
  const [format, setFormat] = useState<ExportFormat>('xlsx')
  const [scopeKey, setScopeKey] = useState(initialScope)
  const [submitting, setSubmitting] = useState(false)
  const [customName, setCustomName] = useState('')

  // Sinkronkan cakupan dengan default terbaru tiap kali modal dibuka lagi
  // (pattern "adjust state saat prop berubah" — render-phase, bukan effect)
  const [prevDefaultScope, setPrevDefaultScope] = useState(initialScope)
  if (initialScope !== prevDefaultScope && scopes.some((s) => s.key === initialScope)) {
    setPrevDefaultScope(initialScope)
    setScopeKey(initialScope)
  }

  const scope = scopes.find((s) => s.key === scopeKey) ?? scopes[0]
  const activeScopeKey = scope?.key ?? ''

  // ── Kolom: identitas + pilihan (default semua) ────────────────────────────
  const allKeys = useMemo(() => columns.map((c) => c.key ?? c.header), [columns])
  const [prevAllKeys, setPrevAllKeys] = useState(allKeys)
  const [selected, setSelected] = useState<Set<string>>(() => new Set(allKeys))
  if (allKeys !== prevAllKeys) {
    setPrevAllKeys(allKeys)
    setSelected(new Set(allKeys))
  }
  const selectedCols = columns
    .map((col, i) => ({ col, key: allKeys[i] }))
    .filter((x) => selected.has(x.key))
    .map((x) => x.col)

  // ── Baris pratinjau: fetch sekali per cakupan selama modal terbuka ─────────
  const rowsQuery = useQuery({
    queryKey: ['export-modal-rows', auditTable ?? title, activeScopeKey],
    queryFn: () => scope!.getRows(),
    enabled: open && Boolean(scope),
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
  })
  const rows = rowsQuery.data
  const rowsError = rowsQuery.error instanceof Error ? rowsQuery.error.message : null

  // ── Ekspor terakhir (audit) ────────────────────────────────────────────────
  const lastExport = useLastExport(auditTable, open)

  const baseName = scope ? (typeof filename === 'function' ? filename(scope.key) : filename) : 'data'
  const defaultName = `${baseName}-${new Date().toISOString().slice(0, 10)}`
  const nameInvalid = customName.trim() !== '' && ILLEGAL_FILENAME.test(customName)
  const resolvedName = customName.trim() !== '' && !nameInvalid ? customName.trim() : defaultName

  const isPresetActive = (keys: string[]) => keys.length === selected.size && keys.every((k) => selected.has(k))

  const handleSubmit = async () => {
    if (!scope) return
    if (nameInvalid) {
      message.error('Nama file memuat karakter yang tidak diizinkan (\\ / : * ? " < > |)')
      return
    }
    const sourceRows = rows ?? []
    if (sourceRows.length === 0) return
    setSubmitting(true)
    try {
      if (onExport) {
        await onExport({ format, scopeKey: scope.key, rows: sourceRows })
      } else {
        const headers = selectedCols.map((col) => col.header)
        const cells: ExportCell[][] = sourceRows.map((row) => selectedCols.map((col) => col.value(row)))
        if (format === 'csv') downloadCsv(`${resolvedName}.csv`, headers, cells)
        else await downloadXlsx(resolvedName, sheetName, headers, cells)
        if (auditTable) {
          void logAudit({
            action: 'EXPORT',
            source: auditSource,
            tableName: auditTable,
            newData: { format, scope: scope.key, count: sourceRows.length },
          })
        }
      }
      message.success(`${sourceRows.length} baris diekspor (${format === 'csv' ? 'CSV' : 'Excel'})`)
      if (auditTable) {
        void queryClient.invalidateQueries({ queryKey: ['audit', 'last-export', auditTable] })
      }
      onClose()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Gagal mengekspor data')
    } finally {
      setSubmitting(false)
    }
  }

  const canExport =
    Boolean(scope) && (rows?.length ?? 0) > 0 && selectedCols.length > 0 && !nameInvalid && !submitting


  // ── Blok pratinjau per cakupan (loading / error / kosong / tabel) ──────────
  let previewNode: ReactNode
  if (rowsQuery.isPending) {
    previewNode = <Skeleton active title={false} paragraph={{ rows: 4 }} />
  } else if (rowsError) {
    previewNode = (
      <ModalNotice
        tone="error"
        title="Gagal memuat pratinjau"
        action={
          <Button size="small" onClick={() => void rowsQuery.refetch()}>
            Coba lagi
          </Button>
        }
      >
        {rowsError}
      </ModalNotice>
    )
  } else if ((rows?.length ?? 0) === 0) {
    previewNode = (
      <div
        style={{
          textAlign: 'center',
          padding: '20px 0',
          color: token.colorTextSecondary,
          fontSize: 13,
          background: token.colorFillQuaternary,
          borderRadius: 10,
        }}
      >
        Tidak ada data pada cakupan ini.
      </div>
    )
  } else {
    const previewCols = selectedCols.slice(0, PREVIEW_COLUMNS)
    const tableColumns: TableColumnsType<T> = previewCols.map((c) => ({
      title: c.header,
      key: c.key ?? c.header,
      ellipsis: true,
      render: (_: unknown, row: T) => {
        const cell = c.value(row)
        return cell == null ? '' : (cell as ReactNode)
      },
    }))
    previewNode = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Table<T>
          size="small"
          rowKey={(_, i) => String(i)}
          columns={tableColumns}
          dataSource={rows!.slice(0, PREVIEW_ROWS)}
          pagination={false}
          scroll={{ y: 84 }}
        />
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {rows!.length} baris · {selectedCols.length} kolom
          {selectedCols.length > PREVIEW_COLUMNS
            ? ` · pratinjau ${PREVIEW_COLUMNS} kolom pertama`
            : ''}
          {rows!.length > PREVIEW_ROWS ? ` · pratinjau ${PREVIEW_ROWS} baris pertama` : ''}
        </Typography.Text>
        {alertDescription && (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {alertDescription}
          </Typography.Text>
        )}
      </div>
    )
  }

  const showScopeCards = scopes.length > 1
  const showColumnPicker = columns.length > 1

  return (
    <AppModal
      open={open}
      onCancel={onClose}
      size={size}
      title={title}
      subtitle={subtitle ?? 'Pilih cakupan, kolom, dan format data yang diekspor'}
      icon={<ExportOutlined />}
      destroyOnHidden
      footer={
        <ModalFooter
          left={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Input
                style={{ width: 240 }}
                value={customName !== '' ? customName : defaultName}
                status={nameInvalid ? 'error' : undefined}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder={defaultName}
                allowClear
              />
              <Radio.Group
                value={format}
                onChange={(e) => setFormat(e.target.value as ExportFormat)}
                optionType="button"
                buttonStyle="solid"
                options={[
                  { value: 'xlsx', label: <span><FileExcelOutlined /> Excel</span> },
                  { value: 'csv', label: <span><FileTextOutlined /> CSV</span> },
                ]}
              />
            </div>
          }
          onCancel={onClose}
          onOk={() => void handleSubmit()}
          okText="Ekspor"
          okIcon={<ExportOutlined />}
          okLoading={submitting}
          okDisabled={!canExport}
        />
      }
    >
      <motion.div
        variants={pageShellVariants}
        initial="initial"
        animate="animate"
        style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        {extra && (
          <motion.div variants={pageShellItemVariants} transition={pageShellItemTransition}>
            {extra}
          </motion.div>
        )}

        {showScopeCards && (
          <motion.div variants={pageShellItemVariants} transition={pageShellItemTransition} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <ModalSection title="Cakupan" style={{ marginBottom: 0 }} />
            <div style={{ overflowX: 'auto' }}>
              <Segmented
                value={activeScopeKey}
                onChange={(v) => setScopeKey(String(v))}
                options={scopes.map((s) => ({ value: s.key, label: s.label, disabled: s.disabled }))}
              />
            </div>
            {scope?.description && (
              <Typography.Text type="secondary" style={{ fontSize: 12, maxWidth: 640 }}>
                {scope.description}
              </Typography.Text>
            )}
          </motion.div>
        )}

        {showColumnPicker && (
          <motion.div variants={pageShellItemVariants} transition={pageShellItemTransition} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <ModalSection
              title={`Kolom (${selectedCols.length}/${columns.length})`}
              style={{ marginBottom: 0 }}
              trailing={
                <div style={{ display: 'flex', gap: 4 }}>
                  <Button type="link" size="small" style={{ padding: 0 }} onClick={() => setSelected(new Set(allKeys))}>
                    Semua
                  </Button>
                  <Button type="link" size="small" style={{ padding: 0 }} onClick={() => setSelected(new Set())}>
                    Reset
                  </Button>
                </div>
              }
            />

            {presets && presets.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {presets.map((p) => {
                  const active = isPresetActive(p.columnKeys)
                  return (
                    <Button
                      key={p.key}
                      size="small"
                      type={active ? 'primary' : 'default'}
                      onClick={() => setSelected(new Set(p.columnKeys))}
                    >
                      {p.label}
                    </Button>
                  )
                })}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 6 }}>
              {columns.map((c, i) => {
                const key = allKeys[i]
                const active = selected.has(key)
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      setSelected((prev) => {
                        const next = new Set(prev)
                        if (next.has(key)) next.delete(key)
                        else next.add(key)
                        return next
                      })
                    }
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '5px 10px',
                      borderRadius: 8,
                      border: `1px solid ${active ? token.colorPrimary : token.colorBorderSecondary}`,
                      background: active ? token.colorPrimaryBg : token.colorBgContainer,
                      color: active ? token.colorPrimary : token.colorText,
                      fontSize: 12.5,
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s ease, background 0.15s ease',
                    }}
                  >
                    {active && <CheckOutlined style={{ fontSize: 11 }} />}
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontWeight: active ? 600 : 400,
                      }}
                    >
                      {c.header}
                    </span>
                  </button>
                )
              })}
            </div>
            {selectedCols.length === 0 && (
              <Typography.Text type="danger" style={{ fontSize: 12 }}>
                Pilih minimal satu kolom untuk melanjutkan.
              </Typography.Text>
            )}
          </motion.div>
        )}

        <motion.div variants={pageShellItemVariants} transition={pageShellItemTransition} style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          <ModalSection title="Pratinjau" style={{ marginBottom: 0 }} />
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeScopeKey}
              variants={swapVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={swapTransition}
            >
              {previewNode}
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {nameInvalid && (
          <Typography.Text type="danger" style={{ fontSize: 12 }}>
            Nama file tidak boleh memuat \ / : * ? " &lt; &gt; |
          </Typography.Text>
        )}

        {auditTable && !lastExport.isPending && !lastExport.isError && lastExport.data !== undefined && (
          <motion.div variants={pageShellItemVariants} transition={pageShellItemTransition}>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <HistoryOutlined style={{ color: token.colorTextTertiary }} />
              <span>
                {lastExport.data ? (
                  <>
                    Terakhir diekspor {formatDateId(lastExport.data.createdAt)}
                    {formatLabel(lastExport.data.format) && ` · ${formatLabel(lastExport.data.format)}`}
                    {lastExport.data.count != null && ` · ${lastExport.data.count} baris`}
                    {lastExport.data.actorName && ` · oleh ${lastExport.data.actorName}`}
                  </>
                ) : (
                  'Belum pernah diekspor dari modul ini.'
                )}
              </span>
            </Typography.Text>
          </motion.div>
        )}
      </motion.div>
    </AppModal>
  )
}
