export type TeacherAttendanceStatus = 'hadir' | 'sakit' | 'izin' | 'tugas_luar'

export interface TeacherAttendance {
  id: string
  teacher_id: string
  date: string
  status: TeacherAttendanceStatus
  note: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  teachers?: {
    id: string
    name: string
    nbm: string | null
    subject: string | null
    phone: string | null
  } | null
}

export interface TeacherAttendancePayload {
  teacher_id: string
  date: string
  status: TeacherAttendanceStatus
  note?: string | null
}

export const TEACHER_ATTENDANCE_STATUS_META: Record<
  TeacherAttendanceStatus,
  { label: string; color: string }
> = {
  hadir: { label: 'Hadir', color: 'success' },
  sakit: { label: 'Sakit', color: 'warning' },
  izin: { label: 'Izin', color: 'processing' },
  tugas_luar: { label: 'Tugas Luar', color: 'purple' },
}

/** Target hapus baris absensi guru (pasangan guru + tanggal). */
export interface TeacherAttendanceDeleteTarget {
  teacher_id: string
  date: string
}
