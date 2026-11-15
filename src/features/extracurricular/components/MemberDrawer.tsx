import { useMemo, useState } from 'react'
import {
  Alert,
  App,
  Avatar,
  Button,
  Checkbox,
  Drawer,
  Empty,
  Input,
  List,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Tag,
  Typography,
  theme,
} from 'antd'
import {
  DeleteOutlined,
  PlusOutlined,
  PrinterOutlined,
  SearchOutlined,
  TrophyOutlined,
  WhatsAppOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { StudentMultiSelect } from '../../../shared/components/StudentSelect'
import {
  useAddActivityMembers,
  useActivityMembers,
  useRemoveActivityMember,
  useRemoveActivityMembers,
  useSetMemberRole,
  useStudentsByClasses,
} from '../hooks'
import type { Activity } from '../types'
import { useClassesBrief } from '../../students/hooks'
import { useStudentDetail } from '../../students/useStudentDetail'
import { useDebounce } from '../../../shared/hooks/useDebounce'
import { BroadcastModal } from '../../students/components/BroadcastModal'
import { PrintModal } from './PrintModal'
import type { Student } from '../../students/types'

const ROLE_OPTIONS = ['Anggota', 'Ketua', 'Wakil Ketua', 'Sekretaris', 'Bendahara']

interface MemberDrawerProps {
  open: boolean
  activity: Activity | null
  onClose: () => void
}

export function MemberDrawer({ open, activity, onClose }: MemberDrawerProps) {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const { open: openStudentDetail } = useStudentDetail()
  const [mode, setMode] = useState<'santri' | 'kelas'>('santri')
  const [picked, setPicked] = useState<string[]>([])
  const [classIds, setClassIds] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [printOpen, setPrintOpen] = useState(false)
  const [waOpen, setWaOpen] = useState(false)
  const debouncedSearch = useDebounce(search, 300)

  const membersQuery = useActivityMembers(open ? activity?.id : undefined)
  const addMutation = useAddActivityMembers()
  const removeMutation = useRemoveActivityMember()
  const bulkRemoveMutation = useRemoveActivityMembers()
  const roleMutation = useSetMemberRole()
  const classesQuery = useClassesBrief()
  const studentsQuery = useStudentsByClasses(mode === 'kelas' ? classIds : [])

  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data])
  const memberStudentIds = useMemo(
    () => new Set(members.map((m) => m.student_id)),
    [members],
  )

  /** Kelas-kelas yang benar-benar ada di daftar anggota (untuk filter). */
  const memberClassOptions = useMemo(
    () =>
      [...new Set(members.map((m) => m.students?.classes?.name).filter((c): c is string => !!c))].sort(),
    [members],
  )

  const filteredMembers = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return members.filter((m) => {
      if (classFilter && m.students?.classes?.name !== classFilter) return false
      if (!q) return true
      const name = m.students?.name?.toLowerCase() ?? ''
      const code = m.students?.registration_code?.toLowerCase() ?? ''
      return name.includes(q) || code.includes(q)
    })
  }, [members, classFilter, debouncedSearch])

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const visibleIds = useMemo(() => filteredMembers.map((m) => m.id), [filteredMembers])
  const visibleIdSet = useMemo(() => new Set(visibleIds), [visibleIds])
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id))
  const someVisibleSelected = visibleIds.some((id) => selectedSet.has(id))

  const toggleSelect = (memberId: string, checked: boolean) =>
    setSelectedIds((prev) => (checked ? [...prev, memberId] : prev.filter((id) => id !== memberId)))

  const toggleSelectAll = (checked: boolean) =>
    setSelectedIds((prev) =>
      checked
        ? [...new Set([...prev, ...visibleIds])]
        : prev.filter((id) => !visibleIdSet.has(id)),
    )

  const classStudents = mode === 'kelas' ? (studentsQuery.data ?? []) : []
  const newCount = classStudents.filter((s) => !memberStudentIds.has(s.id)).length
  const skippedCount = classStudents.length - newCount

  const handleAdd = () => {
    if (!activity || picked.length === 0) return
    addMutation.mutate(
      { activityId: activity.id, studentIds: picked },
      {
        onSuccess: (count) => {
          if (count === 0) {
            message.warning('Semua santri yang dipilih sudah tergabung di kegiatan ini')
          } else {
            message.success(count === 1 ? '1 santri ditambahkan' : `${count} santri ditambahkan`)
          }
          setPicked([])
        },
        onError: (err: Error) => message.error(err.message || 'Gagal menambah anggota'),
      },
    )
  }

  const handleAddClass = () => {
    if (!activity || newCount === 0) return
    addMutation.mutate(
      { activityId: activity.id, studentIds: classStudents.map((s) => s.id) },
      {
        onSuccess: (count) => {
          if (count === 0) {
            message.warning('Semua santri di kelas yang dipilih sudah tergabung di kegiatan ini')
          } else {
            message.success(count === 1 ? '1 santri ditambahkan' : `${count} santri ditambahkan`)
          }
          setClassIds([])
        },
        onError: (err: Error) => message.error(err.message || 'Gagal menambah anggota'),
      },
    )
  }

  const handleRemove = (memberId: string, name?: string) => {
    removeMutation.mutate(memberId, {
      onSuccess: () => message.success(`${name ?? 'Anggota'} dikeluarkan dari kegiatan`),
      onError: (err: Error) => message.error(err.message || 'Gagal mengeluarkan anggota'),
    })
  }

  const handleBulkRemove = () => {
    if (selectedIds.length === 0) return
    bulkRemoveMutation.mutate(selectedIds, {
      onSuccess: () => {
        message.success(
          selectedIds.length === 1
            ? '1 anggota dikeluarkan dari kegiatan'
            : `${selectedIds.length} anggota dikeluarkan dari kegiatan`,
        )
        setSelectedIds([])
      },
      onError: (err: Error) => message.error(err.message || 'Gagal mengeluarkan anggota'),
    })
  }

  const handleRole = (memberId: string, role: string) => {
    roleMutation.mutate(
      { memberId, role },
      {
        onSuccess: () => message.success('Peran anggota diperbarui'),
        onError: (err: Error) => message.error(err.message || 'Gagal mengubah peran'),
      },
    )
  }

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <TrophyOutlined style={{ color: token.colorPrimary }} />
          <span>Anggota {activity?.name ?? ''}</span>
        </div>
      }
      extra={
        <Space size={0}>
          <Button
            type="text"
            icon={<PrinterOutlined />}
            disabled={members.length === 0}
            onClick={() => setPrintOpen(true)}
          >
            Cetak
          </Button>
          <Button
            type="text"
            icon={<WhatsAppOutlined style={{ color: token.colorSuccess }} />}
            disabled={members.length === 0}
            onClick={() => setWaOpen(true)}
          >
            WA
          </Button>
        </Space>
      }
      open={open}
      onClose={onClose}
      afterOpenChange={(visible) => {
        // reset setelah animasi tutup selesai agar state tambah anggota bersih
        if (!visible) {
          setMode('santri')
          setPicked([])
          setClassIds([])
          setSearch('')
          setClassFilter(null)
          setSelectedIds([])
        }
      }}
      width={480}
      destroyOnHidden
    >
      {activity?.teachers && (
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: token.colorTextTertiary }}>Pembina: </span>
          <span style={{ fontWeight: 600 }}>{activity.teachers.name}</span>
        </div>
      )}

      <Segmented
        block
        value={mode}
        onChange={(v) => setMode(v as 'santri' | 'kelas')}
        options={[
          { label: 'Pilih Santri', value: 'santri' },
          { label: 'Per Kelas', value: 'kelas' },
        ]}
        style={{ marginBottom: 12 }}
      />

      {mode === 'santri' ? (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <StudentMultiSelect
              value={picked}
              onChange={(v) => setPicked(v)}
              placeholder="Cari santri untuk ditambah…"
            />
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={picked.length === 0}
            loading={addMutation.isPending}
            onClick={handleAdd}
          >
            Tambah
          </Button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <Select
              mode="multiple"
              style={{ flex: 1 }}
              placeholder="Pilih satu atau banyak kelas"
              value={classIds}
              onChange={setClassIds}
              options={(classesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
              loading={classesQuery.isLoading}
              optionFilterProp="label"
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              disabled={newCount === 0}
              loading={addMutation.isPending}
              onClick={handleAddClass}
            >
              Tambah
            </Button>
          </div>

          {classIds.length > 0 && classStudents.length > 0 && (
            <>
              <Typography.Paragraph
                type="secondary"
                style={{ fontSize: 12.5, marginBottom: skippedCount > 0 ? 8 : 12 }}
              >
                Akan ditambahkan: {newCount === 1 ? '1 santri' : `${newCount} santri`}.{' '}
                {newCount > 0 && (
                  <>
                    Contoh:{' '}
                    {classStudents.filter((s) => !memberStudentIds.has(s.id)).slice(0, 5).map((s) => s.name).join(', ')}
                    {newCount > 5 ? ` (+${newCount - 5} lainnya)` : ''}
                  </>
                )}
              </Typography.Paragraph>
              {skippedCount > 0 && (
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginBottom: 12 }}
                  message={
                    skippedCount === 1
                      ? '1 santri sudah tergabung, otomatis dilewati'
                      : `${skippedCount} santri sudah tergabung, otomatis dilewati`
                  }
                />
              )}
            </>
          )}
        </>
      )}

      {members.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <Input
              allowClear
              prefix={<SearchOutlined style={{ color: token.colorTextQuaternary }} />}
              placeholder="Cari nama atau kode santri"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1 }}
            />
            <Select
              allowClear
              placeholder="Semua kelas"
              value={classFilter}
              onChange={(v) => setClassFilter(v ?? null)}
              options={memberClassOptions.map((c) => ({ value: c, label: c }))}
              style={{ width: 140 }}
              popupMatchSelectWidth={false}
            />
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '6px 10px',
              marginBottom: 12,
              borderRadius: 10,
              background: token.colorFillAlter,
              border: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            <Checkbox
              checked={allVisibleSelected}
              indeterminate={!allVisibleSelected && someVisibleSelected}
              onChange={(e) => toggleSelectAll(e.target.checked)}
              aria-label="Pilih semua anggota yang terlihat"
            />
            <span style={{ fontSize: 12, color: token.colorTextSecondary }}>
              {selectedIds.length > 0
                ? `${selectedIds.length} dipilih dari ${filteredMembers.length} anggota`
                : `${filteredMembers.length} anggota`}
            </span>
            <span style={{ flex: 1 }} />
            {selectedIds.length > 0 && (
              <Popconfirm
                title={`Keluarkan ${selectedIds.length} anggota terpilih dari kegiatan?`}
                okText="Keluarkan"
                cancelText="Batal"
                onConfirm={handleBulkRemove}
              >
                <Button
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  loading={bulkRemoveMutation.isPending}
                >
                  Keluarkan
                </Button>
              </Popconfirm>
            )}
          </div>
        </>
      )}

      <List
        loading={membersQuery.isPending}
        dataSource={filteredMembers}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                members.length > 0
                  ? 'Tidak ada anggota yang cocok dengan pencarian atau filter'
                  : 'Belum ada anggota'
              }
            />
          ),
        }}
        renderItem={(m) => (
          <List.Item
            actions={[
              <Popconfirm
                title={`Keluarkan ${m.students?.name ?? 'anggota ini'} dari kegiatan?`}
                onConfirm={() => handleRemove(m.id, m.students?.name)}
                okText="Keluarkan"
                cancelText="Batal"
                key="remove"
              >
                <Button
                  type="text"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  loading={removeMutation.isPending && removeMutation.variables === m.id}
                />
              </Popconfirm>,
            ]}
          >
            <Checkbox
              checked={selectedSet.has(m.id)}
              onChange={(e) => toggleSelect(m.id, e.target.checked)}
              style={{ marginInlineEnd: 12 }}
              aria-label={`Pilih ${m.students?.name ?? 'anggota'}`}
            />
            <List.Item.Meta
              avatar={
                <Avatar style={{ background: token.colorPrimaryBg, color: token.colorPrimary }}>
                  {(m.students?.name ?? '?').charAt(0).toUpperCase()}
                </Avatar>
              }
              title={
                <Space size={6}>
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 500 }}
                    onClick={() => m.students && openStudentDetail(m.students.id)}
                  >
                    {m.students?.name ?? '-'}
                  </button>
                  <Select
                    size="small"
                    variant="borderless"
                    value={m.role || 'Anggota'}
                    loading={roleMutation.isPending && roleMutation.variables?.memberId === m.id}
                    onChange={(v) => handleRole(m.id, v)}
                    options={ROLE_OPTIONS.map((r) => ({ value: r, label: r }))}
                    style={{ fontWeight: 400 }}
                    popupMatchSelectWidth={false}
                  />
                </Space>
              }
              description={
                <Space size={6}>
                  <span style={{ fontSize: 12, color: token.colorTextTertiary }}>
                    {m.students?.registration_code}
                  </span>
                  {m.students?.classes?.name && (
                    <Tag style={{ borderRadius: 6, fontSize: 11 }}>{m.students.classes.name}</Tag>
                  )}
                  <span style={{ fontSize: 12, color: token.colorTextQuaternary }}>
                    sejak {dayjs(m.joined_at).format('DD MMM YYYY')}
                  </span>
                </Space>
              }
            />
          </List.Item>
        )}
      />

      {/* Cetak roster & broadcast WA ke wali anggota — reuse pola students/dorms */}
      <PrintModal open={printOpen} onClose={() => setPrintOpen(false)} activity={activity} />
      <BroadcastModal
        open={waOpen}
        onClose={() => setWaOpen(false)}
        students={members.map((m) => m.students).filter(Boolean) as unknown as Student[]}
      />
    </Drawer>
  )
}
