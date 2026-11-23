import { useEffect, useMemo, useState } from 'react'
import {
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Input,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  type TableColumnsType,
} from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import dayjs, { type Dayjs } from 'dayjs'
import { useAuditLogs, useProfiles } from './hooks'
import { fetchAuditLogsForExport, TABLE_LABELS } from './api'
import { logAudit } from '../../shared/utils/auditLogger'
import { downloadCsv } from '../../shared/utils/csv'
import { useDebounce } from '../../shared/hooks/useDebounce'
import type { AuditLog } from './types'

const SOURCE_OPTIONS = [
  { value: 'SYSTEM', label: 'Sistem' },
  { value: 'MASTER', label: 'Master Data' },
  { value: 'OPERATIONAL', label: 'Operasional' },
  { value: 'SECURITY', label: 'Keamanan' },
  { value: 'AUTH', label: 'Autentikasi' },
]

const ACTION_OPTIONS = [
  { value: 'INSERT', label: 'Tambah' },
  { value: 'UPDATE', label: 'Ubah' },
  { value: 'DELETE', label: 'Hapus' },
  { value: 'SYNC', label: 'Sinkron' },
  { value: 'EXPORT', label: 'Ekspor' },
]

const ACTION_COLOR: Record<string, string> = {
  INSERT: 'green',
  UPDATE: 'blue',
  DELETE: 'red',
  SYNC: 'purple',
  EXPORT: 'orange',
  LOGIN: 'geekblue',
  LOGOUT: 'default',
  EXECUTE: 'geekblue',
  BROADCAST: 'cyan',
}

/** Preset rentang tanggal cepat di atas RangePicker. */
const DATE_PRESETS: { label: string; days: number }[] = [
  { label: 'Hari ini', days: 1 },
  { label: '7 hari', days: 7 },
  { label: '30 hari', days: 30 },
]

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ------------------------------------------------------------
// Diff JSON terstruktur: perbandingan old vs new per key — pengganti
// dua <pre> mentah. Nilai sensitif (password/pin/token) sudah dimasking
// auditLogger sebelum ditulis, jadi tidak perlu masking di sini.
// ------------------------------------------------------------

interface DiffRow {
  key: string
  oldV: unknown
  newV: unknown
  status: 'changed' | 'added' | 'removed'
}

function buildDiffRows(
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null,
): DiffRow[] {
  const keys = [...new Set([...Object.keys(oldData ?? {}), ...Object.keys(newData ?? {})])]
  const rows: DiffRow[] = []
  for (const key of keys) {
    const inOld = oldData != null && key in oldData
    const inNew = newData != null && key in newData
    if (!inOld) {
      rows.push({ key, oldV: undefined, newV: newData?.[key], status: 'added' })
    } else if (!inNew) {
      rows.push({ key, oldV: oldData?.[key], newV: undefined, status: 'removed' })
    } else if (JSON.stringify(oldData?.[key]) !== JSON.stringify(newData?.[key])) {
      rows.push({ key, oldV: oldData?.[key], newV: newData?.[key], status: 'changed' })
    }
  }
  return rows
}

const fmtDiffValue = (v: unknown) =>
  v === undefined ? '(tidak ada)' : typeof v === 'string' ? v : JSON.stringify(v)

