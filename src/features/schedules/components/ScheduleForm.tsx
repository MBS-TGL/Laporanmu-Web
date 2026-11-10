import { useEffect } from 'react'
import { Form, Input, Select, TimePicker } from 'antd'
import { CalendarOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { AppModal } from '../../../shared/components/AppModal'
import { useClassesBrief, useSubjectsBrief, useTeachersBrief } from '../hooks'
import type { Schedule, ScheduleFormValues } from '../types'

const DAY_OPTIONS = [
  { value: 1, label: 'Senin' },
  { value: 2, label: 'Selasa' },
  { value: 3, label: 'Rabu' },
  { value: 4, label: 'Kamis' },
  { value: 5, label: 'Jumat' },
  { value: 6, label: 'Sabtu' },
  { value: 7, label: 'Minggu' },
]

// Nilai mentah form: waktu masih dayjs, dikonversi 'HH:mm' saat submit
interface ScheduleFormState {
  class_id: string
  subject_id?: string
  teacher_id?: string
  day_of_week: number
  start_time: Dayjs
  end_time: Dayjs
  room?: string
  notes?: string
}

interface ScheduleFormProps {
  open: boolean
  schedule: Schedule | null
  submitting: boolean
  onCancel: () => void
  onSubmit: (values: ScheduleFormValues) => void
}

export function ScheduleForm({ open, schedule, submitting, onCancel, onSubmit }: ScheduleFormProps) {
  const [form] = Form.useForm<ScheduleFormState>()
  const classesQuery = useClassesBrief()
  const subjectsQuery = useSubjectsBrief()
  const teachersQuery = useTeachersBrief()

  useEffect(() => {
    if (!open) return
    if (schedule) {
      form.setFieldsValue({
        class_id: schedule.class_id,
        subject_id: schedule.subject_id ?? undefined,
        teacher_id: schedule.teacher_id ?? undefined,
        day_of_week: schedule.day_of_week,
        start_time: dayjs(schedule.start_time, 'HH:mm:ss'),
        end_time: dayjs(schedule.end_time, 'HH:mm:ss'),
        room: schedule.room ?? undefined,
        notes: schedule.notes ?? undefined,
      })
    } else {
      form.resetFields()
    }
  }, [open, schedule, form])

  const handleFinish = (values: ScheduleFormState) => {
    onSubmit({
      class_id: values.class_id,
      subject_id: values.subject_id,
      teacher_id: values.teacher_id,
      day_of_week: values.day_of_week,
      start_time: values.start_time.format('HH:mm'),
      end_time: values.end_time.format('HH:mm'),
      room: values.room,
      notes: values.notes,
    })
  }

  return (
    <AppModal
      title={schedule ? 'Edit Jadwal KBM' : 'Tambah Jadwal KBM'}
      subtitle={schedule ? 'Perbarui detail jadwal mengajar' : 'Jadwal kelas, mapel, dan pengajar per minggu'}
      icon={<CalendarOutlined />}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      width={520}
      destroyOnHidden
    >
      <Form<ScheduleFormState>
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        disabled={submitting}
        initialValues={{ day_of_week: 1 }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
          <Form.Item
            name="class_id"
            label="Kelas"
            rules={[{ required: true, message: 'Kelas wajib dipilih' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Pilih kelas"
              loading={classesQuery.isPending}
              options={(classesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            />
          </Form.Item>

          <Form.Item name="teacher_id" label="Pengajar">
            <Select
              showSearch
              optionFilterProp="label"
              allowClear
              placeholder="Pilih guru / musyrif"
              loading={teachersQuery.isPending}
              options={(teachersQuery.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
            />
          </Form.Item>
        </div>

        <Form.Item name="subject_id" label="Mata Pelajaran">
          <Select
            showSearch
            optionFilterProp="label"
            allowClear
            placeholder="Pilih mapel"
            loading={subjectsQuery.isPending}
            options={(subjectsQuery.data ?? []).map((s) => ({
              value: s.id,
              label: s.code ? `${s.name} (${s.code})` : s.name,
            }))}
          />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 12px' }}>
          <Form.Item
            name="day_of_week"
            label="Hari"
            rules={[{ required: true, message: 'Hari wajib dipilih' }]}
          >
            <Select options={DAY_OPTIONS} placeholder="Hari" />
          </Form.Item>
          <Form.Item
            name="start_time"
            label="Mulai"
            rules={[{ required: true, message: 'Jam mulai wajib diisi' }]}
          >
            <TimePicker format="HH:mm" minuteStep={5} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="end_time"
            label="Selesai"
            dependencies={['start_time']}
            rules={[
              { required: true, message: 'Jam selesai wajib diisi' },
              ({ getFieldValue }) => ({
                validator(_, value: Dayjs | undefined) {
                  const start = getFieldValue('start_time') as Dayjs | undefined
                  if (!value || !start || value.isAfter(start)) return Promise.resolve()
                  return Promise.reject(new Error('Jam selesai harus setelah jam mulai'))
                },
              }),
            ]}
          >
            <TimePicker format="HH:mm" minuteStep={5} style={{ width: '100%' }} />
          </Form.Item>
        </div>

        <Form.Item name="room" label="Ruang">
          <Input placeholder="Contoh: Kelas 7A / Lab / Aula" maxLength={60} />
        </Form.Item>

        <Form.Item name="notes" label="Keterangan">
          <Input.TextArea rows={2} placeholder="Keterangan singkat (opsional)" maxLength={300} />
        </Form.Item>
      </Form>
    </AppModal>
  )
}
