export type GateDirection = 'exit' | 'entry'

export interface GateLog {
  id: string
  student_id: string
  direction: GateDirection
  occurred_at: string
  recorded_by: string | null
  note: string | null
  created_at?: string
  student?: {
    id: string
    name: string
    registration_code: string
    classes?: { name: string } | null
  } | null
  recorder?: { name: string } | null
}

export interface GateLogFilters {
  search?: string
  direction?: GateDirection
  from?: string
  to?: string
  page: number
  pageSize: number
}

/** Siswa versi ringkas untuk resolusi cepat (scan / kode manual / impor) */
export interface GateStudentLite {
  id: string
  name: string
  registration_code: string
  nisn: string | null
  class_name: string | null
}

/** Santri yang arah terakhirnya hari ini "keluar" (belum masuk lagi) */
export interface GateOutsideStudent {
  student_id: string
  name: string
  registration_code: string
  class_name: string | null
  last_exit_at: string
}

export interface GateTodayStats {
  entryCount: number
  exitCount: number
  outside: GateOutsideStudent[]
  logCount: number
}

/** Baris untuk bulk insert (impor file) */
export interface GateLogInsertRow {
  student_id: string
  direction: GateDirection
  occurred_at: string
  note?: string | null
}

export interface BulkInsertResult {
  ok: number
  failed: number
  errors: { row_index: number; error: string }[]
}
