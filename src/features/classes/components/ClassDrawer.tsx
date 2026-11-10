import { useQuery } from '@tanstack/react-query'
import { Avatar, Button, Drawer, Empty, List, Space, Tag, theme } from 'antd'
import { TeamOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import type { ClassRow } from '../types'

interface ClassDrawerProps {
  open: boolean
  cls: ClassRow | null
  onClose: () => void
  onEdit?: (cls: ClassRow) => void
}

/** Detail satu kelas: info + wali + daftar santri aktif di kelas tsb */
export function ClassDrawer({ open, cls, onClose, onEdit }: ClassDrawerProps) {
  const { token } = theme.useToken()
  const navigate = useNavigate()

  const studentsQuery = useQuery({
    queryKey: ['students', 'by-class', cls?.id],
    enabled: open && !!cls,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('id, name, registration_code, gender, photo_url, total_points')
        .eq('class_id', cls!.id)
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('name')
      if (error) throw error
      return data as {
        id: string
        name: string
        registration_code: string
        gender: 'L' | 'P' | null
        photo_url: string | null
        total_points: number
      }[]
    },
  })

  const students = studentsQuery.data ?? []
  const male = students.filter((s) => s.gender === 'L').length
  const female = students.filter((s) => s.gender === 'P').length

  return (
    <Drawer open={open} onClose={onClose} width={520} title={cls ? `Detail Kelas ${cls.name}` : ''}>
      {cls && (
        <>
          <Space wrap size={6} style={{ marginTop: 4, marginBottom: 16 }}>
            {cls.grade && <Tag color="processing">Tingkat {cls.grade}</Tag>}
            {cls.major && <Tag>{cls.major}</Tag>}
            {cls.academic_year?.name && <Tag>{cls.academic_year.name}</Tag>}
            <Tag color={cls.homeroom_teacher_id ? 'success' : 'warning'}>
              {cls.homeroom_teacher?.name ? `Wali: ${cls.homeroom_teacher.name}` : 'Belum ada wali'}
            </Tag>
          </Space>

          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            Santri Aktif ({students.length})
            {students.length > 0 && (
              <span style={{ fontWeight: 400, fontSize: 12, color: token.colorTextTertiary }}>
                {' '}
                · {male} putra · {female} putri
              </span>
            )}
          </div>
          <List
            size="small"
            loading={studentsQuery.isPending}
            locale={{
              emptyText: (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada santri di kelas ini" />
              ),
            }}
            dataSource={students}
            renderItem={(s) => (
              <List.Item>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar
                    size={28}
                    src={s.photo_url || undefined}
                    style={{ background: token.colorPrimaryBg, color: token.colorPrimaryTextActive, fontWeight: 700, fontSize: 12 }}
                  >
                    {s.name.charAt(0).toUpperCase()}
                  </Avatar>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</div>
                    <div style={{ fontSize: 11.5, color: token.colorTextTertiary }}>
                      {s.registration_code}
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: 12, color: token.colorTextSecondary }}>
                  {s.total_points > 0 ? `+${s.total_points}` : s.total_points} poin
                </span>
              </List.Item>
            )}
          />

          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between' }}>
            {cls && (
              <Button
                type="link"
                icon={<TeamOutlined />}
                style={{ padding: 0 }}
                onClick={() => {
                  onClose()
                  navigate(`/master/students?classId=${cls.id}`)
                }}
              >
                Kelola santri di Data Siswa
              </Button>
            )}
            {onEdit && (
              <a
                onClick={() => {
                  onClose()
                  onEdit(cls)
                }}
              >
                Edit kelas
              </a>
            )}
          </div>
        </>
      )}
    </Drawer>
  )
}
