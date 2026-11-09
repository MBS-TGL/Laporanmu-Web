import { useEffect } from 'react'
import { Col, Collapse, DatePicker, Form, Input, InputNumber, Row, Select } from 'antd'
import { UserOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { AppModal } from '../../../shared/components/AppModal'
import { SectionDivider } from '../../../shared/components/SectionDivider'
import { useClassesBrief, useDormsBrief, useStudentGuardians } from '../hooks'
import { registrationCodeExists } from '../api'
import {
  EDUCATION_OPTIONS,
  GUARDIAN_RELATION_OPTIONS,
  INCOME_OPTIONS,
  RELIGION_OPTIONS,
} from '../status'
import type { GuardianRelation, Student, StudentFormValues, StudentGuardianInput } from '../types'

interface StudentFormProps {
  open: boolean
  student: Student | null
  submitting: boolean
  onCancel: () => void
  onSubmit: (values: StudentFormValues) => void
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Aktif' },
  { value: 'graduated', label: 'Lulus' },
  { value: 'transferred', label: 'Pindah' },
  { value: 'left', label: 'Keluar' },
]

const CHILD_STATUS_OPTIONS = ['Anak Kandung', 'Anak Angkat', 'Anak Tiri'].map((s) => ({
  value: s,
  label: s,
}))

const UNIFORM_SIZE_OPTIONS = ['S', 'M', 'L', 'XL', 'XXL'].map((s) => ({ value: s, label: s }))

/** Blok Orang Tua: nama path form `guardian_fields.<relation>.<field>` */
const GUARDIAN_BLOCKS: { relation: GuardianRelation; label: string }[] = [
  { relation: 'father', label: 'Data Ayah' },
  { relation: 'mother', label: 'Data Ibu' },
  { relation: 'guardian', label: 'Data Wali' },
]

type GuardianFieldKey = 'name' | 'phone' | 'education' | 'occupation' | 'income_range' | 'address'
type GuardianFieldsShape = Partial<Record<GuardianRelation, Partial<Record<GuardianFieldKey, string>>>>

interface StudentFormShape extends Omit<StudentFormValues, 'birth_date' | 'admitted_at' | 'guardians'> {
  birth_date?: Dayjs
  admitted_at?: Dayjs
  guardian_fields?: GuardianFieldsShape
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Col span={24}>
      <SectionDivider>{children}</SectionDivider>
    </Col>
  )
}

/** Baris guardian dikirim hanya bila ada minimal satu field terisi */
function collectGuardians(fields?: GuardianFieldsShape): StudentGuardianInput[] {
  if (!fields) return []
  const rows: StudentGuardianInput[] = []
  for (const { relation } of GUARDIAN_BLOCKS) {
    const block = fields[relation] ?? {}
    const hasValue = Object.values(block).some((v) => v && v.trim() !== '')
    if (!hasValue) continue
    rows.push({
      relation,
      name: block.name?.trim() || undefined,
      nik: undefined,
      phone: block.phone?.trim() || undefined,
      education: block.education || undefined,
      occupation: block.occupation?.trim() || undefined,
      income_range: block.income_range || undefined,
      address: block.address?.trim() || undefined,
    })
  }
  return rows
}

