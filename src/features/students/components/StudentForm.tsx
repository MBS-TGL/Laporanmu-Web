import { useEffect } from 'react'
import { Col, DatePicker, Form, Input, Row, Select } from 'antd'
import { UserOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { AppModal } from '../../../shared/components/AppModal'
import { SectionDivider } from '../../../shared/components/SectionDivider'
import { useClassesBrief, useDormsBrief } from '../hooks'
import { registrationCodeExists } from '../api'
import { GUARDIAN_RELATION_OPTIONS, RELIGION_OPTIONS } from '../status'
import type { Student, StudentFormValues } from '../types'

interface StudentFormProps {
  open: boolean
  student: Student | null
  submitting: boolean
  onCancel: () => void
  onSubmit: (values: StudentFormValues) => void
}

const STATUS_OPTIONS = [
  { value: 'aktif', label: 'Aktif' },
  { value: 'lulus', label: 'Lulus' },
  { value: 'pindah', label: 'Pindah' },
  { value: 'keluar', label: 'Keluar' },
]

interface StudentFormShape extends Omit<StudentFormValues, 'birth_date'> {
  birth_date?: Dayjs
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Col span={24}>
      <SectionDivider>{children}</SectionDivider>
    </Col>
  )
}

export function StudentForm({ open, student, submitting, onCancel, onSubmit }: StudentFormProps) {
  const [form] = Form.useForm<StudentFormShape>()
  const classesQuery = useClassesBrief()
  const dormsQuery = useDormsBrief()

  useEffect(() => {
    if (!open) return
    if (student) {
      form.setFieldsValue({
        name: student.name,
        registration_code: student.registration_code,
        class_id: student.class_id ?? '',
        dorm_id: student.dorm_id ?? undefined,
        gender: student.gender ?? undefined,
        status: student.status,
        nisn: student.nisn ?? undefined,
        nis: student.nis ?? undefined,
        phone: student.phone ?? undefined,
        birth_place: student.birth_place ?? undefined,
        birth_date: student.birth_date ? dayjs(student.birth_date) : undefined,
        religion: student.religion ?? undefined,
        address: student.address ?? undefined,
        guardian_name: student.guardian_name ?? undefined,
        guardian_relation: student.guardian_relation ?? undefined,
        tags: student.tags ?? [],
      })
    } else {
      form.resetFields()
      form.setFieldsValue({ status: 'aktif', tags: [] })
    }
  }, [open, student, form])

  const handleFinish = (values: StudentFormShape) => {
    onSubmit({
      ...values,
      birth_date: values.birth_date ? values.birth_date.format('YYYY-MM-DD') : undefined,
    })
  }

  return (
    <AppModal
      title={student ? 'Edit Siswa' : 'Tambah Siswa'}
      subtitle={student ? 'Perbarui data siswa' : 'Data lengkap siswa baru'}
      icon={<UserOutlined />}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      width={680}
      destroyOnHidden
    >
      <Form<StudentFormShape>
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        disabled={submitting}
      >
        <Row gutter={16}>
          <SectionTitle>Data Pribadi</SectionTitle>

          <Col span={24}>
            <Form.Item
              name="name"
              label="Nama Lengkap"
              rules={[{ required: true, message: 'Nama wajib diisi' }]}
            >
              <Input placeholder="Nama siswa" maxLength={120} />
            </Form.Item>
          </Col>

          <Col xs={24} sm={12}>
            <Form.Item
              name="registration_code"
              label="Kode Registrasi"
              rules={[
                { required: true, message: 'Kode pendaftaran wajib diisi' },
                {
                  validator: async (_, value: string) => {
                    if (!value) return
                    const exists = await registrationCodeExists(value, student?.id)
                    if (exists) throw new Error('Kode sudah digunakan siswa lain')
                  },
                },
              ]}
            >
              <Input placeholder="Contoh: SPR-2026-001" maxLength={40} />
            </Form.Item>
          </Col>

          <Col xs={24} sm={12}>
            <Form.Item
              name="nisn"
              label="NISN"
              rules={[{ pattern: /^\d{0,20}$/, message: 'NISN hanya boleh berisi angka' }]}
            >
              <Input placeholder="Nomor Induk Siswa Nasional" maxLength={20} />
            </Form.Item>
          </Col>

          <Col xs={24} sm={12}>
            <Form.Item name="nis" label="NIS">
              <Input placeholder="Nomor Induk Siswa" maxLength={20} />
            </Form.Item>
          </Col>

          <Col xs={24} sm={12}>
            <Form.Item
              name="phone"
              label="No. HP"
              rules={[{ pattern: /^[\d+\-\s]{0,20}$/, message: 'Format nomor tidak valid' }]}
            >
              <Input placeholder="08xxxxxxxxxx" maxLength={20} />
            </Form.Item>
          </Col>

          <Col xs={24} sm={12}>
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
          </Col>

          <Col xs={24} sm={12}>
            <Form.Item name="birth_date" label="Tanggal Lahir">
              <DatePicker style={{ width: '100%' }} format="DD MMMM YYYY" />
            </Form.Item>
          </Col>

          <Col xs={24} sm={12}>
            <Form.Item name="birth_place" label="Tempat Lahir">
              <Input placeholder="Contoh: Bogor" maxLength={60} />
            </Form.Item>
          </Col>

          <Col xs={24} sm={12}>
            <Form.Item name="religion" label="Agama">
              <Select placeholder="Pilih" allowClear options={RELIGION_OPTIONS} />
            </Form.Item>
          </Col>

          <SectionTitle>Penempatan</SectionTitle>

          <Col xs={24} sm={12}>
            <Form.Item
              name="class_id"
              label="Kelas"
              rules={[{ required: true, message: 'Kelas wajib dipilih' }]}
            >
              <Select
                placeholder="Pilih kelas"
                loading={classesQuery.isPending}
                options={(classesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
          </Col>

          <Col xs={24} sm={12}>
            <Form.Item name="dorm_id" label="Asrama">
              <Select
                placeholder="Pilih asrama (opsional)"
                allowClear
                loading={dormsQuery.isPending}
                options={(dormsQuery.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
          </Col>

          <Col xs={24} sm={12}>
            <Form.Item
              name="status"
              label="Status"
              rules={[{ required: true, message: 'Status wajib dipilih' }]}
            >
              <Select options={STATUS_OPTIONS} />
            </Form.Item>
          </Col>

          <SectionTitle>Wali & Alamat</SectionTitle>

          <Col xs={24} sm={12}>
            <Form.Item name="guardian_name" label="Nama Wali">
              <Input placeholder="Nama orang tua / wali" maxLength={120} />
            </Form.Item>
          </Col>

          <Col xs={24} sm={12}>
            <Form.Item name="guardian_relation" label="Hubungan Wali">
              <Select
                placeholder="Pilih"
                allowClear
                options={GUARDIAN_RELATION_OPTIONS}
              />
            </Form.Item>
          </Col>

          <Col span={24}>
            <Form.Item name="address" label="Alamat">
              <Input.TextArea rows={2} placeholder="Alamat lengkap" maxLength={300} />
            </Form.Item>
          </Col>

          <Col span={24}>
            <Form.Item name="tags" label="Tags">
              <Select
                mode="tags"
                placeholder="Ketik tag lalu Enter (contoh: hafizh, ukhuwah)"
                tokenSeparators={[',']}
                open={false}
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </AppModal>
  )
}
