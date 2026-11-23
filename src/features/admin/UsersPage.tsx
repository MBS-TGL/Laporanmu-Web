import { useMemo, useState } from 'react'
import {
  Alert,
  App,
  Avatar,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Row,
  Select,
  Space,
  Table,
  Tag,
  theme,
  Tooltip,
  type TableColumnsType,
} from 'antd'
import {
  DisconnectOutlined,
  ExportOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  LinkOutlined,
  MailOutlined,
  ReloadOutlined,
  SyncOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { StatChip } from '../../shared/components/StatChip'
import { FilterChips } from '../../shared/components/FilterChips'
import { StatusTag } from '../../shared/components/StatusTag'
import { useTabActions } from '../../shared/components/ActionsSlot'
import { useDebounce } from '../../shared/hooks/useDebounce'
import { useProfile } from '../../shared/hooks/useProfile'
import { useTablePagination } from '../../shared/hooks/useTablePagination'
import { logAudit } from '../../shared/utils/auditLogger'
import { downloadXlsx } from '../../shared/export/download'
import {
  useLastLogins,
  useProfiles,
  useSendPasswordReset,
  useSetTeacherLink,
  useTeachersForLinking,
  useUpdateProfile,
} from './hooks'
import { UserDrawer } from './components/UserDrawer'
import { LinkModal, type LinkTarget } from './components/LinkModal'
import { UnlinkedCard } from './components/UnlinkedCard'
import { useRoleMeta, roleMetaOf } from './usersMeta'
import type { AdminProfile } from './types'
import type { TeacherLinkBrief } from './api'

type LinkFilter = '' | 'linked' | 'unlinked'

export function UsersPage({ active }: { active: boolean }) {
  const { message, modal } = App.useApp()
  const { token } = theme.useToken()
  const { profile: myProfile } = useProfile()
  const roleMetas = useRoleMeta()
  const profilesQuery = useProfiles()
  const teachersQuery = useTeachersForLinking()
  const lastLoginsQuery = useLastLogins()
  const updateMutation = useUpdateProfile()
  const linkMutation = useSetTeacherLink()
  const resetPwMutation = useSendPasswordReset()

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [roleFilter, setRoleFilter] = useState<string | undefined>()
  const [linkFilter, setLinkFilter] = useState<LinkFilter>('')
  const [isPrivacyMode, setIsPrivacyMode] = useState(false)
  const [detailProfile, setDetailProfile] = useState<AdminProfile | null>(null)
  const [linkTarget, setLinkTarget] = useState<LinkTarget | null>(null)

  // Edit inline (nama & role) — pola lama dipertahankan
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState<string>()

  const profiles = useMemo(() => profilesQuery.data ?? [], [profilesQuery.data])
  const teachers = useMemo(() => teachersQuery.data ?? [], [teachersQuery.data])
  const lastLogins = lastLoginsQuery.data
  const teacherByProfileId = useMemo(
    () => new Map(teachers.filter((t) => t.profile_id).map((t) => [t.profile_id as string, t])),
    [teachers],
  )
  const unlinkedTeachers = useMemo(() => teachers.filter((t) => !t.profile_id), [teachers])
  const linkedProfileIds = useMemo(
    () => new Set(profiles.filter((p) => teacherByProfileId.has(p.id)).map((p) => p.id)),
    [profiles, teacherByProfileId],
  )

  const linkedOf = (p: AdminProfile): TeacherLinkBrief | null => teacherByProfileId.get(p.id) ?? null
  const disp = (email: string) =>
    isPrivacyMode ? `${email.charAt(0)}***${email.slice(email.indexOf('@'))}` : email

  const filtered = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase()
    return profiles.filter((p) => {
      if (roleFilter && p.role !== roleFilter) return false
      if (linkFilter === 'linked' && !teacherByProfileId.has(p.id)) return false
      if (linkFilter === 'unlinked' && teacherByProfileId.has(p.id)) return false
      if (!term) return true
      return [p.name, p.email, teacherByProfileId.get(p.id)?.name ?? ''].some((v) =>
        v.toLowerCase().includes(term),
      )
    })
  }, [profiles, debouncedSearch, roleFilter, linkFilter, teacherByProfileId])

  const pg = useTablePagination(filtered.length, { label: 'akun', showSizeChanger: false, defaultPageSize: 15 })

  const canManage = myProfile?.role === 'developer' || myProfile?.role === 'admin'
  const hasFilters = Boolean(search || roleFilter || linkFilter)
  const resetFilters = () => {
    setSearch('')
    setRoleFilter(undefined)
    setLinkFilter('')
  }

  const stats = useMemo(
    () => ({
      total: profiles.length,
      staff: profiles.filter((p) => ['developer', 'admin', 'manager', 'teacher'].includes(p.role)).length,
      unlinked: unlinkedTeachers.length,
      pending: profiles.filter((p) => p.role === 'pending').length,
    }),
    [profiles, unlinkedTeachers],
  )

  // ── Aksi ────────────────────────────────────────────────────────────────────
  const handleSave = (record: AdminProfile) => {
    const updates: { name?: string; role?: string } = {}
    if (editName !== record.name) updates.name = editName
    if (editRole !== undefined && editRole !== record.role) updates.role = editRole
    if (Object.keys(updates).length === 0) {
      setEditingId(null)
      return
    }
    // Guard keras: role akun sendiri tidak boleh diubah — mencegah developer
    // menurunkan sendiri level aksesnya dan kehilangan akses ke tab ini.
    if (record.id === myProfile?.id && updates.role !== undefined) {
      message.error('Role akun sendiri tidak bisa diubah — minta developer/admin lain.')
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

  const openLinkModal = (target: LinkTarget) => {
    setLinkTarget(target)
  }

  const handleUnlink = (profile: AdminProfile) => {
    const teacher = linkedOf(profile)
    if (!teacher) return
    modal.confirm({
      title: `Lepas link ${teacher.name}?`,
      content: 'Akun tetap ada, hanya keterhubungan dengan data guru yang dilepas.',
      okText: 'Lepas',
      okButtonProps: { danger: true },
      cancelText: 'Batal',
      onOk: () =>
        new Promise<void>((resolve, reject) => {
          linkMutation.mutate(
            { teacherId: teacher.id, profileId: null },
            {
              onSuccess: () => {
                message.success('Link guru dilepas')
                void logAudit({
                  action: 'UPDATE',
                  source: 'SECURITY',
                  tableName: 'teachers',
                  recordId: teacher.id,
                  oldData: { profile_id: profile.id, name: teacher.name },
                  newData: { profile_id: null },
                })
                resolve()
              },
              onError: (err: Error) => {
                message.error(err.message || 'Gagal melepas link')
                reject(err)
              },
            },
          )
        }),
    })
  }

  const handleResetPassword = (profile: AdminProfile) => {
    modal.confirm({
      title: 'Kirim email pemulihan password?',
      content: `Tautan ganti password akan dikirim ke ${profile.email}.`,
      okText: 'Kirim',
      cancelText: 'Batal',
      onOk: () =>
        new Promise<void>((resolve, reject) => {
          resetPwMutation.mutate(profile.email, {
            onSuccess: () => {
              message.success(`Email pemulihan dikirim ke ${profile.email}`)
              void logAudit({
                action: 'UPDATE',
                source: 'SECURITY',
                tableName: 'profiles',
                recordId: profile.id,
                newData: { password_reset_email: true, email: profile.email },
              })
              resolve()
            },
            onError: (err: Error) => {
              message.error(err.message || 'Gagal mengirim email pemulihan')
              reject(err)
            },
          })
        }),
    })
  }

  // ── Kolom tabel ─────────────────────────────────────────────────────────────
  const columns: TableColumnsType<AdminProfile> = [
    {
      title: 'Pengguna',
      key: 'name',
      sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
      render: (_, p) => {
        const isEditing = editingId === p.id
        return isEditing ? (
          <Input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={80} />
        ) : (
          <Space size={10}>
            <Avatar style={{ background: 'rgba(79,70,229,0.1)', color: '#4f46e5', fontWeight: 700 }}>
              {(p.name || '?').charAt(0).toUpperCase()}
            </Avatar>
            <div>
              <Button type="link" style={{ padding: 0, height: 'auto', fontWeight: 600 }} onClick={() => setDetailProfile(p)}>
                {p.name}
              </Button>
              <div style={{ fontSize: 12, color: '#888' }}>
                {disp(p.email)}
                {p.created_at && (
                  <span style={{ color: '#bbb' }}>
                    {' '}· {new Date(p.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                )}
              </div>
              {!isEditing && (
                <div style={{ fontSize: 12, marginTop: 2 }}>
                  {teacherByProfileId.has(p.id) ? (
                    <span style={{ color: token.colorTextSecondary }}>
                      Guru: <span style={{ color: token.colorText }}>{teacherByProfileId.get(p.id)?.name}</span>
                    </span>
                  ) : (
                    <Tag color="orange" style={{ borderRadius: 6, fontSize: 11, lineHeight: '16px', marginInlineEnd: 0 }}>
                      Belum terhubung
                    </Tag>
                  )}
                </div>
              )}
            </div>
          </Space>
        )
      },
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      width: 150,
      sorter: (a, b) => (a.role || '').localeCompare(b.role || ''),
      render: (_, p) => {
        const isEditing = editingId === p.id
        const isSelf = p.id === myProfile?.id
        const meta = roleMetaOf(p.role, roleMetas)
        return isEditing ? (
          <Tooltip title={isSelf ? 'Role akun sendiri terkunci untuk mencegah terkunci dari sistem' : undefined}>
            <Select
              style={{ width: '100%' }}
              value={editRole ?? p.role}
              onChange={setEditRole}
              disabled={isSelf}
              options={roleMetas.map((r) => ({ value: r.value, label: r.label }))}
            />
          </Tooltip>
        ) : (
          <StatusTag color={meta.color} icon={meta.icon}>
            {meta.label}
          </StatusTag>
        )
      },
    },
    {
      title: 'Login Terakhir',
      key: 'last_login',
      width: 150,
      sorter: (a, b) => (lastLogins?.[a.id] ?? '').localeCompare(lastLogins?.[b.id] ?? ''),
      render: (_, p) => {
        const ts = lastLogins?.[p.id]
        return ts ? (
          <span style={{ fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }}>
            {dayjs(ts).format('DD MMM YYYY HH:mm')}
          </span>
        ) : (
          <span style={{ fontSize: 12.5, color: '#bbb' }}>Belum pernah</span>
        )
      },
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: canManage ? 170 : 120,
      align: 'right',
      render: (_, p) => {
        const isEditing = editingId === p.id
        const isSelf = p.id === myProfile?.id
        if (!canManage) return <span style={{ color: '#bbb' }}>—</span>
        if (isEditing) {
          return (
            <Space size="small">
              <Button
                type="primary"
                size="small"
                loading={updateMutation.isPending}
                onClick={() => handleSave(p)}
              >
                Simpan
              </Button>
              <Button size="small" onClick={() => setEditingId(null)}>
                Batal
              </Button>
            </Space>
          )
        }
        return (
          <Space size={0} wrap={false}>
            {isSelf && <Tag color="gold" style={{ marginInlineEnd: 8 }}>Anda</Tag>}
            <Tooltip title="Kirim email pemulihan password">
              <Button type="text" size="small" icon={<MailOutlined />} onClick={() => handleResetPassword(p)} />
            </Tooltip>
            {linkedOf(p) ? (
              <Tooltip title="Lepas link guru">
                <Button type="text" size="small" icon={<DisconnectOutlined />} onClick={() => handleUnlink(p)} />
              </Tooltip>
            ) : (
              <Tooltip title="Hubungkan ke data guru">
                <Button type="text" size="small" icon={<LinkOutlined />} onClick={() => openLinkModal({ profile: p, teacher: null })} />
              </Tooltip>
            )}
            <Button
              size="small"
              type="text"
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

  const activeFilterChips = [
    ...(search ? [{ key: 'search', label: `Cari: ${search}`, onClear: () => setSearch('') }] : []),
    ...(roleFilter
      ? [{ key: 'role', label: `Role: ${roleMetaOf(roleFilter, roleMetas).label}`, onClear: () => setRoleFilter(undefined) }]
      : []),
    ...(linkFilter
      ? [
          {
            key: 'link',
            label: linkFilter === 'linked' ? 'Terhubung guru' : 'Belum terhubung',
            onClear: () => setLinkFilter(''),
          },
        ]
      : []),
  ]

  const [exporting, setExporting] = useState(false)
  const handleExportAccounts = async () => {
    setExporting(true)
    try {
      await downloadXlsx(
        `daftar-pengguna-${dayjs().format('YYYY-MM-DD')}.xlsx`,
        'Pengguna',
        ['Nama', 'Email', 'Role', 'Guru Terhubung', 'Login Terakhir', 'Dibuat'],
        profiles.map((p) => [
          p.name,
          p.email,
          p.role,
          teacherByProfileId.get(p.id)?.name ?? '',
          lastLogins?.[p.id] ? dayjs(lastLogins[p.id]).format('DD MMM YYYY HH:mm') : '',
          p.created_at ? dayjs(p.created_at).format('DD MMM YYYY') : '',
        ]),
      )
      void logAudit({
        action: 'EXPORT',
        source: 'SECURITY',
        tableName: 'profiles',
        newData: { rows: profiles.length, format: 'xlsx' },
      })
      message.success(`${profiles.length} akun diekspor`)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Gagal mengekspor daftar pengguna')
    } finally {
      setExporting(false)
    }
  }

  // Aksi tab diportal ke kanan judul shell — hasil WAJIB dirender di JSX
  const actions = useTabActions(
    active,
    <>
      <Tooltip title={isPrivacyMode ? 'Tampilkan email' : 'Sembunyikan email (mode privasi)'}>
        <Button
          icon={isPrivacyMode ? <EyeInvisibleOutlined /> : <EyeOutlined />}
          aria-label={isPrivacyMode ? 'Tampilkan email' : 'Sembunyikan email (mode privasi)'}
          onClick={() => setIsPrivacyMode((v) => !v)}
        />
      </Tooltip>
      <Tooltip title="Ekspor daftar akun (XLSX)">
        <Button
          icon={<ExportOutlined />}
          aria-label="Ekspor daftar akun"
          loading={exporting}
          disabled={profiles.length === 0}
          onClick={() => void handleExportAccounts()}
        />
      </Tooltip>
      <Button
        icon={<ReloadOutlined spin={profilesQuery.isFetching || teachersQuery.isFetching} />}
        aria-label="Muat ulang pengguna & guru"
        onClick={() => { void profilesQuery.refetch(); void teachersQuery.refetch() }}
      />
    </>,
  )

  return (
    <div>
      {actions}
      {!canManage && (
        <Alert
          type="warning"
          showIcon
          message="Hanya Developer & Admin yang dapat mengubah pengguna."
          style={{ marginBottom: 16 }}
        />
      )}

      {(profilesQuery.isError || teachersQuery.isError) && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="Gagal memuat data"
          description={profilesQuery.isError ? 'Daftar akun tidak bisa diambil dari server.' : 'Data guru tidak bisa diambil dari server.'}
          action={
            <Button size="small" icon={<ReloadOutlined />} onClick={() => { void profilesQuery.refetch(); void teachersQuery.refetch() }}>
              Coba lagi
            </Button>
          }
        />
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <StatChip
          icon={<UserOutlined />}
          label="Total Akun"
          value={stats.total}
          loading={profilesQuery.isLoading}
          onClick={resetFilters}
          active={!roleFilter && !linkFilter && !search}
        />
        <StatChip icon={<TeamOutlined />} label="Staff Aktif" value={stats.staff} color="sky" loading={profilesQuery.isLoading} />
        <StatChip icon={<DisconnectOutlined />} label="Guru Belum Terhubung" value={stats.unlinked} color="amber" loading={teachersQuery.isLoading} />
        <StatChip
          icon={<SyncOutlined />}
          label="Menunggu Promosi"
          value={stats.pending}
          color="rose"
          loading={profilesQuery.isLoading}
          onClick={() => setRoleFilter(roleFilter === 'pending' ? undefined : 'pending')}
          active={roleFilter === 'pending'}
        />
      </div>

      {canManage && stats.pending > 0 && roleFilter !== 'pending' && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={`${stats.pending} akun ber-role pending menunggu promosi — ubah role-nya langsung di tabel.`}
          action={
            <Button size="small" onClick={() => setRoleFilter('pending')}>
              Lihat
            </Button>
          }
        />
      )}

      {/* ── Layout utama: tabel akun + panel antrian guru berdampingan (xl) ── */}
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <Card>
            <Space wrap size="middle" style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space wrap size="middle">
                <Input
                  placeholder="Cari nama, email, atau guru terhubung"
                  allowClear
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ width: 260, maxWidth: '100%' }}
                />
                <Select
                  placeholder="Semua Role"
                  allowClear
                  style={{ minWidth: 150 }}
                  value={roleFilter}
                  onChange={setRoleFilter}
                  options={roleMetas.map((r) => ({ value: r.value, label: r.label }))}
                />
                <Select
                  placeholder="Status Link"
                  allowClear
                  style={{ minWidth: 160 }}
                  value={linkFilter || undefined}
                  onChange={(v) => setLinkFilter((v as LinkFilter) ?? '')}
                  options={[
                    { value: 'linked', label: 'Sudah terhubung' },
                    { value: 'unlinked', label: 'Belum terhubung' },
                  ]}
                />
              </Space>
              <span style={{ fontSize: 12.5, color: 'rgba(0,0,0,0.45)' }}>{filtered.length} pengguna</span>
            </Space>
            <FilterChips chips={activeFilterChips} marginTop={12} />
            {editingId && editingId === myProfile?.id && (
              <Alert
                type="warning"
                showIcon
                message="Kamu sedang mengedit akun milikmu sendiri — berhati-hatilah mengubah role."
                style={{ marginTop: 12 }}
              />
            )}
            <Table<AdminProfile>
              style={{ marginTop: 12 }}
              rowKey="id"
              columns={columns}
              dataSource={filtered}
              loading={profilesQuery.isLoading}
              scroll={{ x: 'max-content' }}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={hasFilters ? 'Tidak ada pengguna cocok dengan filter' : 'Tidak ada pengguna'}
                  />
                ),
              }}
              pagination={pg.pagination}
            />
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <UnlinkedCard
            teachers={unlinkedTeachers}
            loading={teachersQuery.isLoading}
            isError={teachersQuery.isError}
            onRetry={() => void teachersQuery.refetch()}
            canManage={canManage}
            onLink={(t) => openLinkModal({ profile: null, teacher: t })}
          />
        </Col>
      </Row>

      {/* ── Modal hubungkan guru ↔ akun (dua arah, bisa buat akun baru) ── */}
      {linkTarget && (
        <LinkModal
          target={linkTarget}
          profiles={profiles}
          unlinkedTeachers={unlinkedTeachers}
          linkedProfileIds={linkedProfileIds}
          myRole={myProfile?.role ?? null}
          onClose={() => setLinkTarget(null)}
        />
      )}

      <UserDrawer
        profile={detailProfile}
        linkedTeacher={detailProfile ? linkedOf(detailProfile) : null}
        canManage={canManage}
        onClose={() => setDetailProfile(null)}
        onEdit={(p) => {
          setDetailProfile(null)
          setEditingId(p.id)
          setEditName(p.name)
          setEditRole(undefined)
        }}
        onLink={(p) => {
          setDetailProfile(null)
          openLinkModal({ profile: p, teacher: null })
        }}
        onUnlink={(p) => {
          setDetailProfile(null)
          handleUnlink(p)
        }}
        onResetPassword={(p) => {
          setDetailProfile(null)
          handleResetPassword(p)
        }}
      />
    </div>
  )
}
