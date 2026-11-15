import { useEffect, useMemo } from 'react'
import { Button, Col, DatePicker, Form, Input, Row, Space } from 'antd'
import { FileAddOutlined, QrcodeOutlined } from '@ant-design/icons'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { AppModal } from '../../../shared/components/AppModal'
import { StudentSelect } from '../../../shared/components/StudentSelect'
import type { LeavePermit, PermitFormValues, PermitStudentBrief } from '../types'

const PURPOSE_PRESETS = [
  'Pulang ke rumah',
  'Belanja kebutuhan',
  'Kontrol kesehatan',
  'Keperluan keluarga',
  'Mengurus administrasi',
  'Lainnya',
]

interface Props {
  open: boolean
  submitting: boolean
  onCancel: () => void
  onSubmit: (values: PermitFormValues) => void
  /** Izin yang diedit — kosong = mode terbitkan baru */
  editPermit?: LeavePermit | null
  /** Duplikat izin lama (Izin Ulang) — santri & detail terisi, tanggal kembali ke default */
  duplicatePermit?: LeavePermit | null
  /** Santri hasil scan kartu — prefill pilihan santri */
  presetStudent?: PermitStudentBrief | null
  /** Buka modal scan kartu dari dalam form */
  onScanClick?: () => void
}

/**
 * Form penerbitan & pengeditan surat izin keluar.
 * Dipakai ulang oleh tombol "Terbitkan Izin", edit di drawer/tabel,
 * izin ulang (duplikat), dan hasil scan kartu santri.
 */
