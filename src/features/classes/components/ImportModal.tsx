import { useMemo } from 'react'
import { ImportWizard } from '../../../shared/import/ImportWizard'
import { useAcademicYearsBrief, useImportClasses, useTeachersBriefForClasses } from '../hooks'
import {
  CLASS_IMPORT_HEADERS,
  getClassRowMessage,
  getClassRowStatus,
  parseClassTable,
  type ClassImportRow,
} from '../importParse'
import type { ClassRow } from '../types'

const IMPORT_COLUMNS = [
  { key: 'name', header: 'Nama Kelas', width: 140 },
  { key: 'grade', header: 'Tingkat', width: 90 },
  { key: 'major', header: 'Jurusan', width: 120 },
  { key: 'teacher', header: 'Wali Kelas', width: 170 },
  { key: 'year', header: 'Tahun Ajaran', width: 140 },
]

interface ImportModalProps {
  open: boolean
  onClose: () => void
  /** Kelas aktif saat ini — untuk deteksi duplikat nama di tahun akademik sama */
  existingClasses: ClassRow[]
}

/** Impor kelas dari Excel/CSV (ImportWizard, SKILLS.md Skill 3). */
export function ImportModal({ open, onClose, existingClasses }: ImportModalProps) {
  const yearsQuery = useAcademicYearsBrief()
  const teachersQuery = useTeachersBriefForClasses()
  const importClasses = useImportClasses()

  const existingKeys = useMemo(
    () =>
      new Set(
        existingClasses.map((c) => `${c.name.trim().toLowerCase()}|${c.academic_year_id ?? ''}`),
      ),
    [existingClasses],
  )

  return (
    <ImportWizard<ClassImportRow>
      open={open}
      onClose={onClose}
      title="Impor Kelas"
      subtitle="Unggah daftar kelas dalam satu batch"
      entityLabel="kelas"
      columns={IMPORT_COLUMNS}
      template={{
        filename: 'template-impor-kelas',
        headers: CLASS_IMPORT_HEADERS,
        exampleRows: [
          ['7A', '7', 'Tahfidz', '', '2025/2026'],
          ['8B', '8', 'IPA', 'Ustadz Ahmad', '2025/2026'],
        ],
      }}
      formatHint={
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>Kolom wajib: <b>Nama Kelas</b>. Tingkat, Jurusan, Wali Kelas, dan Tahun Ajaran opsional.</li>
          <li>Nama wali & tahun ajaran dicocokkan dengan data yang sudah ada; bila tidak cocok kolomnya dikosongkan.</li>
          <li>Nama kelas yang sama di tahun akademik yang sama ditandai duplikat dan dilewati.</li>
        </ul>
      }
      parse={(table) =>
        parseClassTable(table, {
          teachers: teachersQuery.data ?? [],
          years: yearsQuery.data ?? [],
          existingKeys,
        })
      }
      getRowStatus={getClassRowStatus}
      getRowMessage={getClassRowMessage}
      previewCells={(row) => [row.name, row.grade, row.major, row.teacher, row.year]}
      onSubmit={async (ready, ctx) => {
        const chunks = ctx.chunk(
          ready.map((r) => ({
            name: r.name,
            grade: r.grade || null,
            major: r.major || null,
            academic_year_id: r.academicYearId,
            homeroom_teacher_id: r.homeroomTeacherId,
          })),
          100,
        )
        let inserted = 0
        const failed: { label: string; error: string }[] = []
        for (let i = 0; i < chunks.length; i++) {
          try {
            // Audit log & invalidasi query dijalankan oleh useImportClasses
            inserted += await importClasses.mutateAsync(chunks[i])
          } catch (err) {
            failed.push({ label: `Baris ${i * 100 + 1}+`, error: (err as Error).message })
          }
          ctx.onProgress(Math.min((i + 1) * 100, ready.length), ready.length)
        }
        return { inserted, failed: failed.length > 0 ? failed : undefined }
      }}
    />
  )
}
