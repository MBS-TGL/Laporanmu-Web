import { useEffect } from 'react'
import { Button, Checkbox, Form, Input, InputNumber, Radio, Select, Space, theme } from 'antd'
import { DeleteOutlined, MinusCircleOutlined, PlusOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { useFlag } from '../../../shared/hooks/useFeatureFlags'
import { OPTION_KEYS } from '../importParse'
import {
  DIFFICULTY_LABEL,
  QUESTION_TYPE_LABEL,
  type CbtQuestion,
  type Difficulty,
  type QuestionFormValues,
  type QuestionType,
} from '../types'

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E']
const ADVANCED_TYPES: QuestionType[] = ['pg_multi', 'true_false', 'matching', 'essay']

interface QuestionModalProps {
  open: boolean
  onClose: () => void
  /** Mapel kelas tujuan soal baru (dari filter aktif tab). */
  classSubjectId: string | undefined
  initial?: CbtQuestion | null
  onSave: (values: QuestionFormValues, id?: string) => Promise<void>
}

/**
 * Form soal multi-tipe: PG (default), PG kompleks, benar-salah,
 * menjodohkan, dan uraian. Tipe lanjutan di-gerbang flag
 * `module.cbt_lanjutan`; tanpa flag form PG klasik saja.
 */
export function QuestionModal({ open, onClose, initial, onSave }: QuestionModalProps) {
  const [form] = Form.useForm<QuestionFormValues>()
  const { token } = theme.useToken()
  const advanced = useFlag('module.cbt_lanjutan')
  const editing = Boolean(initial)

  useEffect(() => {
    if (!open) return
    if (initial) {
      form.setFieldsValue({
        question: initial.question,
        type: initial.type,
        difficulty: initial.difficulty,
        options: initial.options.length
          ? initial.options.map((o) => ({ text: o.text }))
          : [{ text: '' }, { text: '' }],
        answer_key: initial.answer_key || undefined,
        answer_multi:
          Array.isArray(initial.answer) && initial.type === 'pg_multi'
            ? (initial.answer as string[])
            : undefined,
        answer_tf:
          initial.type === 'true_false' && (initial.answer === 'B' || initial.answer === 'S')
            ? (initial.answer as 'B' | 'S')
            : undefined,
        rights: initial.pairs?.rights?.length
          ? initial.pairs.rights.map((r) => ({ text: r.text }))
          : [{ text: '' }, { text: '' }],
        correct_pairs: initial.pairs?.correct ?? undefined,
        points: initial.points,
        explanation: initial.explanation ?? undefined,
      })
    } else {
      form.setFieldsValue({
        question: '',
        type: 'pg',
        difficulty: 'sedang',
        options: [{ text: '' }, { text: '' }, { text: '' }, { text: '' }],
        points: 1,
      })
    }
  }, [open, initial, form])

  const type = (Form.useWatch('type', form) ?? 'pg') as QuestionType
  const optionsValue = Form.useWatch('options', form)
  const rightsValue = Form.useWatch('rights', form)
  const filledCount = optionsValue ? optionsValue.filter((o) => (o?.text ?? '').trim() !== '').length : 4

  const handleOk = async () => {
    const values = await form.validateFields()
    await onSave(values, initial?.id)
  }

  return (
    <AppModal
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      okText={editing ? 'Simpan' : 'Tambah Soal'}
      title={editing ? 'Ubah Soal' : 'Tambah Soal'}
      subtitle="Tersimpan di bank sesuai kelas & mapel terpilih"
      width={advanced && type !== 'pg' ? 720 : 640}
      destroyOnHidden
      maskClosable={false}
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {advanced && (
            <Form.Item name="type" label="Tipe soal" style={{ width: 190, marginBottom: 16 }}>
              <Select
                options={ADVANCED_TYPES.map((t) => ({ value: t, label: QUESTION_TYPE_LABEL[t] }))}
                onChange={(v) => {
                  form.setFieldValue('type', v)
                  if (v === 'matching' && !form.getFieldValue('rights')) {
                    form.setFieldValue('rights', [{ text: '' }, { text: '' }])
                  }
                }}
              />
            </Form.Item>
          )}
          {advanced && (
            <Form.Item name="difficulty" label="Tingkat" style={{ width: 130, marginBottom: 16 }}>
              <Select options={(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map((k) => ({ value: k, label: DIFFICULTY_LABEL[k] }))} />
            </Form.Item>
          )}
          <Form.Item name="points" label="Poin" rules={[{ required: true, message: 'Poin wajib diisi' }]} style={{ width: 110, marginBottom: 16 }}>
            <InputNumber min={0.5} max={100} step={0.5} style={{ width: 110 }} />
          </Form.Item>
        </div>

        <Form.Item
          name="question"
          label={type === 'matching' ? 'Instruksi menjodohkan' : type === 'essay' ? 'Pertanyaan uraian' : 'Pertanyaan'}
          rules={[{ required: true, message: 'Pertanyaan wajib diisi' }]}
        >
          <Input.TextArea rows={3} placeholder="Tulis pertanyaan soal di sini" showCount maxLength={1000} />
        </Form.Item>

        {/* ── Kunci & opsi per tipe ── */}
        {type === 'true_false' ? (
          <Form.Item name="answer_tf" label="Kunci jawaban" rules={[{ required: true, message: 'Pilih kunci' }]}>
            <Radio.Group
              optionType="button"
              buttonStyle="solid"
              options={[
                { value: 'B', label: 'Benar' },
                { value: 'S', label: 'Salah' },
              ]}
            />
          </Form.Item>
        ) : type === 'essay' ? (
          <div style={{ fontSize: 12.5, color: token.colorTextTertiary, marginBottom: 16 }}>
            Uraian dinilai manual oleh guru setelah santri mengumpulkan. Tulis rubrik penilaian di pembahasan bila perlu.
          </div>
        ) : type === 'matching' ? (
          <>
            <div style={{ marginBottom: 6, fontWeight: 600, fontSize: 13.5 }}>Item kiri (soal)</div>
            <Form.List name="options">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field) => (
                    <Space.Compact key={field.key} style={{ display: 'flex', marginBottom: 8 }}>
                      <Form.Item name={[field.name, 'text']} noStyle rules={[{ required: true, message: 'Item wajib diisi' }]}>
                        <Input placeholder={`Item kiri ${field.name + 1}`} />
                      </Form.Item>
                      {fields.length > 2 && (
                        <Button icon={<DeleteOutlined />} onClick={() => remove(field.name)} style={{ width: 40 }} />
                      )}
                    </Space.Compact>
                  ))}
                  {fields.length < 6 && (
                    <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ text: '' })} style={{ width: '100%' }}>
                      Tambah item kiri
                    </Button>
                  )}
                </>
              )}
            </Form.List>
            <div style={{ margin: '14px 0 6px', fontWeight: 600, fontSize: 13.5 }}>Pasangan kanan</div>
            <Form.List name="rights">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field) => (
                    <Space.Compact key={field.key} style={{ display: 'flex', marginBottom: 8 }}>
                      <Form.Item name={[field.name, 'text']} noStyle rules={[{ required: true, message: 'Pasangan wajib diisi' }]}>
                        <Input placeholder={`Pasangan kanan ${field.name + 1}`} />
                      </Form.Item>
                      {fields.length > 2 && (
                        <Button icon={<MinusCircleOutlined />} onClick={() => remove(field.name)} style={{ width: 40 }} />
                      )}
                    </Space.Compact>
                  ))}
                  {fields.length < 6 && (
                    <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ text: '' })} style={{ width: '100%' }}>
                      Tambah pasangan kanan
                    </Button>
                  )}
                </>
              )}
            </Form.List>
            <MatchingKeyEditor lefts={optionsValue ?? []} rights={rightsValue ?? []} />
          </>
        ) : (
          <>
            <div style={{ marginBottom: 6, fontWeight: 600, fontSize: 13.5 }}>Opsi jawaban</div>
            <Form.List
              name="options"
              rules={[
                {
                  validator: async (_, value) => {
                    const filled = (value ?? []).filter((o: { text?: string }) => (o?.text ?? '').trim() !== '')
                    if (filled.length < 2) throw new Error('Minimal 2 opsi jawaban terisi')
                  },
                },
              ]}
            >
              {(fields, { add, remove }, { errors }) => (
                <>
                  {fields.map((field) =>
                    type === 'pg_multi' ? (
                      <Space.Compact key={field.key} style={{ display: 'flex', marginBottom: 8 }}>
                        <Form.Item name={[field.name, 'key']} valuePropName="checked" noStyle>
                          <Checkbox
                            style={{ width: 44, flexShrink: 0, display: 'grid', placeItems: 'center' }}
                            title={`Tandai ${OPTION_LETTERS[field.name]} sebagai kunci`}
                          >
                            {OPTION_LETTERS[field.name]}
                          </Checkbox>
                        </Form.Item>
                        <Form.Item name={[field.name, 'text']} noStyle rules={[{ required: true, message: `Teks opsi ${OPTION_LETTERS[field.name]} wajib diisi` }]}>
                          <Input placeholder={`Teks opsi ${OPTION_LETTERS[field.name]}`} />
                        </Form.Item>
                        {fields.length > 2 && (
                          <Button icon={<DeleteOutlined />} onClick={() => remove(field.name)} style={{ width: 40, flexShrink: 0 }} />
                        )}
                      </Space.Compact>
                    ) : (
                      <Space.Compact key={field.key} style={{ display: 'flex', marginBottom: 8 }}>
                        <Button
                          type={form.getFieldValue('answer_key') === OPTION_LETTERS[field.name] ? 'primary' : 'default'}
                          onClick={() => form.setFieldValue('answer_key', OPTION_LETTERS[field.name])}
                          style={{ width: 44, flexShrink: 0 }}
                          title={`Jadikan kunci jawaban ${OPTION_LETTERS[field.name]}`}
                          disabled={(optionsValue?.[field.name]?.text ?? '').trim() === ''}
                        >
                          {OPTION_LETTERS[field.name]}
                        </Button>
                        <Form.Item name={[field.name, 'text']} noStyle rules={[{ required: true, message: `Teks opsi ${OPTION_LETTERS[field.name]} wajib diisi` }]}>
                          <Input placeholder={`Teks opsi ${OPTION_LETTERS[field.name]}`} />
                        </Form.Item>
                        {fields.length > 2 && (
                          <Button icon={<DeleteOutlined />} onClick={() => remove(field.name)} style={{ width: 40, flexShrink: 0 }} />
                        )}
                      </Space.Compact>
                    ),
                  )}
                  <Form.ErrorList errors={errors} />
                  {fields.length < OPTION_KEYS.length && (
                    <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ text: '' })} style={{ width: '100%' }}>
                      Tambah opsi {OPTION_LETTERS[fields.length]}
                    </Button>
                  )}
                </>
              )}
            </Form.List>
            {type === 'pg' && (
              <Form.Item name="answer_key" label="Kunci jawaban" rules={[{ required: true, message: 'Pilih kunci jawaban' }]} style={{ marginTop: 12 }}>
                <Radio.Group
                  optionType="button"
                  buttonStyle="solid"
                  options={OPTION_KEYS.slice(0, Math.max(2, filledCount)).map((k) => ({ label: k, value: k }))}
                />
              </Form.Item>
            )}
            {type === 'pg_multi' && (
              <div style={{ fontSize: 12.5, color: token.colorTextTertiary, marginTop: 4 }}>
                Centang semua huruf yang merupakan kunci (boleh lebih dari satu). Skor PG kompleks dihitung proporsional.
              </div>
            )}
          </>
        )}

        <Form.Item name="explanation" label="Pembahasan (opsional)" style={{ marginTop: 12 }}>
          <Input.TextArea rows={2} placeholder="Penjelasan jawaban / rubrik penilaian essay" maxLength={1000} />
        </Form.Item>
      </Form>
    </AppModal>
  )
}