export function FormModal({ open, submitting, onCancel, onSubmit, editPermit, duplicatePermit, presetStudent, onScanClick }: Props) {
  const [form] = Form.useForm()

  // Opsi awal untuk StudentSelect (shape { value, label }) — dari edit,
  // izin ulang, atau preset scan/gerbang agar label santri langsung tampil
  const initialOptions = useMemo(() => {
    const brief = editPermit?.student
      ? {
          id: editPermit.student_id,
          name: editPermit.student.name,
          registration_code: editPermit.student.registration_code,
          phone: editPermit.student.phone ?? editPermit.phone,
        }
      : duplicatePermit?.student
        ? {
            id: duplicatePermit.student_id,
            name: duplicatePermit.student.name,
            registration_code: duplicatePermit.student.registration_code,
            phone: duplicatePermit.student.phone ?? duplicatePermit.phone,
          }
        : presetStudent
    if (!brief) return []
    return [{ value: brief.id, label: `${brief.name} (${brief.registration_code})` }]
  }, [editPermit, duplicatePermit, presetStudent])

  // Prefill saat modal dibuka: mode edit, izin ulang, preset scan, atau reset default
  useEffect(() => {
    if (!open) return
    if (editPermit) {
      const deadline = dayjs(editPermit.return_deadline)
      form.setFieldsValue({
        student_id: editPermit.student_id,
        phone: editPermit.phone ?? editPermit.student?.phone ?? undefined,
        destination: editPermit.destination,
        purpose: editPermit.purpose,
        leave_date: dayjs(editPermit.leave_date),
        return_date: deadline,
        return_time: deadline,
      })
    } else if (duplicatePermit) {
      // Tanggal & jam memakai default (hari ini +3 jam) — hanya detail yang disalin
      form.setFieldsValue({
        student_id: duplicatePermit.student_id,
        phone: duplicatePermit.phone ?? duplicatePermit.student?.phone ?? undefined,
        destination: duplicatePermit.destination,
        purpose: duplicatePermit.purpose,
      })
    } else if (presetStudent) {
      form.setFieldsValue({
        student_id: presetStudent.id,
        phone: presetStudent.phone ?? undefined,
        destination: undefined,
        purpose: undefined,
      })
    } else {
      form.resetFields()
    }
  }, [open, editPermit, duplicatePermit, presetStudent, form])

  const handleFinish = (values: {
    student_id: string
    phone?: string
    destination: string
    purpose: string
    leave_date: Dayjs
    return_date: Dayjs
    return_time: Dayjs
  }) => {
    onSubmit({
      student_id: values.student_id,
      phone: values.phone,
      destination: values.destination,
      purpose: values.purpose,
      leave_date: values.leave_date.format('YYYY-MM-DD'),
      return_date: values.return_date.format('YYYY-MM-DD'),
      return_time: values.return_time.format('HH:mm'),
    })
  }

  return (
    <AppModal
      title={editPermit ? 'Edit Surat Izin' : duplicatePermit ? 'Izin Ulang (Duplikat)' : 'Terbitkan Surat Izin Keluar'}
      subtitle={
        editPermit
          ? `No. ${editPermit.id.slice(0, 8).toUpperCase()}`
          : duplicatePermit
            ? `Disalin dari No. ${duplicatePermit.id.slice(0, 8).toUpperCase()}, periksa jadwal sebelum menerbitkan`
            : 'Isi data santri dan jangka waktu izin'
      }
      icon={<FileAddOutlined />}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      okText={editPermit ? 'Simpan' : 'Terbitkan'}
      confirmLoading={submitting}
      width={560}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        disabled={submitting}
        initialValues={{ leave_date: dayjs(), return_date: dayjs(), return_time: dayjs().add(3, 'hour') }}
      >
        <Form.Item label="Santri" required style={{ marginBottom: 12 }}>
          <Space.Compact style={{ display: 'flex', width: '100%' }}>
            <Form.Item
              name="student_id"
              noStyle
              rules={[{ required: true, message: 'Santri wajib dipilih' }]}
            >
              <StudentSelect
                initialOptions={initialOptions}
                placeholder="Ketik nama atau pilih santri"
              />
            </Form.Item>
            {onScanClick && !editPermit && (
              <Button icon={<QrcodeOutlined />} onClick={onScanClick} title="Scan kartu santri">
                Scan
              </Button>
            )}
          </Space.Compact>
        </Form.Item>

        <Form.Item name="phone" label="No. Telepon / WA Wali" style={{ marginBottom: 12 }}>
          <Input maxLength={20} placeholder="08xxxxxxxxxx (opsional)" />
        </Form.Item>

        <Form.Item
          name="destination"
          label="Tujuan"
          rules={[{ required: true, message: 'Tujuan wajib diisi' }]}
          style={{ marginBottom: 12 }}
        >
          <Input maxLength={120} placeholder="Rumah orang tua, rumah sakit…" />
        </Form.Item>

        <Form.Item
          name="purpose"
          label="Keperluan"
          rules={[{ required: true, message: 'Keperluan wajib diisi' }]}
          style={{ marginBottom: 12 }}
        >
          <Input maxLength={150} />
        </Form.Item>

        <Row gutter={8} style={{ marginBottom: 4 }}>
          {PURPOSE_PRESETS.map((preset) => (
            <Col key={preset} xs={12} sm={8}>
              <Button
                size="small"
                type="dashed"
                block
                style={{ marginBottom: 6 }}
                onClick={() => form.setFieldValue('purpose', preset)}
              >
                {preset}
              </Button>
            </Col>
          ))}
        </Row>

        <Row gutter={12} style={{ marginTop: 8 }}>
          <Col span={12}>
            <Form.Item
              name="leave_date"
              label="Tanggal Keluar"
              rules={[{ required: true, message: 'Tanggal keluar wajib diisi' }]}
            >
              <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="return_date"
              label="Tanggal Kembali"
              dependencies={['leave_date']}
              rules={[
                { required: true, message: 'Tanggal kembali wajib diisi' },
                ({ getFieldValue }) => ({
                  validator(_, value: Dayjs) {
                    const leave = getFieldValue('leave_date') as Dayjs | undefined
                    if (!value || !leave || !value.isBefore(leave, 'day')) return Promise.resolve()
                    return Promise.reject(new Error('Tanggal kembali tidak boleh lebih awal dari tanggal keluar'))
                  },
                }),
              ]}
            >
              <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="return_time"
          label="Jam Kembali"
          rules={[{ required: true, message: 'Jam kembali wajib diisi' }]}
        >
          <DatePicker.TimePicker style={{ width: '100%' }} format="HH:mm" minuteStep={5} />
        </Form.Item>
      </Form>
    </AppModal>
  )
}
