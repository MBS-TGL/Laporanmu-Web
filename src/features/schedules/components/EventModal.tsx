import { useEffect } from 'react'
import { DatePicker, Form, Input, Select, TimePicker } from 'antd'
import { CalendarOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { AppModal } from '../../../shared/components/AppModal'
import type { CalendarEvent, CalendarEventCategory, CalendarEventFormValues, CalendarEventTarget } from '../calendarTypes'

const CATEGORY_OPTIONS: { value: CalendarEventCategory; label: string; color: string }[] = [
  { value: 'akademik', label: 'Akademik / KBM', color: '#1677ff' },
  { value: 'pondok', label: 'Kegiatan Pondok', color: '#722ed1' },
  { value: 'ujian', label: 'Ujian (PTS/PAS/Asesmen)', color: '#fa8c16' },
  { value: 'libur', label: 'Libur / Perpulangan', color: '#52c41a' },
  { value: 'umum', label: 'Agenda Umum / Yayasan', color: '#13c2c2' },
]

const TARGET_OPTIONS: { value: CalendarEventTarget; label: string }[] = [
  { value: 'ALL', label: 'Semua Jenjang' },
  { value: 'SMP', label: 'Khusus SMP' },
  { value: 'SMA', label: 'Khusus SMA' },
]

interface EventFormState {
  title: string
  category: CalendarEventCategory
  target_level: CalendarEventTarget
  date_range: [Dayjs, Dayjs]
  start_time?: Dayjs
  end_time?: Dayjs
  location?: string
  description?: string
  color?: string
}

interface EventModalProps {
  open: boolean
  event: CalendarEvent | null
  initialDate?: Dayjs
  submitting: boolean
  onCancel: () => void
  onSubmit: (values: CalendarEventFormValues) => void
}

export function EventModal({
  open,
  event,
  initialDate,
  submitting,
  onCancel,
  onSubmit,
}: EventModalProps) {
  const [form] = Form.useForm<EventFormState>()

  useEffect(() => {
    if (!open) return
    if (event) {
      form.setFieldsValue({
        title: event.title,
        category: event.category,
        target_level: event.target_level,
        date_range: [dayjs(event.start_date), dayjs(event.end_date)],
        start_time: event.start_time ? dayjs(event.start_time, 'HH:mm:ss') : undefined,
        end_time: event.end_time ? dayjs(event.end_time, 'HH:mm:ss') : undefined,
        location: event.location ?? undefined,
        description: event.description ?? undefined,
        color: event.color ?? undefined,
      })
    } else {
      const start = initialDate ?? dayjs()
      form.resetFields()
      form.setFieldsValue({
        category: 'pondok',
        target_level: 'ALL',
        date_range: [start, start],
      })
    }
  }, [open, event, initialDate, form])

  const handleFinish = (values: EventFormState) => {
    const [start, end] = values.date_range
    onSubmit({
      title: values.title.trim(),
      category: values.category,
      target_level: values.target_level,
      start_date: start.format('YYYY-MM-DD'),
      end_date: end.format('YYYY-MM-DD'),
      start_time: values.start_time ? values.start_time.format('HH:mm') : null,
      end_time: values.end_time ? values.end_time.format('HH:mm') : null,
      location: values.location,
      description: values.description,
      color: values.color,
    })
  }

  return (
    <AppModal
      title={event ? 'Edit Agenda / Kegiatan' : 'Tambah Agenda / Kegiatan'}
      subtitle="Jadwal kalender pendidikan, ujian, dan kegiatan kepesantrenan"
      icon={<CalendarOutlined />}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      width={520}
      destroyOnHidden
    >
      <Form<EventFormState>
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        disabled={submitting}
      >
        <Form.Item
          name="title"
          label="Nama Agenda / Kegiatan"
          rules={[{ required: true, message: 'Nama agenda wajib diisi' }]}
        >
          <Input placeholder="Contoh: Mukhayyam Al-Quran, PTS Semester Ganjil" maxLength={150} />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
          <Form.Item
            name="category"
            label="Kategori"
            rules={[{ required: true, message: 'Kategori wajib dipilih' }]}
          >
            <Select options={CATEGORY_OPTIONS} placeholder="Pilih kategori" />
          </Form.Item>

          <Form.Item
            name="target_level"
            label="Sasaran Jenjang"
            rules={[{ required: true, message: 'Sasaran wajib dipilih' }]}
          >
            <Select options={TARGET_OPTIONS} placeholder="Pilih jenjang" />
          </Form.Item>
        </div>

        <Form.Item
          name="date_range"
          label="Tanggal Pelaksanaan"
          rules={[{ required: true, message: 'Rentang tanggal wajib diisi' }]}
        >
          <DatePicker.RangePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
          <Form.Item name="start_time" label="Jam Mulai (Opsional)">
            <TimePicker format="HH:mm" minuteStep={5} style={{ width: '100%' }} placeholder="Mulai" />
          </Form.Item>
          <Form.Item name="end_time" label="Jam Selesai (Opsional)">
            <TimePicker format="HH:mm" minuteStep={5} style={{ width: '100%' }} placeholder="Selesai" />
          </Form.Item>
        </div>

        <Form.Item name="location" label="Lokasi / Tempat">
          <Input placeholder="Contoh: Masjid Pondok, Aula Utama, Lapangan" maxLength={100} />
        </Form.Item>

        <Form.Item name="description" label="Keterangan / Catatan">
          <Input.TextArea rows={3} placeholder="Rincian informasi agenda, pakaian, atau instruksi santri" maxLength={500} />
        </Form.Item>
      </Form>
    </AppModal>
  )
}
