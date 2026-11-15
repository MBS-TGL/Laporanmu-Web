import { useEffect } from 'react'
import { Form, Input, InputNumber, Select, Space, Switch } from 'antd'
import { FileProtectOutlined } from '@ant-design/icons'
import { useFlag } from '../../../shared/hooks/useFeatureFlags'
import { AppModal } from '../../../shared/components/AppModal'
import { useSubjectOptions } from '../useSubjectOptions'
import { EXAM_TYPE_LABEL, type CbtExam, type ExamFormValues, type ExamType } from '../types'

interface ExamModalProps {
  open: boolean
  onClose: () => void
  initial?: CbtExam | null
  onSave: (values: ExamFormValues, id?: string) => Promise<void>
}

/** Form sesi ujian CBT: identitas, durasi, jenis penilaian, dan shuffle. */
export function ExamModal({ open, onClose, initial, onSave }: ExamModalProps) {
  const [form] = Form.useForm<ExamFormValues>()
  const csOptions = useSubjectOptions()
  const advanced = useFlag('module.cbt_lanjutan')
  const editing = Boolean(initial)

  useEffect(() => {
    if (!open) return
    if (initial) {
      form.setFieldsValue({
        title: initial.title,
        class_subject_id: initial.class_subject_id,
        duration_minutes: initial.duration_minutes,
        exam_type: initial.exam_type,
        question_count: initial.question_count ?? undefined,
        show_explanations: initial.show_explanations,
        show_leaderboard: initial.show_leaderboard,
        shuffle_questions: initial.shuffle_questions,
        shuffle_options: initial.shuffle_options,
      })
    } else {
      form.setFieldsValue({
        title: '',
        duration_minutes: 60,
        exam_type: 'sumatif',
        question_count: undefined,
        difficulty_mix: undefined,
        show_explanations: false,
        show_leaderboard: false,
        shuffle_questions: true,
        shuffle_options: true,
      })
    }
  }, [open, initial, form])

  const handleOk = async () => {
    const values = await form.validateFields()
    await onSave(values, initial?.id)
  }

  return (
    <AppModal
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      okText={editing ? 'Simpan' : 'Buat Ujian'}
      title={editing ? 'Ubah Ujian' : 'Buat Sesi Ujian'}
      subtitle="Ujian diambil santri via token, nilainya mengalir ke penilaian sesuai jenis"
      width={560}
      destroyOnHidden
      maskClosable={false}
      icon={<FileProtectOutlined />}
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item name="title" label="Judul ujian" rules={[{ required: true, message: 'Judul wajib diisi' }]}>
          <Input placeholder="Contoh: PTS Matematika Kelas 7A" maxLength={150} showCount />
        </Form.Item>

        <Form.Item name="class_subject_id" label="Kelas & mapel" rules={[{ required: true, message: 'Pilih kelas & mapel' }]}>
          <Select
            showSearch
            placeholder="Pilih kelas & mapel"
            loading={csOptions.loading}
            options={csOptions.options}
            filterOption={(input, option) =>
              String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
          />
        </Form.Item>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          <Form.Item
            name="duration_minutes"
            label="Durasi (menit)"
            rules={[{ required: true, message: 'Durasi wajib diisi' }]}
            style={{ width: 150, marginBottom: 16 }}
          >
            <InputNumber min={5} max={600} step={5} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="exam_type" label="Jenis penilaian" rules={[{ required: true }]} style={{ width: 160, marginBottom: 16 }}>
            <Select options={(Object.keys(EXAM_TYPE_LABEL) as ExamType[]).map((k) => ({ value: k, label: EXAM_TYPE_LABEL[k] }))} />
          </Form.Item>
          <Form.Item
            name="question_count"
            label="Jumlah soal diacak"
            style={{ width: 170, marginBottom: 16 }}
            extra="Kosong = semua soal dari bank"
          >
            <InputNumber min={1} placeholder="Semua" style={{ width: '100%' }} />
          </Form.Item>
        </div>

        {advanced && (
          <Form.Item
            label="Sebaran kesulitan (opsional)"
            extra="Kosong = acak murni. Isi jumlah soal per tingkat kesulitan."
            style={{ marginBottom: 8 }}
          >
            <Space size={12} wrap>
              <Form.Item name={['difficulty_mix', 'mudah']} noStyle>
                <InputNumber<number> min={0} placeholder="Mudah" style={{ width: 100 }} />
              </Form.Item>
              <Form.Item name={['difficulty_mix', 'sedang']} noStyle>
                <InputNumber<number> min={0} placeholder="Sedang" style={{ width: 100 }} />
              </Form.Item>
              <Form.Item name={['difficulty_mix', 'sulit']} noStyle>
                <InputNumber<number> min={0} placeholder="Sulit" style={{ width: 100 }} />
              </Form.Item>
            </Space>
          </Form.Item>
        )}

        <Form.Item
          name="shuffle_questions"
          label="Acak urutan soal"
          valuePropName="checked"
          style={{ marginBottom: 8 }}
        >
          <Switch />
        </Form.Item>
        <Form.Item name="shuffle_options" label="Acak urutan opsi jawaban" valuePropName="checked">
          <Switch />
        </Form.Item>
        {advanced && (
          <Form.Item name="show_explanations" label="Review jawaban + pembahasan pasca-ujian" valuePropName="checked" style={{ marginBottom: 8 }}>
            <Switch />
          </Form.Item>
        )}
        {advanced && (
          <Form.Item name="show_leaderboard" label="Papan peringkat anonim untuk santri" valuePropName="checked">
            <Switch />
          </Form.Item>
        )}
      </Form>
    </AppModal>
  )
}
