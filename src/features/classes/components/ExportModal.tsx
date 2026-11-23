import { useMemo } from 'react'
import { ExportModal as SharedExportModal, type ExportColumn, type ExportScope } from '../../../shared/export/ExportModal'
import { fetchClassesByIds } from '../api'
import { useClassGenderCounts } from '../hooks'
import type { ClassRow } from '../types'

type ExportScopeKey = 'filtered' | 'selected'

interface ExportModalProps {
  open: boolean
  onClose: () => void
  /**
   * Hasil filter halaman (sudah mencakup search, tingkat, tanpa wali, kelas
   * kosong) — satu sumber kebenaran agar jumlah di modal = baris yang diekspor.
   */
  filteredRows: ClassRow[]
  selectedIds: string[]
  /** Lingkup yang dipilih saat modal dibuka (dari menu / bar massal) */
  defaultScope?: ExportScopeKey
}

/** Ekspor kelas — wrapper tipis di atas shared ExportModal. Angka L/P dari cache gender-counts halaman. */
export function ExportModal({ open, onClose, filteredRows, selectedIds, defaultScope = 'filtered' }: ExportModalProps) {
  const countsQuery = useClassGenderCounts()

  const columns: ExportColumn<ClassRow>[] = useMemo(() => {
    const counts = countsQuery.data ?? new Map<string, { total: number; male: number; female: number }>()
    return [
      { header: 'Nama Kelas', value: (c) => c.name },
      { header: 'Tingkat', value: (c) => c.grade },
      { header: 'Jurusan', value: (c) => c.major },
      { header: 'Tahun Akademik', value: (c) => c.academic_year?.name },
      { header: 'Wali Kelas', value: (c) => c.homeroom_teacher?.name },
      { header: 'Jumlah Santri', value: (c) => counts.get(c.id)?.total ?? 0 },
      { header: 'Putra (L)', value: (c) => counts.get(c.id)?.male ?? 0 },
      { header: 'Putri (P)', value: (c) => counts.get(c.id)?.female ?? 0 },
    ]
  }, [countsQuery.data])

  const scopes: ExportScope<ClassRow>[] = [
    {
      key: 'filtered',
      label: `Hasil filter (${filteredRows.length})`,
      description: 'Semua kelas yang cocok dengan pencarian & filter aktif saat ini.',
      count: filteredRows.length,
      getRows: async () => filteredRows,
    },
    {
      key: 'selected',
      label: `Terpilih (${selectedIds.length})`,
      disabled: selectedIds.length === 0,
      count: selectedIds.length,
      getRows: () => fetchClassesByIds(selectedIds),
    },
  ]

  return (
    <SharedExportModal<ClassRow>
      open={open}
      onClose={onClose}
      title="Export Data Kelas"
      filename="data-kelas"
      sheetName="Kelas"
      columns={columns}
      scopes={scopes}
      defaultScopeKey={defaultScope}
      auditTable="classes"
    />
  )
}
