import { useEffect } from 'react'
import { DatePicker, Form, Input, Select, Typography } from 'antd'
import { SwapOutlined } from '@ant-design/icons'
import { type Dayjs } from 'dayjs'
import { AppModal } from '../../../shared/components/AppModal'
import { useCreateSubstitution, useTeachersBrief } from '../hooks'
import type { Schedule } from '../types'

interface SubstitutionModalProps {
  open: boolean
  schedule: Schedule | null
  date: Dayjs
  onClose: () => void
}

interface FormValues {
  substitute_teacher_id: string
  date: Dayjs
  note?: string
}

export function SubstitutionModal({ open, schedule, date, onClose }: SubstitutionModalProps) {
  const [form] = Form.useForm<FormValues>()
  const teachersQuery = useTeachersBrief()
  const createMutation = useCreateSubstitution()

  useEffect(() => {
    if (open) {
      form.resetFields()
      form.setFieldsValue({
        date: date,
      })
    }
  }, [open, date, form])

  if (!schedule) return null

  const handleSave = async () => {
    try {
      const vals = await form.validateFields()
      createMutation.mutate(
        {
          schedule_id: schedule.id,
          date: vals.date.format('YYYY-MM-DD'),
          original_teacher_id: schedule.teacher_id,
          substitute_teacher_id: vals.substitute_teacher_id,
          note: vals.note,
        },
        { onSuccess: onClose }
      )
    } catch {
      // validation error
    }
  }

  return (
    <AppModal
      open={open}
      title="Tunjuk Guru Pengganti"
      subtitle="Catat penggantian mengajar untuk jadwal ini"
      icon={<SwapOutlined />}
      onCancel={onClose}
      onOk={handleSave}
      okText="Simpan Pengganti"
      confirmLoading={createMutation.isPending}
      destroyOnHidden
      width={460}
    >
      <div style={{ marginBottom: 16 }}>
        <Typography.Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 4 }}>
          Jadwal: <b>{schedule.classes?.name}</b> · {schedule.subjects?.name} ({schedule.start_time.slice(0, 5)} - {schedule.end_time.slice(0, 5)})
        </Typography.Paragraph>
        <Typography.Paragraph type="secondary" style={{ fontSize: 13, margin: 0 }}>
          Guru Asli: <b>{schedule.teachers?.name ?? 'Belum ditentukan'}</b>
        </Typography.Paragraph>
      </div>

      <Form form={form} layout="vertical">
        <Form.Item name="date" label="Tanggal Penggantian" rules={[{ required: true }]}>
          <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          name="substitute_teacher_id"
          label="Pilih Guru Pengganti"
          rules={[{ required: true, message: 'Pilih guru pengganti' }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Pilih guru yang bertugas"
            loading={teachersQuery.isPending}
            options={(teachersQuery.data ?? [])
              .filter((t) => t.id !== schedule.teacher_id)
              .map((t) => ({ value: t.id, label: t.name }))}
          />
        </Form.Item>

        <Form.Item name="note" label="Alasan / Catatan Penugasan">
          <Input.TextArea rows={2} placeholder="Misal: Guru utama tugas luar / dinas" />
        </Form.Item>
      </Form>
    </AppModal>
  )
}
