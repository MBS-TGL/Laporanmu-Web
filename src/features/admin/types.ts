export interface AdminProfile {
  id: string
  email: string
  name: string
  role: string
  phone: string | null
  created_at?: string
}

export interface AuditLog {
  id: string
  user_id: string | null
  action: string
  source: string
  table_name: string | null
  record_id: string | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  actor_name: string | null
  actor_role: string | null
  ip_address: string | null
  user_agent: string | null
  url: string | null
  created_at: string
}
