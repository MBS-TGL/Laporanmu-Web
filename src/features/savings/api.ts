import { supabase } from '../../lib/supabase'
import type { AccountFormValues, SavingsAccount, SavingsStatus, SavingsTxn, TxnValues } from './types'

const ACCOUNT_SELECT =
  '*, students(id, name, registration_code, classes(name))'

export async function fetchAccounts(): Promise<SavingsAccount[]> {
  const { data, error } = await supabase
    .from('savings_accounts')
    .select(ACCOUNT_SELECT)
    .is('deleted_at', null)
    .order('opened_at', { ascending: false })
    .limit(1000)
  if (error) throw error
  return (data ?? []) as unknown as SavingsAccount[]
}

export async function createAccount(values: AccountFormValues): Promise<SavingsAccount> {
  const { data, error } = await supabase
    .from('savings_accounts')
    .insert({
      student_id: values.student_id,
      note: values.note?.trim() || null,
    })
    .select(ACCOUNT_SELECT)
    .single()
  if (error) {
    // 23505: unique aktif per santri — beri pesan yang ramah
    if (error.code === '23505') {
      throw new Error('Santri ini sudah punya rekening tabungan')
    }
    throw error
  }
  return data as unknown as SavingsAccount
}

export async function setAccountStatus(id: string, status: SavingsStatus): Promise<void> {
  const { error } = await supabase
    .from('savings_accounts')
    .update({ status, closed_at: status === 'closed' ? new Date().toISOString().slice(0, 10) : null })
    .eq('id', id)
  if (error) throw error
}

export async function fetchTxns(accountId: string, limit = 100): Promise<SavingsTxn[]> {
  const { data, error } = await supabase
    .from('savings_transactions')
    .select('*, profiles(name)')
    .eq('account_id', accountId)
    .order('occurred_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as unknown as SavingsTxn[]
}

/**
 * Setor / tarik lewat RPC security definer (0022) — saldo berubah
 * secara atomik: lock rekening, validasi, catat transaksi, update saldo.
 */
export async function applyTxn(
  accountId: string,
  values: TxnValues,
): Promise<SavingsAccount> {
  const { data, error } = await supabase
    .rpc('savings_apply_txn', {
      p_account_id: accountId,
      p_kind: values.kind,
      p_amount: values.amount,
      p_note: values.note?.trim() || null,
      p_occurred_at: values.occurred_at,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as SavingsAccount
}

export function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}
