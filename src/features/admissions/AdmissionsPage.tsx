import { useMemo, useState } from 'react'
import { Alert, Button, Card, Input, Segmented, Space, Table, Tabs, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  InboxOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { PageHeader } from '../../shared/components/PageHeader'
import { StatChip } from '../../shared/components/StatChip'
import { usePermissions } from '../../shared/hooks/useProfile'
import { useTablePagination } from '../../shared/hooks/useTablePagination'
import { useUrlTab } from '../../shared/hooks/useUrlTab'
import { AdmissionDrawer } from './components/AdmissionDrawer'
import { ConvertModal } from './components/ConvertModal'
import { useAdmissions } from './hooks'
import { STAGE_META, stageMeta, type Admission, type AdmissionStage } from './types'

const TAB_KEYS = ['inbox', 'archive'] as const
type TabKey = (typeof TAB_KEYS)[number]

const STAGE_FILTERS: { value: 'all' | AdmissionStage; label: string }[] = [
  { value: 'all', label: 'Semua' },
  ...(Object.keys(STAGE_META) as AdmissionStage[]).map((key) => ({
    value: key,
    label: STAGE_META[key].label,
  })),
]

export function AdmissionsPage() {
  const { tab, setTab } = useUrlTab('inbox', { keys: TAB_KEYS })
  const activeTab = (tab as TabKey) ?? 'inbox'
  const archived = activeTab === 'archive'
  const { canWrite } = usePermissions()

  const [search, setSearch] = useState('')
  const [stage, setStage] = useState<'all' | AdmissionStage>('all')
  const [detail, setDetail] = useState<Admission | null>(null)
  const [convertTarget, setConvertTarget] = useState<Admission | null>(null)

  const listQuery = useAdmissions({
    archived,
    search: search.trim() || undefined,
    stage: stage === 'all' ? undefined : stage,
  })
  // Query terpisah untuk chip ringkasan (semua pendaftar aktif)
  const statsQuery = useAdmissions({})

  const rows = listQuery.data ?? []
  const pg = useTablePagination(rows.length, { label: 'pendaftar' })

  const counts = useMemo(() => {
    const all = statsQuery.data ?? []
    return {
      registered: all.filter((a) => a.stage === 'registered').length,
      accepted: all.filter((a) => a.stage === 'accepted').length,
      rejected: all.filter((a) => a.stage === 'rejected').length,
    }
  }, [statsQuery.data])

  const columns: ColumnsType<Admission> = [
    {
      title: 'Pendaftar',
      dataIndex: 'full_name',
      key: 'name',
      render: (_value, row) => (
        <div style={{ minWidth: 0 }}>
          <Typography.Text strong>{row.full_name}</Typography.Text>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {row.registration_number}
            </Typography.Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Asal Sekolah',
      dataIndex: 'origin_school',
      key: 'origin_school',
      render: (v: string | null) => v || '—',
    },
    {
      title: 'Target',
      dataIndex: 'target_grade',
      key: 'target_grade',
      width: 110,
      render: (v: string | null) => v || '—',
    },
    {
      title: 'Wali',
      key: 'parent',
      render: (_value, row) => (
        <div>
          <div>{row.parent_name ?? '—'}</div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {row.parent_phone ?? '—'}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: 'Tahap',
      dataIndex: 'stage',
      key: 'stage',
      width: 110,
      render: (value: AdmissionStage) => {
        const meta = stageMeta(value)
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: 'Terdaftar',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (value: string) => new Date(value).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
    },
    {
      title: '',
      key: 'action',
      width: 90,
      align: 'right',
      render: (_value, row) => (
        <Button size="small" onClick={() => setDetail(row)}>
          Detail
        </Button>
      ),
    },
  ]

  const content = (
    <>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space wrap>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Cari nama, nomor, wali, sekolah"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                pg.reset()
              }}
              style={{ width: 280, maxWidth: '100%' }}
            />
            <Segmented
              value={stage}
              options={STAGE_FILTERS}
              onChange={(value) => {
                setStage(value as 'all' | AdmissionStage)
                pg.reset()
              }}
            />
          </Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              void listQuery.refetch()
              void statsQuery.refetch()
            }}
            loading={listQuery.isFetching}
          >
            Muat Ulang
          </Button>
        </Space>
      </Card>

      {listQuery.isError ? (
        <Alert
          type="error"
          showIcon
          message="Gagal memuat data pendaftar"
          description={(listQuery.error as Error).message}
          action={
            <Button size="small" onClick={() => void listQuery.refetch()}>
              Coba lagi
            </Button>
          }
        />
      ) : (
        <Table<Admission>
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={rows}
          loading={listQuery.isLoading}
          pagination={pg.pagination}
          scroll={{ x: 820 }}
          locale={{
            emptyText: archived
              ? 'Tidak ada pendaftar diarsipkan.'
              : 'Belum ada pendaftar. Data masuk otomatis dari webhook PPDB.',
          }}
        />
      )}
    </>
  )

  return (
    <div>
      <PageHeader
        title="PPDB"
        subtitle="Pendaftar baru, seleksi, dan konversi menjadi santri"
        extra={
          <Space>
            <StatChip
              icon={<InboxOutlined />}
              label="Baru"
              value={counts.registered}
              color="sky"
              loading={statsQuery.isLoading}
            />
            <StatChip
              icon={<CheckCircleOutlined />}
              label="Diterima"
              value={counts.accepted}
              color="emerald"
              loading={statsQuery.isLoading}
            />
            <StatChip
              icon={<CloseCircleOutlined />}
              label="Ditolak"
              value={counts.rejected}
              color="rose"
              loading={statsQuery.isLoading}
            />
          </Space>
        }
      />

      <Tabs
        activeKey={activeTab}
        onChange={(key) => {
          setTab(key)
          pg.reset()
        }}
        items={[
          { key: 'inbox', label: 'Kotak Masuk', children: content },
          { key: 'archive', label: 'Arsip', children: content },
        ]}
      />

      <AdmissionDrawer
        open={Boolean(detail)}
        admission={detail}
        canWrite={canWrite}
        onClose={() => setDetail(null)}
        onConvert={(admission) => {
          setDetail(null)
          setConvertTarget(admission)
        }}
      />

      <ConvertModal
        open={Boolean(convertTarget)}
        admission={convertTarget}
        onClose={() => setConvertTarget(null)}
        onConverted={() => {
          void listQuery.refetch()
          void statsQuery.refetch()
        }}
      />
    </div>
  )
}
