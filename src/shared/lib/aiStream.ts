import { supabase, supabaseAnonKey, supabaseUrl } from '../../lib/supabase'
import {
  AI_AUTH_MESSAGE,
  AI_EMPTY_MESSAGE,
  AI_INVALID_MESSAGE,
  AI_NETWORK_MESSAGE,
  AI_QUOTA_MESSAGE,
  AI_SERVER_MESSAGE,
  type AiChatMessage,
  type AiErrorCode,
} from './ai'

export interface StreamAiOptions {
  context?: string
  history?: AiChatMessage[]
  signal?: AbortSignal
  onToken: (token: string) => void
}

export type StreamAiResult =
  | { ok: true; text: string; aborted: boolean }
  | { ok: false; code: AiErrorCode; message: string }

export interface SseChunk {
  tokens: string[]
  done: boolean
  error: string | null
}

export interface SseDecoder {
  push(chunk: string): SseChunk
  flush(): SseChunk
}

interface SseEvent {
  token?: string
  done?: boolean
  error?: string
}

function emptyChunk(): SseChunk {
  return { tokens: [], done: false, error: null }
}

export function createSseDecoder(): SseDecoder {
  let buffer = ''

  const parseEvent = (event: string): SseEvent => {
    const data = event
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n')
      .trim()
    if (!data) return {}
    if (data === '[DONE]') return { done: true }

    let parsed: unknown
    try {
      parsed = JSON.parse(data)
    } catch {
      return {}
    }

    const payload = parsed as {
      error?: { message?: string } | string
      choices?: Array<{ delta?: { content?: string } }>
    }
    if (payload.error) {
      return {
        error: typeof payload.error === 'string' ? payload.error : (payload.error.message ?? ''),
        done: true,
      }
    }

    const token = payload.choices?.[0]?.delta?.content
    return typeof token === 'string' && token ? { token } : {}
  }

  const consume = (events: string[]): SseChunk => {
    const result = emptyChunk()
    for (const event of events) {
      const parsed = parseEvent(event)
      if (parsed.token) result.tokens.push(parsed.token)
      if (parsed.error) {
        result.error = parsed.error
        result.done = true
        break
      }
      if (parsed.done) {
        result.done = true
        break
      }
    }
    return result
  }

  return {
    push(chunk: string) {
      buffer += chunk
      const events = buffer.split(/\r?\n\r?\n/)
      buffer = events.pop() ?? ''
      return consume(events)
    },
    flush() {
      if (!buffer.trim()) return emptyChunk()
      const event = buffer
      buffer = ''
      return consume([event])
    },
  }
}

async function getAccessToken(): Promise<string> {
  try {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? ''
  } catch {
    return ''
  }
}

function errorForStatus(status: number, detail: string): { code: AiErrorCode; message: string } {
  if (status === 401 || status === 403) {
    return { code: 'auth', message: detail || AI_AUTH_MESSAGE }
  }
  if (status === 429) {
    return { code: 'quota', message: detail || AI_QUOTA_MESSAGE }
  }
  if (status === 400) {
    return { code: 'invalid', message: detail || AI_INVALID_MESSAGE }
  }
  return { code: 'server', message: detail || AI_SERVER_MESSAGE }
}

function applyChunk(
  chunk: SseChunk,
  onToken: (token: string) => void,
): { done: boolean; error: string | null } {
  for (const token of chunk.tokens) onToken(token)
  return { done: chunk.done, error: chunk.error }
}

export async function streamAi(
  prompt: string,
  options: StreamAiOptions,
): Promise<StreamAiResult> {
  const text = prompt.trim()
  if (!text) return { ok: false, code: 'invalid', message: AI_INVALID_MESSAGE }

  const accessToken = await getAccessToken()
  if (!accessToken) return { ok: false, code: 'auth', message: AI_AUTH_MESSAGE }

  let response: Response
  try {
    response = await fetch(`${supabaseUrl}/functions/v1/ai-proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        mode: 'chat',
        prompt: text,
        input: text,
        context: options.context,
        history: options.history ?? [],
        stream: true,
      }),
      signal: options.signal,
    })
  } catch {
    if (options.signal?.aborted) return { ok: true, text: '', aborted: true }
    return { ok: false, code: 'network', message: AI_NETWORK_MESSAGE }
  }

  if (!response.ok) {
    let detail = ''
    try {
      const body = (await response.json()) as { error?: string }
      detail = body.error ?? ''
    } catch {
      /* body bukan JSON */
    }
    return { ok: false, ...errorForStatus(response.status, detail) }
  }

  if (!response.body) return { ok: false, code: 'server', message: AI_SERVER_MESSAGE }

  const reader = response.body.getReader()
  const textDecoder = new TextDecoder()
  const sse = createSseDecoder()
  let answer = ''
  let streamError: string | null = null
  let finished = false

  try {
    while (!finished) {
      const { value, done } = await reader.read()
      if (done) break
      const chunk = sse.push(textDecoder.decode(value, { stream: true }))
      answer += chunk.tokens.join('')
      const applied = applyChunk(chunk, options.onToken)
      if (applied.error) streamError = applied.error
      if (applied.done) finished = true
    }

    if (!finished) {
      const tail = textDecoder.decode()
      if (tail) {
        const tailChunk = sse.push(tail)
        answer += tailChunk.tokens.join('')
        const tailApplied = applyChunk(tailChunk, options.onToken)
        if (tailApplied.error) streamError = tailApplied.error
        if (tailApplied.done) finished = true
      }
    }

    if (!finished) {
      const flushed = sse.flush()
      answer += flushed.tokens.join('')
      const applied = applyChunk(flushed, options.onToken)
      if (applied.error) streamError = applied.error
    }
  } catch {
    if (options.signal?.aborted) return { ok: true, text: answer, aborted: true }
    return { ok: false, code: 'network', message: AI_NETWORK_MESSAGE }
  } finally {
    try {
      reader.releaseLock()
    } catch {
      /* reader sudah dilepas */
    }
  }

  if (streamError) return { ok: false, code: 'server', message: streamError }
  if (!answer.trim()) return { ok: false, code: 'empty', message: AI_EMPTY_MESSAGE }
  return { ok: true, text: answer, aborted: false }
}
