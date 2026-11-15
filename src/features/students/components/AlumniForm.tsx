import { useEffect } from 'react'
import {
  DatePicker,
  Form,
  Input,
  InputNumber,
  Radio,
  Select,
} from 'antd'
import { TeamOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { AppModal } from '../../../shared/components/AppModal'
import {
  checkAlumniDuplicate,
  normalizeAlumniName,
  normalizeAlumniPhone,
  type ExistingStudentKey,
} from '../alumniValidation'
import { useClassesBrief } from '../hooks'
import type { AlumniFormValues } from '../api'
import type { Student } from '../types'

interface Props {
  open: boolean
  editingAlumni: Student | null
  submitting?: boolean
  existingStudents: ExistingStudentKey[]
  onCancel: () => void
  onSubmit: (values: AlumniFormValues) => void
}

interface FormFields {
  name: string
  gender: 'L' | 'P'
  graduation_year: number
  nisn?: string
  last_class_id?: string
  graduated_at?: dayjs.Dayjs
  phone?: string
}

export function AlumniForm({
  open,
  editingAlumni,
  submitting,
  existingStudents,
  onCancel,
  onSubmit,
}: Props) {
  const [form] = Form.useForm<FormFields>()
  const classesQuery = useClassesBrief()
  const classOptions = (classesQuery.data ?? []).map((c) => ({
    value: c.id,
    label: c.name,
  }))

  const currentYear = new Date().getFullYear()

  useEffect(() => {
    if (open) {
      if (editingAlumni) {
        form.setFieldsValue({
          name: editingAlumni.name,
          gender: (editingAlumni.gender as 'L' | 'P') || 'L',
          graduation_year: editingAlumni.graduation_year ?? currentYear,
          nisn: editingAlumni.nisn || undefined,
          last_class_id: editingAlumni.last_class_id || editingAlumni.class_id || undefined,
          graduated_at: editingAlumni.graduated_at ? dayjs(editingAlumni.graduated_at) : undefined,
          phone: editingAlumni.phone || undefined,
        })
      } else {
        form.resetFields()
        form.setFieldsValue({
          gender: 'L',
          graduation_year: currentYear,
        })
      }
    }
  }, [open, editingAlumni, form, currentYear])

  const handleFinish = (values: FormFields) => {
    const payload: AlumniFormValues = {
      name: normalizeAlumniName(values.name),
      gender: values.gender,
      graduation_year: values.graduation_year,
      nisn: values.nisn?.trim() || undefined,
      last_class_id: values.last_class_id || undefined,
      graduated_at: values.graduated_at ? values.graduated_at.format('YYYY-MM-DD') : undefined,
      phone: normalizeAlumniPhone(values.phone) || undefined,
    }
    onSubmit(payload)
  }

  return (
  <AppModal
    title={editingAlumni ? 'Edit Data Alumni' : 'Tambah Alumni Manual'}
    subtitle={editingAlumni ? 'Perbarui data alumni' : 'Isi data alumni secara manual'}
    icon={<TeamOutlined />}
    open={open}
    onCancel={onCancel}
    onOk={() => form.submit()}
    confirmLoading={submitting}
    destroyOnHidden
      okText={editingAlumni ? 'Simpan Perubahan' : 'Tambah Alumni'}
      cancelText="Batal"
      width={520}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        requiredMark="optional"
        style={{ marginTop: 8 }}
      >
        <Form.Item
          name="name"
          label="Nama Lengkap"
          rules={[
            { required: true, message: 'Nama lengkap wajib diisi' },
            () => ({
              validator(_, value) {
                const year = form.getFieldValue('graduation_year')
                const nisn = form.getFieldValue('nisn')
                if (!value || !year || nisn) return Promise.resolve()

                const dup = checkAlumniDuplicate(
                  {
                    name: value,
                    graduation_year: Number(year),
                    id: editingAlumni?.id,
                  },
                  existingStudents,
                )
                if (dup.isDuplicate) {
                  return Promise.reject(new Error(dup.reason))
                }
                return Promise.resolve()
              },
            }),
          ]}
        >
          <Input placeholder="Contoh: Ahmad Dahlan" />
        </Form.Item>

        <Form.Item
          name="gender"
          label="Jenis Kelamin"
          rules={[{ required: true, message: 'Jenis kelamin wajib dipilih' }]}
        >
          <Radio.Group buttonStyle="solid">
            <Radio.Button value="L">Laki-laki</Radio.Button>
            <Radio.Button value="P">Perempuan</Radio.Button>
          </Radio.Group>
        </Form.Item>

        <Form.Item
          name="graduation_year"
          label="Tahun Lulus (Angkatan)"
          rules={[
            { required: true, message: 'Tahun kelulusan wajib diisi' },
            {
              type: 'number',
              min: 1990,
              max: currentYear,
              message: `Tahun harus di antara 1990 dan ${currentYear}`,
            },
          ]}
        >
          <InputNumber style={{ width: '100%' }} placeholder="Contoh: 2024" />
        </Form.Item>

        <Form.Item
          name="nisn"
          label="NISN (Nomor Induk Siswa Nasional)"
          rules={[
            () => ({
              validator(_, value) {
                if (!value || !value.trim()) return Promise.resolve()
                const cleaned = value.trim()
                if (!/^\d+$/.test(cleaned) || cleaned.length !== 10) {
                  return Promise.reject(new Error('NISN harus berupa 10 digit angka'))
                }
                const dup = checkAlumniDuplicate(
                  {
                    nisn: cleaned,
                    name: form.getFieldValue('name') || '',
                    graduation_year: form.getFieldValue('graduation_year') || currentYear,
                    id: editingAlumni?.id,
                  },
                  existingStudents,
                )
                if (dup.isDuplicate) {
                  return Promise.reject(new Error(dup.reason))
                }
                return Promise.resolve()
              },
            }),
          ]}
        >
          <Input placeholder="10 digit angka (opsional)" maxLength={10} />
        </Form.Item>

        <Form.Item name="last_class_id" label="Kelas Terakhir">
          <Select
            allowClear
            showSearch
            placeholder="Pilih kelas terakhir saat lulus"
            optionFilterProp="label"
            options={classOptions}
          />
        </Form.Item>

        <Form.Item name="graduated_at" label="Tanggal Lulus">
          <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder="Pilih tanggal kelulusan" />
        </Form.Item>

        <Form.Item name="phone" label="Nomor Telepon / WhatsApp">
          <Input placeholder="Contoh: 081234567890 (opsional)" />
        </Form.Item>
      </Form>
    </AppModal>
  )
}
