import { useMemo } from 'react'
import { ExportModal } from '../../../shared/export/ExportModal'
import { WORSHIP_CATEGORY_LABEL, type WorshipCategory } from '../types'

interface StudentBrief {
  id: string
  name: string
}

interface ExportRow {
  santri: string
  kelas: string
  kategori: string
  butir: string
  terampil: string
  tanggal: string
}

interface WorshipExportModalProps {
  open: boolean
  onClose: () => void
  category: WorshipCategory
  className: string
  items: Array<{ id: string; label: string }>
  students: StudentBrief[]
  mastery: Array<{ student_id: string; item_id: string; mastered: boolean; mastered_at: string | null }>
}

/**
 * Modal ekspor laporan kemahiran ibadah per kelas ke format XLSX / CSV.
 */
export function WorshipExportModal({
  open,
  onClose,
  category,
  className,
  items,
  students,
  mastery,
}: WorshipExportModalProps) {
  const rows = useMemo<ExportRow[]>(() => {
    const nameById = new Map(students.map((s) => [s.id, s.name]))
    return mastery.map((m) => ({
      santri: nameById.get(m.student_id) ?? '',
      kelas: className,
      kategori: WORSHIP_CATEGORY_LABEL[category],
      butir: items.find((i) => i.id === m.item_id)?.label ?? '',
      terampil: m.mastered ? 'Terampil' : 'Belum',
      tanggal: m.mastered_at ?? '',
    }))
  }, [mastery, students, className, category, items])

  return (
    <ExportModal
      open={open}
      onClose={onClose}
      title="Ekspor Kemahiran Ibadah"
      filename={`kemahiran-${category}-${className.toLowerCase().replace(/\s+/g, '-') || 'kelas'}`}
      columns={[
        { key: 'santri', header: 'Santri', value: (r: ExportRow) => r.santri },
        { key: 'kelas', header: 'Kelas', value: (r: ExportRow) => r.kelas },
        { key: 'kategori', header: 'Kategori', value: (r: ExportRow) => r.kategori },
        { key: 'butir', header: 'Butir', value: (r: ExportRow) => r.butir },
        { key: 'terampil', header: 'Status', value: (r: ExportRow) => r.terampil },
        { key: 'tanggal', header: 'Tanggal', value: (r: ExportRow) => r.tanggal },
      ]}
      scopes={[
        {
          key: 'class',
          label: `Kemahiran ${className || 'kelas'} (${rows.length})`,
          count: rows.length,
          getRows: async () => rows,
        },
      ]}
      auditTable="worship_mastery"
    />
  )
}
