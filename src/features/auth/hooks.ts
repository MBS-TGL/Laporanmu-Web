import { useMutation } from '@tanstack/react-query'
import { App } from 'antd'
import { useNavigate } from 'react-router-dom'
import { queryClient } from '../../core/queryClient'
import { logAudit } from '../../shared/utils/auditLogger'
import { signIn, signOut } from './api'

async function invalidateAuth() {
  await queryClient.invalidateQueries({ queryKey: ['session'] })
  await queryClient.invalidateQueries({ queryKey: ['profile'] })
}

export function useLogin() {
  const navigate = useNavigate()
  const { message } = App.useApp()

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => signIn(email, password),
    onSuccess: async ({ user }) => {
      await invalidateAuth()
      // Tanda jejak login untuk kolom "Login Terakhir" (RPC admin_last_logins)
      void logAudit({ action: 'LOGIN', source: 'AUTH', tableName: 'profiles', recordId: user?.id ?? null })
      message.success('Berhasil masuk')
      navigate('/dashboard', { replace: true })
    },
    onError: (error: Error) => {
      message.error(error.message || 'Gagal masuk. Periksa email dan password.')
    },
  })
}

export function useLogout() {
  const navigate = useNavigate()
  const { message } = App.useApp()

  return useMutation({
    // Audit LOGOUT ditulis SEBELUM sesi dibersihkan (logAudit butuh user aktif)
    mutationFn: async () => {
      await logAudit({ action: 'LOGOUT', source: 'AUTH', tableName: 'profiles' })
      await signOut()
    },
    onSuccess: async () => {
      await invalidateAuth()
      navigate('/login', { replace: true })
    },
    onError: (error: Error) => {
      message.error(error.message || 'Gagal keluar')
    },
  })
}
