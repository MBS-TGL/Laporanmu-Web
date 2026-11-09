import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { logAudit } from '../../shared/utils/auditLogger'
import {
  applyTxn,
  createAccount,
  fetchAccounts,
  fetchTxns,
  setAccountStatus,
} from './api'
import type { AccountFormValues, SavingsStatus, SavingsTxnKind, TxnValues } from './types'

export function useSavingsAccounts() {
  return useQuery({
    queryKey: ['savings', 'accounts'],
    queryFn: fetchAccounts,
  })
}

export function useSavingsTxns(accountId: string | undefined) {
  return useQuery({
    queryKey: ['savings', 'txns', accountId],
    queryFn: () => fetchTxns(accountId as string),
    enabled: !!accountId,
  })
}

export function useCreateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: AccountFormValues) => createAccount(values),
    onSuccess: (account) => {
      void logAudit({
        action: 'INSERT',
        source: 'OPERATIONAL',
        tableName: 'savings_accounts',
        recordId: account.id,
        newData: { student_id: account.student_id },
      })
      void qc.invalidateQueries({ queryKey: ['savings'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useSetAccountStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: SavingsStatus }) =>
      setAccountStatus(id, status),
    onSuccess: (_data, vars) => {
      void logAudit({
        action: 'UPDATE',
        source: 'OPERATIONAL',
        tableName: 'savings_accounts',
        recordId: vars.id,
        newData: { status: vars.status },
      })
      void qc.invalidateQueries({ queryKey: ['savings'] })
    },
  })
}

export function useApplyTxn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ accountId, values }: { accountId: string; values: TxnValues }) =>
      applyTxn(accountId, values),
    onSuccess: (_account, vars) => {
      void logAudit({
        action: 'INSERT',
        source: 'OPERATIONAL',
        tableName: 'savings_transactions',
        newData: {
          account_id: vars.accountId,
          kind: vars.values.kind as SavingsTxnKind,
          amount: vars.values.amount,
        },
      })
      void qc.invalidateQueries({ queryKey: ['savings'] })
    },
  })
}