function JsonDiff({ oldData, newData }: { oldData: Record<string, unknown> | null; newData: Record<string, unknown> | null }) {
  const rows = useMemo(() => buildDiffRows(oldData, newData), [oldData, newData])
  if (rows.length === 0) {
    return (
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        Tidak ada perbedaan antar snapshot.
      </Typography.Text>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {rows.map((row) => (
        <div key={row.key} style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', fontSize: 12 }}>
          <Typography.Text strong style={{ fontSize: 11.5, minWidth: 120 }}>
            {row.key}
          </Typography.Text>
          {row.status === 'removed' ? (
            <span style={{ background: '#fff1f0', padding: '1px 6px', borderRadius: 6, textDecoration: 'line-through' }}>
              {fmtDiffValue(row.oldV)}
            </span>
          ) : (
            row.status !== 'added' && (
              <span style={{ background: '#fff1f0', padding: '1px 6px', borderRadius: 6, textDecoration: 'line-through' }}>
                {fmtDiffValue(row.oldV)}
              </span>
            )
          )}
          {row.status !== 'removed' && (
            <span style={{ background: row.status === 'added' ? '#f0fdf4' : '#f6fef6', padding: '1px 6px', borderRadius: 6 }}>
              {fmtDiffValue(row.newV)}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

/** Snapshot JSON utuh (sisi tunggal: INSERT/DELETE) — dipakai bila diff per-key tidak relevan. */
function JsonBlock({ data, tone }: { data: Record<string, unknown>; tone: 'old' | 'new' }) {
  return (
    <pre
      style={{
        background: tone === 'old' ? '#fff1f0' : '#f0fdf4',
        padding: 8,
        borderRadius: 8,
        fontSize: 11,
        overflowX: 'auto',
        whiteSpace: 'pre-wrap',
      }}
    >
      {JSON.stringify(data, null, 2)}
    </pre>
  )
}

export function AuditPage() {
  const { message } = App.useApp()
  // Filter bersumber dari URL (?tab=audit&q=&source=&…&p=2) — bertahan saat
  // refresh/ganti tab dan bisa dibagikan sebagai deep-link. Param `tab`
  // dipertahankan karena params dibangun dari yang sudah ada.
  const [searchParams, setSearchParams] = useSearchParams()
  const source = searchParams.get('source') ?? undefined
  const action = searchParams.get('action') ?? undefined
  const tableName = searchParams.get('table') ?? undefined
  const userId = searchParams.get('user') ?? undefined
  const search = searchParams.get('q') ?? ''
  const fromDate = searchParams.get('from') ?? undefined
  const toDate = searchParams.get('to') ?? undefined
  const page = Number(searchParams.get('p') ?? '1') || 1
  const pageSize = 20

  /** Tulis perubahan filter ke URL (replace) dan reset ke halaman 1. */
  const applyFilters = (updates: Record<string, string | undefined>) => {
    const sp = new URLSearchParams(searchParams)
    for (const [k, v] of Object.entries(updates)) {
      if (!v) sp.delete(k)
      else sp.set(k, v)
    }
    sp.delete('p')
    setSearchParams(sp, { replace: true })
  }
  const setPage = (p: number) => {
    const sp = new URLSearchParams(searchParams)
    if (p <= 1) sp.delete('p')
    else sp.set('p', String(p))
    setSearchParams(sp, { replace: true })
  }

  // Ketikan ditahan 300ms sebelum masuk URL — query tidak refire per keystroke
  const [searchInput, setSearchInput] = useState(search)
  const debouncedSearch = useDebounce(searchInput)
  useEffect(() => {
    setSearchInput(search) // sinkron bila URL berubah dari luar (deep-link/back)
  }, [search])
  useEffect(() => {
    if ((debouncedSearch || undefined) !== (search || undefined)) {
      applyFilters({ q: debouncedSearch || undefined })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  const profilesQuery = useProfiles()
  const profiles = useMemo(() => profilesQuery.data ?? [], [profilesQuery.data])

  const dateRange = useMemo<[Dayjs, Dayjs] | null>(() => {
    if (!fromDate || !toDate) return null
    const from = dayjs(fromDate)
    const to = dayjs(toDate)
    return from.isValid() && to.isValid() ? [from, to] : null
  }, [fromDate, toDate])

  const logsQuery = useAuditLogs({
    source,
    action,
    tableName,
    userId,
    search: search || undefined,
    from: fromDate,
    to: toDate,
    page,
    pageSize,
  })

  const columns: TableColumnsType<AuditLog> = useMemo(
    () => [
      {
        title: 'Waktu',
        dataIndex: 'created_at',
        key: 'created_at',
        width: 130,
        render: (v: string) => fmtTime(v),
      },
      {
        title: 'Aksi',
        key: 'action',
        width: 100,
        render: (_, l) => <Tag color={ACTION_COLOR[l.action] ?? 'default'}>{l.action}</Tag>,
      },
      {
        title: 'Subjek',
        key: 'subject',
        render: (_, l) => (
          <div>
            <Typography.Text style={{ fontSize: 13 }}>
              {l.table_name ? (TABLE_LABELS[l.table_name] ?? l.table_name) : '—'}
            </Typography.Text>
            {l.record_id && (
              <div>
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                  {l.record_id.slice(0, 8)}…
                </Typography.Text>
              </div>
            )}
          </div>
        ),
      },
      {
        title: 'Pelaku',
        key: 'actor',
        width: 170,
        render: (_, l) => (
          <div>
            <Typography.Text style={{ fontSize: 13 }}>{l.actor_name ?? 'Sistem'}</Typography.Text>
            {l.actor_role && (
              <div>
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                  {l.actor_role}
                </Typography.Text>
              </div>
            )}
          </div>
        ),
      },
      { title: 'Sumber', dataIndex: 'source', key: 'source', width: 110, render: (v: string) => <Tag>{v}</Tag> },
    ],
    [],
  )

  const expandedRowRender = (l: AuditLog) => {
    const isPairUpdate = l.old_data != null && l.new_data != null
    return (
      <div style={{ padding: 8 }}>
        <Typography.Text strong style={{ fontSize: 12 }}>
          Detail Forensik
        </Typography.Text>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', margin: '6px 0 10px' }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            IP: {l.ip_address ?? '—'}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            URL: {l.url ?? '—'}
          </Typography.Text>
        </div>
        {l.user_agent && (
          <div style={{ marginBottom: 10 }}>
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              User Agent
            </Typography.Text>
            <Typography.Paragraph style={{ fontSize: 11.5, marginBottom: 0, maxWidth: 640 }}>
              {l.user_agent}
            </Typography.Paragraph>
          </div>
        )}
        {isPairUpdate ? (
          <>
            <Typography.Text strong style={{ fontSize: 12 }}>
              Perubahan Data
            </Typography.Text>
            <div style={{ marginTop: 6 }}>
              <JsonDiff oldData={l.old_data} newData={l.new_data} />
            </div>
          </>
        ) : (
          <>
            {l.old_data && (
              <>
                <Typography.Text strong style={{ fontSize: 12 }}>
                  Data Lama
                </Typography.Text>
                <JsonBlock data={l.old_data} tone="old" />
              </>
            )}
            {l.new_data && (
              <>
                <Typography.Text strong style={{ fontSize: 12 }}>
                  Data Baru
                </Typography.Text>
                <JsonBlock data={l.new_data} tone="new" />
              </>
            )}
          </>
        )}
        {!l.old_data && !l.new_data && (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Tidak ada snapshot data untuk entri ini.
          </Typography.Text>
        )}
      </div>
    )
  }

  const total = logsQuery.data?.total ?? 0
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const rows = await fetchAuditLogsForExport({
        source,
        action,
        tableName,
        userId,
        search: search || undefined,
        from: fromDate,
        to: toDate,
      })
      downloadCsv(
        `audit-log-${dayjs().format('YYYY-MM-DD')}.csv`,
        ['Waktu', 'Aksi', 'Sumber', 'Tabel', 'Record ID', 'Pelaku', 'Role', 'IP', 'URL'],
        rows.map((l) => [
          fmtTime(l.created_at),
          l.action,
          l.source,
          l.table_name ? (TABLE_LABELS[l.table_name] ?? l.table_name) : '',
          l.record_id,
          l.actor_name,
          l.actor_role,
          l.ip_address,
          l.url,
        ]),
      )
      void logAudit({
        action: 'EXPORT',
        source: 'SECURITY',
        tableName: 'audit_logs',
        newData: { rows: rows.length, format: 'csv' },
      })
      message.success(`${rows.length} entri diekspor ke CSV`)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Gagal mengekspor audit log')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      <Card>
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12} lg={6}>
            <Input
              placeholder="Cari pelaku / tabel / aksi"
              allowClear
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </Col>
          <Col xs={12} sm={6} lg={4}>
            <Select
              placeholder="Sumber"
              allowClear
              style={{ width: '100%' }}
              value={source}
              onChange={(v) => applyFilters({ source: v ?? undefined })}
              options={SOURCE_OPTIONS}
            />
          </Col>
          <Col xs={12} sm={6} lg={4}>
            <Select
              placeholder="Aksi"
              allowClear
              style={{ width: '100%' }}
              value={action}
              onChange={(v) => applyFilters({ action: v ?? undefined })}
              options={ACTION_OPTIONS}
            />
          </Col>
          <Col xs={12} sm={6} lg={4}>
            <Select
              placeholder="Tabel"
              allowClear
              showSearch
              optionFilterProp="label"
              style={{ width: '100%' }}
              value={tableName}
              onChange={(v) => applyFilters({ table: v ?? undefined })}
              options={Object.entries(TABLE_LABELS).map(([value, label]) => ({ value, label }))}
            />
          </Col>
          <Col xs={12} sm={6} lg={6}>
            <Select
              placeholder="Pengguna (pelaku)"
              allowClear
              showSearch
              optionFilterProp="label"
              style={{ width: '100%' }}
              value={userId}
              onChange={(v) => applyFilters({ user: v ?? undefined })}
              loading={profilesQuery.isLoading}
              options={profiles.map((p) => ({ value: p.id, label: `${p.name} (${p.email})` }))}
            />
          </Col>
          <Col xs={24} sm={12} lg={12}>
            <Space wrap style={{ width: '100%' }}>
              {DATE_PRESETS.map((preset) => (
                <Button
                  key={preset.label}
                  size="small"
                  onClick={() =>
                    applyFilters({
                      from: dayjs().subtract(preset.days - 1, 'day').format('YYYY-MM-DD'),
                      to: dayjs().format('YYYY-MM-DD'),
                    })
                  }
                >
                  {preset.label}
                </Button>
              ))}
              <DatePicker.RangePicker
                style={{ flex: 1, minWidth: 220 }}
                value={dateRange}
                onChange={(v) =>
                  applyFilters({
                    from: v?.[0]?.format('YYYY-MM-DD'),
                    to: v?.[1]?.format('YYYY-MM-DD'),
                  })
                }
              />
            </Space>
          </Col>
        </Row>

        <Space direction="vertical" size="middle" style={{ width: '100%', marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
              Total {total} entri
            </Typography.Text>
            <Button
              size="small"
              icon={<DownloadOutlined />}
              loading={exporting}
              disabled={total === 0}
              onClick={() => void handleExport()}
            >
              Ekspor CSV
            </Button>
          </div>
          <Table<AuditLog>
            rowKey="id"
            columns={columns}
            dataSource={logsQuery.data?.data ?? []}
            loading={logsQuery.isLoading}
            locale={{
              emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada aktivitas tercatat" />,
            }}
            expandable={{
              expandedRowRender,
              rowExpandable: () => true,
            }}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: false,
              onChange: setPage,
            }}
            scroll={{ x: true }}
          />
        </Space>
      </Card>
    </div>
  )
}
