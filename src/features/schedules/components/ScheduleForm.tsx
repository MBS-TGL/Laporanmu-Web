import { useEffect, useMemo } from 'react'
import { Alert, AutoComplete, Form, Input, Select, TimePicker } from 'antd'
import { CalendarOutlined, WarningOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { AppModal } from '../../../shared/components/AppModal'
import { findConflicts, useClassesBrief, useSubjectsBrief, useTeachersBrief, useTimeSlots } from '../hooks'
import { useRooms } from '../../academic-years/hooks'
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
  time_slot_id?: string
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
  existingSchedules?: Schedule[]
  onCancel: () => void
  onSubmit: (values: ScheduleFormValues) => void
}

export function ScheduleForm({
  open,
  schedule,
  submitting,
  existingSchedules = [],
  onCancel,
  onSubmit,
}: ScheduleFormProps) {
  const [form] = Form.useForm<ScheduleFormState>()
  const classesQuery = useClassesBrief()
  const subjectsQuery = useSubjectsBrief()
  const teachersQuery = useTeachersBrief()
  const timeSlotsQuery = useTimeSlots()
  const roomsQuery = useRooms()
  const roomOptions = useMemo(
    () =>
      (roomsQuery.data ?? [])
        .filter((r) => r.is_active)
        .map((r) => ({ value: r.name, label: r.code ? `${r.name} (${r.code})` : r.name })),
    [roomsQuery.data],
  )

  const watchedValues = Form.useWatch([], form)

  useEffect(() => {
    if (!open) return
    if (schedule) {
      form.setFieldsValue({
        class_id: schedule.class_id,
        subject_id: schedule.subject_id ?? undefined,
        teacher_id: schedule.teacher_id ?? undefined,
        time_slot_id: schedule.time_slot_id ?? undefined,
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

  // Live conflict detection saat form sedang diisi
  const liveConflicts = useMemo(() => {
    if (!open || !watchedValues?.class_id || !watchedValues?.day_of_week) return []
    const startStr = watchedValues.start_time?.format?.('HH:mm')
    const endStr = watchedValues.end_time?.format?.('HH:mm')
    if (!startStr || !endStr) return []

    return findConflicts(existingSchedules, {
      day_of_week: Number(watchedValues.day_of_week),
      start_time: startStr,
      end_time: endStr,
      class_id: watchedValues.class_id,
      teacher_id: watchedValues.teacher_id,
      room: watchedValues.room,
      excludeId: schedule?.id,
    })
  }, [open, watchedValues, existingSchedules, schedule?.id])

  const handleTimeSlotChange = (slotId: string | undefined) => {
    if (!slotId) return
    const slot = (timeSlotsQuery.data ?? []).find((s) => s.id === slotId)
    if (slot) {
      form.setFieldsValue({
        start_time: dayjs(slot.start_time, 'HH:mm:ss'),
        end_time: dayjs(slot.end_time, 'HH:mm:ss'),
      })
    }
  }

  const handleFinish = (values: ScheduleFormState) => {
    onSubmit({
      class_id: values.class_id,
      subject_id: values.subject_id,
      teacher_id: values.teacher_id,
      time_slot_id: values.time_slot_id,
      day_of_week: values.day_of_week,
      start_time: values.start_time.format('HH:mm'),
      end_time: values.end_time.format('HH:mm'),
      room: values.room,
      notes: values.notes,
    })
  }

  const selectedClassName = classesQuery.data?.find((c) => c.id === watchedValues?.class_id)?.name

  return (
    <AppModal
      title={schedule ? 'Edit Jadwal KBM' : 'Tambah Jadwal KBM'}
      subtitle={schedule ? 'Perbarui detail jadwal mengajar' : 'Jadwal kelas, mapel, dan pengajar per minggu'}
      icon={<CalendarOutlined />}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      width={540}
      destroyOnHidden
    >
      <Form<ScheduleFormState>
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        disabled={submitting}
        initialValues={{ day_of_week: 1 }}
      >
        {liveConflicts.length > 0 && (
          <Alert
            type="warning"
            showIcon
            icon={<WarningOutlined />}
            style={{ marginBottom: 16 }}
            message={
              <span style={{ fontWeight: 600 }}>
                Terdeteksi {liveConflicts.length} Bentrok / Tabrakan Jadwal
              </span>
            }
            description={
              <ul style={{ margin: '4px 0 0', paddingLeft: 16, fontSize: 12.5 }}>
                {liveConflicts.slice(0, 3).map(({ schedule: s, reason }) => {
                  let label = ''
                  if (reason === 'teacher') {
                    label = `Guru (${s.teachers?.name ?? 'terpilih'}) sudah terjadwal di ${s.classes?.name ?? 'kelas lain'} (${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)})`
                  } else if (reason === 'room') {
                    label = `Ruang '${s.room}' sudah dipakai ${s.classes?.name ?? 'kelas lain'} (${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)})`
                  } else {
                    label = `Kelas ${selectedClassName ?? ''} sudah memiliki jadwal mapel ${s.subjects?.name ?? 'lain'} (${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)})`
                  }
                  return <li key={s.id}>{label}</li>
                })}
                {liveConflicts.length > 3 && <li>...dan {liveConflicts.length - 3} bentrok lainnya</li>}
              </ul>
            }
          />
        )}
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

        <Form.Item
          name="time_slot_id"
          label="Pilih Jam Pelajaran (Time Slot)"
          extra="Memilih slot akan otomatis mengisi jam mulai dan jam selesai di bawah."
        >
          <Select
            allowClear
            placeholder="Pilih slot jam (opsional)"
            loading={timeSlotsQuery.isPending}
            onChange={handleTimeSlotChange}
            options={(timeSlotsQuery.data ?? []).map((slot) => ({
              value: slot.id,
              label: `${slot.name} (${slot.start_time.slice(0, 5)} - ${slot.end_time.slice(0, 5)})${slot.is_break ? ' [Istirahat]' : ''}`,
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
          <AutoComplete
            options={roomOptions}
            filterOption={(input, option) =>
              String(option?.value ?? '').toLowerCase().includes(input.toLowerCase())
            }
            placeholder="Pilih ruang atau ketik manual"
            maxLength={60}
          />
        </Form.Item>

        <Form.Item name="notes" label="Keterangan">
          <Input.TextArea rows={2} placeholder="Keterangan singkat (opsional)" maxLength={300} />
        </Form.Item>
      </Form>
    </AppModal>
  )
}