export function StudentForm({ open, student, submitting, onCancel, onSubmit }: StudentFormProps) {
  const [form] = Form.useForm<StudentFormShape>()
  const classesQuery = useClassesBrief()
  const dormsQuery = useDormsBrief()
  // Data ayah/ibu/wali ada di tabel terpisah (0020) — diambil saat edit
  const guardiansQuery = useStudentGuardians(student?.id, open && !!student)

  useEffect(() => {
    if (!open) return
    if (student) {
      form.setFieldsValue({
        name: student.name,
        nickname: student.nickname ?? undefined,
        registration_code: student.registration_code,
        class_id: student.class_id ?? '',
        dorm_id: student.dorm_id ?? undefined,
        gender: student.gender ?? undefined,
        status: student.status,
        nisn: student.nisn ?? undefined,
        nis: student.nis ?? undefined,
        nik: student.nik ?? undefined,
        phone: student.phone ?? undefined,
        birth_place: student.birth_place ?? undefined,
        birth_date: student.birth_date ? dayjs(student.birth_date) : undefined,
        religion: student.religion ?? undefined,
        address: student.address ?? undefined,
        guardian_name: student.guardian_name ?? undefined,
        guardian_relation: student.guardian_relation ?? undefined,
        kk_number: student.kk_number ?? undefined,
        child_status: student.child_status ?? undefined,
        child_number: student.child_number ?? undefined,
        siblings_count: student.siblings_count ?? undefined,
        home_phone: student.home_phone ?? undefined,
        origin_school: student.origin_school ?? undefined,
        origin_graduation_year: student.origin_graduation_year ?? undefined,
        admitted_at: student.admitted_at ? dayjs(student.admitted_at) : undefined,
        uniform_size: student.uniform_size ?? undefined,
        tags: student.tags ?? [],
      })
    } else {
      form.resetFields()
      form.setFieldsValue({ status: 'active', tags: [] })
    }
  }, [open, student, form])

  // Prefill blok ayah/ibu/wali begitu data guardians termuat
  useEffect(() => {
    if (!open || !student || !guardiansQuery.data) return
    const shape: GuardianFieldsShape = {}
    for (const g of guardiansQuery.data) {
      shape[g.relation] = {
        name: g.name ?? undefined,
        phone: g.phone ?? undefined,
        education: g.education ?? undefined,
        occupation: g.occupation ?? undefined,
        income_range: g.income_range ?? undefined,
        address: g.address ?? undefined,
      }
    }
    form.setFieldsValue({ guardian_fields: shape })
  }, [open, student, guardiansQuery.data, form])

  const handleFinish = (values: StudentFormShape) => {
    onSubmit({
      ...values,
      birth_date: values.birth_date ? values.birth_date.format('YYYY-MM-DD') : undefined,
      admitted_at: values.admitted_at ? values.admitted_at.format('YYYY-MM-DD') : undefined,
      guardians: collectGuardians(values.guardian_fields),
    })
  }

  /** Field form di dalam blok Collapse: name={['guardian_fields', relation, field]} */
  function guardianBlock(relation: GuardianRelation) {
    const name = (field: GuardianFieldKey) => ['guardian_fields', relation, field] as const
    return (
      <Row gutter={16}>
        <Col xs={24} sm={12}>
          <Form.Item name={[...name('name')]} label="Nama">
            <Input placeholder={`Nama ${relation}`} maxLength={120} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item
            name={[...name('phone')]}
            label="No. HP"
            rules={[{ pattern: /^[\d+\-\s]{0,20}$/, message: 'Format nomor tidak valid' }]}
          >
            <Input placeholder="08xxxxxxxxxx" maxLength={20} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item name={[...name('education')]} label="Pendidikan">
            <Select placeholder="Pilih" allowClear options={EDUCATION_OPTIONS} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item name={[...name('occupation')]} label="Pekerjaan">
            <Input placeholder="Contoh: Petani" maxLength={60} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item name={[...name('income_range')]} label="Penghasilan / bulan">
            <Select placeholder="Pilih" allowClear options={INCOME_OPTIONS} />
          </Form.Item>
        </Col>
        <Col span={24}>
          <Form.Item name={[...name('address')]} label="Alamat">
            <Input.TextArea rows={2} placeholder="Kosongkan bila sama dengan alamat siswa" maxLength={300} />
          </Form.Item>
        </Col>
      </Row>
    )
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
            <Form.Item name="nickname" label="Nama Panggilan">
              <Input placeholder="Nama panggilan" maxLength={60} />
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
              name="nik"
              label="NIK"
              rules={[{ pattern: /^\d{0,16}$/, message: 'NIK hanya boleh 16 digit angka' }]}
            >
              <Input placeholder="NIK sesuai KK" maxLength={16} />
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

          <SectionTitle>Kontak Utama (WA & Portal)</SectionTitle>

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

          <SectionTitle>Orang Tua</SectionTitle>

          <Col span={24}>
            <Collapse
              ghost
              items={GUARDIAN_BLOCKS.map(({ relation, label }) => ({
                key: relation,
                label,
                // forceRender agar nilai field tetap terkirim walau blok tak dibuka
                forceRender: true,
                children: guardianBlock(relation),
              }))}
            />
          </Col>

          <SectionTitle>Data Lainnya</SectionTitle>

          <Col span={24}>
            <Collapse
              ghost
              items={[
                {
                  key: 'extra',
                  label: 'Data lengkap (KK, sekolah asal, dll.)',
                  forceRender: true,
                  children: (
                    <Row gutter={16}>
                      <Col xs={24} sm={12}>
                        <Form.Item
                          name="kk_number"
                          label="No. KK"
                          rules={[{ pattern: /^\d{0,16}$/, message: 'No. KK hanya boleh 16 digit angka' }]}
                        >
                          <Input placeholder="Nomor Kartu Keluarga" maxLength={16} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12}>
                        <Form.Item name="child_status" label="Status Anak">
                          <Select placeholder="Pilih" allowClear options={CHILD_STATUS_OPTIONS} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12}>
                        <Form.Item name="child_number" label="Anak Ke">
                          <InputNumber
                            style={{ width: '100%' }}
                            min={1}
                            max={50}
                            placeholder="Contoh: 2"
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12}>
                        <Form.Item name="siblings_count" label="Jumlah Saudara">
                          <InputNumber
                            style={{ width: '100%' }}
                            min={0}
                            max={50}
                            placeholder="Contoh: 3"
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12}>
                        <Form.Item
                          name="home_phone"
                          label="Telepon Rumah"
                          rules={[{ pattern: /^[\d+\-\s]{0,20}$/, message: 'Format nomor tidak valid' }]}
                        >
                          <Input placeholder="0331xxxxxxx" maxLength={20} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12}>
                        <Form.Item name="uniform_size" label="Ukuran Seragam">
                          <Select placeholder="Pilih" allowClear options={UNIFORM_SIZE_OPTIONS} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12}>
                        <Form.Item name="origin_school" label="Sekolah Asal">
                          <Input placeholder="Contoh: SDN 1 Tanggul" maxLength={120} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12}>
                        <Form.Item name="origin_graduation_year" label="Tahun Lulus Sekolah Asal">
                          <InputNumber
                            style={{ width: '100%' }}
                            min={1980}
                            max={2200}
                            placeholder="Contoh: 2024"
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12}>
                        <Form.Item name="admitted_at" label="Tanggal Diterima">
                          <DatePicker style={{ width: '100%' }} format="DD MMMM YYYY" />
                        </Form.Item>
                      </Col>
                    </Row>
                  ),
                },
              ]}
            />
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
