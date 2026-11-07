import { useMemo, useState, type Key, type ReactNode } from 'react'
import { Button, Card, Input, Popconfirm, Select, Space, Table, Tag, Typography, type TableColumnsType } from 'antd'
import { CheckCircleOutlined, ClearOutlined, QuestionCircleOutlined, SearchOutlined, SwapOutlined, TeamOutlined, UserDeleteOutlined } from '@ant-design/icons'
import { StatChip } from '../../../shared/components/StatChip'
import { usePermissions } from '../../../shared/hooks/useProfile'
import { useClassesBrief, usePlacementCounts, usePlacements } from '../hooks'
import type { Placement } from '../types'

const GENDER_LABEL: Record<string, string> = { L: 'Laki-laki', P: 'Perempuan' }
const GENDER_COLOR: Record<string, string> = { L: 'geekblue', P: 'magenta' }

type PlacementStatus = 'all' | 'unassigned' | 'assigned'

interface TabPlacementsProps {
  /** Buka modal penempatan untuk beberapa santri (bulk bar) */
  onAssign: (studentIds: string[]) => void
  /** Buka modal penempatan untuk satu santri (preset kamar asal) */
  onMoveOne: (studentId: string) => void
  /** Kosongkan penempatan satu/berapa santri */
  onEvict: (studentIds: string[]) => void
}

export function TabPlacements({ onAssign, onMoveOne, onEvict }: TabPlacementsProps) {
  const { canWrite } = usePermissions()
  const [search, setSearch] = useState('')
  const [gender, setGender] = useState<'L' | 'P' | undefined>()
  const [classId, setClassId] = useState<string | undefined>()
  const [status, setStatus] = useState<PlacementStatus>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [selectedKeys, setSelectedKeys] = useState<Key[]>([])

  const filters = useMemo(
    () => ({ search: search || undefined, gender, classId, placement: status, page, pageSize }),
    [search, gender, classId, status, page, pageSize],
  )

  const query = usePlacements(filters)
  const countsQuery = usePlacementCounts()
  const classesQuery = useClassesBrief()

  const counts = countsQuery.data
  const total = (counts?.assigned ?? 0) + (counts?.unassigned ?? 0)

  const statusChip = (
    key: PlacementStatus,
    label: string,
    value: number,
    color: 'indigo' | 'amber' | 'emerald',
    icon: ReactNode,
  ) => (
    <StatChip
      icon={icon}
      label={label}
      value={value}
      color={color}
      loading={countsQuery.isLoading}
      active={status === key}
      onClick={() => {
        setStatus((prev) => (prev === key ? 'all' : key))
        setPage(1)
      }}
    />
  )

  const columns: TableColumnsType<Placement> = [
    {
      title: 'Nama Santri',
      dataIndex: 'name',
      key: 'name',
      render: (_, row) => <span style={{ fontWeight: 500 }}>{row.name}</span>,
    },
    {
      title: 'Kelas',
      key: 'class',
      render: (_, row) => row.classes?.name ?? '-',
      responsive: ['md'],
    },
    {
      title: 'Gender',
      dataIndex: 'gender',
      key: 'gender',
      width: 110,
      render: (v: string | null) =>
        v ? <Tag color={GENDER_COLOR[v]}>{GENDER_LABEL[v] ?? v}</Tag> : '-',
      responsive: ['md'],
    },
    {
      title: 'Asrama',
      key: 'dorm',
      render: (_, row) =>
        row.dorms?.name ? (
          <Tag color="green">{row.dorms.name}</Tag>
        ) : (
          <Tag>Belum ditempatkan</Tag>
        ),
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 150,
      render: (_, row) =>
        canWrite ? (
          <Space size="small">
            <Button type="text" size="small" icon={<SwapOutlined />} onClick={() => onMoveOne(row.id)}>
              {row.dorm_id ? 'Pindah' : 'Tempatkan'}
            </Button>
            {row.dorm_id && (
              <Popconfirm
                title="Kosongkan penempatan santri ini?"
                onConfirm={() => {
                  onEvict([row.id])
                  setSelectedKeys((prev) => prev.filter((k) => k !== row.id))
                }}
                okText="Kosongkan"
                cancelText="Batal"
              >
                <Button type="text" size="small" danger icon={<UserDeleteOutlined />} />
              </Popconfirm>
            )}
          </Space>
        ) : (
          <span style={{ color: '#bbb' }}>—</span>
        ),
    },
  ]

  return (
    <div>
      <Space wrap style={{ marginBottom: 16 }}>
        {statusChip('all', 'Total Santri', total, 'indigo', <TeamOutlined />)}
        {statusChip('unassigned', 'Belum Ditempatkan', counts?.unassigned ?? 0, 'amber', <QuestionCircleOutlined />)}
        {statusChip('assigned', 'Sudah Ditempatkan', counts?.assigned ?? 0, 'emerald', <CheckCircleOutlined />)}
      </Space>

      <Card>
        <Space wrap style={{ marginBottom: 16 }}>
          <Input
            placeholder="Cari nama santri"
            prefix={<SearchOutlined />}
            allowClear
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            style={{ width: 220 }}
          />
          <Select
            placeholder="Kelas"
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ minWidth: 150 }}
            value={classId}
            onChange={(v) => {
              setClassId(v)
              setPage(1)
            }}
            loading={classesQuery.isLoading}
            options={(classesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
          />
          <Select
            placeholder="Gender"
            allowClear
            style={{ minWidth: 130 }}
            value={gender}
            onChange={(v) => {
              setGender(v)
              setPage(1)
            }}
            options={[
              { value: 'L', label: 'Laki-laki' },
              { value: 'P', label: 'Perempuan' },
            ]}
          />
        </Space>

        {selectedKeys.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
              padding: '8px 12px',
              marginBottom: 12,
              borderRadius: 10,
              background: 'rgba(79, 70, 229, 0.06)',
              border: '1px solid rgba(79, 70, 229, 0.2)',
            }}
          >
            <Typography.Text strong style={{ fontSize: 12.5 }}>
              {selectedKeys.length} santri dipilih
            </Typography.Text>
            {canWrite && (
              <>
                <Button
                  type="primary"
                  size="small"
                  onClick={() => onAssign(selectedKeys.map(String))}
                >
                  Tempatkan
                </Button>
                <Popconfirm
                  title={`Kosongkan penempatan ${selectedKeys.length} santri?`}
                  onConfirm={() => {
                    onEvict(selectedKeys.map(String))
                    setSelectedKeys([])
                  }}
                  okText="Kosongkan"
                  cancelText="Batal"
                >
                  <Button size="small" icon={<UserDeleteOutlined />}>
                    Kosongkan
                  </Button>
                </Popconfirm>
              </>
            )}
            <Button type="text" size="small" icon={<ClearOutlined />} onClick={() => setSelectedKeys([])}>
              Bersihkan
            </Button>
          </div>
        )}

        <Table<Placement>
          rowKey="id"
          columns={columns}
          dataSource={query.data?.data ?? []}
          loading={query.isPending}
          rowSelection={{ selectedRowKeys: selectedKeys, onChange: setSelectedKeys }}
          pagination={{
            current: page,
            pageSize,
            total: query.data?.total ?? 0,
            showSizeChanger: true,
            showTotal: (t) => `Total ${t} santri`,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
              setSelectedKeys([])
            },
          }}
          scroll={{ x: true }}
        />
      </Card>
    </div>
  )
}
