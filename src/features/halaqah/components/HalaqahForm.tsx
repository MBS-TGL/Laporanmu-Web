import { useEffect } from 'react'
import { Form, Input, InputNumber, Select } from 'antd'
import { DeploymentUnitOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { useTeachersBrief } from '../hooks'
import type { HalaqahFormValues, HalaqahGroup } from '../types'

interface HalaqahFormProps {
  open: boolean
  group: HalaqahGroup | null
  submitting: boolean
  onCancel: () => void
  onSubmit: (values: HalaqahFormValues) => void
}

export function HalaqahForm({ open, group, submitting, onCancel, onSubmit }: HalaqahFormProps) {
  const [form] = Form.useForm<HalaqahFormValues>()
  const teachersQuery = useTeachersBrief()

  useEffect(() => {
    if (!open) return
    if (group) {
      form.setFieldsValue({
        name: group.name,
        musyrif_id: group.musyrif_id ?? undefined,
        gender: group.gender ?? undefined,
        place: group.place ?? undefined,
        schedule: group.schedule ?? undefined,
        capacity: group.capacity,
        notes: group.notes ?? undefined,
      })
    } else {
      form.resetFields()
    }
  }, [open, group, form])

  return (
    <AppModal
      title={group ? 'Edit Halaqah' : 'Tambah Halaqah'}
      subtitle={group ? 'Perbarui detail halaqah' : 'Kelompok halaqah beserta musyrifnya'}
      icon={<DeploymentUnitOutlined />}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      width={480}
      destroyOnHidden
    >
      <Form<HalaqahFormValues>
        form={form}
        layout="vertical"
        onFinish={onSubmit}
        disabled={submitting}
        initialValues={{ capacity: 20 }}
      >
        <Form.Item
          name="name"
          label="Nama Halaqah"
          rules={[{ required: true, message: 'Nama halaqah wajib diisi' }]}
        >
          <Input placeholder="Contoh: Halaqah Al-Fatih" maxLength={100} />
        </Form.Item>

        <Form.Item name="musyrif_id" label="Musyrif">
          <Select
            showSearch
            optionFilterProp="label"
            allowClear
            placeholder="Pilih musyrif / ustadz"
            loading={teachersQuery.isPending}
            options={(teachersQuery.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
          />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
          <Form.Item name="gender" label="Kategori">
            <Select
              allowClear
              placeholder="Putra / Putri"
              options={[
                { value: 'L', label: 'Putra' },
                { value: 'P', label: 'Putri' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="capacity"
            label="Kapasitas"
            rules={[{ required: true, message: 'Kapasitas wajib diisi' }]}
          >
            <InputNumber style={{ width: '100%' }} min={0} max={200} precision={0} />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
          <Form.Item name="place" label="Tempat">
            <Input placeholder="Contoh: Aula Putra" maxLength={80} />
          </Form.Item>
          <Form.Item name="schedule" label="Jadwal">
            <Input placeholder="Contoh: Ba'da Maghrib" maxLength={80} />
          </Form.Item>
        </div>

        <Form.Item name="notes" label="Keterangan">
          <Input.TextArea rows={2} placeholder="Keterangan singkat (opsional)" maxLength={300} />
        </Form.Item>
      </Form>
    </AppModal>
  )
}
