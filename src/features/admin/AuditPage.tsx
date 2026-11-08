import { useState } from 'react'
import {
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
import { PageHeader } from '../../shared/components/PageHeader'
import { useAuditLogs } from './hooks'
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
}

const TABLE_LABELS: Record<string, string> = {
  profiles: 'Akun & Profil',
  students: 'Data Siswa',
  teachers: 'Data Guru',
  classes: 'Data Kelas',
  dorms: 'Asrama',
  academic_years: 'Tahun Akademik',
  reports: 'Poin Santri',
  point_rules: 'Aturan Poin',
  gate_logs: 'Log Gerbang',
  student_attendance: 'Absensi',
  student_monthly_reports: 'Rapor Bulanan',
  student_semester_reports: 'Rapor Semester',
  health_logs: 'Kesehatan',
  health_medicines: 'Stok Obat',
  counseling_logs: 'BK',
  leave_permits: 'Izin Pulang',
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function AuditPage() {
  const [source, setSource] = useState<string | undefined>()
  const [action, setAction] = useState<string | undefined>()
  const [tableName, setTableName] = useState<string | undefined>()
  const [search, setSearch] = useState('')
  const [dateRange, setDateRange] = useState<[import('dayjs').Dayjs, import('dayjs').Dayjs] | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)

  const logsQuery = useAuditLogs({
    source,
    action,
    tableName,
    search: search || undefined,
    from: dateRange?.[0]?.format('YYYY-MM-DD'),
    to: dateRange?.[1]?.format('YYYY-MM-DD'),
    page,
    pageSize,
  })

  const columns: TableColumnsType<AuditLog> = [
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
  ]

  const expandedRowRender = (l: AuditLog) => (
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
      {l.old_data && (
        <>
          <Typography.Text strong style={{ fontSize: 12 }}>
            Data Lama
          </Typography.Text>
          <pre
            style={{
              background: '#fff1f0',
              padding: 8,
              borderRadius: 8,
              fontSize: 11,
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
            }}
          >
            {JSON.stringify(l.old_data, null, 2)}
          </pre>
        </>
      )}
      {l.new_data && (
        <>
          <Typography.Text strong style={{ fontSize: 12 }}>
            Data Baru
          </Typography.Text>
          <pre
            style={{
              background: '#f0fdf4',
              padding: 8,
              borderRadius: 8,
              fontSize: 11,
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
            }}
          >
            {JSON.stringify(l.new_data, null, 2)}
          </pre>
        </>
      )}
      {!l.old_data && !l.new_data && (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Tidak ada snapshot data untuk entri ini.
        </Typography.Text>
      )}
    </div>
  )

  const total = logsQuery.data?.total ?? 0

  return (
    <div>
      <PageHeader title="Audit Log" subtitle="Jejak seluruh perubahan data oleh pengguna" />

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12} lg={6}>
            <Input
              placeholder="Cari pelaku / tabel / aksi"
              allowClear
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
          </Col>
          <Col xs={12} sm={6} lg={4}>
            <Select
              placeholder="Sumber"
              allowClear
              style={{ width: '100%' }}
              value={source}
              onChange={(v) => {
                setSource(v)
                setPage(1)
              }}
              options={SOURCE_OPTIONS}
            />
          </Col>
          <Col xs={12} sm={6} lg={4}>
            <Select
              placeholder="Aksi"
              allowClear
              style={{ width: '100%' }}
              value={action}
              onChange={(v) => {
                setAction(v)
                setPage(1)
              }}
              options={ACTION_OPTIONS}
            />
          </Col>
          <Col xs={12} sm={6} lg={4}>
            <Select
              placeholder="Tabel"
              allowClear
              showSearch
              style={{ width: '100%' }}
              value={tableName}
              onChange={(v) => {
                setTableName(v)
                setPage(1)
              }}
              options={Object.entries(TABLE_LABELS).map(([value, label]) => ({ value, label }))}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <DatePicker.RangePicker
              style={{ width: '100%' }}
              value={dateRange}
              onChange={(v) => {
                setDateRange(v as [import('dayjs').Dayjs, import('dayjs').Dayjs] | null)
                setPage(1)
              }}
            />
          </Col>
        </Row>
      </Card>

      <Card>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
            Total {total} entri
          </Typography.Text>
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

