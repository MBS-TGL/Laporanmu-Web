import { useEffect } from 'react'
import { AutoComplete, Form, Input, InputNumber, Switch } from 'antd'
import { BookOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { subjectCodeExists } from '../api'
import type { Subject, SubjectFormValues } from '../types'

// Kategori bawaan — digabung dengan kategori yang sudah dipakai
const PRESET_CATEGORIES = ['Umum', 'Diniyah', 'Bahasa', 'Keagamaan', 'Muatan Lokal']

interface SubjectFormProps {
  open: boolean
  subject: Subject | null
  submitting: boolean
  onCancel: () => void
  onSubmit: (values: SubjectFormValues) => void
}

export function SubjectForm({ open, subject, submitting, onCancel, onSubmit }: SubjectFormProps) {
  const [form] = Form.useForm<SubjectFormValues>()

  useEffect(() => {
    if (!open) return
    if (subject) {
      form.setFieldsValue({
        name: subject.name,
        code: subject.code ?? undefined,
        weekly_hours: subject.weekly_hours,
        category: subject.category ?? undefined,
        description: subject.description ?? undefined,
        is_active: subject.is_active,
      })
    } else {
      form.resetFields()
    }
  }, [open, subject, form])

  return (
    <AppModal
      title={subject ? 'Edit Mata Pelajaran' : 'Tambah Mata Pelajaran'}
      subtitle={subject ? 'Perbarui detail mata pelajaran' : 'Mapel yang diajarkan beserta jam per minggu'}
      icon={<BookOutlined />}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      width={480}
      destroyOnHidden
    >
      <Form<SubjectFormValues>
        form={form}
        layout="vertical"
        onFinish={onSubmit}
        disabled={submitting}
        initialValues={{ weekly_hours: 2, is_active: true }}
      >
        <Form.Item
          name="name"
          label="Nama Mapel"
          rules={[{ required: true, message: 'Nama mapel wajib diisi' }]}
        >
          <Input placeholder="Contoh: Matematika" maxLength={100} />
        </Form.Item>

        <Form.Item
          name="code"
          label="Kode Mapel"
          rules={[
            {
              validator: async (_, value: string | undefined) => {
                if (!value?.trim() || value.trim() === subject?.code) return
                if (await subjectCodeExists(value.trim())) {
                  throw new Error('Kode mapel sudah dipakai')
                }
              },
            },
          ]}
        >
          <Input placeholder="Contoh: MAT" maxLength={20} style={{ textTransform: 'uppercase' }} />
        </Form.Item>

        <Form.Item name="category" label="Kelompok">
          <AutoComplete
            options={PRESET_CATEGORIES.map((c) => ({ value: c }))}
            filterOption={(input, option) =>
              String(option?.value ?? '').toLowerCase().includes(input.toLowerCase())
            }
            placeholder="Contoh: Umum"
          />
        </Form.Item>

        <Form.Item
          name="weekly_hours"
          label="Jam Pelajaran per Minggu"
          rules={[{ required: true, message: 'JP wajib diisi' }]}
        >
          <InputNumber style={{ width: '100%' }} min={0} max={40} precision={0} placeholder="Contoh: 3" />
        </Form.Item>

        <Form.Item name="description" label="Keterangan">
          <Input.TextArea rows={2} placeholder="Keterangan singkat (opsional)" maxLength={300} />
        </Form.Item>

        <Form.Item name="is_active" label="Status" valuePropName="checked">
          <Switch checkedChildren="Aktif" unCheckedChildren="Nonaktif" />
        </Form.Item>
      </Form>
    </AppModal>
  )
}
