import { useMemo } from 'react'
import { ImportWizard } from '../../../shared/import/ImportWizard'
import { useBulkCreateDorms, useDorms, useMusyrifBrief } from '../hooks'
import { parseDormTable } from '../importParse'
import { GENDER_LABEL } from '../meta'
import type { ParsedDormRow } from '../types'

const COLUMNS = [
  { key: 'name', header: 'Nama', width: 180 },
  { key: 'gender', header: 'Gender', width: 90 },
  { key: 'capacity', header: 'Kapasitas', width: 90 },
  { key: 'musyrif', header: 'Musyrif', width: 160 },
  { key: 'status', header: 'Status', width: 90 },
]

const TEMPLATE = {
  filename: 'template-kamar',
  headers: ['Nama', 'Gender', 'Kapasitas', 'Musyrif', 'Status'],
  exampleRows: [
    ['Melati A1', 'Putra', 12, 'Ustadz Ahmad', 'Aktif'],
    ['Anggrek B2', 'Putri', 10, '', 'Penuh'],
    ['Cemara C1', 'Campur', 8, '', 'Nonaktif'],
  ],
}

interface ImportModalProps {
  open: boolean
  onClose: () => void
}

/** Impor kamar via shared ImportWizard — parser di importParse.ts (+test). */
export function ImportModal({ open, onClose }: ImportModalProps) {
  const dormsQuery = useDorms()
  const musyrifQuery = useMusyrifBrief()
  const bulkMutation = useBulkCreateDorms()

  const existingNames = useMemo(
    () => (dormsQuery.data ?? []).map((d) => d.name.trim().toLowerCase()),
    [dormsQuery.data],
  )

  return (
    <ImportWizard<ParsedDormRow>
      open={open}
      onClose={onClose}
      title="Import Kamar"
      subtitle="Impor daftar kamar dari file Excel/CSV, validasi duplikat & kapasitas otomatis"
      entityLabel="Kamar"
      columns={COLUMNS}
      template={TEMPLATE}
      formatHint={
        <>
          Kolom: <b>Nama</b> (wajib), Gender (Putra/Putri/Campur), <b>Kapasitas</b> (wajib, 1–100),
          Musyrif (nama persis, opsional), Status (Aktif/Penuh/Nonaktif). Kamar yang namanya sudah
          ada di database akan ditandai duplikat.
        </>
      }
      maxRows={200}
      parse={(table) => parseDormTable(table, { existingNames, teachers: musyrifQuery.data ?? [] }).rows}
      getRowStatus={(r) => r.rowStatus}
      getRowMessage={(r) => r.message}
      previewCells={(r) => [
        r.name,
        r.gender ? (GENDER_LABEL[r.gender] ?? r.gender) : '',
        String(r.capacity),
        r.musyrifName ?? '',
        r.status,
      ]}
      onSubmit={async (ready) => {
        const values = ready.map((r) => ({
          name: r.name,
          gender: r.gender ?? undefined,
          capacity: r.capacity,
          musyrif_id: r.musyrifId ?? undefined,
          status: r.status,
        }))
        const res = await bulkMutation.mutateAsync(values)
        return {
          inserted: res.inserted,
          failed: res.failed.map((f) => ({ label: f.name, error: f.error })),
        }
      }}
    />
  )
}
