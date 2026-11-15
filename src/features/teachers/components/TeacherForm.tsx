import { useEffect, useMemo, useState } from 'react'
import {
  App,
  Avatar,
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Progress,
  Segmented,
  Select,
  Space,
  Tag,
  Upload,
  theme,
} from 'antd'
import {
  BookOutlined,
  CameraOutlined,
  ClockCircleOutlined,
  IdcardOutlined,
  MailOutlined,
  ReadOutlined,
  SolutionOutlined,
} from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { AppModal } from '../../../shared/components/AppModal'
import { ModalSection } from '../../../shared/components/ModalSection'
import { compressImage } from '../../../shared/utils/imageCompress'
import type { Teacher, TeacherFormValues } from '../types'
import { TEACHER_EMPLOYMENT_LABEL, WORK_DAYS } from '../types'
import { nbmExists } from '../api'

interface TeacherFormProps {
  open: boolean
  teacher: Teacher | null
  submitting: boolean
  onCancel: () => void
  onSubmit: (values: TeacherFormValues) => void
}

interface FormState extends Omit<TeacherFormValues, 'join_date' | 'birth_date'> {
  join_date?: Dayjs
  birth_date?: Dayjs
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Aktif' },
  { value: 'inactive', label: 'Nonaktif' },
  { value: 'on_leave', label: 'Cuti' },
]

const EDUCATION_OPTIONS = ['SMA', 'D1', 'D2', 'D3', 'S1', 'S2', 'S3'].map((v) => ({
  value: v,
  label: v === 'SMA' ? 'SMA/Sederajat' : v,
}))

// Urutan progres pengisian — jumlah field terisi jadi "% Lengkap" di modal
const PROGRESS_FIELDS = [
  'name',
  'nbm',
  'subject',
  'gender',
  'phone',
  'email',
  'status',
  'join_date',
  'address',
  'nik',
  'employment_status',
  'type',
  'birth_place',
  'birth_date',
  'last_education',
] as const

const GRID_2COL: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  columnGap: 12,
}
const SPAN_2: React.CSSProperties = { gridColumn: 'span 2' }

/** Chips hari kerja — nilai Form: string[] terurut sesuai WORK_DAYS */
function WorkDaysChips({
  value,
  onChange,
}: {
  value?: string[]
  onChange?: (v: string[]) => void
}) {
  const selected = value ?? [...WORK_DAYS]
  return (
    <Space size={4} wrap>
      {WORK_DAYS.map((d) => {
        const on = selected.includes(d)
        return (
          <Tag.CheckableTag
            key={d}
            checked={on}
            style={{ paddingInline: 10 }}
            onChange={() => {
              const next = on ? selected.filter((x) => x !== d) : [...selected, d]
              onChange?.(WORK_DAYS.filter((x) => next.includes(x)))
            }}
          >
            {d.slice(0, 3)}
          </Tag.CheckableTag>
        )
      })}
    </Space>
  )
}

