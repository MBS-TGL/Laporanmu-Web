import { useEffect } from 'react'
import { DatePicker, Form, Input, Select } from 'antd'
import { FileTextOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { AppModal } from '../../../shared/components/AppModal'
import { StudentSelect } from '../../../shared/components/StudentSelect'
import { generateLetterNumber } from './api'
import { useCreateOfficialLetter } from './hooks'
import {
  LETTER_TYPE_META,
  type OfficialLetterPayload,
  type OfficialLetterType,
} from './types'

interface LetterModalProps {
  open: boolean
  onClose: () => void
  presetStudentId?: string
  presetReportId?: string
}

interface FormValues {
  student_id: string
  type: OfficialLetterType
  letter_no: string
  subject: string
  body_text: string
  issued_date: dayjs.Dayjs
}

const TEMPLATES: Record<OfficialLetterType, { subject: string; body: string }> = {
  panggilan: {
    subject: 'Panggilan Orang Tua / Wali Santri',
    body: `Assalamu'alaikum Wr. Wb.

Mengharap kehadiran Bapak/Ibu Wali Santri pada:
Hari/Tanggal : [Hari, Tanggal]
Waktu        : 08.30 WIB - Selesai
Tempat       : Ruang BK / Kantor SMP Muhammadiyah 4 Tanggul
Keperluan    : Koordinasi dan pembinaan perkembangan belajar santri.

Demikian surat ini kami sampaikan, atas kehadiran dan kerjasamanya kami ucapkan terima kasih.

Wassalamu'alaikum Wr. Wb.`,
  },
  peringatan: {
    subject: 'Surat Peringatan Kedisiplinan (SP)',
    body: `Surat ini diterbitkan sebagai bentuk peringatan resmi terkait kedisiplinan dan tata tertib santri di pondok pesantren.

Diharapkan santri yang bersangkutan dapat melakukan perbaikan sikap, memenuhi kewajiban ibadah, dan mematuhi tata tertib yang berlaku. Pelanggaran berulang akan ditindaklanjuti dengan tindakan skorsing atau pengembalian kepada orang tua.`,
  },
  pujian: {
    subject: 'Apresiasi Prestasi Santri',
    body: `Pimpinan Pesantren dan Sekolah memberikan apresiasi setinggi-tingginya atas prestasi membanggakan yang telah diraih oleh santri dalam bidang [Sebutkan Prestasi].

Semoga prestasi ini menjadi motivasi untuk terus berprestasi dan menginspirasi santri lainnya.`,
  },
}

export function LetterModal({ open, onClose, presetStudentId, presetReportId }: LetterModalProps) {
  const [form] = Form.useForm<FormValues>()
  const createMutation = useCreateOfficialLetter()

  useEffect(() => {
    if (open) {
      form.resetFields()
      const defaultType: OfficialLetterType = 'panggilan'
      const meta = LETTER_TYPE_META[defaultType]
      form.setFieldsValue({
        type: defaultType,
        letter_no: generateLetterNumber(meta.prefix),
        subject: TEMPLATES[defaultType].subject,
        body_text: TEMPLATES[defaultType].body,
        issued_date: dayjs(),
        student_id: presetStudentId,
      })
    }
  }, [open, presetStudentId, form])

  const handleTypeChange = (type: OfficialLetterType) => {
    const meta = LETTER_TYPE_META[type]
    form.setFieldsValue({
      letter_no: generateLetterNumber(meta.prefix),
      subject: TEMPLATES[type].subject,
      body_text: TEMPLATES[type].body,
    })
  }

  const handleSave = async () => {
    try {
      const vals = await form.validateFields()
      const payload: OfficialLetterPayload = {
        student_id: vals.student_id,
        type: vals.type,
        letter_no: vals.letter_no,
        subject: vals.subject,
        body_text: vals.body_text,
        issued_date: vals.issued_date.format('YYYY-MM-DD'),
        related_report_id: presetReportId,
      }
      createMutation.mutate(payload, { onSuccess: onClose })
    } catch {
      // validation error
    }
  }

  return (
    <AppModal
      open={open}
      title="Terbitkan Surat Resmi BK"
      subtitle="Surat panggilan / pemanggilan wali ber-QR verifikasi"
      icon={<FileTextOutlined />}
      onCancel={onClose}
      onOk={handleSave}
      okText="Terbitkan Surat"
      confirmLoading={createMutation.isPending}
      destroyOnHidden
      width={580}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        <Form.Item
          name="student_id"
          label="Pilih Santri"
          rules={[{ required: true, message: 'Wajib memilih santri' }]}
        >
          <StudentSelect placeholder="Cari santri berdasarkan nama / NIS..." />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item name="type" label="Jenis Surat" rules={[{ required: true }]}>
            <Select
              onChange={handleTypeChange}
              options={Object.entries(LETTER_TYPE_META).map(([val, meta]) => ({
                value: val,
                label: meta.label,
              }))}
            />
          </Form.Item>
          <Form.Item name="issued_date" label="Tanggal Terbit" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
        </div>

        <Form.Item
          name="letter_no"
          label="Nomor Surat (Otomatis / Kustom)"
          rules={[{ required: true, message: 'Nomor surat wajib diisi' }]}
        >
          <Input placeholder="Contoh: 123/SP-ORTU/SMPM-4/2026" />
        </Form.Item>

        <Form.Item
          name="subject"
          label="Perihal Surat"
          rules={[{ required: true, message: 'Perihal surat wajib diisi' }]}
        >
          <Input placeholder="Perihal surat..." />
        </Form.Item>

        <Form.Item
          name="body_text"
          label="Isi Surat (Bisa Diedit)"
          rules={[{ required: true, message: 'Isi surat wajib ada' }]}
        >
          <Input.TextArea rows={6} />
        </Form.Item>
      </Form>
    </AppModal>
  )
}
