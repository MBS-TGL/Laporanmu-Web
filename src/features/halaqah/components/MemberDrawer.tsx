import { useState } from 'react'
import { App, Avatar, Button, Drawer, Empty, List, Popconfirm, Tag, Tooltip, Typography, theme } from 'antd'
import { DeleteOutlined, DeploymentUnitOutlined, PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { StudentMultiSelect } from '../../../shared/components/StudentSelect'
import { useAddHalaqahMembers, useHalaqahMembers, useRemoveHalaqahMember } from '../hooks'
import type { HalaqahGroup } from '../types'
import { useStudentDetail } from '../../students/useStudentDetail'

interface MemberDrawerProps {
  open: boolean
  group: HalaqahGroup | null
  /** Boleh kelola anggota: role writer ATAU musyrif pemegang kelompok (scope guru). */
  canManage?: boolean
  onClose: () => void
}

export function MemberDrawer({ open, group, canManage = false, onClose }: MemberDrawerProps) {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const { open: openStudentDetail } = useStudentDetail()
  const [picked, setPicked] = useState<string[]>([])

  // Reset pilihan saat drawer tutup — pola "adjust state on prop change" (tanpa effect)
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (!open) setPicked([])
  }

  const membersQuery = useHalaqahMembers(open ? group?.id : undefined)
  const addMutation = useAddHalaqahMembers()
  const removeMutation = useRemoveHalaqahMember()

  const members = membersQuery.data ?? []

  const handleAdd = () => {
    if (!group || picked.length === 0) return
    addMutation.mutate(
      { groupId: group.id, studentIds: picked },
      {
        onSuccess: (count) => {
          if (count === 0) {
            message.warning('Semua santri yang dipilih sudah tergabung di halaqah ini')
          } else {
            message.success(
              count === 1 ? '1 santri ditambahkan' : `${count} santri ditambahkan`,
            )
          }
          setPicked([])
        },
        onError: (err: Error) => message.error(err.message || 'Gagal menambah anggota'),
      },
    )
  }

  const handleRemove = (memberId: string, name?: string) => {
    removeMutation.mutate(memberId, {
      onSuccess: () => message.success(`${name ?? 'Anggota'} dikeluarkan dari halaqah`),
      onError: (err: Error) => message.error(err.message || 'Gagal mengeluarkan anggota'),
    })
  }

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <DeploymentUnitOutlined style={{ color: token.colorPrimary }} />
          <span>Anggota {group?.name ?? ''}</span>
        </div>
      }
      open={open}
      onClose={onClose}
      width={440}
      destroyOnHidden
    >
      {group?.musyrif_id && (
        <div style={{ marginBottom: 12 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Musyrif
          </Typography.Text>
          <div style={{ fontWeight: 600 }}>{group.teachers?.name ?? '-'}</div>
        </div>
      )}

      {canManage && (
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
      )}

      <List
        loading={membersQuery.isPending}
        dataSource={members}
        locale={{
          emptyText: (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada anggota" />
          ),
        }}
        renderItem={(m) => (
          <List.Item
            actions={
              canManage
                ? [
                    <Popconfirm
                      title={`Keluarkan ${m.students?.name ?? 'anggota ini'} dari halaqah?`}
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
                  ]
                : []
            }
          >
            <List.Item.Meta
              avatar={
                <Avatar
                  size={32}
                  style={{ background: token.colorPrimaryBg, color: token.colorPrimary }}
                >
                  {(m.students?.name ?? '?').charAt(0).toUpperCase()}
                </Avatar>
              }
              title={
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    fontWeight: 600,
                    display: 'block',
                    maxWidth: '100%',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    textAlign: 'left',
                  }}
                  onClick={() => m.students && openStudentDetail(m.students.id)}
                >
                  {m.students?.name ?? '-'}
                </button>
              }
              description={
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                  }}
                >
                  <Tooltip title={m.students?.registration_code}>
                    <span
                      style={{
                        fontSize: 12,
                        color: token.colorTextTertiary,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        flexShrink: 1,
                      }}
                    >
                      {m.students?.registration_code}
                    </span>
                  </Tooltip>
                  {m.students?.classes?.name && (
                    <Tag
                      style={{
                        borderRadius: 6,
                        fontSize: 11,
                        marginInlineEnd: 0,
                        flexShrink: 0,
                      }}
                    >
                      {m.students.classes.name}
                    </Tag>
                  )}
                  <Tooltip title={`Anggota sejak ${dayjs(m.joined_at).format('DD MMMM YYYY')}`}>
                    <span
                      style={{
                        fontSize: 12,
                        color: token.colorTextQuaternary,
                        flexShrink: 0,
                      }}
                    >
                      {dayjs(m.joined_at).format('DD MMM YYYY')}
                    </span>
                  </Tooltip>
                </div>
              }
            />
          </List.Item>
        )}
      />
    </Drawer>
  )
}
