// Edge Function: ppdb-webhook
// Penerima pendaftar PPDB dari formulir publik web sekolah.
//
// Alur: header x-api-key → sha256 → lookup api_keys (belum dicabut)
// → rate limit per key (30 req/menit via api_request_log)
// → RPC ppdb_admission_upsert (dedupe registration_number aktif)
// → catat pemakaian (last_used_at + api_request_log).
//
// Deploy:
//   supabase functions deploy ppdb-webhook
// Env SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY tersedia otomatis.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
}

const RATE_LIMIT_PER_MINUTE = 30

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Service client: melewati RLS untuk log + upsert admissions
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // ---- Validasi API key ----
  const apiKey = req.headers.get('x-api-key') ?? ''
  if (!apiKey) {
    return json({ ok: false, reason: 'Header x-api-key wajib diisi' }, 401)
  }
  const keyHash = await sha256Hex(apiKey)
  const { data: keyRow, error: keyError } = await admin
    .from('api_keys')
    .select('id, name, revoked_at')
    .eq('key_hash', keyHash)
    .maybeSingle()
  if (keyError || !keyRow || keyRow.revoked_at) {
    return json({ ok: false, reason: 'API key tidak valid atau sudah dicabut' }, 401)
  }
  const keyId = keyRow.id as string

  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null

  // ---- Rate limit: hitung request key ini dalam 60 detik terakhir ----
  const { count } = await admin
    .from('api_request_log')
    .select('id', { count: 'exact', head: true })
    .eq('key_id', keyId)
    .gte('created_at', new Date(Date.now() - 60_000).toISOString())
  if ((count ?? 0) >= RATE_LIMIT_PER_MINUTE) {
    return json({ ok: false, reason: 'Batas 30 request per menit terlampaui' }, 429)
  }

  // ---- Body: satu objek atau array pendaftar (impor massal) ----
  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return json({ ok: false, reason: 'Body JSON tidak valid' }, 400)
  }
  const items: unknown[] = Array.isArray(payload) ? payload : [payload]
  if (items.length === 0 || items.length > 100) {
    return json({ ok: false, reason: 'Kirim 1-100 pendaftar per request' }, 400)
  }

  // ---- Upsert dedupe via RPC ----
  const results: Array<{ registration_number: string; ok: boolean; duplicated?: boolean; id?: string; stage?: string; reason?: string }> = []
  for (const item of items) {
    const registrationNumber = (item as { registration_number?: string })?.registration_number ?? ''
    const { data, error } = await admin.rpc('ppdb_admission_upsert', { p_payload: item })
    if (error) {
      results.push({ registration_number: registrationNumber, ok: false, reason: error.message })
    } else {
      results.push({ registration_number: registrationNumber, ok: true, ...(data as object) })
    }
  }

  const failed = results.filter((r) => !r.ok).length
  const status = failed === results.length ? 400 : failed > 0 ? 207 : 200

  // ---- Catat pemakaian (best effort) ----
  await admin.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', keyId)
  await admin.from('api_request_log').insert({
    key_id: keyId,
    path: '/ppdb-webhook',
    status,
    source_ip: clientIp,
  })

  return json({ ok: failed === 0, results }, status)
})
