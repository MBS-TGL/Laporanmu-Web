import { useEffect, useState } from 'react'
import { DatePicker, Form, Input, Select } from 'antd'
import { UserAddOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { AppModal } from '../../../shared/components/AppModal'
import { nextRegistrationNumber } from '../api'
import type { Admission, AdmissionFormValues } from '../types'

interface AdmissionFormShape {
  full_name: string
  gender?: 'L' | 'P'
  birth_place?: string
  birth_date?: Dayjs
  origin_school?: string
  target_grade?: string
  parent_name?: string
  parent_phone?: string
  address?: string
  notes?: string
}

interface AdmissionFormProps {
  open: boolean
  admission: Admission | null
  submitting: boolean
  onCancel: () => void
  onSubmit: (values: AdmissionFormValues) => void
}

export function AdmissionForm({ open, admission, submitting, onCancel, onSubmit }: AdmissionFormProps) {
  const [form] = Form.useForm<AdmissionFormShape>()
  // Nomor registrasi hanya untuk pendaftar baru — ditampilkan sebelum simpan
  const [regNumber, setRegNumber] = useState<string>('')

  useEffect(() => {
    if (!open) return
    if (admission) {
      setRegNumber(admission.registration_number)
      form.setFieldsValue({
        full_name: admission.full_name,
        gender: admission.gender ?? undefined,
        birth_place: admission.birth_place ?? undefined,
        birth_date: admission.birth_date ? dayjs(admission.birth_date) : undefined,
        origin_school: admission.origin_school ?? undefined,
        target_grade: admission.target_grade ?? undefined,
        parent_name: admission.parent_name ?? undefined,
        parent_phone: admission.parent_phone ?? undefined,
        address: admission.address ?? undefined,
        notes: admission.notes ?? undefined,
      })
    } else {
      form.resetFields()
      void nextRegistrationNumber().then(setRegNumber).catch(() => setRegNumber(''))
    }
  }, [open, admission, form])

  const handleFinish = (values: AdmissionFormShape) => {
    onSubmit({
      full_name: values.full_name,
      gender: values.gender,
      birth_place: values.birth_place,
      birth_date: values.birth_date?.format('YYYY-MM-DD'),
      origin_school: values.origin_school,
      target_grade: values.target_grade,
      parent_name: values.parent_name,
      parent_phone: values.parent_phone,
      address: values.address,
      notes: values.notes,
    })
  }

  return (
    <AppModal
      title={admission ? 'Edit Pendaftar' : 'Tambah Pendaftar PPDB'}
      subtitle={admission ? 'Perbarui data calon santri' : 'Data awal calon santri baru (input manual)'}
      icon={<UserAddOutlined />}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      width={560}
      destroyOnHidden
    >
      {!admission && regNumber && (
        <div style={{ marginBottom: 16, fontSize: 13, color: 'rgba(0,0,0,0.55)' }}>
          Nomor registrasi otomatis:{' '}
          <b style={{ color: '#4f46e5' }}>{regNumber}</b>
        </div>
      )}
      <Form<AdmissionFormShape>
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        disabled={submitting}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0 12px' }}>
          <Form.Item
            name="full_name"
            label="Nama Lengkap"
            rules={[{ required: true, message: 'Nama lengkap wajib diisi' }]}
          >
            <Input placeholder="Nama calon santri" maxLength={120} />
          </Form.Item>
          <Form.Item name="gender" label="Jenis Kelamin">
            <Select
              allowClear
              placeholder="Pilih"
              options={[
                { value: 'L', label: 'Laki-laki' },
                { value: 'P', label: 'Perempuan' },
              ]}
            />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
          <Form.Item name="birth_place" label="Tempat Lahir">
            <Input placeholder="Contoh: Tuban" maxLength={80} />
          </Form.Item>
          <Form.Item name="birth_date" label="Tanggal Lahir">
            <DatePicker format="DD MMM YYYY" style={{ width: '100%' }} />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
          <Form.Item name="origin_school" label="Asal Sekolah">
            <Input placeholder="Contoh: MI Al-Hidayah" maxLength={120} />
          </Form.Item>
          <Form.Item name="target_grade" label="Masuk Tingkat">
            <Input placeholder="Contoh: VII / 1" maxLength={20} />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
          <Form.Item name="parent_name" label="Nama Wali">
            <Input placeholder="Nama orang tua / wali" maxLength={120} />
          </Form.Item>
          <Form.Item name="parent_phone" label="No. HP Wali">
            <Input placeholder="08xxxxxxxxxx" maxLength={20} />
          </Form.Item>
        </div>

        <Form.Item name="address" label="Alamat">
          <Input.TextArea rows={2} placeholder="Alamat lengkap (opsional)" maxLength={300} />
        </Form.Item>

        <Form.Item name="notes" label="Catatan">
          <Input.TextArea rows={2} placeholder="Catatan seleksi, dokumen, dll. (opsional)" maxLength={300} />
        </Form.Item>
      </Form>
    </AppModal>
  )
}
