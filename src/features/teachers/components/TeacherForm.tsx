import { useEffect } from 'react'
import { DatePicker, Form, Input, Select } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { AppModal } from '../../../shared/components/AppModal'
import type { Teacher, TeacherFormValues } from '../types'
import { nbmExists } from '../api'

interface TeacherFormProps {
  open: boolean
  teacher: Teacher | null
  submitting: boolean
  onCancel: () => void
  onSubmit: (values: TeacherFormValues) => void
}

interface FormState extends Omit<TeacherFormValues, 'join_date'> {
  join_date?: Dayjs
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Aktif' },
  { value: 'inactive', label: 'Nonaktif' },
  { value: 'cuti', label: 'Cuti' },
]

export function TeacherForm({ open, teacher, submitting, onCancel, onSubmit }: TeacherFormProps) {
  const [form] = Form.useForm<FormState>()

  useEffect(() => {
    if (!open) return
    if (teacher) {
      form.setFieldsValue({
        name: teacher.name,
        nbm: teacher.nbm ?? undefined,
        subject: teacher.subject ?? undefined,
        gender: teacher.gender ?? undefined,
        phone: teacher.phone ?? undefined,
        email: teacher.email ?? undefined,
        status: teacher.status,
        join_date: teacher.join_date ? dayjs(teacher.join_date) : undefined,
        nik: teacher.nik ?? undefined,
        nip: teacher.nip ?? undefined,
        nuptk: teacher.nuptk ?? undefined,
        notes: teacher.notes ?? undefined,
      })
    } else {
      form.resetFields()
      form.setFieldsValue({ status: 'active' })
    }
  }, [open, teacher, form])

  const handleFinish = (values: FormState) => {
    onSubmit({
      ...values,
      join_date: values.join_date ? values.join_date.format('YYYY-MM-DD') : undefined,
    })
  }

  return (
    <AppModal
      title={teacher ? 'Edit Guru' : 'Tambah Guru'}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      width={640}
      destroyOnHidden
    >
      <Form<FormState> form={form} layout="vertical" onFinish={handleFinish} disabled={submitting}>
        <Form.Item
          name="name"
          label="Nama Lengkap"
          rules={[{ required: true, message: 'Nama wajib diisi' }]}
        >
          <Input placeholder="Nama guru" maxLength={120} />
        </Form.Item>

        <Form.Item
          name="nbm"
          label="NBM"
          rules={[
            {
              validator: async (_, value: string) => {
                if (!value) return
                const exists = await nbmExists(value, teacher?.id)
                if (exists) throw new Error('NBM sudah digunakan guru lain')
              },
            },
          ]}
        >
          <Input placeholder="Nomor Induk Madrasah" maxLength={40} />
        </Form.Item>

        <Form.Item name="subject" label="Mata Pelajaran">
          <Input placeholder="Contoh: Matematika" maxLength={100} />
        </Form.Item>

        <Form.Item name="gender" label="Jenis Kelamin">
          <Select
            placeholder="Pilih"
            allowClear
            options={[
              { value: 'L', label: 'Laki-laki' },
              { value: 'P', label: 'Perempuan' },
            ]}
          />
        </Form.Item>

        <Form.Item
          name="status"
          label="Status"
          rules={[{ required: true, message: 'Status wajib dipilih' }]}
        >
          <Select options={STATUS_OPTIONS} />
        </Form.Item>

        <Form.Item
          name="phone"
          label="No. HP / WA"
          rules={[{ pattern: /^[\d+\-\s]{0,20}$/, message: 'Format nomor tidak valid' }]}
        >
          <Input placeholder="08xxxxxxxxxx" maxLength={20} />
        </Form.Item>

        <Form.Item
          name="email"
          label="Email"
          rules={[{ type: 'email', message: 'Format email tidak valid' }]}
        >
          <Input placeholder="guru@contoh.com" maxLength={120} />
        </Form.Item>

        <Form.Item name="join_date" label="Tanggal Bergabung">
          <DatePicker style={{ width: '100%' }} format="DD-MM-YYYY" />
        </Form.Item>

        <Form.Item
          name="nik"
          label="NIK"
          rules={[{ pattern: /^\d{0,20}$/, message: 'NIK hanya angka' }]}
        >
          <Input maxLength={20} />
        </Form.Item>

        <Form.Item name="nip" label="NIP">
          <Input maxLength={30} />
        </Form.Item>

        <Form.Item name="nuptk" label="NUPTK">
          <Input maxLength={30} />
        </Form.Item>

        <Form.Item name="notes" label="Catatan">
          <Input.TextArea rows={2} maxLength={500} />
        </Form.Item>
      </Form>
    </AppModal>
  )
}
