import { useEffect } from 'react'
import { Form, Input, InputNumber, Select } from 'antd'
import { ApartmentOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import type { Dorm, DormFormValues } from '../types'
import { useMusyrifBrief } from '../hooks'

interface DormFormProps {
  open: boolean
  dorm: Dorm | null
  submitting: boolean
  onCancel: () => void
  onSubmit: (values: DormFormValues) => void
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Aktif' },
  { value: 'full', label: 'Penuh' },
  { value: 'inactive', label: 'Nonaktif' },
]

const GENDER_OPTIONS = [
  { value: 'male', label: 'Putra' },
  { value: 'female', label: 'Putri' },
  { value: 'mixed', label: 'Campur' },
]

export function DormForm({ open, dorm, submitting, onCancel, onSubmit }: DormFormProps) {
  const [form] = Form.useForm<DormFormValues>()
  const musyrifQuery = useMusyrifBrief()

  useEffect(() => {
    if (!open) return
    if (dorm) {
      form.setFieldsValue({
        name: dorm.name,
        gender: dorm.gender ?? undefined,
        capacity: dorm.capacity,
        musyrif_id: dorm.musyrif_id ?? undefined,
        status: dorm.status ?? 'active',
      })
    } else {
      form.resetFields()
      form.setFieldsValue({ status: 'active', capacity: 1, gender: undefined })
    }
  }, [open, dorm, form])

  return (
    <AppModal
      title={dorm ? 'Edit Kamar' : 'Tambah Kamar'}
      subtitle={dorm ? 'Perbarui kamar & musyrif' : 'Kamar asrama dan plotting santri'}
      icon={<ApartmentOutlined />}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      width={520}
      destroyOnHidden
    >
      <Form<DormFormValues> form={form} layout="vertical" onFinish={onSubmit} disabled={submitting}>
        <Form.Item
          name="name"
          label="Nama Kamar / Gedung"
          rules={[{ required: true, message: 'Nama kamar wajib diisi' }]}
        >
          <Input placeholder="Contoh: Melati A1" maxLength={80} />
        </Form.Item>

        <Form.Item name="gender" label="Gender Penghuni">
          <Select placeholder="Pilih" options={GENDER_OPTIONS} allowClear />
        </Form.Item>

        <Form.Item
          name="capacity"
          label="Kapasitas"
          rules={[{ required: true, message: 'Kapasitas wajib diisi' }]}
        >
          <InputNumber style={{ width: '100%' }} min={1} max={100} />
        </Form.Item>

        <Form.Item name="musyrif_id" label="Musyrif Penanggung Jawab">
          <Select
            placeholder="Pilih musyrif (opsional)"
            allowClear
            loading={musyrifQuery.isPending}
            showSearch
            optionFilterProp="label"
            options={(musyrifQuery.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
          />
        </Form.Item>

        <Form.Item
          name="status"
          label="Status"
          rules={[{ required: true, message: 'Status wajib dipilih' }]}
        >
          <Select options={STATUS_OPTIONS} />
        </Form.Item>
      </Form>
    </AppModal>
  )
}
