import { useQuery } from '@tanstack/react-query'
import { fetchReportsByStudent } from '../behavior/api'
import { fetchGateLogsByStudent } from '../gate/api'
import { fetchAuditLogs } from '../admin/api'
import { fetchMonthlyRowsByStudent } from '../report-cards/api'

/**
 * Ringkasan lintas-modul untuk drawer detail siswa: catatan poin (behavior),
 * raport bulanan, log gerbang, dan audit log. SATU sumber untuk semua
 * pemakai — jangan fetch lintas-feature manual lagi (lihat SKILLS.md §Skill 6).
 */
export function useStudentOverview(studentId: string | undefined, enabled: boolean) {
  const reportsQuery = useQuery({
    queryKey: ['behavior-reports', 'student', studentId],
    queryFn: () => fetchReportsByStudent(studentId!, 100),
    enabled: enabled && !!studentId,
  })

  const reportCardQuery = useQuery({
    queryKey: ['raport-monthly', 'student', studentId],
    queryFn: () => fetchMonthlyRowsByStudent(studentId!),
    enabled: enabled && !!studentId,
  })

  const gateQuery = useQuery({
    queryKey: ['gate-logs', 'student', studentId],
    queryFn: () => fetchGateLogsByStudent(studentId!, 20),
    enabled: enabled && !!studentId,
  })

  const auditQuery = useQuery({
    queryKey: ['audit-logs', 'student', studentId],
    queryFn: () => fetchAuditLogs({ tableName: 'students', recordId: studentId!, page: 1, pageSize: 50 }),
    enabled: enabled && !!studentId,
  })

  return { reportsQuery, reportCardQuery, gateQuery, auditQuery }
}
