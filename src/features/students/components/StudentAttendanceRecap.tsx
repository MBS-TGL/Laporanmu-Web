import { useQuery } from '@tanstack/react-query'
import { Card, Empty, Spin, Tag, Typography } from 'antd'
import dayjs from 'dayjs'
import { CalendarOutlined } from '@ant-design/icons'
import { supabase } from '../../../lib/supabase'
import { summarizeDays } from '../../attendance/api'
import type { AttendanceDays } from '../../attendance/types'

async function fetchStudentMonthAttendance(studentId: string, year: number, month: number) {
  const { data, error } = await supabase
    .from('student_attendance')
    .select('id, year, month, days')
    .eq('student_id', studentId)
    .eq('year', year)
    .eq('month', month)
    .maybeSingle()

  if (error) throw error
  return data as { id: string; year: number; month: number; days: AttendanceDays } | null
}

/**
 * Seksi rekap absensi harian santri (H/S/I/A/P) di DetailDrawer — tab Perilaku.
 * Mengambil ringkasan bulan berjalan via summarizeDays.
 */
export function StudentAttendanceRecap({ studentId }: { studentId: string }) {
  const now = dayjs()
  const year = now.year()
  const month = now.month() + 1

  const query = useQuery({
    queryKey: ['student-attendance', 'month-recap', studentId, year, month],
    queryFn: () => fetchStudentMonthAttendance(studentId, year, month),
    enabled: Boolean(studentId),
    staleTime: 60_000,
  })

  const days = query.data?.days ?? {}
  const summary = summarizeDays(days)
  const totalRecorded = summary.H + summary.S + summary.I + summary.A + summary.P

  return (
    <Card
      size="small"
      style={{ marginTop: 16, borderRadius: 13 }}
      styles={{ body: { padding: '12px 16px' } }}
      title={
        <Typography.Text strong style={{ fontSize: 13 }}>
          <CalendarOutlined style={{ marginInlineEnd: 6 }} />
          Kehadiran Harian · {now.format('MMMM YYYY')}
        </Typography.Text>
      }
    >
      {query.isPending ? (
        <div style={{ textAlign: 'center', padding: 16 }}>
          <Spin size="small" />
        </div>
      ) : totalRecorded === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada data kehadiran harian bulan ini" />
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <Tag color="green" style={{ borderRadius: 999 }}>Hadir: {summary.H}</Tag>
          <Tag color="gold" style={{ borderRadius: 999 }}>Sakit: {summary.S}</Tag>
          <Tag color="blue" style={{ borderRadius: 999 }}>Izin: {summary.I}</Tag>
          <Tag color="red" style={{ borderRadius: 999 }}>Alpa: {summary.A}</Tag>
          {summary.P > 0 && <Tag color="purple" style={{ borderRadius: 999 }}>Pulang: {summary.P}</Tag>}
          <Tag style={{ borderRadius: 999 }}>Total: {totalRecorded} hari</Tag>
        </div>
      )}
    </Card>
  )
}
