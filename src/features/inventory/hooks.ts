import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { logAudit } from '../../shared/utils/auditLogger'
import { createItem, fetchItems, softDeleteItem, updateItem } from './api'
import type { ItemFormValues } from './types'

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
