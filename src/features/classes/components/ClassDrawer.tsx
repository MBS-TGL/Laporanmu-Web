import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Avatar, Badge, Button, Drawer, Empty, List, Space, Tabs, Tag, theme } from 'antd'
import { CalendarOutlined, BookOutlined, TableOutlined, TeamOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import dayjs from 'dayjs'
import { pageShellItemVariants, shellTransition } from '../../../shared/motion'
import { photoThumb } from '../../../shared/utils/photoThumb'
import { supabase } from '../../../lib/supabase'
import { useStudentDetail } from '../../students/useStudentDetail'
import { useClassSubjects } from '../hooks'
import { SubjectsTab } from './SubjectsTab'
import type { ClassRow } from '../types'

interface ClassDrawerProps {
  open: boolean
  cls: ClassRow | null
  onClose: () => void
  onEdit?: (cls: ClassRow) => void
}

/** Detail satu kelas: info + wali + tab santri & mapel */
export function ClassDrawer({ open, cls, onClose, onEdit }: ClassDrawerProps) {
  const { token } = theme.useToken()
  const navigate = useNavigate()
  const { open: openStudentDetail } = useStudentDetail()
  const [activeTab, setActiveTab] = useState('students')

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

  const classSubjectsQuery = useClassSubjects(
    cls?.id,
    cls?.academic_year_id ?? undefined,
  )

  const students = studentsQuery.data ?? []
  const male = students.filter((s) => s.gender === 'L').length
  const female = students.filter((s) => s.gender === 'P').length
  const csCount = classSubjectsQuery.data?.length ?? 0

  return (
    <Drawer open={open} onClose={onClose} size="min(560px, 96vw)" title={cls ? `Detail Kelas ${cls.name}` : ''}>
      {cls && (
        <motion.div
          variants={pageShellItemVariants}
          initial="initial"
          animate="animate"
          transition={shellTransition}
        >
          <Space wrap size={6} style={{ marginTop: 4, marginBottom: 16 }}>
            {cls.grade && <Tag color="processing">Tingkat {cls.grade}</Tag>}
            {cls.major && <Tag>{cls.major}</Tag>}
            {cls.academic_year?.name && <Tag>{cls.academic_year.name}</Tag>}
            <Tag color={cls.homeroom_teacher_id ? 'success' : 'warning'}>
              {cls.homeroom_teacher?.name ? `Wali: ${cls.homeroom_teacher.name}` : 'Belum ada wali'}
            </Tag>
          </Space>

          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            size="small"
            items={[
              {
                key: 'students',
                label: (
                  <span>
                    <TeamOutlined style={{ marginRight: 4 }} />
                    Santri
                    {students.length > 0 && (
                      <Badge
                        count={students.length}
                        size="small"
                        style={{ marginLeft: 6, backgroundColor: token.colorPrimary }}
                      />
                    )}
                  </span>
                ),
                children: (
                  <>
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
                        <List.Item
                          style={{ cursor: 'pointer' }}
                          onClick={() => openStudentDetail(s.id)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Avatar
                              size={28}
                              src={photoThumb(s.photo_url)}
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

                    <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                      <Button
                        type="link"
                        icon={<TeamOutlined />}
                        style={{ padding: 0 }}
                        onClick={() => {
                          onClose()
                          navigate(`/students?classId=${cls.id}`)
                        }}
                      >
                        Kelola santri
                      </Button>
                      <Button
                        type="link"
                        icon={<CalendarOutlined />}
                        style={{ padding: 0 }}
                        onClick={() => {
                          onClose()
                          const now = dayjs()
                          navigate(`/attendance?class=${cls.id}&month=${now.month() + 1}&year=${now.year()}`)
                        }}
                      >
                        Absensi kelas ini
                      </Button>
                      <Button
                        type="link"
                        icon={<TableOutlined />}
                        style={{ padding: 0 }}
                        onClick={() => {
                          onClose()
                          navigate(`/grades?tab=leger&class=${cls.id}&ay=${cls.academic_year_id ?? ''}`)
                        }}
                      >
                        Leger nilai
                      </Button>
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
                ),
              },
              {
                key: 'subjects',
                label: (
                  <span>
                    <BookOutlined style={{ marginRight: 4 }} />
                    Mapel & Guru
                    {csCount > 0 && (
                      <Badge
                        count={csCount}
                        size="small"
                        style={{ marginLeft: 6, backgroundColor: token.colorPrimary }}
                      />
                    )}
                  </span>
                ),
                children: <SubjectsTab cls={cls} />,
              },
            ]}
          />
        </motion.div>
      )}
    </Drawer>
  )
}
