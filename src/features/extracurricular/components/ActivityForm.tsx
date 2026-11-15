import { useEffect } from 'react'
import { Form, Input, Select } from 'antd'
import { TrophyOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { useTeachersBrief } from '../hooks'
import type { Activity, ActivityFormValues } from '../types'

interface ActivityFormProps {
  open: boolean
  activity: Activity | null
  submitting: boolean
  onCancel: () => void
  onSubmit: (values: ActivityFormValues) => void
}

export function ActivityForm({ open, activity, submitting, onCancel, onSubmit }: ActivityFormProps) {
  const [form] = Form.useForm<ActivityFormValues>()
  const teachersQuery = useTeachersBrief()

  useEffect(() => {
    if (!open) return
    if (activity) {
      form.setFieldsValue({
        name: activity.name,
        coach_id: activity.coach_id ?? undefined,
        schedule: activity.schedule ?? undefined,
        place: activity.place ?? undefined,
        description: activity.description ?? undefined,
      })
    } else {
      form.resetFields()
    }
  }, [open, activity, form])

  return (
    <AppModal
      title={activity ? 'Edit Ekstrakurikuler' : 'Tambah Ekstrakurikuler'}
      subtitle={activity ? 'Perbarui detail kegiatan' : 'Kegiatan ekstrakurikuler beserta pembina'}
      icon={<TrophyOutlined />}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      size="sm"
      destroyOnHidden
    >
      <Form<ActivityFormValues> form={form} layout="vertical" onFinish={onSubmit} disabled={submitting}>
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
