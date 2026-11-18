import { useQuery } from '@tanstack/react-query'
import { Card, Empty, Spin, Tag, Typography } from 'antd'
import dayjs from 'dayjs'
import { BookOutlined } from '@ant-design/icons'
import { fetchStudentSubjectRecap } from '../../attendance/api'
import { useFlag } from '../../../shared/hooks/useFeatureFlags'

/**
 * Seksi rekap absensi mapel (P2) di DetailDrawer siswa — tab Perilaku.
 * Mengambil sendiri datanya (bulan berjalan); hanya tampil bila flag
 * module.subject_attendance aktif.
 */
export function StudentSubjectRecap({ studentId }: { studentId: string }) {
  const enabled = useFlag('module.subject_attendance', true)
  const monthStart = dayjs().startOf('month').format('YYYY-MM-DD')
  const monthEnd = dayjs().endOf('month').format('YYYY-MM-DD')

  const recapQuery = useQuery({
    queryKey: ['subject-attendance', 'recap', studentId, monthStart],
    queryFn: () => fetchStudentSubjectRecap(studentId, monthStart, monthEnd),
    enabled: enabled && Boolean(studentId),
    staleTime: 60_000,
  })

  if (!enabled) return null

  const entries = recapQuery.data ?? []
  const count = (status: string) => entries.filter((e) => e.status === status).length
  const absences = entries.filter((e) => e.status !== 'H').slice(0, 10)
  const total = entries.length

  return (
    <Card
      size="small"
      style={{ marginTop: 16, borderRadius: 13 }}
      styles={{ body: { padding: '12px 16px' } }}
      title={
        <Typography.Text strong style={{ fontSize: 13 }}>
          <BookOutlined style={{ marginInlineEnd: 6 }} />
          Absensi Mapel · {dayjs().format('MMMM YYYY')}
        </Typography.Text>
      }
    >
      {recapQuery.isPending ? (
        <div style={{ textAlign: 'center', padding: 16 }}>
          <Spin />
        </div>
      ) : total === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada data absensi mapel bulan ini" />
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <Tag style={{ borderRadius: 999 }}>Hadir {count('H')}</Tag>
            <Tag color="gold" style={{ borderRadius: 999 }}>Sakit {count('S')}</Tag>
            <Tag color="blue" style={{ borderRadius: 999 }}>Izin {count('I')}</Tag>
            <Tag color="error" style={{ borderRadius: 999 }}>Alpa {count('A')}</Tag>
            <Tag style={{ borderRadius: 999 }}>Total {total} jam tercatat</Tag>
          </div>
          {absences.length > 0 && (
            <div style={{ marginTop: 10, display: 'grid', gap: 4 }}>
              {absences.map((e, i) => (
                <Typography.Text key={`${e.schedule_id}-${e.date}-${i}`} type="secondary" style={{ fontSize: 12 }}>
                  {dayjs(e.date).format('DD MMM')} · {e.subject ?? 'Tanpa mapel'} —{' '}
                  {e.status === 'S' ? 'Sakit' : e.status === 'I' ? 'Izin' : 'Alpa'}
                </Typography.Text>
              ))}
              {entries.filter((e) => e.status !== 'H').length > 10 && (
                <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>
                  …dan {entries.filter((e) => e.status !== 'H').length - 10} ketidakhadiran lainnya
                </Typography.Text>
              )}
            </div>
          )}
        </>
      )}
    </Card>
  )
}
