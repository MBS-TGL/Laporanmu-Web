import { useEffect, useState } from 'react'
import { App, Avatar, Button, Drawer, Empty, List, Popconfirm, Select, Space, Tag, theme } from 'antd'
import { DeleteOutlined, PlusOutlined, TrophyOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { StudentMultiSelect } from '../../../shared/components/StudentSelect'
import {
  useAddEkskulMembers,
  useEkskulMembers,
  useRemoveEkskulMember,
  useSetMemberRole,
} from '../hooks'
import type { Ekskul } from '../types'

const ROLE_OPTIONS = ['Anggota', 'Ketua', 'Wakil Ketua', 'Sekretaris', 'Bendahara']

interface MemberDrawerProps {
  open: boolean
  ekskul: Ekskul | null
  onClose: () => void
}

export function MemberDrawer({ open, ekskul, onClose }: MemberDrawerProps) {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const [picked, setPicked] = useState<string[]>([])

  const membersQuery = useEkskulMembers(open ? ekskul?.id : undefined)
  const addMutation = useAddEkskulMembers()
  const removeMutation = useRemoveEkskulMember()
  const roleMutation = useSetMemberRole()

  useEffect(() => {
    if (!open) setPicked([])
  }, [open])

  const members = membersQuery.data ?? []

  const handleAdd = () => {
    if (!ekskul || picked.length === 0) return
    addMutation.mutate(
      { ekskulId: ekskul.id, studentIds: picked },
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

  const handleRemove = (memberId: string, name?: string) => {
    removeMutation.mutate(memberId, {
      onSuccess: () => message.success(`${name ?? 'Anggota'} dikeluarkan dari kegiatan`),
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
          <span>Anggota {ekskul?.name ?? ''}</span>
        </div>
      }
      open={open}
      onClose={onClose}
      width={480}
      destroyOnHidden
    >
      {ekskul?.teachers && (
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: token.colorTextTertiary }}>Pembina: </span>
          <span style={{ fontWeight: 600 }}>{ekskul.teachers.name}</span>
        </div>
      )}

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

      <List
        loading={membersQuery.isPending}
        dataSource={members}
        locale={{
          emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada anggota" />,
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
            <List.Item.Meta
              avatar={
                <Avatar style={{ background: token.colorPrimaryBg, color: token.colorPrimary }}>
                  {(m.students?.name ?? '?').charAt(0).toUpperCase()}
                </Avatar>
              }
              title={
                <Space size={6}>
                  <span>{m.students?.name ?? '-'}</span>
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
    </Drawer>
  )
}
