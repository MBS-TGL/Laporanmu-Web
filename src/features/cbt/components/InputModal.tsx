import { useMemo, useState } from 'react'
import { Alert, App, Input, Typography } from 'antd'
import { FileAddOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { createCbtQuestionsBulk } from '../api'
import { getCbtRowMessage, getCbtRowStatus } from '../importParse'
import { parseQuestionText } from '../textParse'

const FORMAT_HINT = `1. Teks pertanyaan soal
A. Opsi pertama
B. Opsi kedua
C. Opsi ketiga
D. Opsi keempat
Kunci: B
Poin: 1

2. Soal berikutnya ...`

interface InputModalProps {
  open: boolean
  onClose: () => void
  classSubjectId: string
  existingQuestions: string[]
  onFinished: (inserted: number) => void
}

/**
 * Input Cepat Teks: tempel banyak soal sekaligus dalam format teks biasa
 * (penomoran + opsi A-E + Kunci + Poin). Parser murni di textParse.ts.
 */
export function InputModal({
  open,
  onClose,
  classSubjectId,
  existingQuestions,
  onFinished,
}: InputModalProps) {
  const { message } = App.useApp()
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)

  const parsed = useMemo(
    () => (open && text.trim() ? parseQuestionText(text, existingQuestions) : []),
    [open, text, existingQuestions],
  )
  const ready = parsed.filter((r) => getCbtRowStatus(r) === 'siap')
  const problemRows = parsed.filter((r) => getCbtRowStatus(r) !== 'siap')

  const handleSave = async () => {
    if (ready.length === 0) return
    setSaving(true)
    try {
      await createCbtQuestionsBulk(
        ready.map((r) => ({
          class_subject_id: classSubjectId,
          question: r.question,
          options: r.options,
          answer_key: r.answerKey,
          points: r.points,
        })),
      )
      message.success(`${ready.length} soal ditambahkan ke bank`)
      onFinished(ready.length)
    } catch (err) {
      message.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppModal
      open={open}
      onCancel={() => {
        setText('')
        onClose()
      }}
      title="Input Cepat Bank Soal"
      subtitle="Tempel banyak soal sekaligus, format teks biasa tanpa file Excel"
      icon={<FileAddOutlined />}
      width={720}
      destroyOnHidden
      okText={ready.length > 0 ? `Tambahkan ${ready.length} Soal` : 'Tambahkan Soal'}
      okButtonProps={{ disabled: ready.length === 0, loading: saving }}
      onOk={handleSave}
    >
      <Typography.Paragraph type="secondary" style={{ fontSize: 12.5, marginBottom: 8 }}>
        Satu soal diawali nomor, opsi pakai huruf A-E, lalu baris <code>Kunci:</code> dan opsional{' '}
        <code>Poin:</code>. Baris panjang boleh dilipat ke baris baru.
      </Typography.Paragraph>

      <Alert
        type="info"
        style={{ marginBottom: 12 }}
        message={
          <pre style={{ margin: 0, fontFamily: 'inherit', fontSize: 12, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
            {FORMAT_HINT}
          </pre>
        }
      />

      <Input.TextArea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'Tempel soal-soal di sini, contoh:\n\n1. Ibu kota Provinsi Jawa Timur adalah ...\nA. Surabaya\nB. Malang\nC. Kediri\nKunci: A'}
        rows={12}
        style={{ fontSize: 13, lineHeight: 1.6 }}
      />

      {parsed.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <Typography.Text>
            {ready.length} soal siap disimpan
            {problemRows.length > 0 && (
              <Typography.Text type="warning"> · {problemRows.length} baris bermasalah</Typography.Text>
            )}
          </Typography.Text>
          {problemRows.slice(0, 5).map((r) => (
            <Alert
              key={r.row}
              type={getCbtRowStatus(r) === 'duplikat' ? 'warning' : 'error'}
              showIcon
              style={{ marginTop: 8 }}
              message={`Soal #${r.row}: ${getCbtRowMessage(r)}`}
              description={r.question.slice(0, 120)}
            />
          ))}
          {problemRows.length > 5 && (
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 6 }}>
              dan {problemRows.length - 5} baris bermasalah lainnya.
            </Typography.Text>
          )}
        </div>
      )}
    </AppModal>
  )
}
