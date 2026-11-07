// Edge Function: wa-broadcast
// Proxy ke API Fonnte (api.fonnte.com) — WAJIB karena API Fonnte tidak
// mengirim header CORS (dipanggilan langsung dari browser diblokir) dan
// token device tidak boleh pernah sampai ke browser.
//
// Alur: JWT user → cek role staff → baca token dari wa_settings (service
// role) → POST api.fonnte.com/send (pesan kustom per-penerima via `data`).
//
// Deploy:
//   supabase functions deploy wa-broadcast
// (env SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
//  otomatis tersedia di runtime Supabase)

import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/** Role yang boleh mengirim broadcast — setara canWrite di frontend */
const SEND_ROLES = new Set(['developer', 'admin', 'pengurus'])
/** Batas aman penerima per request */
const MAX_RECIPIENTS = 500

interface Recipient {
  target: string
  message: string
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // ---- Auth: JWT user dari header Authorization ----
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  )
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return json({ ok: false, reason: 'Sesi berakhir — login ulang' }, 401)
  }

  // ---- Gate role ----
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || !SEND_ROLES.has(profile.role as string)) {
    return json({ ok: false, reason: 'Tidak punya akses mengirim broadcast' }, 403)
  }

  // ---- Validasi body ----
  let body: { recipients?: Recipient[] }
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, reason: 'Format request tidak valid' }, 400)
  }
  const recipients = (body.recipients ?? []).filter(
    (r) => typeof r.target === 'string' && r.target.trim() && typeof r.message === 'string',
  )
  if (recipients.length === 0) {
    return json({ ok: false, reason: 'Tidak ada penerima dengan nomor telepon' })
  }
  if (recipients.length > MAX_RECIPIENTS) {
    return json({ ok: false, reason: `Maksimal ${MAX_RECIPIENTS} penerima per pengiriman` })
  }

  // ---- Token Fonnte dari wa_settings (service role — RLS dilewati) ----
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
  const { data: settings } = await admin
    .from('wa_settings')
    .select('fonnte_token')
    .eq('id', true)
    .single()
  const token = settings?.fonnte_token
  if (!token) {
    return json({ ok: false, reason: 'Token Fonnte belum diatur' })
  }

  // ---- Kirim ke Fonnte — delay acak 5-10 detik antar pesan ----
  const payload = new URLSearchParams()
  payload.set(
    'data',
    JSON.stringify(
      recipients.map((r) => ({
        target: r.target.trim(),
        message: r.message,
        delay: '5-10',
      })),
    ),
  )

  const fonnteRes = await fetch('https://api.fonnte.com/send', {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: payload.toString(),
  })
  const fonnteData = await fonnteRes.json().catch(() => null)

  if (!fonnteData || fonnteData.status !== true) {
    return json({
      ok: false,
      reason:
        fonnteData?.reason ??
        `Gagal menghubungi Fonnte (HTTP ${fonnteRes.status}) — device mungkin disconnected`,
    })
  }

  return json({
    ok: true,
    detail: fonnteData.detail ?? 'success',
    sent: recipients.length,
  })
})
