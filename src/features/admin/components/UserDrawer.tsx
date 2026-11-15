import { App, Button, Descriptions, Drawer, Empty, Space, Spin, Tag, Typography } from 'antd'
import {
  EditOutlined,
  LinkOutlined,
  MailOutlined,
  DisconnectOutlined,
  CopyOutlined,
} from '@ant-design/icons'
import { StatusTag } from '../../../shared/components/StatusTag'
import { useAuditLogs } from '../hooks'
import { ROLE_META } from '../usersMeta'
import type { AdminProfile } from '../types'
import type { TeacherLinkBrief } from '../api'

interface UserDrawerProps {
  profile: AdminProfile | null
  /** Guru yang terhubung ke akun ini (null = belum ada) */
  linkedTeacher: TeacherLinkBrief | null
  canManage: boolean
  onClose: () => void
  onEdit: (profile: AdminProfile) => void
  onLink: (profile: AdminProfile) => void
  onUnlink: (profile: AdminProfile) => void
  /** Kirim email pemulihan password — konfirmasi ditangani pemanggil */
  onResetPassword: (profile: AdminProfile) => void
}

/**
 * Drawer detail akun pengguna: identitas, status link guru, aksi pengelolaan,
 * dan jejak aktivitas terakhir dari audit log.
 */
export function UserDrawer({
  profile,
  linkedTeacher,
  canManage,
  onClose,
  onEdit,
  onLink,
  onUnlink,
  onResetPassword,
}: UserDrawerProps) {
  const { message } = App.useApp()

  const activityQuery = useAuditLogs({
    userId: profile?.id,
    page: 1,
    pageSize: 8,
  })
  const activities = activityQuery.data?.data ?? []

  const copyEmail = () => {
    if (!profile) return
    void navigator.clipboard
      .writeText(profile.email)
      .then(() => message.success('Email disalin ke clipboard'))
      .catch(() => message.error('Gagal menyalin email'))
  }

  return (
    <Drawer
      open={profile !== null}
      onClose={onClose}
      width={480}
      title="Detail Akun"
      destroyOnHidden
    >
      {profile && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: 'rgba(79, 70, 229, 0.1)',
                color: '#4f46e5',
                display: 'grid',
                placeItems: 'center',
                fontSize: 20,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {(profile.name || '?').charAt(0).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <Typography.Text strong style={{ fontSize: 16, display: 'block' }}>
                {profile.name}
              </Typography.Text>
              <Space size={4}>
                <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
                  {profile.email}
                </Typography.Text>
                <Button
                  type="text"
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={copyEmail}
                />
              </Space>
              <div style={{ marginTop: 6 }}>
                <RoleTag role={profile.role} />
              </div>
            </div>
          </div>

          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Terdaftar">
              {profile.created_at
                ? new Date(profile.created_at).toLocaleDateString('id-ID', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Guru Terhubung">
              {linkedTeacher ? (
                <Space size={6}>
                  <span style={{ fontWeight: 600 }}>{linkedTeacher.name}</span>
                  {linkedTeacher.nbm && (
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {linkedTeacher.nbm}
                    </Typography.Text>
                  )}
                </Space>
              ) : (
                <Tag style={{ borderRadius: 6 }}>Belum terhubung</Tag>
              )}
            </Descriptions.Item>
          </Descriptions>

          {canManage && (
            <Space wrap>
              <Button icon={<EditOutlined />} onClick={() => onEdit(profile)}>
                Edit
              </Button>
              {linkedTeacher ? (
                <Button icon={<DisconnectOutlined />} onClick={() => onUnlink(profile)}>
                Lepas Link
                </Button>
              ) : (
                <Button icon={<LinkOutlined />} onClick={() => onLink(profile)}>
                  Hubungkan Guru
                </Button>
              )}
              <Button icon={<MailOutlined />} onClick={() => onResetPassword(profile)}>
                Reset Password
              </Button>
            </Space>
          )}

          <div>
            <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
              Aktivitas Terakhir
            </Typography.Text>
            {activityQuery.isLoading ? (
              <div style={{ textAlign: 'center', padding: 24 }}>
                <Spin />
              </div>
            ) : activities.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada aktivitas tercatat" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {activities.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 12.5,
                      padding: '6px 10px',
                      borderRadius: 8,
                      background: 'rgba(15, 23, 42, 0.03)',
                    }}
                  >
                    <StatusTag color={log.action === 'DELETE' ? 'red' : log.action === 'INSERT' ? 'green' : 'blue'}>
                      {log.action}
                    </StatusTag>
                    <span style={{ fontWeight: 500 }}>{log.table_name ?? '-'}</span>
                    <span style={{ marginLeft: 'auto', color: 'rgba(0,0,0,0.45)', fontSize: 12 }}>
                      {new Date(log.created_at).toLocaleString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Drawer>
  )
}

/** Tag role dengan meta warna+icon dari usersMeta. */
function RoleTag({ role }: { role: string }) {
  const meta = ROLE_META.find((r) => r.value === role)
  return (
    <StatusTag color={meta?.color ?? 'default'} icon={meta?.icon}>
      {meta?.label ?? role}
    </StatusTag>
  )
}
