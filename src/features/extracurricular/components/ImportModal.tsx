import { useMemo } from 'react'
import { ImportWizard } from '../../../shared/import/ImportWizard'
import { useBulkCreateActivity, useActivity, useTeachersBrief } from '../hooks'
import { parseActivityTable } from '../importParse'
import type { ParsedActivityRow } from '../importParse'

const COLUMNS = [
  { key: 'name', header: 'Nama Kegiatan', width: 160 },
  { key: 'coach', header: 'Pembina', width: 160 },
  { key: 'schedule', header: 'Jadwal', width: 110 },
  { key: 'place', header: 'Tempat', width: 120 },
  { key: 'description', header: 'Deskripsi', width: 160 },
]

const TEMPLATE = {
  filename: 'template-ekstrakurikuler',
  headers: ['Nama Kegiatan', 'Pembina', 'Jadwal', 'Tempat', 'Deskripsi'],
  exampleRows: [
    ['Pramuka', 'Siti Aminah', 'Jumat', 'Lapangan', 'Wajib untuk kelas 7'],
    ['Futsal', 'Muhammad Misbahul Huda', 'Sabtu Pagi', 'Lapangan Sekolah', ''],
    ['Seni Tari', '', 'Sabtu', 'Aula', ''],
  ],
}

interface ImportModalProps {
  open: boolean
  onClose: () => void
}

/** Impor kegiatan ekstrakurikuler via shared ImportWizard — parser di importParse.ts (+test). */
export function ImportModal({ open, onClose }: ImportModalProps) {
  const activityQuery = useActivity()
  const teachersQuery = useTeachersBrief()
  const bulkMutation = useBulkCreateActivity()

  const existingNames = useMemo(
    () => (activityQuery.data ?? []).map((e) => e.name.trim().toLowerCase()),
    [activityQuery.data],
  )

  return (
    <ImportWizard<ParsedActivityRow>
      open={open}
      onClose={onClose}
      title="Import Ekstrakurikuler"
      subtitle="Impor daftar kegiatan dari file Excel/CSV, validasi duplikat & pencocokan pembina otomatis"
      entityLabel="Kegiatan"
      columns={COLUMNS}
      template={TEMPLATE}
      formatHint={
        <>
          Kolom: <b>Nama Kegiatan</b> (wajib), Pembina (nama persis seperti di Data Guru, opsional),
          Jadwal, Tempat, Deskripsi. Kegiatan yang namanya sudah ada di database akan ditandai
          duplikat; pembina yang tidak ditemukan dikosongkan dengan peringatan.
        </>
      }
      maxRows={200}
      parse={(table) =>
        parseActivityTable(table, { existingNames, teachers: teachersQuery.data ?? [] }).rows
      }
      getRowStatus={(r) => r.rowStatus}
      getRowMessage={(r) => r.message}
      previewCells={(r) => [
        r.name,
        r.coachName ?? '',
        r.schedule ?? '',
        r.place ?? '',
        r.description ?? '',
      ]}
      onSubmit={async (ready) => {
        const res = await bulkMutation.mutateAsync(
          ready.map((r) => ({
            name: r.name,
            coach_id: r.coachId ?? undefined,
            schedule: r.schedule ?? undefined,
            place: r.place ?? undefined,
            description: r.description ?? undefined,
          })),
        )
        return {
          inserted: res.inserted,
          failed: res.failed.map((f) => ({ label: f.name, error: f.error })),
        }
      }}
    />
  )
}
