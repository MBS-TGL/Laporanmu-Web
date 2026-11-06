import { useEffect } from 'react'
import { Form, Input, InputNumber } from 'antd'
import { AppModal } from '../../../shared/components/AppModal'
import type { PointRule, PointRuleFormValues } from '../types'
import { pointRuleNameExists } from '../api'

interface PointRuleFormProps {
  open: boolean
  rule: PointRule | null
  submitting: boolean
  onCancel: () => void
  onSubmit: (values: PointRuleFormValues) => void
}

export function PointRuleForm({ open, rule, submitting, onCancel, onSubmit }: PointRuleFormProps) {
  const [form] = Form.useForm<PointRuleFormValues>()

  useEffect(() => {
    if (!open) return
    if (rule) {
      form.setFieldsValue({
        name: rule.name,
        points: rule.points,
        category: rule.category ?? undefined,
      })
    } else {
      form.resetFields()
    }
  }, [open, rule, form])

  return (
    <AppModal
      title={rule ? 'Edit Aturan Poin' : 'Tambah Aturan Poin'}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      width={480}
      destroyOnHidden
    >
      <Form<PointRuleFormValues> form={form} layout="vertical" onFinish={onSubmit} disabled={submitting}>
        <Form.Item
          name="name"
          label="Nama Aturan"
          rules={[
            { required: true, message: 'Nama aturan wajib diisi' },
            {
              validator: async (_, value: string | undefined) => {
                if (!value || value === rule?.name) return
                if (await pointRuleNameExists(value)) {
                  throw new Error('Nama aturan sudah dipakai')
                }
              },
            },
          ]}
        >
          <Input placeholder="Contoh: Terlambat masuk kelas" maxLength={100} />
        </Form.Item>

        <Form.Item
          name="points"
          label="Poin (negatif = pelanggaran, positif = prestasi)"
          rules={[{ required: true, message: 'Poin wajib diisi' }]}
        >
          <InputNumber style={{ width: '100%' }} min={-200} max={200} precision={0} placeholder="Contoh: -10" />
        </Form.Item>

        <Form.Item name="category" label="Kategori">
          <Input placeholder="Contoh: Kedisiplinan" maxLength={50} />
        </Form.Item>
      </Form>
    </AppModal>
  )
}
