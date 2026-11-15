import { useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Checkbox,
  Input,
  InputNumber,
  Segmented,
  Space,
  Spin,
  Tag,
  Typography,
  Upload,
  theme,
} from 'antd'
import { FileAddOutlined, ThunderboltOutlined, UploadOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { useFlag } from '../../../shared/hooks/useFeatureFlags'
import { callAi } from '../../../shared/lib/ai'
import { createCbtQuestionsBulk } from '../api'
import { getCbtRowStatus } from '../importParse'
import { buildAiQuestionPrompt, parseAiQuestions, type AiSourceMode } from '../aiParse'
import type { CbtImportRow } from '../importParse'

const MAX_SOURCE_CHARS = 12000

interface GenerateModalProps {
  open: boolean
  onClose: () => void
  classSubjectId: string
  existingQuestions: string[]
  onFinished: (inserted: number) => void
}

/**
 * Draf soal dengan AI (Gemini): dari materi/CP-TP yang ditempel atau file
 * teks, atau menormalkan soal existing. Draf SELALU lewat pratinjau guru —
 * tidak ada soal yang langsung masuk bank tanpa diperiksa.
 */
export function GenerateModal({
  open,
  onClose,
  classSubjectId,
  existingQuestions,
  onFinished,
}: GenerateModalProps) {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const aiEnabled = useFlag('cbt.ai_generate')

  const [mode, setMode] = useState<AiSourceMode>('materi')
  const [source, setSource] = useState('')
  const [count, setCount] = useState(5)
  const [extra, setExtra] = useState('')
  const [generating, setGenerating] = useState(false)
  const [drafts, setDrafts] = useState<CbtImportRow[]>([])
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [aiError, setAiError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const existingSet = useMemo(() => new Set(existingQuestions.map((q) => q.replace(/\s+/g, ' ').trim().toLowerCase())), [existingQuestions])

  const draftKey = (r: CbtImportRow) => `${r.row}:${r.question.slice(0, 40)}`
  const readyDrafts = drafts.filter((d) => getCbtRowStatus(d) === 'siap')

  const handleUpload = async (file: File) => {
    if (file.size > 200_000) {
      message.error('File terlalu besar. Maksimal 200 KB.')
      return false
    }
    const content = await file.text()
    setSource((prev) => (prev ? `${prev}\n\n${content}` : content).slice(0, MAX_SOURCE_CHARS))
    message.success(`Materi dari "${file.name}" ditambahkan`)
    return false // cegah upload otomatis antd
  }

  const handleGenerate = async () => {
    if (!source.trim()) {
      message.warning(mode === 'materi' ? 'Tempel materi atau CP/TP dulu' : 'Tempel soal yang mau dinormalkan dulu')
      return
    }
    setGenerating(true)
    setAiError(null)
    setDrafts([])
    setPicked(new Set())
    try {
      const { system, prompt } = buildAiQuestionPrompt({ mode, source, count, extra })
      const reply = await callAi({ system, prompt, maxOutputTokens: 8192 })
      if (reply.startsWith('API Key AI belum diatur')) {
        setAiError(reply)
        return
      }
      const { rows, error } = parseAiQuestions(reply)
      if (error) {
        setAiError(error)
        return
      }
      // tandai duplikat dengan bank berdasar teks soal
      const marked = rows.map((r) => ({
        ...r,
        duplicate: existingSet.has(r.question.replace(/\s+/g, ' ').trim().toLowerCase()),
      }))
      setDrafts(marked)
      setPicked(new Set(marked.filter((d) => getCbtRowStatus(d) === 'siap').map(draftKey)))
      if (marked.every((d) => getCbtRowStatus(d) !== 'siap')) {
        setAiError('Semua draf bermasalah atau duplikat dengan bank. Periksa daftar di bawah.')
      }
    } finally {
      setGenerating(false)
    }
  }

  const handleSave = async () => {
    const chosen = readyDrafts.filter((d) => picked.has(draftKey(d)))
    if (chosen.length === 0) return
    setSaving(true)
    try {
      await createCbtQuestionsBulk(
        chosen.map((r) => ({
          class_subject_id: classSubjectId,
          question: r.question,
          options: r.options,
          answer_key: r.answerKey,
          points: r.points,
        })),
      )
      message.success(`${chosen.length} soal draf ditambahkan ke bank`)
      onFinished(chosen.length)
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
        setDrafts([])
        setAiError(null)
        onClose()
      }}
      title="Buat Draf Soal dengan AI"
      subtitle="Draf selalu diperiksa guru sebelum masuk bank soal"
      icon={<ThunderboltOutlined />}
      width={760}
      destroyOnHidden
      footer={null}
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="AI menyusun draf dari materi yang kamu berikan, bukan dari internet. Periksa dan sunting soal di bank setelah disimpan."
      />

      <Segmented
        value={mode}
        onChange={(v) => setMode(v as AiSourceMode)}
        options={[
          { value: 'materi', label: 'Dari Materi / CP-TP' },
          { value: 'existing', label: 'Normalisasi Soal Existing' },
        ]}
        style={{ marginBottom: 12 }}
      />

      <Space size={8} wrap style={{ marginBottom: 8 }}>
        <Upload accept=".txt,.md,.csv" showUploadList={false} beforeUpload={handleUpload}>
          <Button icon={<UploadOutlined />}>Unggah file teks (.txt/.md)</Button>
        </Upload>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Untuk PDF/dokumen, salin bagian materinya lalu tempel di bawah.
        </Typography.Text>
      </Space>

      <Input.TextArea
        value={source}
        onChange={(e) => setSource(e.target.value.slice(0, MAX_SOURCE_CHARS))}
        rows={mode === 'materi' ? 8 : 10}
        maxLength={MAX_SOURCE_CHARS}
        showCount
        placeholder={
          mode === 'materi'
            ? 'Tempel materi bab buku paket, ringkasan LKS, atau CP/TP di sini. Contoh: "TP 7.1 Siswa dapat menjelaskan ciri-ciri makhluk hidup..."'
            : 'Tempel soal-soal existing (dari buku/LKS/dokumen sekolah). AI menormalkan ke format bank tanpa mengubah makna.'
        }
        style={{ fontSize: 13, marginBottom: 12 }}
      />

      <Space size={16} wrap style={{ marginBottom: 12 }}>
        <Space.Compact>
          <InputNumber min={1} max={20} value={count} onChange={(v) => setCount(v ?? 5)} style={{ width: 90 }} />
          <Button type="primary" icon={<ThunderboltOutlined />} onClick={handleGenerate} loading={generating}>
            {mode === 'materi' ? 'Hasilkan Draf Soal' : 'Normalisasi Soal'}
          </Button>
        </Space.Compact>
        <Input
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          placeholder="Instruksi tambahan (opsional): fokus bab, jenjang, tingkat kesulitan"
          style={{ flex: '1 1 260px', minWidth: 220 }}
        />
      </Space>

      {aiError && (
        <Alert type="warning" showIcon style={{ marginBottom: 12 }} message={aiError} />
      )}

      {generating && (
        <div style={{ textAlign: 'center', padding: 32 }}>
          <Spin />
          <Typography.Text type="secondary" style={{ display: 'block', marginTop: 12 }}>
            Menyusun draf soal, biasanya beberapa detik…
          </Typography.Text>
        </div>
      )}

      {drafts.length > 0 && !generating && (
        <div>
          <Space size={12} wrap style={{ marginBottom: 8 }}>
            <Typography.Text strong>
              {readyDrafts.length} draf siap · {drafts.length - readyDrafts.length} bermasalah
            </Typography.Text>
            <Button
              size="small"
              onClick={() => setPicked(new Set(readyDrafts.map(draftKey)))}
            >
              Pilih Semua
            </Button>
            <Button size="small" onClick={() => setPicked(new Set())}>
              Kosongkan
            </Button>
          </Space>

          <div style={{ maxHeight: 320, overflowY: 'auto', display: 'grid', gap: 8 }}>
            {drafts.map((d) => {
              const status = getCbtRowStatus(d)
              const key = draftKey(d)
              return (
                <div
                  key={key}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: `1px solid ${status === 'siap' ? token.colorBorderSecondary : token.colorWarningBorder}`,
                    background: status === 'siap' ? undefined : token.colorWarningBg,
                  }}
                >
                  {status === 'siap' ? (
                    <Checkbox
                      checked={picked.has(key)}
                      onChange={(e) =>
                        setPicked((prev) => {
                          const next = new Set(prev)
                          if (e.target.checked) next.add(key)
                          else next.delete(key)
                          return next
                        })
                      }
                    >
                      <Typography.Text strong>#{d.row}</Typography.Text> {d.question}
                    </Checkbox>
                  ) : (
                    <Typography.Text type="warning">
                      <Tag color="orange">#{d.row}</Tag> {d.question.slice(0, 100)} — {status === 'duplikat' ? 'duplikat dengan bank' : 'draf tidak valid'}
                    </Typography.Text>
                  )}
                </div>
              )
            })}
          </div>

          <Button
            type="primary"
            icon={<FileAddOutlined />}
            onClick={handleSave}
            loading={saving}
            disabled={picked.size === 0}
            block
            style={{ marginTop: 12 }}
          >
            Simpan {picked.size} Draf ke Bank Soal
          </Button>
        </div>
      )}

      {!aiEnabled && (
        <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 12 }}>
          Fitur AI dapat dimatikan lewat flag <code>cbt.ai_generate</code> di Dashboard Admin.
        </Typography.Text>
      )}
    </AppModal>
  )
}