/** Editor pasangan kunci menjodohkan: per item kiri pilih pasangan kanan. */
function MatchingKeyEditor({
  lefts,
  rights,
}: {
  lefts: { text?: string }[]
  rights: { text?: string }[]
}) {
  const form = Form.useFormInstance()
  const filledRights = rights.filter((r) => (r?.text ?? '').trim() !== '')
  const options = filledRights.map((r, i) => ({ value: `R${i + 1}`, label: `R${i + 1}. ${r.text}` }))
  const correctPairs = Form.useWatch('correct_pairs', form) ?? {}

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ marginBottom: 6, fontWeight: 600, fontSize: 13.5 }}>Kunci pasangan</div>
      {lefts
        .map((l, i) => ({ l, i }))
        .filter(({ l }) => (l?.text ?? '').trim() !== '')
        .map(({ l, i }) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ minWidth: 200, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {l.text}
            </span>
            <span style={{ color: 'rgba(0,0,0,0.35)' }}>→</span>
            <Select
              style={{ width: 280 }}
              placeholder="Pilih pasangan kanan"
              value={correctPairs[String(i + 1)]}
              onChange={(v) => {
                const next = { ...correctPairs, [String(i + 1)]: v }
                form.setFieldValue('correct_pairs', next)
              }}
              options={options}
            />
          </div>
        ))}
      {filledRights.length < 2 && (
        <div style={{ fontSize: 12.5, color: 'rgba(0,0,0,0.45)' }}>Isi minimal 2 pasangan kanan terlebih dahulu.</div>
      )}
    </div>
  )
}
