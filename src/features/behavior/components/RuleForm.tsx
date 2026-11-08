import { useEffect, useMemo } from 'react'
import { AutoComplete, Form, Input, InputNumber, Segmented } from 'antd'
import { FallOutlined, FileDoneOutlined, RiseOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { StatusTag } from '../../../shared/components/StatusTag'
import { usePointRulesBrief } from '../hooks'
import type { PointRule, RuleFormValues } from '../types'
import { pointRuleNameExists } from '../api'

// Kategori bawaan (sesuai seed) — digabung dengan kategori yang sudah dipakai
const PRESET_CATEGORIES = [
  'Kedisiplinan',
  'Kehadiran',
  'Perilaku',
  'Kesehatan',
  'Kejujuran',
  'Kerapian',
  'Kebaikan',
  'Prestasi',
]

// Nilai mentah form: tipe & besaran dipisah, tanda poin diturunkan saat submit
interface RuleFormState {
  name: string
  kind: 'negative' | 'positive'
  magnitude: number
  category?: string
}

interface RuleFormProps {
  open: boolean
  rule: PointRule | null
  submitting: boolean
  onCancel: () => void
  onSubmit: (values: RuleFormValues) => void
}

export function RuleForm({ open, rule, submitting, onCancel, onSubmit }: RuleFormProps) {
  const [form] = Form.useForm<RuleFormState>()
  const { data: brief } = usePointRulesBrief()

  const categoryOptions = useMemo(() => {
    const set = new Set(PRESET_CATEGORIES)
    for (const r of brief ?? []) if (r.category) set.add(r.category)
    return [...set].sort((a, b) => a.localeCompare(b)).map((c) => ({ value: c }))
  }, [brief])

  useEffect(() => {
    if (!open) return
    if (rule) {
      form.setFieldsValue({
        name: rule.name,
        kind: rule.points < 0 ? 'negative' : 'positive',
        magnitude: Math.abs(rule.points),
        category: rule.category ?? undefined,
      })
    } else {
      form.resetFields()
    }
  }, [open, rule, form])

  const handleFinish = (values: RuleFormState) => {
    const points =
      values.kind === 'negative' ? -Math.abs(values.magnitude) : Math.abs(values.magnitude)
    onSubmit({ name: values.name, points, category: values.category })
  }

  return (
    <AppModal
      title={rule ? 'Edit Aturan Poin' : 'Tambah Aturan Poin'}
      subtitle={rule ? 'Perbarui detail aturan poin' : 'Aturan pelanggaran atau prestasi beserta bobot poinnya'}
      icon={<FileDoneOutlined />}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      width={480}
      destroyOnHidden
    >
      <Form<RuleFormState>
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        disabled={submitting}
        initialValues={{ kind: 'negative' }}
      >
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

        <Form.Item name="kind" label="Tipe">
          <Segmented
            block
            options={[
              { label: 'Pelanggaran', value: 'negative', icon: <FallOutlined /> },
              { label: 'Prestasi', value: 'positive', icon: <RiseOutlined /> },
            ]}
          />
        </Form.Item>

        {/* Tanda poin mengikuti tipe — user hanya mengisi besarannya */}
        <Form.Item noStyle shouldUpdate={() => true}>
          {({ getFieldValue }) => {
            const kind = (getFieldValue('kind') as RuleFormState['kind']) ?? 'negative'
            const magnitude = (getFieldValue('magnitude') as number | undefined) ?? 0
            return (
              <Form.Item
                name="magnitude"
                label="Jumlah Poin"
                rules={[{ required: true, message: 'Jumlah poin wajib diisi' }]}
                extra={
                  magnitude > 0 ? (
                    <StatusTag
                      color={kind === 'negative' ? 'red' : 'green'}
                      icon={kind === 'negative' ? <FallOutlined /> : <RiseOutlined />}
                    >
                      {`${kind === 'negative' ? '−' : '+'}${magnitude} poin`}
                    </StatusTag>
                  ) : undefined
                }
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={1}
                  max={200}
                  precision={0}
                  placeholder="Contoh: 10"
                  addonBefore={kind === 'negative' ? '−' : '+'}
                />
              </Form.Item>
            )
          }}
        </Form.Item>

        <Form.Item name="category" label="Kategori">
          <AutoComplete
            options={categoryOptions}
            filterOption={(input, option) =>
              String(option?.value ?? '').toLowerCase().includes(input.toLowerCase())
            }
            placeholder="Contoh: Kedisiplinan"
          />
        </Form.Item>
      </Form>
    </AppModal>
  )
}
