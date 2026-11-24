import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

export const MODEL = 'openai/gpt-oss-120b'
export const CHAT_MODEL = 'openai/gpt-oss-20b'

export type AiMode = 'chat' | 'cbt' | 'counseling' | 'health' | 'insights' | 'rapor'

export type AiErrorCode =
  | 'aborted'
  | 'auth'
  | 'empty'
  | 'invalid'
  | 'network'
  | 'quota'
  | 'server'

export type AiResult =
  | { ok: true; text: string }
  | { ok: false; code: AiErrorCode; message: string }

export interface AiChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface CallAiOptions {
  system?: string
  prompt: string
  mode?: AiMode
  history?: AiChatMessage[]
  maxOutputTokens?: number
  context?: string
  signal?: AbortSignal
}

export const AI_NETWORK_MESSAGE = 'Tidak bisa terhubung ke layanan AI. Periksa koneksi internet kamu.'
export const AI_SERVER_MESSAGE = 'Maaf, layanan AI tidak dapat diakses. Coba lagi sebentar.'
export const AI_EMPTY_MESSAGE = 'Maaf, saya belum menemukan jawabannya. Coba tanyakan dengan kalimat lain.'
export const AI_AUTH_MESSAGE = 'Sesi AI tidak valid. Login ulang lalu coba lagi.'
export const AI_QUOTA_MESSAGE = 'Kuota AI sedang penuh. Coba lagi beberapa menit.'
export const AI_INVALID_MESSAGE = 'Permintaan AI tidak valid.'

export function estimateTokens(...parts: (string | undefined)[]): number {
  const chars = parts.reduce((sum, part) => sum + (part?.length ?? 0), 0)
  return Math.ceil(chars / 4)
}

async function mapInvokeError(error: unknown): Promise<{ code: AiErrorCode; message: string }> {
  let status = 0
  let detail = ''

  if (error instanceof FunctionsHttpError && error.context instanceof Response) {
    status = error.context.status
    try {
      const body = (await error.context.json()) as { error?: string }
      detail = body.error ?? ''
    } catch {
      /* body bukan JSON */
    }
  }

  const message = error instanceof Error ? error.message : ''
  if (/abort/i.test(message)) {
    return { code: 'aborted', message: 'Permintaan AI dibatalkan.' }
  }
  if (/failed to send|network|fetch/i.test(message)) {
    return { code: 'network', message: AI_NETWORK_MESSAGE }
  }
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

async function invokeAi(options: CallAiOptions): Promise<AiResult> {
  const body = {
    mode: options.mode,
    system: options.system,
    prompt: options.prompt,
    input: options.prompt,
    context: options.context,
    history: options.history ?? [],
    maxOutputTokens: options.maxOutputTokens,
  }

  try {
    const { data, error } = await supabase.functions.invoke('ai-proxy', {
      body,
      signal: options.signal,
    })

    if (error) {
      return { ok: false, ...(await mapInvokeError(error)) }
    }

    const text = (data as { text?: string } | null)?.text?.trim() ?? ''
    if (!text) {
      return { ok: false, code: 'empty', message: AI_EMPTY_MESSAGE }
    }

    return { ok: true, text }
  } catch (error) {
    return { ok: false, ...(await mapInvokeError(error)) }
  }
}

/** Pemanggilan AI generik untuk modul (CBT, konseling, health, insights, rapor). */
export async function callAi(options: CallAiOptions): Promise<string> {
  const result = await invokeAi(options)
  return result.ok ? result.text : result.message
}

/** Chat asisten: hasil terstruktur agar error tidak tampil sebagai jawaban. */
export async function askAi(
  prompt: string,
  options: { history?: AiChatMessage[]; context?: string; signal?: AbortSignal } = {},
): Promise<AiResult> {
  return invokeAi({
    mode: 'chat',
    prompt,
    history: options.history,
    context: options.context,
    signal: options.signal,
  })
}
