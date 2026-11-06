import { useMutation } from '@tanstack/react-query'
import { App } from 'antd'
import { useNavigate } from 'react-router-dom'
import { queryClient } from '../../core/queryClient'
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
    onSuccess: async () => {
      await invalidateAuth()
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
    mutationFn: signOut,
    onSuccess: async () => {
      await invalidateAuth()
      navigate('/login', { replace: true })
    },
    onError: (error: Error) => {
      message.error(error.message || 'Gagal keluar')
    },
  })
}
