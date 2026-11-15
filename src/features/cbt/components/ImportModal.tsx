import { ImportWizard } from '../../../shared/import/ImportWizard'
import { createCbtQuestionsBulk } from '../api'
import { getCbtRowMessage, getCbtRowStatus, parseCbtQuestionTable, type CbtImportRow } from '../importParse'

const IMPORT_COLUMNS = [
  { key: 'question', header: 'Soal', width: 280 },
  { key: 'optA', header: 'Opsi A', width: 130 },
  { key: 'optB', header: 'Opsi B', width: 130 },
  { key: 'optC', header: 'Opsi C', width: 130 },
  { key: 'optD', header: 'Opsi D', width: 130 },
  { key: 'optE', header: 'Opsi E', width: 130 },
  { key: 'key', header: 'Kunci', width: 70 },
  { key: 'points', header: 'Poin', width: 70 },
]

interface ImportModalProps {
  open: boolean
  onClose: () => void
  classSubjectId: string
  /** Soal yang sudah ada di bank — untuk deteksi duplikat. */
  existingQuestions: string[]
  onFinished: () => void
}

/** Impor bank soal dari Excel/CSV (ImportWizard, SKILLS.md Skill 3). */
export function ImportModal({
  open,
  onClose,
  classSubjectId,
  existingQuestions,
  onFinished,
}: ImportModalProps) {
  return (
    <ImportWizard<CbtImportRow>
      open={open}
      onClose={onClose}
      title="Impor Bank Soal"
      subtitle="Unggah daftar soal pilihan ganda dalam satu batch"
      entityLabel="Soal"
      columns={IMPORT_COLUMNS}
      template={{
        filename: 'template-impor-bank-soal-cbt',
        headers: IMPORT_COLUMNS.map((c) => c.header),
        exampleRows: [
          ['Ibu kota Provinsi Jawa Timur adalah...', 'Surabaya', 'Malang', 'Kediri', 'Jember', '', 'A', '1'],
          ['Hasil dari 12 x 8 adalah...', '86', '96', '106', '', '', 'B', '2'],
        ],
      }}
      formatHint={
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>Kolom Opsi C/D/E boleh kosong jika soal hanya punya 2 opsi.</li>
          <li>Kunci harus huruf opsi yang terisi (A sampai E).</li>
          <li>Poin boleh kosong (dianggap 1); desimal pakai koma atau titik.</li>
          <li>Soal yang teksnya sama dengan yang sudah ada ditandai duplikat.</li>
        </ul>
      }
      parse={(table) => parseCbtQuestionTable(table, existingQuestions)}
      getRowStatus={getCbtRowStatus}
      getRowMessage={getCbtRowMessage}
      previewCells={(row) => [
        row.question,
        row.options.find((o) => o.key === 'A')?.text ?? '',
        row.options.find((o) => o.key === 'B')?.text ?? '',
        row.options.find((o) => o.key === 'C')?.text ?? '',
        row.options.find((o) => o.key === 'D')?.text ?? '',
        row.options.find((o) => o.key === 'E')?.text ?? '',
        row.answerKey,
        String(row.points),
      ]}
      onSubmit={async (ready, ctx) => {
        let inserted = 0
        const failed: { label: string; error: string }[] = []
        const chunks = ctx.chunk(
          ready.map((r) => ({
            class_subject_id: classSubjectId,
            question: r.question,
            options: r.options,
            answer_key: r.answerKey,
            points: r.points,
          })),
          100,
        )
        for (let i = 0; i < chunks.length; i++) {
          try {
            inserted += await createCbtQuestionsBulk(chunks[i])
          } catch (err) {
            failed.push({ label: `Baris ${(i + 1) * 100 - chunks[i].length + 1}+`, error: (err as Error).message })
          }
          ctx.onProgress(Math.min((i + 1) * 100, ready.length), ready.length)
        }
        return { inserted, failed: failed.length > 0 ? failed : undefined }
      }}
      onFinished={onFinished}
    />
  )
}
