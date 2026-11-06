import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export type ProfileRole = 'developer' | 'admin' | 'pengurus' | 'guru' | 'pending'

export interface Profile {
  id: string
  email: string
  name: string
  role: ProfileRole
  phone: string | null
  avatar_url: string | null
  spmb_role?: string | null
}

const ALLOWED_ROLES: ProfileRole[] = ['developer', 'admin', 'pengurus', 'guru']

export function isRoleAllowed(role: string | null | undefined): boolean {
  if (!role) return false
  return ALLOWED_ROLES.includes(role as ProfileRole)
}

// Sesuai matrix RLS: tulis = developer|admin|pengurus, hapus = developer|admin
const WRITE_ROLES: ProfileRole[] = ['developer', 'admin', 'pengurus']
const DELETE_ROLES: ProfileRole[] = ['developer', 'admin']

export function canWrite(role: string | null | undefined): boolean {
  if (!role) return false
  return WRITE_ROLES.includes(role as ProfileRole)
}

export function canDelete(role: string | null | undefined): boolean {
  if (!role) return false
  return DELETE_ROLES.includes(role as ProfileRole)
}

export function usePermissions() {
  const { role } = useProfile()
  return { canWrite: canWrite(role), canDelete: canDelete(role) }
}

export function useSession() {
  return useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getSession()
      if (error) throw error
      return data.session
    },
    staleTime: 1000 * 60,
  })
}

export function useProfile() {
  const sessionQuery = useSession()
  const userId = sessionQuery.data?.user?.id

  const profileQuery = useQuery({
    queryKey: ['profile', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId as string)
        .single()
      if (error) throw error
      return data as Profile
    },
  })

  const profile = profileQuery.data ?? null
  const role = profile?.role ?? null

  return {
    session: sessionQuery.data ?? null,
    profile,
    role,
    isAuthenticated: !!sessionQuery.data?.user,
    isLoading: sessionQuery.isPending || (!!userId && profileQuery.isPending),
    isError: sessionQuery.isError || profileQuery.isError,
  }
}
