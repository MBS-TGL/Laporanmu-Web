import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useProfile } from '../../shared/hooks/useProfile'
import type { HalaqahGroup } from './types'
import { useHalaqah } from './hooks'

/**
 * Scope musyrif: bila akun ber-role `teacher`, semua data halaqah difokuskan ke
 * kelompok di mana guru ter-link (teachers.profile_id = profile.id) menjadi
 * musyrif (halaqah_groups.musyrif_id). Role lain (developer/admin/manager)
 * melihat semua kelompok.
 *
 * Ini kenyamanan UI — keamanan sesungguhnya di RLS (migrasi 0041).
 */
export function useHalaqahScope() {
  const { profile, role } = useProfile()

  const teacherQuery = useQuery({
    queryKey: ['halaqah', 'my-teacher', profile?.id],
    enabled: !!profile?.id && role === 'teacher',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teachers')
        .select('id')
        .eq('profile_id', profile!.id)
        .is('deleted_at', null)
      if (error) throw error
      return (data ?? []) as { id: string }[]
    },
  })

  const scoped = role === 'teacher'
  const teacherIds = scoped ? (teacherQuery.data ?? []).map((t) => t.id) : []

  return {
    /** true bila akun guru → UI difokuskan ke kelompoknya sendiri. */
    scoped,
    /** id teacher milik akun ini (bisa >1 bila guru tercatat ganda). */
    teacherIds,
    /** id teacher pertama — untuk prefill musyrif di form setoran. */
    myTeacherId: teacherIds[0] ?? null,
    /** true selama teacher ter-link belum selesai dimuat (khusus akun guru). */
    isLoading: scoped && !!profile?.id && teacherQuery.isPending,
  }
}

/** useHalaqah + scope musyrif: groups otomatis difilter bila akun guru. */
export function useScopedHalaqah() {
  const scope = useHalaqahScope()
  const { scoped, teacherIds } = scope
  const groupsQuery = useHalaqah()

  // Selama teacher belum termuat, groups = undefined agar konsumen menahan
  // loading (bukan kedip ke empty state "belum punya kelompok").
  const scopeReady = !scoped || !scope.isLoading
  const allGroups = groupsQuery.data ?? []
  const groups = scopeReady
    ? scoped
      ? allGroups.filter(
          (g: HalaqahGroup) => g.musyrif_id !== null && teacherIds.includes(g.musyrif_id),
        )
      : allGroups
    : undefined

  return {
    /** undefined = scope masih termuat (konsumen menampilkan loading). */
    groups: groups as HalaqahGroup[] | undefined,
    scoped,
    teacherIds,
    myTeacherId: teacherIds[0] ?? null,
    isLoading: groupsQuery.isPending || !scopeReady,
    groupsQuery,
  }
}
