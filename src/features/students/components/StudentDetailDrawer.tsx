import { Avatar, Button, Descriptions, Drawer, Empty, List, Space, Spin, Tag, Typography } from 'antd'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { StatusTag } from '../../../shared/components/StatusTag'
import { usePermissions } from '../../../shared/hooks/useProfile'
import { fetchReportsByStudent } from '../../behavior/api'
import { fetchGateLogsByStudent } from '../../gate/api'
import { STUDENT_STATUS_META, GENDER_LABEL } from '../status'
import type { Student } from '../types'

interface StudentDetailDrawerProps {
  open: boolean
  student: Student | null
  onClose: () => void
  onEdit: (student: Student) => void
  /** mode privasi: sembunyikan kode / NISN / nomor telepon */
  isPrivacyMode?: boolean
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('')
}

const MASK = '••••••'

export function StudentDetailDrawer({
  open,
  student,
  onClose,
  onEdit,
  isPrivacyMode = false,
}: StudentDetailDrawerProps) {
  const { canWrite } = usePermissions()
  const mask = (value: string | null) => (isPrivacyMode && value ? MASK : (value ?? '—'))

  const reportsQuery = useQuery({
    queryKey: ['behavior-reports', 'student', student?.id],
    queryFn: () => fetchReportsByStudent(student!.id),
    enabled: open && !!student?.id,
  })

  const gateQuery = useQuery({
    queryKey: ['gate-logs', 'student', student?.id],
    queryFn: () => fetchGateLogsByStudent(student!.id),
    enabled: open && !!student?.id,
  })

  if (!student) return null

  const statusMeta = STUDENT_STATUS_META[student.status]
  const points = student.total_points ?? 0

  return (
    <Drawer
      title="Detail Siswa"
      open={open}
      onClose={onClose}
      size="min(480px, 94vw)"
      destroyOnHidden
      styles={{ body: { scrollbarWidth: 'none' } }}
      footer={
        canWrite ? (
          <Space style={{ float: 'right' }}>
            <Button onClick={onClose}>Tutup</Button>
            <Button type="primary" onClick={() => onEdit(student)}>
              Edit Siswa
            </Button>
          </Space>
        ) : undefined
      }
    >
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
        <Avatar
          size={56}
          style={{ background: '#e0e7ff', color: '#3730a3', fontWeight: 700, fontSize: 20, flexShrink: 0 }}
        >
          {initials(student.name)}
        </Avatar>
        <div>
          <Typography.Title level={4} style={{ margin: 0, fontSize: 18, letterSpacing: '-0.02em' }}>
            {student.name}
          </Typography.Title>
          <Space size={8} style={{ marginTop: 4 }}>
            <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
              {mask(student.registration_code)}
            </Typography.Text>
            <StatusTag color={statusMeta.color} icon={statusMeta.icon}>
              {statusMeta.label}
            </StatusTag>
          </Space>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            flex: 1,
            background: points < 0 ? '#fff1f0' : '#f0fdf4',
            borderRadius: 12,
            padding: '10px 14px',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Total Poin
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: points < 0 ? '#dc2626' : '#16a34a' }}>
            {points > 0 ? `+${points}` : points}
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>Dihitung otomatis dari catatan poin</div>
        </div>
        <div style={{ flex: 1, background: '#f8fafc', borderRadius: 12, padding: '10px 14px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Kelas
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>
            {student.classes?.name ?? '—'}
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{student.dorms?.name ?? 'Tanpa asrama'}</div>
        </div>
      </div>

      <Descriptions
        column={1}
        size="small"
        colon={false}
        labelStyle={{ width: 120, color: '#64748b' }}
        style={{ marginBottom: 8 }}
      >
        <Descriptions.Item label="Gender">{student.gender ? GENDER_LABEL[student.gender] : '—'}</Descriptions.Item>
        <Descriptions.Item label="NISN">{mask(student.nisn)}</Descriptions.Item>
        <Descriptions.Item label="NIS">{mask(student.nis)}</Descriptions.Item>
        <Descriptions.Item label="TTL">
          {student.birth_place || student.birth_date
            ? [student.birth_place, student.birth_date ? dayjs(student.birth_date).format('DD MMM YYYY') : null]
                .filter(Boolean)
                .join(', ')
            : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Agama">{student.religion ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="Telepon">{mask(student.phone)}</Descriptions.Item>
        <Descriptions.Item label="Wali">
          {student.guardian_name
            ? student.guardian_relation
              ? `${student.guardian_name} (${student.guardian_relation})`
              : student.guardian_name
            : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Alamat">{student.address ?? '—'}</Descriptions.Item>
        {student.tags && student.tags.length > 0 && (
          <Descriptions.Item label="Tags">
            <Space size={4} wrap>
              {student.tags.map((tag) => (
                <Tag key={tag} style={{ borderRadius: 6 }}>
                  {tag}
                </Tag>
              ))}
            </Space>
          </Descriptions.Item>
        )}
        <Descriptions.Item label="Terdaftar">
          {student.created_at ? dayjs(student.created_at).format('DD MMM YYYY') : '—'}
        </Descriptions.Item>
      </Descriptions>

      <Typography.Text strong style={{ display: 'block', margin: '16px 0 4px' }}>
        Riwayat Poin
      </Typography.Text>
      {reportsQuery.isPending ? (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Spin />
        </div>
      ) : (reportsQuery.data ?? []).length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada catatan poin" />
      ) : (
        <List
          size="small"
          dataSource={reportsQuery.data}
          renderItem={(item) => (
            <List.Item
              actions={[
                <StatusTag key="p" color={item.points < 0 ? 'red' : 'green'}>
                  {item.points > 0 ? `+${item.points}` : item.points}
                </StatusTag>,
              ]}
            >
              <List.Item.Meta
                title={item.rule?.name ?? '-'}
                description={
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {dayjs(item.reported_at).format('DD MMM YYYY HH:mm')}
                    {item.reporter?.name ? ` · ${item.reporter.name}` : ''}
                  </Typography.Text>
                }
              />
            </List.Item>
          )}
        />
      )}

      <Typography.Text strong style={{ display: 'block', margin: '16px 0 4px' }}>
        Aktivitas Gerbang
      </Typography.Text>
      {gateQuery.isPending ? (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Spin />
        </div>
      ) : (gateQuery.data ?? []).length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada aktivitas gerbang" />
      ) : (
        <List
          size="small"
          dataSource={gateQuery.data}
          renderItem={(item) => (
            <List.Item
              actions={[
                item.direction === 'keluar' ? (
                  <StatusTag key="d" color="orange">Keluar</StatusTag>
                ) : (
                  <StatusTag key="d" color="green">Masuk</StatusTag>
                ),
              ]}
            >
              <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
                {dayjs(item.occurred_at).format('DD MMM YYYY HH:mm')}
              </Typography.Text>
            </List.Item>
          )}
        />
      )}
    </Drawer>
  )
}
