import { useQuery } from '@tanstack/react-query'
import { Avatar, Descriptions, Drawer, Empty, List, Space, Tag, theme } from 'antd'
import { WhatsAppOutlined } from '@ant-design/icons'
import { StatusTag } from '../../../shared/components/StatusTag'
import { supabase } from '../../../lib/supabase'
import { waLink } from '../../students/wa'
import type { Teacher, TeacherStatus } from '../types'

const MASK = '••••••'

const STATUS_META: Record<TeacherStatus, { label: string; color?: string }> = {
  active: { label: 'Aktif', color: 'green' },
  inactive: { label: 'Nonaktif' },
  on_leave: { label: 'Cuti', color: 'orange' },
}

interface TeacherDrawerProps {
  open: boolean
  teacher: Teacher | null
  isPrivacyMode?: boolean
  onClose: () => void
  onEdit?: (teacher: Teacher) => void
}

/** Profil ringkas satu guru + kelas yang diamanahkan (wali kelas) */
export function TeacherDrawer({ open, teacher, isPrivacyMode, onClose, onEdit }: TeacherDrawerProps) {
  const { token } = theme.useToken()

  const classesQuery = useQuery({
    queryKey: ['classes', 'by-teacher', teacher?.id],
    enabled: open && !!teacher,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name, grade, academic_year:academic_years(name)')
        .eq('homeroom_teacher_id', teacher!.id)
        .is('deleted_at', null)
        .order('name')
      if (error) throw error
      return (data ?? []) as unknown as {
        id: string
        name: string
        grade: number
        academic_year: { name: string } | null
      }[]
    },
  })

  const mask = (v: string | null) => (!v ? '—' : isPrivacyMode ? MASK : v)

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={520}
      title={teacher ? 'Detail Guru' : ''}
      styles={{ body: { paddingTop: 0 } }}
    >
      {teacher && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBlock: 16 }}>
            <Avatar
              size={56}
              src={isPrivacyMode ? undefined : teacher.photo_url || undefined}
              style={{ background: token.colorPrimaryBg, color: token.colorPrimaryTextActive, fontWeight: 700, fontSize: 20, flexShrink: 0 }}
            >
              {isPrivacyMode ? '*' : teacher.name.charAt(0).toUpperCase()}
            </Avatar>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 700 }}>{teacher.name}</div>
              <Space size={6} style={{ marginTop: 4 }}>
                <StatusTag color={STATUS_META[teacher.status].color}>
                  {STATUS_META[teacher.status].label}
                </StatusTag>
                {teacher.subject && <Tag>{teacher.subject}</Tag>}
                {teacher.gender && (
                  <Tag>{teacher.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</Tag>
                )}
              </Space>
            </div>
          </div>

          <Descriptions
            column={1}
            size="small"
            bordered
            items={[
              { key: 'nik', label: 'NIK', children: mask(teacher.nik) },
              { key: 'nip', label: 'NIP', children: mask(teacher.nip) },
              { key: 'nuptk', label: 'NUPTK', children: mask(teacher.nuptk) },
              { key: 'nbm', label: 'NBM', children: mask(teacher.nbm) },
              {
                key: 'phone',
                label: 'Telepon',
                children: (
                  <Space size={6}>
                    <span>{mask(teacher.phone)}</span>
                    {teacher.phone && !isPrivacyMode && (
                      <a
                        href={waLink(teacher.phone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Chat WhatsApp"
                      >
                        <WhatsAppOutlined style={{ color: token.colorSuccess }} />
                      </a>
                    )}
                  </Space>
                ),
              },
              { key: 'email', label: 'Email', children: mask(teacher.email) },
              {
                key: 'join',
                label: 'Bergabung',
                children: teacher.join_date
                  ? new Date(teacher.join_date).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })
                  : '—',
              },
              { key: 'address', label: 'Alamat', children: teacher.address || '—' },
              { key: 'notes', label: 'Catatan', children: teacher.notes || '—' },
            ]}
          />

          <div style={{ marginTop: 20 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Kelas Diamanahkan (Wali Kelas)</div>
            <List
              size="small"
              loading={classesQuery.isPending}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="Belum menjadi wali kelas"
                  />
                ),
              }}
              dataSource={classesQuery.data ?? []}
              renderItem={(c) => (
                <List.Item>
                  <div>
                    <span style={{ fontWeight: 600 }}>{c.name}</span>
                    <Tag style={{ marginLeft: 8 }}>Tingkat {c.grade}</Tag>
                  </div>
                  <span style={{ fontSize: 12, color: token.colorTextTertiary }}>
                    {c.academic_year?.name ?? ''}
                  </span>
                </List.Item>
              )}
            />
          </div>

          {onEdit && (
            <div style={{ marginTop: 16 }}>
              <a
                onClick={() => {
                  onClose()
                  onEdit(teacher)
                }}
              >
                Edit data guru
              </a>
            </div>
          )}
        </>
      )}
    </Drawer>
  )
}
