import { useEffect, useMemo, useState } from 'react'
import { App, Button, Col, DatePicker, Form, Input, Row, Select } from 'antd'
import { CalendarOutlined, ThunderboltOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { AppModal } from '../../../shared/components/AppModal'
import { StudentMultiSelect, StudentSelect } from '../../../shared/components/StudentSelect'
import { callAi } from '../../../shared/lib/ai'
import { CATEGORY_OPTIONS, STATUS_OPTIONS, URGENCY_OPTIONS } from '../constants'
import type {
  CounselingCategory,
  CounselingFormValues,
  CounselingLog,
  CounselingStatus,
  CounselingUrgency,
} from '../types'

interface CounselingFormShape {
  student_id: string
  additional_student_ids?: string[]
  counselor_name: string
  date: Dayjs
  time: Dayjs
  category: CounselingCategory
  complaint: string
  diagnosis?: string
  action_plan?: string
  urgency: CounselingUrgency
  status: CounselingStatus
  next_session_date?: Dayjs
}

const AI_SYSTEM = `Kamu adalah asisten konselor sekolah pondok santri (BK) di aplikasi Laporanmu.
ATURAN KETAT:
1. Buat rencana tindakan BK HANYA berdasarkan keluhan, diagnosis, kategori, dan tingkat urgensi yang diberikan.
2. Bahasa Indonesia, praktis, gaya konselor pesantren (melibatkan musyrif/ustadz bila relevan).
3. TANPA heading, TANPA bullet, TANPA penjelasan tambahan — satu paragraf ringkas maksimal 180 karakter.
4. DILARANG mendiagnosis medis/psikologis yang serius atau mengarang data santri.`

interface FormModalProps {
  open: boolean
  submitting: boolean
  /** Selain null = mode edit */
  editLog: CounselingLog | null
  /** Santri yang sudah ditentukan (catat sesi dari drawer detail) */
  presetStudent?: { value: string; label: string } | null
  /** Keluhan awal (mis. tindak lanjut ketidakhadiran dari halaman absensi) */
  presetComplaint?: string
  defaultCounselor: string
  onCancel: () => void
  onSubmit: (values: CounselingFormValues) => void
}

export function FormModal({
  open,
  submitting,
  editLog,
  presetStudent,
  presetComplaint,
  defaultCounselor,
  onCancel,
  onSubmit,
}: FormModalProps) {
  const { message } = App.useApp()
  const [form] = Form.useForm<CounselingFormShape>()
  const [suggesting, setSuggesting] = useState(false)
  const complaint = Form.useWatch('complaint', form)

  const initialOptions = useMemo(() => {
    if (editLog?.student_id) {
      return [{ value: editLog.student_id, label: editLog.student_name }]
    }
    if (presetStudent) return [presetStudent]
    return []
  }, [editLog, presetStudent])

  useEffect(() => {
    if (!open) return
    form.resetFields()
    if (editLog) {
      form.setFieldsValue({
        student_id: editLog.student_id ?? undefined,
        counselor_name: editLog.counselor_name,
        date: dayjs(editLog.date),
        time: dayjs(editLog.time, 'HH:mm'),
        category: editLog.category,
        complaint: editLog.complaint,
        diagnosis: editLog.diagnosis ?? undefined,
        action_plan: editLog.action_plan ?? undefined,
        urgency: editLog.urgency,
        status: editLog.status,
        next_session_date: editLog.next_session_date ? dayjs(editLog.next_session_date) : undefined,
      })
    } else {
      form.setFieldsValue({
        student_id: presetStudent?.value,
        counselor_name: defaultCounselor,
        date: dayjs(),
        time: dayjs(),
        category: 'personal',
        complaint: presetComplaint ?? undefined,
        urgency: 'low',
        status: 'in_progress',
      })
    }
  }, [open, form, editLog, defaultCounselor, presetStudent, presetComplaint])

  const suggestPlan = async () => {
    const complaintValue = String(form.getFieldValue('complaint') ?? '').trim()
    if (!complaintValue) {
      message.warning('Isi keluhan santri dulu agar AI bisa memberi saran')
      return
    }
    setSuggesting(true)
    try {
      const category = form.getFieldValue('category') as CounselingCategory
      const urgency = form.getFieldValue('urgency') as CounselingUrgency
      const diagnosis = String(form.getFieldValue('diagnosis') ?? '').trim()
      const result = await callAi({
        system: AI_SYSTEM,
        prompt: `Keluhan santri: ${complaintValue}
Diagnosis konselor: ${diagnosis || '(belum diisi)'}
Kategori bimbingan: ${category}
Tingkat urgensi: ${urgency}

Buat satu rencana tindakan BK ringkas untuk kasus di atas.`,
        maxOutputTokens: 256,
      })
      if (result.startsWith('API Key AI belum diatur')) {
        message.warning(result)
        return
      }
      form.setFieldsValue({
        action_plan: result.replace(/\s+/g, ' ').trim().slice(0, 200),
      })
    } catch {
      message.error('Gagal meminta saran AI')
    } finally {
      setSuggesting(false)
    }
  }

  const handleFinish = (values: CounselingFormShape) => {
    onSubmit({
      student_id: values.student_id,
      additional_student_ids: values.additional_student_ids,
      counselor_name: values.counselor_name,
      date: values.date.format('YYYY-MM-DD'),
      time: values.time.format('HH:mm'),
      category: values.category,
      complaint: values.complaint,
      diagnosis: values.diagnosis,
      action_plan: values.action_plan,
      urgency: values.urgency,
      status: values.status,
      next_session_date: values.next_session_date ? values.next_session_date.format('YYYY-MM-DD') : null,
    })
  }

  return (
    <AppModal
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      width={580}
      destroyOnHidden
      icon={<CalendarOutlined />}
      title={editLog ? 'Edit Sesi Bimbingan BK' : 'Catat Sesi Bimbingan BK'}
      subtitle={
        editLog
          ? `Memperbarui sesi ${editLog.student_name}`
          : 'Catat keluhan, diagnosis, dan rencana tindakan BK santri'
      }
    >
      <Form<CounselingFormShape> form={form} layout="vertical" onFinish={handleFinish} disabled={submitting}>
        <Form.Item
          name="student_id"
          label="Pilih Santri Utama"
          rules={[{ required: true, message: 'Santri wajib dipilih' }]}
        >
          <StudentSelect initialOptions={initialOptions} disabled={Boolean(editLog?.student_id)} />
        </Form.Item>

        {!editLog && (
          <Form.Item
            name="additional_student_ids"
            label="Peserta Tambahan (Konseling Kelompok)"
            extra="Pilih santri lain jika sesi ini merupakan konseling kelompok atau klasikal (opsional)."
          >
            <StudentMultiSelect placeholder="Cari santri tambahan..." />
          </Form.Item>
        )}

        <Form.Item name="counselor_name" label="Konselor / Pembimbing">
          <Input maxLength={80} placeholder="Nama ustadz / ustadzah pembimbing" />
        </Form.Item>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item
              name="date"
              label="Tanggal Bimbingan"
              rules={[{ required: true, message: 'Tanggal wajib diisi' }]}
            >
              <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="time"
              label="Jam Sesi"
              rules={[{ required: true, message: 'Jam wajib diisi' }]}
            >
              <DatePicker.TimePicker style={{ width: '100%' }} format="HH:mm" minuteStep={5} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="category" label="Kategori Bimbingan" rules={[{ required: true }]}>
              <Select options={CATEGORY_OPTIONS} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="urgency" label="Tingkat Urgensi" rules={[{ required: true }]}>
              <Select options={URGENCY_OPTIONS} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="complaint"
          label="Keluhan & Masalah Santri"
          rules={[{ required: true, message: 'Keluhan wajib diisi' }]}
        >
          <Input.TextArea
            rows={3}
            maxLength={500}
            showCount
            placeholder="Jelaskan keluhan, gejala psikososial, atau kebingungan yang dihadapi santri…"
          />
        </Form.Item>

        <Form.Item name="diagnosis" label="Diagnosis / Identifikasi Akar Masalah">
          <Input maxLength={150} placeholder="Contoh: Homesickness ringan, penurunan motivasi" />
        </Form.Item>

        <Form.Item
          name="next_session_date"
          label="Tenggat Tindak Lanjut"
          extra="Isi jika kasus perlu dipantau lagi; sesi proses tanpa tenggat bisa menggantung."
        >
          <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
        </Form.Item>

        <Form.Item
          name="action_plan"
          label={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              Rencana Tindakan / Solusi BK
              <Button
                size="small"
                type="dashed"
                icon={<ThunderboltOutlined />}
                loading={suggesting}
                disabled={!complaint}
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  void suggestPlan()
                }}
              >
                Saran AI
              </Button>
            </span>
          }
        >
          <Input maxLength={200} placeholder="Contoh: Bimbingan supportif, koordinasi asrama" />
        </Form.Item>

        <Form.Item name="status" label="Status Sesi" rules={[{ required: true }]}>
          <Select options={STATUS_OPTIONS} />
        </Form.Item>
      </Form>
    </AppModal>
  )
}
