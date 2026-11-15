// Helper murni modul CBT: token ujian & format hitung mundur.
// Tanpa import supabase — aman untuk vitest.

// Alfabet tanpa karakter ambigu (0/O, 1/I/L) agar token mudah dibaca
// pengawas dan ditulis ulang santri.
const TOKEN_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const EXAM_TOKEN_LENGTH = 16

export interface ExamToken {
  /** Token mentah — hanya tampil sekali saat aktivasi. */
  raw: string
  /** Tampilan bergrup: XXXX-XXXX-XXXX-XXXX */
  display: string
  /** SHA-256 hex — yang disimpan di DB. */
  hash: string
  prefix: string
}

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Format token bergrup 4 karakter: XXXX-XXXX-XXXX-XXXX */
export function formatToken(raw: string): string {
  return raw.replace(/(.{4})(?=.)/g, '$1-')
}

/** Token ujian 16 karakter acak + hash SHA-256 (pola suspension). */
export async function generateExamToken(): Promise<ExamToken> {
  const bytes = new Uint8Array(EXAM_TOKEN_LENGTH)
  crypto.getRandomValues(bytes)
  const raw = Array.from(bytes)
    .map((b) => TOKEN_ALPHABET[b % TOKEN_ALPHABET.length])
    .join('')
  const hash = await sha256Hex(raw)
  return { raw, display: formatToken(raw), hash, prefix: raw.slice(0, 8) }
}

/**
 * Sisa waktu ujian dalam ms dari deadline server. Clock skew antara
 * perangkat santri dan server diterima — deadline yang memutus tetap
 * di server (RPC menolak lewat grace 60 detik).
 */
export function remainingMs(deadlineIso: string, nowMs?: number): number {
  const deadline = Date.parse(deadlineIso)
  if (Number.isNaN(deadline)) return 0
  return Math.max(0, deadline - (nowMs ?? Date.now()))
}

/** MM:SS bila < 1 jam, HH:MM:SS bila lebih. Nilai negatif → 00:00. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${String(h).padStart(2, '0')}:${mm}:${ss}` : `${mm}:${ss}`
}
