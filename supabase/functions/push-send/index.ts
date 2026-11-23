// Edge Function: push-send
// Pengirim web push ke santri (portal /portal, tabel push_subscriptions).
// Pemicu: staff (developer/admin, JWT authenticated) memanggil dengan payload.
// Auto-fire dari modul lain (pengumuman/SPP/rapor) menyusul — panggilan
// tinggal mengirim studentIds yang sama.
//
// Setup sekali (terminal):
//   npx web-push generate-vapid-keys
//   → private key  : supabase secrets set VAPID_PRIVATE_KEY=...
//   → subject      : supabase secrets set VAPID_SUBJECT=mailto:admin@sekolah.sch.id
//   → public key   : app_settings key 'push.vapid_public' (value: {"public": "..."})
//
// Deploy: supabase functions deploy push-send

import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

  // ---- Auth: JWT staff → cek role developer|admin ----
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
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile || !['developer', 'admin', 'manager'].includes(profile.role)) {
    return json({ ok: false, reason: 'Hanya developer, admin, atau manager yang boleh mengirim push' }, 403)
  }

  // ---- Konfigurasi VAPID dari secrets ----
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  const subject = Deno.env.get('VAPID_SUBJECT')
  if (!privateKey || !subject) {
    return json({ ok: false, reason: 'VAPID belum dikonfigurasi (VAPID_PRIVATE_KEY / VAPID_SUBJECT)' }, 500)
  }
  webpush.setVapidDetails(subject, Deno.env.get('VAPID_PUBLIC_KEY') ?? '', privateKey)

  // ---- Body: { studentIds?: string[], title, body, url?, kind? } ----
  let payload: { studentIds?: string[]; title?: string; body?: string; url?: string; kind?: string }
  try {
    payload = await req.json()
  } catch {
    return json({ ok: false, reason: 'Body JSON tidak valid' }, 400)
  }
  const title = (payload.title ?? '').trim()
  const body = (payload.body ?? '').trim()
  if (!title || !body) {
    return json({ ok: false, reason: 'title dan body wajib diisi' }, 400)
  }
  const kind = ['announcement', 'spp', 'report', 'general'].includes(payload.kind ?? '')
    ? (payload.kind as string)
    : 'general'
  const url = payload.url ?? '/portal'
  const notification = JSON.stringify({ title, body, url })

  // ---- Kumpulkan subscription (service client) ----
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
  let query = admin.from('push_subscriptions').select('id, endpoint, keys, student_id')
  if (payload.studentIds && payload.studentIds.length > 0) {
    query = query.in('student_id', payload.studentIds)
  }
  const { data: subs, error } = await query
  if (error) {
    return json({ ok: false, reason: error.message }, 500)
  }

  // ---- Tulis kotak masuk server-side (portal_notifications) ----
  // Ditulis sekali per santri penerima, tidak peduli push perangkat
  // berhasil atau ditolak. Kegagalan insert tidak boleh menggagalkan push.
  const recipients = Array.from(
    new Set((subs ?? []).map((s) => s.student_id).filter((id): id is string => Boolean(id))),
  )
  if (recipients.length > 0) {
    const rows = recipients.map((studentId) => ({
      student_id: studentId,
      title,
      body,
      url,
      kind,
    }))
    const { error: inboxError } = await admin.from('portal_notifications').insert(rows)
    if (inboxError) {
      console.error('[push-send] gagal menulis portal_notifications:', inboxError.message)
    }
  }

  const staleIds: string[] = []
  let sent = 0
  for (const sub of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        notification,
      )
      sent += 1
      await admin.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).eq('id', sub.id)
    } catch (err) {
      // Endpoint mati (unsubscribe / expired) → hapus
      const statusCode = (err as { statusCode?: number }).statusCode
      if (statusCode === 404 || statusCode === 410) {
        staleIds.push(sub.id)
      }
    }
  }
  for (const id of staleIds) {
    await admin.from('push_subscriptions').delete().eq('id', id)
  }

  return json({ ok: true, sent, total: subs?.length ?? 0, removed: staleIds.length })
})
