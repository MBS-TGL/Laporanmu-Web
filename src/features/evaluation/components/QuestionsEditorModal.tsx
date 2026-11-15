import { useEffect } from 'react'
import { Button, Form, Input, InputNumber, Select, Space } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import type { EvalQuestion, Instrument } from '../types'

interface QuestionsEditorModalProps {
  open: boolean
  instrument: Instrument | null
  onClose: () => void
  onSave: (questions: EvalQuestion[]) => Promise<void>
}

const TYPES = [
  { value: 'skala', label: 'Skala 1–5' },
  { value: 'pilihan', label: 'Pilihan Ganda' },
  { value: 'teks', label: 'Isian Teks' },
  { value: 'teman', label: 'Pilih Teman (Sosiometri)' },
]

/** Sunting daftar pertanyaan angket (teks, tipe, dimensi, maks skala). */
export function QuestionsEditorModal({ open, instrument, onClose, onSave }: QuestionsEditorModalProps) {
  const [form] = Form.useForm()

  useEffect(() => {
    if (!open) return
    form.setFieldsValue({
      questions: (instrument?.questions ?? []).map((q) => ({
        text: q.text,
        type: q.type,
        dimension: q.dimension,
        max: q.max ?? 5,
      })),
    })
  }, [open, instrument, form])

  const handleOk = async () => {
    const values = await form.validateFields()
    const questions: EvalQuestion[] = (values.questions ?? []).map((q: { text: string; type: string; dimension?: string; max?: number }, i: number) => {
      const base: EvalQuestion = {
        id: `${instrument?.kind ?? 'custom'}-${i + 1}`,
        text: q.text.trim(),
        type: q.type as EvalQuestion['type'],
        dimension: q.dimension?.trim() || undefined,
      }
      if (q.type === 'skala') base.max = q.max ?? 5
      return base
    })
    await onSave(questions)
  }

  return (
    <AppModal
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      okText="Simpan Pertanyaan"
      title={`Sunting Pertanyaan · ${instrument?.title ?? ''}`}
      subtitle="Dimensi dipakai untuk analisis per kelompok (AKPD/EDOM) atau pasangan MBTI (mis. I-E)"
      width={760}
      destroyOnHidden
      maskClosable={false}
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.List
          name="questions"
          rules={[
            {
              validator: async (_, value) => {
                if (!value || value.length < 1) throw new Error('Minimal 1 pertanyaan')
              },
            },
          ]}
        >
          {(fields, { add, remove }, { errors }) => (
            <>
              {fields.map((field) => (
                <div
                  key={field.key}
                  style={{
                    border: '1px solid rgba(0,0,0,0.08)',
                    borderRadius: 10,
                    padding: '10px 12px',
                    marginBottom: 10,
                  }}
                >
                  <Form.Item name={[field.name, 'text']} noStyle rules={[{ required: true, message: 'Pertanyaan wajib diisi' }]}>
                    <Input.TextArea rows={2} placeholder="Teks pertanyaan" style={{ marginBottom: 8 }} />
                  </Form.Item>
                  <Space size={10} wrap>
                    <Form.Item name={[field.name, 'type']} noStyle rules={[{ required: true }]}>
                      <Select options={TYPES} style={{ width: 190 }} />
                    </Form.Item>
                    <Form.Item name={[field.name, 'dimension']} noStyle>
                      <Input placeholder="Dimensi (mis. Akademik / I-E)" style={{ width: 210 }} />
                    </Form.Item>
                    <Form.Item noStyle shouldUpdate={(p, c) => p.questions?.[field.name]?.type !== c.questions?.[field.name]?.type}>
                      {() => {
                        const t = form.getFieldValue(['questions', field.name, 'type'])
                        return t === 'skala' ? (
                          <Form.Item name={[field.name, 'max']} noStyle>
                            <InputNumber min={2} max={10} placeholder="Maks 5" style={{ width: 90 }} />
                          </Form.Item>
                        ) : null
                      }}
                    </Form.Item>
                    {fields.length > 1 && (
                      <Button icon={<DeleteOutlined />} onClick={() => remove(field.name)} danger />
                    )}
                  </Space>
                </div>
              ))}
              <Form.ErrorList errors={errors} />
              <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ text: '', type: 'skala', dimension: '', max: 5 })} style={{ width: '100%' }}>
                Tambah Pertanyaan
              </Button>
            </>
          )}
        </Form.List>
      </Form>
    </AppModal>
  )
}
