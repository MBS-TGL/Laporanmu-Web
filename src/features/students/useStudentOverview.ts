import { useQuery } from '@tanstack/react-query'
import { fetchReportsByStudent } from '../behavior/api'
import { fetchGateLogsByStudent } from '../gate/api'
import { fetchAuditLogs } from '../admin/api'
import { fetchMonthlyRowsByStudent } from '../report-cards/api'

interface OverviewOptions {
  enabled: boolean
  reports?: boolean
  reportCard?: boolean
  gate?: boolean
  audit?: boolean
}

/**
 * Ringkasan lintas-modul untuk drawer detail siswa: catatan poin (behavior),
 * raport bulanan, log gerbang, dan audit log. SATU sumber untuk semua
 * pemakai — jangan fetch lintas-feature manual lagi (lihat SKILLS.md §Skill 6).
 */
export function useStudentOverview(studentId: string | undefined, options: OverviewOptions) {
  const { enabled, reports = true, reportCard = true, gate = true, audit = true } = options

  const reportsQuery = useQuery({
    queryKey: ['behavior-reports', 'student', studentId],
    queryFn: () => fetchReportsByStudent(studentId!, 100),
    enabled: enabled && reports && !!studentId,
  })

  const reportCardQuery = useQuery({
    queryKey: ['raport-monthly', 'student', studentId],
    queryFn: () => fetchMonthlyRowsByStudent(studentId!),
    enabled: enabled && reportCard && !!studentId,
  })

  const gateQuery = useQuery({
    queryKey: ['gate-logs', 'student', studentId],
    queryFn: () => fetchGateLogsByStudent(studentId!, 20),
    enabled: enabled && gate && !!studentId,
  })

  const auditQuery = useQuery({
    queryKey: ['audit-logs', 'student', studentId],
    queryFn: () =>
      fetchAuditLogs({ tableName: 'students', recordId: studentId!, page: 1, pageSize: 50 }),
    enabled: enabled && audit && !!studentId,
  })

  return { reportsQuery, reportCardQuery, gateQuery, auditQuery }
}
