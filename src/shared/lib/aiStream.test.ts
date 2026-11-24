import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSseDecoder, streamAi } from './aiStream'

const mocks = vi.hoisted(() => ({ getSession: vi.fn() }))

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: mocks.getSession } },
  supabaseUrl: 'https://example.supabase.co',
  supabaseAnonKey: 'anon-key',
}))

function delta(content: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`
}

function sseResponse(parts: string[]): Response {
  const encoder = new TextEncoder()
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const part of parts) controller.enqueue(encoder.encode(part))
        controller.close()
      },
    }),
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
  )
}

describe('createSseDecoder', () => {
  it('merangkai event yang terbelah antar chunk', () => {
    const decoder = createSseDecoder()
    expect(decoder.push('data: {"choices":[{"delta":{"content":"Halo')).toEqual({
      tokens: [],
      done: false,
      error: null,
    })
    expect(decoder.push(' dunia"}}]}\n\n')).toEqual({
      tokens: ['Halo dunia'],
      done: false,
      error: null,
    })
  })

  it('membaca beberapa event dalam satu chunk', () => {
    const decoder = createSseDecoder()
    expect(decoder.push(`${delta('Satu')}${delta('Dua')}`).tokens).toEqual(['Satu', 'Dua'])
  })

  it('mengenali penanda selesai', () => {
    const decoder = createSseDecoder()
    expect(decoder.push('data: [DONE]\n\n')).toEqual({
      tokens: [],
      done: true,
      error: null,
    })
  })

  it('mengabaikan data yang bukan JSON', () => {
    const decoder = createSseDecoder()
    expect(decoder.push('data: bukan-json\n\n')).toEqual({
      tokens: [],
      done: false,
      error: null,
    })
  })

  it('meneruskan error dari stream', () => {
    const decoder = createSseDecoder()
    expect(decoder.push('data: {"error":{"message":"gagal"}}\n\n')).toEqual({
      tokens: [],
      done: true,
      error: 'gagal',
    })
  })

  it('mengeluarkan event terakhir lewat flush', () => {
    const decoder = createSseDecoder()
    expect(decoder.push('data: {"choices":[{"delta":{"content":"akhir"}}]}')).toEqual({
      tokens: [],
      done: false,
      error: null,
    })
    expect(decoder.flush()).toEqual({
      tokens: ['akhir'],
      done: false,
      error: null,
    })
  })
})

describe('streamAi', () => {
  beforeEach(() => {
    mocks.getSession.mockReset()
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: 'token' } } })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('mengirim permintaan stream dan mengumpulkan token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse([delta('Halo'), delta(' dunia'), 'data: [DONE]\n\n']),
    )
    vi.stubGlobal('fetch', fetchMock)

    const tokens: string[] = []
    const result = await streamAi('Halo', { onToken: (token) => tokens.push(token) })

    expect(result).toEqual({ ok: true, text: 'Halo dunia', aborted: false })
    expect(tokens).toEqual(['Halo', ' dunia'])

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://example.supabase.co/functions/v1/ai-proxy')
    expect(init).toMatchObject({
      method: 'POST',
      headers: expect.objectContaining({
        Accept: 'text/event-stream',
        Authorization: 'Bearer token',
        apikey: 'anon-key',
      }),
    })
    expect(JSON.parse(String(init.body))).toMatchObject({
      mode: 'chat',
      prompt: 'Halo',
      input: 'Halo',
      stream: true,
    })
  })

  it('menolak permintaan tanpa sesi', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    expect(await streamAi('Halo', { onToken: vi.fn() })).toMatchObject({
      ok: false,
      code: 'auth',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('memetakan status 429 ke kode kuota', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Kuota AI habis' }), { status: 429 }),
      ),
    )

    expect(await streamAi('Halo', { onToken: vi.fn() })).toEqual({
      ok: false,
      code: 'quota',
      message: 'Kuota AI habis',
    })
  })
})
