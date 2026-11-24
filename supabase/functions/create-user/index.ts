// Edge Function: create-user
// Membuat akun auth baru untuk staff (invite). WAJIB lewat Edge Function —
// pembuatan auth user butuh service role dan TIDAK BOLEH dilakukan dari
// browser (auth.signUp client-side akan mengganti sesi admin yang sedang
// aktif; lihat MEMORY 2026-11-12 UsersPage).
//
// Alur:
//   1. Verifikasi JWT pemanggil → role developer|admin (via service-role client).
//   2. admin.createUser (email, tanpa password, metadata name).
//   3. Trigger handle_new_user membuat profil role 'pending' → update role
//      sesuai permintaan.
//   4. Bila teacherId diberikan → link teachers.profile_id ke akun baru.
//   5. Bila sendInvite → generateLink('recovery') supaya admin dapat link
//      set-password untuk dibagikan (WA/email pribadi) tanpa perlu SMTP.
//
// Deploy:
//   supabase functions deploy create-user
// (env SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
//  otomatis tersedia di runtime Supabase)

import { createClient } from 'jsr:@supabase/supabase-js@2'

const configuredOrigins = (Deno.env.get('APP_ORIGIN') ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

function corsHeaders(origin: string | null): Record<string, string> {
  const allowOrigin =
    configuredOrigins.length === 0 || configuredOrigins.includes('*')
      ? '*'
      : origin && configuredOrigins.includes(origin)
        ? origin
        : configuredOrigins[0]
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

function isOriginAllowed(origin: string | null): boolean {
  if (!origin || configuredOrigins.length === 0) return true
  if (configuredOrigins.includes('*')) return true
  return configuredOrigins.includes(origin)
}

/** Role yang boleh dipilih saat membuat akun. 'developer' hanya untuk caller developer. */
const STAFF_ROLES = new Set(['admin', 'manager', 'teacher'])

/** Nilai enum lama (pra-rename 0021) dipetakan ke nilai baru agar pemanggil lawas tetap jalan. */
const ROLE_ALIASES: Record<string, string> = { pengurus: 'manager', guru: 'teacher' }

interface CreateBody {
  email?: string
  name?: string
  role?: string
  teacherId?: string
  sendInvite?: boolean
  /** Password kustom (min 8 karakter) — bila diisi, akun langsung bisa login tanpa link */
  password?: string
}

function json(body: unknown, status = 200, origin: string | null = null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin')
  if (!isOriginAllowed(origin)) {
    return json({ error: 'Origin tidak diizinkan.' }, 403, origin)
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders(origin),
    })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Metode harus POST' }, 405, origin)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Token tidak ditemukan' }, 401, origin)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } },
  )

  // 1) Role pemanggil harus developer/admin
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) return json({ error: 'Sesi tidak valid' }, 401, origin)
  const { data: caller } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .maybeSingle()
  const callerRole = (caller?.role as string | undefined) ?? ''
  if (callerRole !== 'developer' && callerRole !== 'admin') {
    return json({ error: 'Hanya developer & admin yang boleh membuat akun' }, 403, origin)
  }

  // 2) Validasi body
  const body = (await req.json().catch(() => ({}))) as CreateBody
  const email = body.email?.trim().toLowerCase() ?? ''
  const name = body.name?.trim() ?? ''
  const role = ROLE_ALIASES[body.role?.trim() ?? ''] ?? body.role?.trim() ?? 'teacher'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Email tidak valid' }, 400, origin)
  if (!name) return json({ error: 'Nama wajib diisi' }, 400, origin)
  if (role === 'developer' && callerRole !== 'developer') {
    return json({ error: 'Hanya developer yang boleh membuat akun developer' }, 403, origin)
  }
  if (role !== 'developer' && !STAFF_ROLES.has(role)) {
    return json({ error: `Role tidak dikenal: ${role}` }, 400, origin)
  }
  const password = body.password?.trim() ?? ''
  if (password && password.length < 8) {
    return json({ error: 'Password minimal 8 karakter' }, 400, origin)
  }

  // Service role: boleh menulis auth.users & tabel apa pun (RLS dilewati)
  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  // 3) Buat auth user. Dengan password kustom → langsung bisa login
  //    (email_confirm true); tanpa password → akses dibuka lewat link set-password.
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: Boolean(password),
    user_metadata: { name },
    ...(password ? { password } : {}),
  })
  if (createError) {
    const msg = createError.message.includes('already')
      ? 'Akun dengan email ini sudah ada'
      : createError.message
    return json({ error: msg }, 400, origin)
  }
  const userId = created.user.id

  // 4) Set role profil (trigger membuatnya 'pending')
  const { error: roleError } = await admin
    .from('profiles')
    .update({ role, name })
    .eq('id', userId)
  if (roleError) return json({ error: roleError.message, userId }, 400, origin)

  // 5) Link guru bila diminta
  if (body.teacherId) {
    const { error: linkError } = await admin
      .from('teachers')
      .update({ profile_id: userId })
      .eq('id', body.teacherId)
    if (linkError) return json({ error: linkError.message, userId }, 400, origin)
  }

  // 6) Link set-password (recovery) — hanya relevan tanpa password kustom
  let actionLink: string | null = null
  if (body.sendInvite && !password) {
    const { data: link } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
    })
    actionLink = link?.properties?.action_link ?? null
  }

  return json({ userId, email, role, actionLink, passwordSet: Boolean(password) }, 200, origin)
})
