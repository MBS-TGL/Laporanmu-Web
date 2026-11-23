// Edge Function: ai-proxy
// Proxy LLM (Groq) agar API key TIDAK pernah masuk bundle browser.
// Pola auth sama dengan wa-broadcast: JWT user -> cek role staff -> panggil provider.
//
// Deploy:
//   supabase secrets set GROQ_API_KEY=gsk_...
//   supabase functions deploy ai-proxy

import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const DEFAULT_MODEL = 'openai/gpt-oss-120b'
const STAFF_ROLES = new Set(['developer', 'admin', 'manager', 'teacher'])
const MAX_PROMPT_CHARS = 40_000
const MAX_OUTPUT_TOKENS = 8192

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface Body {
  system?: string
  prompt?: string
  history?: ChatMessage[]
  maxOutputTokens?: number
  model?: string
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const apiKey = Deno.env.get('GROQ_API_KEY')
  if (!apiKey) {
    return json({ error: 'Layanan AI belum dikonfigurasi (GROQ_API_KEY kosong).' }, 503)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  )
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return json({ error: 'Sesi berakhir, login ulang.' }, 401)

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || !STAFF_ROLES.has(profile.role as string)) {
    return json({ error: 'Tidak punya akses AI.' }, 403)
  }

  let body: Body
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Format request tidak valid.' }, 400)
  }

  const system = String(body.system ?? '').slice(0, MAX_PROMPT_CHARS)
  const prompt = String(body.prompt ?? '').slice(0, MAX_PROMPT_CHARS)
  if (!system || !prompt) {
    return json({ error: 'system dan prompt wajib diisi.' }, 400)
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    ...(body.history ?? [])
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) })),
    { role: 'user', content: prompt },
  ]

  const maxTokens = Math.min(
    Math.max(Number(body.maxOutputTokens ?? 512), 64),
    MAX_OUTPUT_TOKENS,
  )

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: body.model || DEFAULT_MODEL,
      messages,
      temperature: 0.4,
      max_tokens: maxTokens,
    }),
  })

  if (!response.ok) {
    let detail = ''
    try {
      const err = await response.json()
      detail = err?.error?.message ?? ''
    } catch {
      /* body bukan JSON */
    }
    if (response.status === 429) {
      return json(
        { error: 'Layanan AI sedang membatasi permintaan (kuota). Coba lagi beberapa menit.' },
        429,
      )
    }
    return json(
      { error: `Layanan AI gagal (kode ${response.status})${detail ? `: ${detail}` : ''}` },
      502,
    )
  }

  const data = await response.json().catch(() => null)
  const text: string = data?.choices?.[0]?.message?.content ?? ''
  if (!text) {
    return json(
      { error: 'Layanan AI tidak mengembalikan jawaban. Coba lagi.' },
      502,
    )
  }

  return json({ text })
})
