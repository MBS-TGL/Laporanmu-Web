import { useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  type TableColumnsType,
} from 'antd'
import { SaveOutlined, UserOutlined } from '@ant-design/icons'
import { PageHeader } from '../../shared/components/PageHeader'
import { StatusTag } from '../../shared/components/StatusTag'
import { useProfile } from '../../shared/hooks/useProfile'
import { logAudit } from '../../shared/utils/auditLogger'
import { useProfiles, useUpdateProfile } from './hooks'
import type { AdminProfile } from './types'

const ROLES = [
  { value: 'developer', label: 'Developer', color: 'purple' },
  { value: 'admin', label: 'Admin', color: 'geekblue' },
  { value: 'pengurus', label: 'Pengurus', color: 'cyan' },
  { value: 'guru', label: 'Guru', color: 'green' },
  { value: 'pending', label: 'Pending', color: 'default' },
]

export function UsersPage() {
  const { message } = App.useApp()
  const { profile: myProfile } = useProfile()
  const profilesQuery = useProfiles()
  const updateMutation = useUpdateProfile()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string | undefined>()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState<string>()

  const profiles = useMemo(() => profilesQuery.data ?? [], [profilesQuery.data])
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return profiles.filter((p) => {
      if (roleFilter && p.role !== roleFilter) return false
      if (!term) return true
      return [p.name, p.email].some((v) => v.toLowerCase().includes(term))
    })
  }, [profiles, search, roleFilter])

  const canManage = myProfile?.role === 'developer' || myProfile?.role === 'admin'

  const handleSave = (record: AdminProfile) => {
    const updates: { name?: string; role?: string } = {}
    if (editName !== record.name) updates.name = editName
    if (editRole !== undefined && editRole !== record.role) updates.role = editRole
    if (Object.keys(updates).length === 0) {
      setEditingId(null)
      return
    }
    updateMutation.mutate(
      { id: record.id, updates },
      {
        onSuccess: () => {
          message.success('Pengguna diperbarui')
          setEditingId(null)
          void logAudit({
            action: 'UPDATE',
            source: 'SECURITY',
            tableName: 'profiles',
            recordId: record.id,
            oldData: { name: record.name, role: record.role },
            newData: updates,
          })
        },
        onError: (err: Error) => message.error(err.message || 'Gagal memperbarui pengguna'),
      },
    )
  }

  const columns: TableColumnsType<AdminProfile> = [
    {
      title: 'Pengguna',
      key: 'name',
      render: (_, p) => {
        const isEditing = editingId === p.id
        return isEditing ? (
          <Input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={80} />
        ) : (
          <div>
            <div style={{ fontWeight: 600 }}>{p.name}</div>
            <span style={{ fontSize: 12, color: '#888' }}>{p.email}</span>
          </div>
        )
      },
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      width: 180,
      render: (_, p) => {
        const isEditing = editingId === p.id
        const meta = ROLES.find((r) => r.value === p.role)
        return isEditing ? (
          <Select
            style={{ width: '100%' }}
            value={editRole ?? p.role}
            onChange={setEditRole}
            options={ROLES.map((r) => ({ value: r.value, label: r.label }))}
          />
        ) : (
          <StatusTag color={meta?.color ?? 'default'}>{meta?.label ?? p.role}</StatusTag>
        )
      },
    },
    {
      title: 'Terdaftar',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 130,
      responsive: ['lg'],
      render: (v: string | undefined) =>
        v ? new Date(v).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 150,
      render: (_, p) => {
        const isEditing = editingId === p.id
        const isSelf = p.id === myProfile?.id
        if (!canManage) return <span style={{ color: '#bbb' }}>—</span>
        return isEditing ? (
          <Space size="small">
            <Button
              type="primary"
              size="small"
              icon={<SaveOutlined />}
              loading={updateMutation.isPending}
              onClick={() => handleSave(p)}
            />
            <Button size="small" onClick={() => setEditingId(null)}>
              Batal
            </Button>
          </Space>
        ) : (
          <Space size="small">
            {isSelf && <Tag color="gold">Anda</Tag>}
            <Button
              size="small"
              onClick={() => {
                setEditingId(p.id)
                setEditName(p.name)
                setEditRole(undefined)
              }}
            >
              Edit
            </Button>
          </Space>
        )
      },
    },
  ]

  const stats = useMemo(
    () => ({
      total: profiles.length,
      staff: profiles.filter((p) => ['developer', 'admin', 'pengurus', 'guru'].includes(p.role)).length,
      pending: profiles.filter((p) => p.role === 'pending').length,
    }),
    [profiles],
  )

  return (
    <div>
      <PageHeader
        title="Manajemen Pengguna"
        subtitle="Kelola nama dan role akun staff"
      />

      {!canManage && (
        <Alert
          type="warning"
          showIcon
          message="Hanya Developer & Admin yang dapat mengubah pengguna."
          style={{ marginBottom: 16 }}
        />
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8} xl={6}>
          <Card><Statistic title="Total Akun" value={stats.total} loading={profilesQuery.isLoading} /></Card>
        </Col>
        <Col xs={12} sm={8} xl={6}>
          <Card><Statistic title="Staff Aktif" value={stats.staff} /></Card>
        </Col>
        <Col xs={12} sm={8} xl={6}>
          <Card>
            <Statistic
              title="Menunggu Promosi"
              value={stats.pending}
              valueStyle={{ color: stats.pending > 0 ? '#d97706' : undefined }}
              suffix={stats.pending > 0 ? <UserOutlined style={{ fontSize: 16 }} /> : undefined}
            />
          </Card>
        </Col>
      </Row>

      {canManage && stats.pending > 0 && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={`${stats.pending} akun ber-role pending menunggu promosi — ubah role-nya langsung di tabel.`}
        />
      )}

      <Card style={{ marginBottom: 16 }}>
        <Space wrap size="middle">
          <Input
            placeholder="Cari nama / email"
            allowClear
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 260 }}
          />
          <Select
            placeholder="Semua Role"
            allowClear
            style={{ minWidth: 150 }}
            value={roleFilter}
            onChange={setRoleFilter}
            options={ROLES.map((r) => ({ value: r.value, label: r.label }))}
          />
        </Space>
      </Card>

      <Card>
        {editingId && editingId === myProfile?.id && (
          <Alert
            type="warning"
            showIcon
            message="Kamu sedang mengedit akun milikmu sendiri — berhati-hatilah mengubah role."
            style={{ marginBottom: 12 }}
          />
        )}
        <Table<AdminProfile>
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          loading={profilesQuery.isLoading}
          locale={{
            emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Tidak ada pengguna" />,
          }}
          pagination={{ pageSize: 15, showSizeChanger: false }}
        />
      </Card>
    </div>
  )
}
