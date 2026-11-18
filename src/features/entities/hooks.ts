import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useEntities, type Entity } from './api'

/**
 * Scope entity staff: pilihan tersimpan localStorage + request header
 * `app.current_entity` (dibaca RLS current_entity_id, migration 0052).
 * Ganti entity = set header + buang SEMUA cache query supaya data di-fetch
 * ulang dalam konteks entity baru.
 */
const ENTITY_HEADER = 'app.current_entity'
const ENTITY_STORAGE_KEY = 'laporanmu_entity'

/**
 * Header REST Supabase. PENTING: `supabase.headers` (plain object) TIDAK
 * sampai ke request REST — postgrest-js menyalinnya ke instance `Headers`
 * saat client dibuat. Satu-satunya jalur yang benar: `supabase.rest.headers`
 * (instance Headers, API .set/.delete). Keduanya bertanda protected di tipe
 * supabase-js padahal runtime publik — akses lewat cast.
 */
function restHeaders(): Headers {
  return ((supabase as unknown as { rest: { headers: Headers } }).rest).headers
}

function setEntityHeader(id: string | null) {
  const headers = restHeaders()
  if (id) headers.set(ENTITY_HEADER, id)
  else headers.delete(ENTITY_HEADER)
}

export function useEntityScope() {
  const qc = useQueryClient()
  const entitiesQuery = useEntities()
  const entities = entitiesQuery.data
  const [selected, setSelected] = useState<string | null>(() =>
    typeof localStorage !== 'undefined' ? localStorage.getItem(ENTITY_STORAGE_KEY) : null,
  )

  const resolvedId = useMemo<string | null>(() => {
    if (!entities || entities.length === 0) return null
    const active = entities.filter((e) => e.is_active)
    const pool = active.length > 0 ? active : entities
    return pool.find((e) => e.id === selected)?.id ?? pool[0].id
  }, [entities, selected])

  // Pasang header setiap kali entity resolved berubah (termasuk saat pertama)
  useEffect(() => {
    setEntityHeader(resolvedId)
  }, [resolvedId])

  const current = useMemo<Entity | null>(
    () => entities?.find((e) => e.id === resolvedId) ?? null,
    [entities, resolvedId],
  )

  const switchEntity = (id: string) => {
    localStorage.setItem(ENTITY_STORAGE_KEY, id)
    setEntityHeader(id)
    setSelected(id)
    // Semua data tunduk pada entity → buang seluruh cache
    void qc.invalidateQueries()
  }

  return {
    entities: entities ?? [],
    entityId: resolvedId,
    current,
    switchEntity,
    loading: entitiesQuery.isPending,
  }
}
