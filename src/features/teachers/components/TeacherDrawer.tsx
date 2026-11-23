import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  App,
  Avatar,
  Badge,
  Button,
  Descriptions,
  Drawer,
  Empty,
  List,
  Space,
  Spin,
  Tabs,
  Tag,
  Timeline,
  Tooltip,
  Typography,
  theme,
} from 'antd'
import {
  BookOutlined,
  CopyOutlined,
  IdcardOutlined,
  WhatsAppOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { motion } from 'motion/react'
import { pageShellItemVariants, shellTransition } from '../../../shared/motion'
import { StatusTag } from '../../../shared/components/StatusTag'
import { usePermissions } from '../../../shared/hooks/useProfile'
import { supabase } from '../../../lib/supabase'
import { waLink } from '../../students/wa'
import { fetchAuditLogs } from '../../admin/api'
import type { AuditLog } from '../../admin/types'
import { AssignModal } from './AssignModal'
import type { Teacher, TeacherStatus } from '../types'
import { TEACHER_EMPLOYMENT_LABEL, TEACHER_STATUS_LABEL, TEACHER_TYPE_LABEL, WORK_DAYS } from '../types'

const { Text } = Typography

const MASK = '••••••'

const STATUS_COLOR: Record<TeacherStatus, string | undefined> = {
  active: 'green',
  inactive: undefined,
  on_leave: 'orange',
}

function auditActionMeta(action: string): { label: string; color: string; bg: string } {
  const a = action.toUpperCase()
  if (a === 'INSERT') return { label: 'Buat', color: '#059669', bg: '#ecfdf5' }
  if (a === 'UPDATE') return { label: 'Ubah', color: '#d97706', bg: '#fffbeb' }
  if (a === 'DELETE') return { label: 'Hapus', color: '#dc2626', bg: '#fef2f2' }
  return { label: a, color: '#64748b', bg: '#f1f5f9' }
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', margin: '16px 0 8px' }}>
      {children}
    </div>
  )
}

interface TeacherDrawerProps {
  open: boolean
  teacher: Teacher | null
  isPrivacyMode?: boolean
  onClose: () => void
  onEdit?: (teacher: Teacher) => void
}