export function TeacherForm({ open, teacher, submitting, onCancel, onSubmit }: TeacherFormProps) {
  const { token } = theme.useToken()
  const { message } = App.useApp()
  const [form] = Form.useForm<FormState>()
  const [photo, setPhoto] = useState<string | undefined>()
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  // Foto di-reset saat modal dibuka untuk guru berbeda / mode tambah —
  // pola penyesuaian state saat render (bukan effect)
  const [prevKey, setPrevKey] = useState<{ open: boolean; teacherId?: string }>({ open: false })
  if (open !== prevKey.open || (teacher?.id ?? undefined) !== prevKey.teacherId) {
    setPrevKey({ open, teacherId: teacher?.id ?? undefined })
    if (open) setPhoto(teacher?.photo_url ?? undefined)
  }

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
        address: teacher.address ?? undefined,
        employment_status: teacher.employment_status ?? 'GTY',
        type: teacher.type ?? 'guru',
        birth_place: teacher.birth_place ?? undefined,
        birth_date: teacher.birth_date ? dayjs(teacher.birth_date) : undefined,
        teaching_hours: teacher.teaching_hours ?? undefined,
        last_education: teacher.last_education ?? undefined,
        major: teacher.major ?? undefined,
        graduation_year: teacher.graduation_year ?? undefined,
        work_days: teacher.work_days ?? [...WORK_DAYS],
        fingerspot_name: teacher.fingerspot_name ?? undefined,
      })
    } else {
      form.resetFields()
      form.setFieldsValue({ status: 'active', employment_status: 'GTY', type: 'guru', work_days: [...WORK_DAYS] })
    }
  }, [open, teacher, form])

  const values = Form.useWatch([], form)
  const completeness = useMemo(() => {
    if (!values) return 0
    const filled = PROGRESS_FIELDS.filter((f) => {
      const v = values[f as keyof FormState]
      return v !== undefined && v !== null && v !== ''
    }).length
    return Math.round((filled / PROGRESS_FIELDS.length) * 100)
  }, [values])

  const handlePhoto = async (file: File) => {
    setUploadingPhoto(true)
    try {
      setPhoto(await compressImage(file))
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Foto tidak dapat diproses')
    } finally {
      setUploadingPhoto(false)
    }
    return false // cegah upload otomatis antd
  }

  const handleFinish = (values: FormState) => {
    onSubmit({
      ...values,
      photo_url: photo,
      join_date: values.join_date ? values.join_date.format('YYYY-MM-DD') : undefined,
      birth_date: values.birth_date ? values.birth_date.format('YYYY-MM-DD') : undefined,
    })
  }

  return (
    <AppModal
      title={teacher ? 'Edit Guru' : 'Tambah Guru'}
      subtitle={
        teacher ? 'Perbarui data guru, pengabdian, atau karyawan' : 'Data pengajar, musyrif, dan staf'
      }
      icon={<ReadOutlined />}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting || uploadingPhoto}
      size="lg"
      destroyOnHidden
    >
      <Form<FormState> form={form} layout="vertical" onFinish={handleFinish} disabled={submitting}>
        {/* Kelengkapan data — angka nyata dari field terisi */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 20,
            padding: '10px 12px',
            background: token.colorFillQuaternary,
            borderRadius: 10,
          }}
        >
          <Progress
            percent={completeness}
            showInfo={false}
            size={{ height: 6 }}
            style={{ flex: 1, margin: 0 }}
          />
          <span style={{ fontSize: 12, color: token.colorTextSecondary, whiteSpace: 'nowrap' }}>
            {completeness}% Lengkap
          </span>
        </div>

        {/* ── Foto ─────────────────────────────────────────── */}
        <Form.Item style={{ marginBottom: 20 }}>
          <Space size={12} align="center">
            <Avatar
              size={72}
              src={photo}
              style={{ background: token.colorPrimaryBg, color: token.colorPrimaryTextActive, fontWeight: 700, fontSize: 26 }}
            >
              {values?.name?.charAt(0).toUpperCase() || '?'}
            </Avatar>
            <Upload accept="image/*" showUploadList={false} beforeUpload={handlePhoto}>
              <Button icon={<CameraOutlined />} loading={uploadingPhoto}>
                Pilih Foto
              </Button>
            </Upload>
            {photo && (
              <Button type="text" danger onClick={() => setPhoto(undefined)}>
                Hapus
              </Button>
            )}
          </Space>
        </Form.Item>

        {/* ── Identitas ────────────────────────────────────── */}
        <ModalSection title="Identitas" icon={<IdcardOutlined />} />
        <div style={{ ...GRID_2COL, marginBottom: 16 }}>
          <Form.Item
            name="name"
            label="Nama Lengkap"
            rules={[{ required: true, message: 'Nama wajib diisi' }]}
            style={SPAN_2}
          >
            <Input placeholder="Nama lengkap dengan gelar" maxLength={120} />
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

          <Form.Item
            name="nik"
            label="NIK"
            rules={[{ pattern: /^\d{0,20}$/, message: 'NIK hanya angka' }]}
          >
            <Input maxLength={20} placeholder="16 digit angka" />
          </Form.Item>

          <Form.Item
            name="nip"
            label="NIP"
            rules={[{ pattern: /^\d{0,30}$/, message: 'NIP hanya angka' }]}
          >
            <Input maxLength={30} placeholder="NIP" />
          </Form.Item>

          <Form.Item name="nuptk" label="NUPTK">
            <Input maxLength={30} placeholder="NUPTK" />
          </Form.Item>

          <Form.Item name="birth_place" label="Tempat Lahir">
            <Input placeholder="Kota lahir" maxLength={80} />
          </Form.Item>

          <Form.Item name="birth_date" label="Tanggal Lahir">
            <DatePicker style={{ width: '100%' }} format="DD-MM-YYYY" />
          </Form.Item>

          <Form.Item name="gender" label="Jenis Kelamin">
            <Segmented
              block
              options={[
                { value: 'L', label: 'Laki-laki' },
                { value: 'P', label: 'Perempuan' },
              ]}
            />
          </Form.Item>
        </div>

        {/* ── Kepegawaian ──────────────────────────────────── */}
        <ModalSection title="Kepegawaian" icon={<SolutionOutlined />} />
        <div style={{ ...GRID_2COL, marginBottom: 16 }}>
          <Form.Item name="employment_status" label="Status Kepegawaian">
            <Select
              options={Object.entries(TEACHER_EMPLOYMENT_LABEL).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </Form.Item>

          <Form.Item name="type" label="Tipe Tugas">
            <Segmented
              block
              options={[
                { value: 'guru', label: 'Guru' },
                { value: 'pengabdian', label: 'Pengabdian' },
                { value: 'karyawan', label: 'Karyawan' },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="status"
            label="Status Aktif"
            rules={[{ required: true, message: 'Status wajib dipilih' }]}
          >
            <Select options={STATUS_OPTIONS} />
          </Form.Item>

          <Form.Item name="join_date" label="Tanggal Bergabung">
            <DatePicker style={{ width: '100%' }} format="DD-MM-YYYY" />
          </Form.Item>

          <Form.Item name="teaching_hours" label="Jam Mengajar">
            <InputNumber
              min={0}
              max={60}
              style={{ width: '100%' }}
              placeholder="0"
              addonAfter="jam / minggu"
            />
          </Form.Item>
        </div>

        {/* ── Pendidikan Terakhir ──────────────────────────── */}
        <ModalSection title="Pendidikan Terakhir" icon={<BookOutlined />} />
        <div style={{ ...GRID_2COL, marginBottom: 16 }}>
          <Form.Item name="last_education" label="Tingkat Pendidikan">
            <Select options={EDUCATION_OPTIONS} allowClear placeholder="Pilih tingkat" />
          </Form.Item>

          <Form.Item name="major" label="Jurusan / Program Studi">
            <Input placeholder="Contoh: Pendidikan Bahasa Inggris" maxLength={120} />
          </Form.Item>

          <Form.Item name="graduation_year" label="Tahun Lulus">
            <InputNumber min={1950} max={2100} style={{ width: '100%' }} placeholder="Tahun" />
          </Form.Item>
        </div>

        {/* ── Kontak & Lokasi ──────────────────────────────── */}
        <ModalSection title="Kontak & Lokasi" icon={<MailOutlined />} />
        <div style={{ ...GRID_2COL, marginBottom: 16 }}>
          <Form.Item
            name="phone"
            label="No. HP / WhatsApp"
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

          <Form.Item name="address" label="Alamat Lengkap" style={SPAN_2}>
            <Input.TextArea rows={2} placeholder="Alamat domisili saat ini" maxLength={300} />
          </Form.Item>
        </div>

        {/* ── Presensi ─────────────────────────────────────── */}
        <ModalSection title="Presensi" icon={<ClockCircleOutlined />} />
        <div style={{ ...GRID_2COL, marginBottom: 16 }}>
          <Form.Item name="fingerspot_name" label="Nama di Fingerspot">
            <Input placeholder="Sesuai mesin absensi" maxLength={120} />
          </Form.Item>

          <Form.Item
            name="work_days"
            label="Hari Kerja Aktif"
            style={{ ...SPAN_2, marginBottom: 0 }}
          >
            <WorkDaysChips />
          </Form.Item>
        </div>

        <Form.Item name="notes" label="Catatan Internal" style={{ marginBottom: 0 }}>
          <Input.TextArea rows={2} placeholder="Informasi tambahan" maxLength={500} />
        </Form.Item>
      </Form>
    </AppModal>
  )
}
