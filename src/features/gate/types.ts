export type GateDirection = 'exit' | 'entry'

export interface GateLog {
  id: string
  student_id: string
  direction: GateDirection
  occurred_at: string
  recorded_by: string | null
  note: string | null
  created_at?: string
  student?: { name: string; registration_code: string } | null
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
