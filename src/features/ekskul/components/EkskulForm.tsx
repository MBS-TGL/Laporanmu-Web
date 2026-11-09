import { useEffect } from 'react'
import { Form, Input, Select } from 'antd'
import { TrophyOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { useTeachersBrief } from '../hooks'
import type { Ekskul, EkskulFormValues } from '../types'

interface EkskulFormProps {
  open: boolean
  ekskul: Ekskul | null
  submitting: boolean
  onCancel: () => void
  onSubmit: (values: EkskulFormValues) => void
}

export function EkskulForm({ open, ekskul, submitting, onCancel, onSubmit }: EkskulFormProps) {
  const [form] = Form.useForm<EkskulFormValues>()
  const teachersQuery = useTeachersBrief()

  useEffect(() => {
    if (!open) return
    if (ekskul) {
      form.setFieldsValue({
        name: ekskul.name,
        coach_id: ekskul.coach_id ?? undefined,
        schedule: ekskul.schedule ?? undefined,
        place: ekskul.place ?? undefined,
        description: ekskul.description ?? undefined,
      })
    } else {
      form.resetFields()
    }
  }, [open, ekskul, form])

  return (
    <AppModal
      title={ekskul ? 'Edit Ekstrakurikuler' : 'Tambah Ekstrakurikuler'}
      subtitle={ekskul ? 'Perbarui detail kegiatan' : 'Kegiatan ekstrakurikuler beserta pembina'}
      icon={<TrophyOutlined />}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      width={480}
      destroyOnHidden
    >
      <Form<EkskulFormValues> form={form} layout="vertical" onFinish={onSubmit} disabled={submitting}>
        <Form.Item
          name="name"
          label="Nama Kegiatan"
          rules={[{ required: true, message: 'Nama kegiatan wajib diisi' }]}
        >
          <Input placeholder="Contoh: Pramuka" maxLength={100} />
        </Form.Item>

        <Form.Item name="coach_id" label="Pembina">
          <Select
            showSearch
            optionFilterProp="label"
            allowClear
            placeholder="Pilih pembina"
            loading={teachersQuery.isPending}
            options={(teachersQuery.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
          />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
          <Form.Item name="schedule" label="Jadwal">
            <Input placeholder="Contoh: Jumat sore" maxLength={80} />
          </Form.Item>
          <Form.Item name="place" label="Tempat">
            <Input placeholder="Contoh: Lapangan utama" maxLength={80} />
          </Form.Item>
        </div>

        <Form.Item name="description" label="Keterangan">
          <Input.TextArea rows={2} placeholder="Keterangan singkat (opsional)" maxLength={300} />
        </Form.Item>
      </Form>
    </AppModal>
  )
}
