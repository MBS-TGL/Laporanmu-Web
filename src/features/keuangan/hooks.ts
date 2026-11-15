import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { logAudit } from '../../shared/utils/auditLogger'
import {
  createSppComponent,
  createSppPayment,
  deleteSppComponent,
  deleteSppObligation,
  deleteSppPayment,
  fetchSppComponents,
  fetchSppObligations,
  fetchSppPayments,
  generateSppObligations,
  updateSppComponent,
} from './api'
import type { ComponentFormValues, PaymentFormValues } from './types'
import { attachPaid } from './sppUtil'
import { maybeSendSppWa } from './waAuto'
import { useMemo } from 'react'

/** Kewajiban + pembayaran tahun terpilih, dengan `paid` ter-agregasi per kewajiban. */
export function useSppWithPayments(academicYearId?: string) {
  const obligationsQuery = useSppObligations(academicYearId)
  const paymentsQuery = useSppPayments(academicYearId)
  const obligationsWithPaid = useMemo(
    () => attachPaid(obligationsQuery.data ?? [], paymentsQuery.data ?? []),
    [obligationsQuery.data, paymentsQuery.data],
  )
  return {
    obligations: obligationsWithPaid,
    payments: paymentsQuery.data ?? [],
    loading: obligationsQuery.isPending || paymentsQuery.isPending,
    isError: obligationsQuery.isError || paymentsQuery.isError,
    refetch: () => {
      void obligationsQuery.refetch()
      void paymentsQuery.refetch()
    },
  }
}

// ------------------------------------------------------------
// Komponen
// ------------------------------------------------------------
export function useSppComponents(academicYearId?: string) {
  return useQuery({
    queryKey: ['spp-components', academicYearId ?? 'all'],
    queryFn: () => fetchSppComponents(academicYearId),
    placeholderData: keepPreviousData,
  })
}

export function useCreateSppComponent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ values, academicYearId }: { values: ComponentFormValues; academicYearId: string }) =>
      createSppComponent(values, academicYearId),
    onSuccess: (created) => {
      void logAudit({ action: 'INSERT', source: 'OPERATIONAL', tableName: 'spp_components', recordId: created.id, newData: { name: created.name, amount: created.amount } })
      void qc.invalidateQueries({ queryKey: ['spp-components'] })
    },
  })
}

export function useUpdateSppComponent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: ComponentFormValues }) => updateSppComponent(id, values),
    onSuccess: (_d, vars) => {
      void logAudit({ action: 'UPDATE', source: 'OPERATIONAL', tableName: 'spp_components', recordId: vars.id })
      void qc.invalidateQueries({ queryKey: ['spp-components'] })
      void qc.invalidateQueries({ queryKey: ['spp-obligations'] })
    },
  })
}

export function useDeleteSppComponent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteSppComponent,
    onSuccess: (_d, id) => {
      void logAudit({ action: 'DELETE', source: 'OPERATIONAL', tableName: 'spp_components', recordId: id })
      void qc.invalidateQueries({ queryKey: ['spp-components'] })
      void qc.invalidateQueries({ queryKey: ['spp-obligations'] })
    },
  })
}

// ------------------------------------------------------------
// Kewajiban
// ------------------------------------------------------------
export function useSppObligations(academicYearId?: string) {
  return useQuery({
    queryKey: ['spp-obligations', academicYearId ?? 'all'],
    queryFn: () => fetchSppObligations(academicYearId),
    placeholderData: keepPreviousData,
  })
}

export function useGenerateSppObligations() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: generateSppObligations,
    onSuccess: (created, vars) => {
      void logAudit({
        action: 'EXECUTE',
        source: 'OPERATIONAL',
        tableName: 'spp_obligations',
        newData: { action: 'generate', component_id: vars.componentId, created },
      })
      void qc.invalidateQueries({ queryKey: ['spp-obligations'] })
    },
  })
}

export function useDeleteSppObligation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteSppObligation,
    onSuccess: (_d, id) => {
      void logAudit({ action: 'DELETE', source: 'OPERATIONAL', tableName: 'spp_obligations', recordId: id })
      void qc.invalidateQueries({ queryKey: ['spp-obligations'] })
    },
  })
}

// ------------------------------------------------------------
// Pembayaran
// ------------------------------------------------------------
export function useSppPayments(academicYearId?: string) {
  return useQuery({
    queryKey: ['spp-payments', academicYearId ?? 'all'],
    queryFn: () => fetchSppPayments(academicYearId),
    placeholderData: keepPreviousData,
  })
}

export function useCreateSppPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ values, createdBy }: { values: PaymentFormValues; createdBy: string | null }) =>
      createSppPayment(values, createdBy),
    onSuccess: (payment) => {
      // Sisa = nominal kewajiban - terbayar di cache (sebelum pembayaran ini) - pembayaran ini.
      // Fallback: nominal - pembayaran (kewajiban baru dibayar pertama kali).
      const cached = qc
        .getQueriesData<{ id: string; amount: number; paid?: number }[]>({ queryKey: ['spp-obligations'] })
        .flatMap(([, data]) => data ?? [])
        .find((o) => o.id === payment.obligation_id)
      const sisa = Math.max(
        0,
        (cached?.amount ?? payment.obligation?.amount ?? payment.amount) -
          (cached?.paid ?? 0) -
          payment.amount,
      )
      void maybeSendSppWa(payment, sisa)
      void logAudit({
        action: 'INSERT',
        source: 'OPERATIONAL',
        tableName: 'spp_payments',
        recordId: payment.id,
        newData: { amount: payment.amount, method: payment.method },
      })
      void qc.invalidateQueries({ queryKey: ['spp-payments'] })
      // saldo kewajiban berubah — rekap tunggakan ikut basi
      void qc.invalidateQueries({ queryKey: ['spp-obligations'] })
    },
  })
}

export function useDeleteSppPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteSppPayment,
    onSuccess: (_d, id) => {
      void logAudit({ action: 'DELETE', source: 'OPERATIONAL', tableName: 'spp_payments', recordId: id })
      void qc.invalidateQueries({ queryKey: ['spp-payments'] })
      void qc.invalidateQueries({ queryKey: ['spp-obligations'] })
    },
  })
}
