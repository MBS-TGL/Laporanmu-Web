import type { AiSource } from './aiKnowledge'

export const AI_CACHE_KEY = 'ai:faq:v1'
export const AI_CACHE_TTL_MS = 24 * 60 * 60 * 1000
const MAX_ENTRIES = 40

export interface CacheStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface CachedAnswer {
  text: string
  sources: AiSource[]
}

export interface CacheOptions {
  scope?: string
  storage?: CacheStorage | null
  now?: number
}

interface CacheEntry {
  text: string
  sources: AiSource[]
  cachedAt: number
  expiresAt: number
}

const FOLLOW_UP_PATTERN =
  /\b(lanjut|lanjutkan|lebih|detail|jelaskan|maksudnya|tadi|sebelumnya|contoh|contohnya|tersebut)\b/

function safeSessionStorage(): CacheStorage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

export function normalizeCacheKey(prompt: string): string {
  return prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function cacheKey(prompt: string, scope?: string): string {
  const key = normalizeCacheKey(prompt)
  return scope ? `${scope}|${key}` : key
}

function isSource(value: unknown): value is AiSource {
  if (!value || typeof value !== 'object') return false
  const source = value as Partial<AiSource>
  return (
    typeof source.id === 'string' &&
    typeof source.title === 'string' &&
    typeof source.route === 'string' &&
    (source.isPublic === undefined || typeof source.isPublic === 'boolean')
  )
}

function isCacheEntry(value: unknown): value is CacheEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Partial<CacheEntry>
  return (
    typeof entry.text === 'string' &&
    typeof entry.cachedAt === 'number' &&
    typeof entry.expiresAt === 'number' &&
    Array.isArray(entry.sources) &&
    entry.sources.every(isSource)
  )
}

function readCache(storage: CacheStorage): Record<string, CacheEntry> {
  try {
    const raw = storage.getItem(AI_CACHE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const entries: Record<string, CacheEntry> = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (isCacheEntry(value)) entries[key] = value
    }
    return entries
  } catch {
    return {}
  }
}

function writeCache(storage: CacheStorage, entries: Record<string, CacheEntry>): void {
  try {
    storage.setItem(AI_CACHE_KEY, JSON.stringify(entries))
  } catch {
    /* storage penuh atau diblokir browser */
  }
}

function resolveStorage(options: CacheOptions): CacheStorage | null {
  return options.storage === undefined ? safeSessionStorage() : options.storage
}

export function getCachedAnswer(prompt: string, options: CacheOptions = {}): CachedAnswer | null {
  const storage = resolveStorage(options)
  if (!storage) return null

  const now = options.now ?? Date.now()
  const entry = readCache(storage)[cacheKey(prompt, options.scope)]
  if (!entry || entry.expiresAt <= now) return null
  return { text: entry.text, sources: entry.sources }
}

export function setCachedAnswer(
  prompt: string,
  answer: CachedAnswer,
  options: CacheOptions = {},
): void {
  const storage = resolveStorage(options)
  if (!storage) return

  const now = options.now ?? Date.now()
  const key = cacheKey(prompt, options.scope)
  const fresh = Object.entries(readCache(storage))
    .filter(([, entry]) => entry.expiresAt > now)
    .sort((a, b) => b[1].cachedAt - a[1].cachedAt)
    .slice(0, MAX_ENTRIES - 1)

  const entries: Record<string, CacheEntry> = Object.fromEntries(fresh)
  entries[key] = {
    text: answer.text,
    sources: answer.sources,
    cachedAt: now,
    expiresAt: now + AI_CACHE_TTL_MS,
  }
  writeCache(storage, entries)
}

export function isCacheableQuestion(
  prompt: string,
  knowledgeCount: number,
  historyCount: number,
  isSuggestion = false,
): boolean {
  if (knowledgeCount === 0) return false
  if (isSuggestion) return true
  if (historyCount === 0) return true
  return !FOLLOW_UP_PATTERN.test(normalizeCacheKey(prompt))
}
