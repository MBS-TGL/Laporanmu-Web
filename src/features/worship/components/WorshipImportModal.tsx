import { useMemo } from 'react'
import dayjs from 'dayjs'
import { ImportWizard, type ImportRowStatus, type ImportRunContext, type ImportResult } from '../../../shared/import/ImportWizard'
import { WORSHIP_CATEGORY_LABEL, type WorshipCategory, type WorshipItem } from '../types'
import { upsertWorshipMastery } from '../api'

interface WorshipImportModalProps {
  open: boolean
  onClose: () => void
  category: WorshipCategory
  className: string
  items: Array<Pick<WorshipItem, 'id' | 'label'>>
  students: Array<{ id: string; name: string }>
  onSuccess: () => void
}

interface ParsedImportRow {
  studentId: string
  itemId: string
  studentName: string
  itemLabel: string
  mastered: boolean
  status: ImportRowStatus
  message?: string
}

/**
 * Modal Impor Data Kemahiran Ibadah via ImportWizard:
 * Mendukung template Excel/CSV dengan kolom: Nama Santri, Butir Ibadah, Status (Terampil/Belum).
 */
export function WorshipImportModal({
  open,
  onClose,
  category,
  className,
  items,
  students,
  onSuccess,
}: WorshipImportModalProps) {
  const studentMap = useMemo(() => {
    const map = new Map<string, string>()
    students.forEach((s) => {
      map.set(s.name.trim().toLowerCase(), s.id)
    })
    return map
  }, [students])

  const itemMap = useMemo(() => {
    const map = new Map<string, string>()
    items.forEach((i) => {
      map.set(i.label.trim().toLowerCase(), i.id)
    })
    return map
  }, [items])

  const template = useMemo(
    () => ({
      filename: `template-kemahiran-${category}`,
      headers: ['Nama Santri', 'Butir Ibadah', 'Status Terampil'],
      exampleRows: [
        [students[0]?.name || 'Nama Santri 1', items[0]?.label || 'Contoh Butir 1', 'Terampil'],
        [students[1]?.name || 'Nama Santri 2', items[0]?.label || 'Contoh Butir 1', 'Belum'],
      ],
    }),
    [category, students, items],
  )

  const columns = useMemo(
    () => [
      { key: 'student', header: 'Nama Santri' },
      { key: 'item', header: 'Butir Ibadah' },
      { key: 'status', header: 'Status Terampil' },
    ],
    [],
  )

  const parseTable = (table: string[][]): ParsedImportRow[] => {
    if (table.length <= 1) return []
    const header = table[0].map((h) => (h || '').trim().toLowerCase())
    const studentIdx = header.findIndex((h) => h.includes('santri') || h.includes('nama'))
    const itemIdx = header.findIndex((h) => h.includes('butir') || h.includes('materi'))
    const statusIdx = header.findIndex((h) => h.includes('status') || h.includes('terampil'))

    const rows: ParsedImportRow[] = []
    for (let i = 1; i < table.length; i++) {
      const row = table[i]
      if (!row || row.every((c) => !c || !c.trim())) continue

      const studentRaw = (row[studentIdx >= 0 ? studentIdx : 0] || '').trim()
      const itemRaw = (row[itemIdx >= 0 ? itemIdx : 1] || '').trim()
      const statusRaw = (row[statusIdx >= 0 ? statusIdx : 2] || '').trim().toLowerCase()

      if (!studentRaw) {
        rows.push({
          studentId: '',
          itemId: '',
          studentName: '',
          itemLabel: itemRaw,
          mastered: false,
          status: 'error',
          message: 'Nama santri kosong',
        })
        continue
      }
      if (!itemRaw) {
        rows.push({
          studentId: '',
          itemId: '',
          studentName: studentRaw,
          itemLabel: '',
          mastered: false,
          status: 'error',
          message: 'Butir materi kosong',
        })
        continue
      }

      const sId = studentMap.get(studentRaw.toLowerCase())
      if (!sId) {
        rows.push({
          studentId: '',
          itemId: '',
          studentName: studentRaw,
          itemLabel: itemRaw,
          mastered: false,
          status: 'error',
          message: `Santri "${studentRaw}" tidak terdaftar di kelas ${className || 'ini'}`,
        })
        continue
      }

      const itId = itemMap.get(itemRaw.toLowerCase())
      if (!itId) {
        rows.push({
          studentId: sId,
          itemId: '',
          studentName: studentRaw,
          itemLabel: itemRaw,
          mastered: false,
          status: 'error',
          message: `Butir "${itemRaw}" tidak ditemukan`,
        })
        continue
      }

      const isMastered =
        statusRaw.includes('terampil') ||
        statusRaw === 'ya' ||
        statusRaw === '1' ||
        statusRaw === 'v' ||
        statusRaw === 'true'

      rows.push({
        studentId: sId,
        itemId: itId,
        studentName: studentRaw,
        itemLabel: itemRaw,
        mastered: isMastered,
        status: 'siap',
      })
    }
    return rows
  }

  const handleRunImport = async (
    ready: ParsedImportRow[],
    ctx: ImportRunContext,
  ): Promise<ImportResult> => {
    const now = dayjs().format('YYYY-MM-DD')
    const payload = ready.map((r) => ({
      student_id: r.studentId,
      item_id: r.itemId,
      mastered: r.mastered,
      mastered_at: r.mastered ? now : null,
      recorded_by: null,
    }))

    const chunks = ctx.chunk(payload, 50)
    let inserted = 0
    for (let i = 0; i < chunks.length; i++) {
      await upsertWorshipMastery(chunks[i])
      inserted += chunks[i].length
      ctx.onProgress(inserted, payload.length)
    }

    onSuccess()
    return { inserted }
  }

  return (
    <ImportWizard<ParsedImportRow>
      open={open}
      onClose={onClose}
      title={`Impor Kemahiran ${WORSHIP_CATEGORY_LABEL[category]}`}
      entityLabel="Kemahiran"
      columns={columns}
      template={template}
      parse={(table) => parseTable(table)}
      getRowStatus={(r) => r.status}
      getRowMessage={(r) => r.message}
      previewCells={(r) => [r.studentName, r.itemLabel, r.mastered ? 'Terampil' : 'Belum']}
      onSubmit={handleRunImport}
    />
  )
}
