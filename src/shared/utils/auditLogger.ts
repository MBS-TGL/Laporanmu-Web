import { supabase } from '../../lib/supabase'

export type AuditAction =
  | 'INSERT'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'EXPORT'
  | 'SYNC'

export type AuditSource = 'SYSTEM' | 'OPERATIONAL' | 'MASTER' | 'SECURITY' | 'AUTH'

const SENSITIVE_KEYS = ['password', 'pin', 'password_hash', 'token', 'secret']

function sanitize(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== 'object') return null
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.includes(key.toLowerCase())) {
      out[key] = '***'
    } else if (value !== undefined) {
      out[key] = value
    }
  }
  return out
}

let cachedIp: string | null = null

async function getIp(): Promise<string | null> {
  if (cachedIp) return cachedIp
  try {
    const res = await fetch('https://api64.ipify.org?format=json')
    const json = (await res.json()) as { ip?: string }
    cachedIp = json.ip ?? null
  } catch {
    cachedIp = null
  }
  return cachedIp
}

export interface AuditEntry {
  action: AuditAction
  source?: AuditSource
  tableName: string
  recordId?: string | null
  oldData?: unknown
  newData?: unknown
}

// Fire-and-forget: kegagalan audit tidak boleh menggagalkan aksi utama.
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const [ip, profileRow] = await Promise.all([
      getIp(),
      supabase.from('profiles').select('name, role').eq('id', user.id).single(),
    ])

    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: entry.action,
      source: entry.source ?? 'SYSTEM',
      table_name: entry.tableName,
      record_id: entry.recordId ?? null,
      old_data: sanitize(entry.oldData),
      new_data: sanitize(entry.newData),
      actor_name: (profileRow.data as { name?: string } | null)?.name ?? null,
      actor_role: (profileRow.data as { role?: string } | null)?.role ?? null,
      ip_address: ip,
      user_agent: navigator.userAgent,
      url: window.location.href,
    })
  } catch {
    // sengaja diam — audit tidak pernah me-rethrow
  }
}
