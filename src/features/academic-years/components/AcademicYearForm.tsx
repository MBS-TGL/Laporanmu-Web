import { useEffect } from 'react'
import { Checkbox, DatePicker, Form, Input, Select } from 'antd'
import { CalendarOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { AppModal } from '../../../shared/components/AppModal'
import type { AcademicYear, AcademicYearFormValues, Semester } from '../types'

interface AcademicYearFormProps {
  open: boolean
  year: AcademicYear | null
  submitting: boolean
  onCancel: () => void
  onSubmit: (values: AcademicYearFormValues) => void
}

interface FormState extends Omit<AcademicYearFormValues, 'start_date' | 'end_date'> {
  start_date?: Dayjs
  end_date?: Dayjs
}

const SEMESTER_OPTIONS: { value: Semester; label: string }[] = [
  { value: 'Ganjil', label: 'Ganjil' },
  { value: 'Genap', label: 'Genap' },
]

export function AcademicYearForm({
  open,
  year,
  submitting,
  onCancel,
  onSubmit,
}: AcademicYearFormProps) {
  const [form] = Form.useForm<FormState>()

  useEffect(() => {
    if (!open) return
    if (year) {
      form.setFieldsValue({
        name: year.name,
        semester: (year.semester as Semester) ?? 'Ganjil',
        start_date: year.start_date ? dayjs(year.start_date) : undefined,
        end_date: year.end_date ? dayjs(year.end_date) : undefined,
        curriculum: year.curriculum ?? undefined,
        makeActive: false,
      })
    } else {
      form.resetFields()
      form.setFieldsValue({ semester: 'Ganjil', makeActive: false })
    }
  }, [open, year, form])

  const handleFinish = (values: FormState) => {
    onSubmit({
      name: values.name,
      semester: values.semester,
      start_date: values.start_date ? values.start_date.format('YYYY-MM-DD') : undefined,
      end_date: values.end_date ? values.end_date.format('YYYY-MM-DD') : undefined,
      curriculum: values.curriculum,
      makeActive: values.makeActive,
    })
  }

  return (
    <AppModal
      title={year ? 'Edit Tahun Akademik' : 'Tambah Tahun Akademik'}
      subtitle={year ? 'Perbarui data tahun akademik' : 'Periode semester dan kalender akademik'}
      icon={<CalendarOutlined />}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      width={520}
      destroyOnHidden
    >
      <Form<FormState> form={form} layout="vertical" onFinish={handleFinish} disabled={submitting}>
        <Form.Item
          name="name"
          label="Nama Periode"
          rules={[{ required: true, message: 'Nama wajib diisi' }]}
        >
          <Input placeholder="Contoh: 2026/2027 Ganjil" maxLength={60} />
        </Form.Item>

        <Form.Item
          name="semester"
          label="Semester"
          rules={[{ required: true, message: 'Semester wajib dipilih' }]}
        >
          <Select options={SEMESTER_OPTIONS} />
        </Form.Item>

        <Form.Item
          name="start_date"
          label="Tanggal Mulai"
          rules={[
            { required: true, message: 'Tanggal mulai wajib diisi' },
            {
              validator: (_, value: Dayjs | undefined) => {
                const end = form.getFieldValue('end_date')
                if (value && end && !value.isBefore(end, 'day')) {
                  return Promise.reject(new Error('Tanggal mulai harus sebelum tanggal selesai'))
                }
                return Promise.resolve()
              },
            },
          ]}
        >
          <DatePicker style={{ width: '100%' }} format="DD-MM-YYYY" />
        </Form.Item>

        <Form.Item
          name="end_date"
          label="Tanggal Selesai"
          dependencies={['start_date']}
          rules={[
            { required: true, message: 'Tanggal selesai wajib diisi' },
            {
              validator: (_, value: Dayjs | undefined) => {
                const start = form.getFieldValue('start_date')
                if (value && start && !value.isAfter(start, 'day')) {
                  return Promise.reject(new Error('Tanggal selesai harus setelah tanggal mulai'))
                }
                return Promise.resolve()
              },
            },
          ]}
        >
          <DatePicker style={{ width: '100%' }} format="DD-MM-YYYY" />
        </Form.Item>

        <Form.Item name="curriculum" label="Kurikulum">
          <Select
            placeholder="Pilih kurikulum (opsional)"
            allowClear
            options={[
              { value: 'Merdeka', label: 'Merdeka' },
              { value: 'K-13', label: 'K-13' },
            ]}
          />
        </Form.Item>

        {!year && (
          <Form.Item name="makeActive" valuePropName="checked">
            <Checkbox>Jadikan periode aktif</Checkbox>
          </Form.Item>
        )}
      </Form>
    </AppModal>
  )
}