/** Detail guru bertab: info, mengajar (wali kelas + beban), presensi, audit */
export function TeacherDrawer({ open, teacher, isPrivacyMode, onClose, onEdit }: TeacherDrawerProps) {
  const { token } = theme.useToken()
  const { message } = App.useApp()
  const { canWrite } = usePermissions()
  const [assignOpen, setAssignOpen] = useState(false)

  const mask = (v: string | null) => (!v ? '-' : isPrivacyMode ? MASK : v)

  const copy = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value)
    message.success(`${label} berhasil disalin`)
  }

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

  // Tahun ajaran aktif — dipakai untuk beban mengajar & modal assign
  const activeYearQuery = useQuery({
    queryKey: ['academic-years', 'active'],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('academic_years')
        .select('id, name')
        .eq('is_active', true)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data as { id: string; name: string } | null
    },
  })

  // Beban mengajar: mapel-kelas yang diampu guru ini di tahun ajaran aktif
  const teachingLoadQuery = useQuery({
    queryKey: ['class-subjects', 'by-teacher', teacher?.id, activeYearQuery.data?.id],
    enabled: open && !!teacher && !!activeYearQuery.data?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('class_subjects')
        .select('id, class_id, subject_id, subjects(name), classes(name, grade)')
        .eq('teacher_id', teacher!.id)
        .eq('academic_year_id', activeYearQuery.data!.id)
        .is('deleted_at', null)
        .order('class_id')
      if (error) throw error
      return (data ?? []) as unknown as {
        id: string
        class_id: string
        subject_id: string
        subjects: { name: string } | null
        classes: { name: string; grade: number } | null
      }[]
    },
  })

  // Presensi guru bulan berjalan — rekap + daftar terbaru dari satu fetch
  const attendanceQuery = useQuery({
    queryKey: ['teacher-attendance', 'drawer', teacher?.id, dayjs().format('YYYY-MM')],
    enabled: open && !!teacher,
    queryFn: async () => {
      const from = dayjs().startOf('month').format('YYYY-MM-DD')
      const to = dayjs().endOf('month').format('YYYY-MM-DD')
      const { data, error } = await supabase
        .from('teacher_attendance')
        .select('date, status, note')
        .eq('teacher_id', teacher!.id)
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: false })
      if (error) throw error
      return (data ?? []) as { date: string; status: string; note: string | null }[]
    },
  })

  const auditQuery = useQuery({
    queryKey: ['audit-logs', 'teacher', teacher?.id],
    enabled: open && !!teacher,
    queryFn: () =>
      fetchAuditLogs({ tableName: 'teachers', recordId: teacher!.id, page: 1, pageSize: 50 }),
  })

  // Group per mapel: { mapel: [kelas…] }
  const teachingLoad = (() => {
    const bySubject = new Map<string, string[]>()
    for (const cs of teachingLoadQuery.data ?? []) {
      const subject = cs.subjects?.name ?? '-'
      const list = bySubject.get(subject) ?? []
      if (cs.classes) list.push(cs.classes.name)
      bySubject.set(subject, list)
    }
    return [...bySubject.entries()]
  })()

  const monthRows = attendanceQuery.data ?? []
  const monthCounts = monthRows.reduce(
    (acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }),
    {} as Record<string, number>,
  )
  const presentPct =
    monthRows.length > 0
      ? Math.round(((monthCounts.hadir ?? 0) / monthRows.length) * 100)
      : null

  const birthLine = teacher
    ? [teacher.birth_place, teacher.birth_date ? dayjs(teacher.birth_date).format('DD MMMM YYYY') : '']
        .filter(Boolean)
        .join(', ') || null
    : null

  const attendanceMeta: Record<string, { label: string; color: string }> = {
    hadir: { label: 'Hadir', color: 'success' },
    sakit: { label: 'Sakit', color: 'warning' },
    izin: { label: 'Izin', color: 'processing' },
    tugas_luar: { label: 'Tugas Luar', color: 'purple' },
  }

  if (!teacher) return <Drawer open={open} onClose={onClose} size="min(560px, 96vw)" />

  const infoContent = (
    <>
      <SectionLabel>Identitas & Biodata</SectionLabel>
      <Descriptions
        column={1}
        size="small"
        bordered
        items={[
          { key: 'nik', label: 'NIK', children: mask(teacher.nik) },
          {
            key: 'nip',
            label: 'NIP / NUPTK',
            children: [teacher.nip, teacher.nuptk].map((v) => mask(v)).join(' / '),
          },
          { key: 'nbm', label: 'NBM', children: mask(teacher.nbm) },
          { key: 'birth', label: 'Tempat, Tgl Lahir', children: birthLine ?? '-' },
          {
            key: 'gender',
            label: 'Jenis Kelamin',
            children: teacher.gender ? (teacher.gender === 'L' ? 'Laki-laki' : 'Perempuan') : '-',
          },
        ]}
      />

      <SectionLabel>Kepegawaian</SectionLabel>
      <Descriptions
        column={1}
        size="small"
        bordered
        items={[
          {
            key: 'employment',
            label: 'Status Pegawai',
            children: teacher.employment_status
              ? TEACHER_EMPLOYMENT_LABEL[teacher.employment_status] ?? teacher.employment_status
              : '-',
          },
          {
            key: 'type',
            label: 'Tipe Tugas',
            children: teacher.type ? TEACHER_TYPE_LABEL[teacher.type] : '-',
          },
          { key: 'subject', label: 'Mata Pelajaran', children: teacher.subject ?? '-' },
          {
            key: 'join',
            label: 'Bergabung',
            children: teacher.join_date
              ? dayjs(teacher.join_date).format('DD MMMM YYYY')
              : '-',
          },
          {
            key: 'hours',
            label: 'Jam Mengajar',
            children: teacher.teaching_hours != null ? `${teacher.teaching_hours} jam / minggu` : '-',
          },
        ]}
      />

      <SectionLabel>Pendidikan Terakhir</SectionLabel>
      <Descriptions
        column={1}
        size="small"
        bordered
        items={[
          { key: 'level', label: 'Tingkat', children: teacher.last_education ?? '-' },
          { key: 'major', label: 'Jurusan', children: teacher.major ?? '-' },
          { key: 'year', label: 'Tahun Lulus', children: teacher.graduation_year ?? '-' },
        ]}
      />

      <SectionLabel>Kontak</SectionLabel>
      <Descriptions
        column={1}
        size="small"
        bordered
        items={[
          {
            key: 'phone',
            label: 'No. HP / WhatsApp',
            children: (
              <Space size={6}>
                <span>{mask(teacher.phone)}</span>
                {!isPrivacyMode && teacher.phone && (
                  <>
                    <Tooltip title="Salin nomor">
                      <Button
                        type="text"
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={() => copy(teacher.phone!, 'Nomor HP')}
                      />
                    </Tooltip>
                    <Tooltip title="Chat WhatsApp">
                      <Button
                        type="text"
                        size="small"
                        icon={
                          <WhatsAppOutlined style={{ color: token.colorSuccess }} />
                        }
                        onClick={() =>
                          window.open(waLink(teacher.phone!), '_blank', 'noopener')
                        }
                      />
                    </Tooltip>
                  </>
                )}
              </Space>
            ),
          },
          {
            key: 'email',
            label: 'Email',
            children: (
              <Space size={6}>
                <span>{mask(teacher.email)}</span>
                {!isPrivacyMode && teacher.email && (
                  <Tooltip title="Salin email">
                    <Button
                      type="text"
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => copy(teacher.email!, 'Email')}
                    />
                  </Tooltip>
                )}
              </Space>
            ),
          },
        ]}
      />

      <SectionLabel>Presensi</SectionLabel>
      <Descriptions
        column={1}
        size="small"
        bordered
        items={[
          { key: 'fingerspot', label: 'ID Mesin Fingerspot', children: teacher.fingerspot_name ?? '-' },
        ]}
      />
      <div style={{ marginTop: 8 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>Hari Kerja Aktif: </Text>
        <Space size={4} wrap style={{ marginTop: 6 }}>
          {WORK_DAYS.map((d) => (
            <Tag.CheckableTag key={d} checked={teacher.work_days?.includes(d) ?? true} style={{ paddingInline: 8 }}>
              {d.slice(0, 3)}
            </Tag.CheckableTag>
          ))}
        </Space>
      </div>

      <SectionLabel>Domisili</SectionLabel>
      <Text style={{ fontSize: 13.5 }}>{teacher.address || 'Alamat belum dilengkapi.'}</Text>

      <SectionLabel>Catatan Internal</SectionLabel>
      <Text style={{ fontSize: 13.5 }}>{teacher.notes || 'Tidak ada catatan tambahan.'}</Text>
    </>
  )

  const teachingContent = (
    <>
      <SectionLabel>Kelas Diamanahkan (Wali Kelas)</SectionLabel>
      <List
        size="small"
        loading={classesQuery.isPending}
        locale={{
          emptyText: (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum menjadi wali kelas" />
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

      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: '#64748b',
          margin: '20px 0 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span>
          Beban Mengajar
          <span style={{ fontWeight: 400 }}>
            {' '}
            · {activeYearQuery.data?.name ?? ''}
          </span>
        </span>
        {canWrite && (
          <Button size="small" icon={<BookOutlined />} onClick={() => setAssignOpen(true)}>
            Atur
          </Button>
        )}
      </div>
      <List
        size="small"
        loading={teachingLoadQuery.isPending}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Belum mengajar mapel di kelas mana pun"
            />
          ),
        }}
        dataSource={teachingLoad}
        renderItem={([subject, classes]) => (
          <List.Item>
            <span style={{ fontWeight: 600 }}>{subject}</span>
            <Space size={4} wrap style={{ justifyContent: 'flex-end' }}>
              {classes.map((c) => (
                <Tag key={c}>{c}</Tag>
              ))}
            </Space>
          </List.Item>
        )}
      />
    </>
  )

  const attendanceContent = attendanceQuery.isPending ? (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
      <Spin />
    </div>
  ) : monthRows.length === 0 ? (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      style={{ marginTop: 40 }}
      description="Belum ada absensi guru bulan ini"
    />
  ) : (
    <>
      <SectionLabel>Rekap Bulan Ini ({dayjs().format('MMMM YYYY')})</SectionLabel>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Tag color="green" style={{ borderRadius: 6 }}>Hadir {monthCounts.hadir ?? 0}</Tag>
        <Tag color="orange" style={{ borderRadius: 6 }}>Sakit {monthCounts.sakit ?? 0}</Tag>
        <Tag color="blue" style={{ borderRadius: 6 }}>Izin {monthCounts.izin ?? 0}</Tag>
        <Tag color="purple" style={{ borderRadius: 6 }}>Tugas Luar {monthCounts.tugas_luar ?? 0}</Tag>
        {presentPct != null && (
          <Tag style={{ borderRadius: 6 }}>Kehadiran {presentPct}%</Tag>
        )}
      </div>
      <SectionLabel>Catatan Terbaru</SectionLabel>
      <List
        size="small"
        dataSource={monthRows.slice(0, 10)}
        locale={{ emptyText: 'Belum ada catatan' }}
        renderItem={(r) => {
          const meta = attendanceMeta[r.status] ?? { label: r.status, color: 'default' }
          return (
            <List.Item style={{ paddingBlock: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{dayjs(r.date).format('dddd, DD MMM')}</div>
                {r.note && (
                  <div style={{ fontSize: 12, color: token.colorTextTertiary }}>{r.note}</div>
                )}
              </div>
              <Tag color={meta.color} style={{ marginInlineEnd: 0, borderRadius: 6 }}>
                {meta.label}
              </Tag>
            </List.Item>
          )
        }}
      />
    </>
  )

  const auditLogs: AuditLog[] = auditQuery.data?.data ?? []
  const auditContent = auditQuery.isPending ? (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
      <Spin />
    </div>
  ) : auditLogs.length === 0 ? (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      style={{ marginTop: 40 }}
      description="Belum ada riwayat audit"
    />
  ) : (
    <Timeline
      style={{ marginTop: 16 }}
      items={auditLogs.map((log) => {
        const meta = auditActionMeta(log.action)
        return {
          dot: (
            <span
              style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 5, background: meta.color }}
            />
          ),
          children: (
            <div style={{ paddingBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Tag
                  style={{
                    marginInlineEnd: 0,
                    borderRadius: 6,
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: meta.color,
                    background: meta.bg,
                    borderColor: 'transparent',
                  }}
                >
                  {meta.label}
                </Tag>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>
                  {log.actor_name ?? 'Sistem'}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: token.colorTextTertiary }}>
                  {dayjs(log.created_at).format('DD MMM YYYY HH:mm')}
                </span>
              </div>
              <div style={{ fontSize: 12, color: token.colorTextTertiary, marginTop: 3 }}>
                Sumber: {log.source}
              </div>
            </div>
          ),
        }
      })}
    />
  )

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="min(560px, 96vw)"
      title={teacher.name}
      styles={{ body: { paddingTop: 0 } }}
    >
      <motion.div variants={pageShellItemVariants} initial="initial" animate="animate" transition={shellTransition}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBlock: 16 }}>
          <Avatar
            size={56}
            src={isPrivacyMode ? undefined : teacher.photo_url || undefined}
            style={{
              background: token.colorPrimaryBg,
              color: token.colorPrimaryTextActive,
              fontWeight: 700,
              fontSize: 20,
              flexShrink: 0,
            }}
          >
            {isPrivacyMode ? '*' : teacher.name.charAt(0).toUpperCase()}
          </Avatar>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{teacher.name}</div>
            <Space size={6} style={{ marginTop: 4 }} wrap>
              <StatusTag color={STATUS_COLOR[teacher.status]}>
                {TEACHER_STATUS_LABEL[teacher.status]}
              </StatusTag>
              {teacher.type && <Tag>{TEACHER_TYPE_LABEL[teacher.type]}</Tag>}
              {teacher.subject && <Tag>{teacher.subject}</Tag>}
              {teacher.gender && <Tag>{teacher.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</Tag>}
            </Space>
          </div>
        </div>

        <Tabs
          size="small"
          items={[
            { key: 'info', label: 'Info', icon: <IdcardOutlined />, children: infoContent },
            { key: 'teaching', label: 'Mengajar', icon: <BookOutlined />, children: teachingContent },
            {
              key: 'attendance',
              label: (
                <Badge size="small" count={monthRows.length} offset={[6, 0]} color={token.colorTextQuaternary}>
                  Presensi
                </Badge>
              ),
              children: attendanceContent,
            },
            {
              key: 'audit',
              label: (
                <Badge size="small" count={auditLogs.length} offset={[6, 0]} color={token.colorTextQuaternary}>
                  Audit
                </Badge>
              ),
              children: auditContent,
            },
          ]}
        />

        <div style={{ marginTop: 16, display: 'flex', gap: 16 }}>
          {onEdit && (
            <Button
              type="link"
              style={{ padding: 0 }}
              onClick={() => {
                onClose()
                onEdit(teacher)
              }}
            >
              Edit data guru
            </Button>
          )}
        </div>
      </motion.div>

      <AssignModal
        open={assignOpen}
        teacher={teacher}
        academicYear={activeYearQuery.data}
        onClose={() => setAssignOpen(false)}
      />
    </Drawer>
  )
}
