import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { logAudit } from '../../shared/utils/auditLogger'
import { createItem, createMovement, fetchItems, fetchMovements, softDeleteItem, updateItem } from './api'
import type { ItemFormValues, MovementKind } from './types'

export function useItems() {
  return useQuery({
    queryKey: ['inventory', 'list'],
    queryFn: fetchItems,
  })
}

export function useCreateItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: ItemFormValues) => createItem(values),
    onSuccess: (item) => {
      void logAudit({
        action: 'INSERT',
        source: 'MASTER',
        tableName: 'inventory_items',
        recordId: item.id,
        newData: { name: item.name, quantity: item.quantity },
      })
      void qc.invalidateQueries({ queryKey: ['inventory'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: ItemFormValues }) => updateItem(id, values),
    onSuccess: (item) => {
      void logAudit({
        action: 'UPDATE',
        source: 'MASTER',
        tableName: 'inventory_items',
        recordId: item.id,
      })
      void qc.invalidateQueries({ queryKey: ['inventory'] })
    },
  })
}

export function useDeleteItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => softDeleteItem(id),
    onSuccess: (_data, id) => {
      void logAudit({ action: 'DELETE', source: 'MASTER', tableName: 'inventory_items', recordId: id })
      void qc.invalidateQueries({ queryKey: ['inventory'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useMovements(itemId: string | null) {
  return useQuery({
    queryKey: ['inventory', 'movements', itemId],
    queryFn: () => fetchMovements(itemId as string),
    enabled: Boolean(itemId),
  })
}

export function useCreateMovement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { itemId: string; kind: MovementKind; quantity: number; note?: string | null; actorId: string | null }) =>
      createMovement(input),
    onSuccess: (_d, input) => {
      void logAudit({
        action: 'UPDATE',
        source: 'MASTER',
        tableName: 'inventory_movements',
        recordId: input.itemId,
        newData: { kind: input.kind, quantity: input.quantity },
      })
      void qc.invalidateQueries({ queryKey: ['inventory'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
