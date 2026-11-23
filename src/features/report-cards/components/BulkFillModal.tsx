import { Form, Input, InputNumber, Typography } from 'antd'
import { AppModal } from '../../../shared/components/AppModal'
import { ModalFooter } from '../../../shared/components/ModalFooter'
import { SectionDivider } from '../../../shared/components/SectionDivider'
import type { Criterion } from '../constants'
import type { ReportCardType } from '../types'

export interface BulkFillValues {
  scores: Record<string, number | null>
  weight_kg?: number | null
  height_cm?: number | null
  ziyadah?: string
  murojaah?: string
  sholat?: string
  sick_days?: number
  excused_days?: number
  absent_days?: number
  early_leave_days?: number
  notes?: string
}

interface BulkFillModalProps {
  open: boolean
  type: ReportCardType
  criteria: Criterion[]
  maxScore: number
  onClose: () => void
  onApply: (values: BulkFillValues) => void
}

const FORM_NAMES_MONTHLY_EXTRA = ['ziyadah', 'murojaah', 'sholat'] as const
const FORM_NAMES_ATTENDANCE = ['sick_days', 'excused_days', 'absent_days', 'early_leave_days'] as const

/** Isi Massal: nilai yang diisi di modal ini hanya diterapkan ke sel yang masih kosong. */
export function BulkFillModal({ open, type, criteria, maxScore, onClose, onApply }: BulkFillModalProps) {
  const [form] = Form.useForm()
  const isMonthly = type === 'monthly'

  const handleApply = async () => {
    const values = await form.validateFields()
    const scores: Record<string, number | null> = {}
    for (const c of criteria) {
      const v = values.scores?.[c.key]
      scores[c.key] = typeof v === 'number' ? v : null
    }
    onApply({
      scores,
      weight_kg: values.weight_kg ?? null,
      height_cm: values.height_cm ?? null,
      ziyadah: values.ziyadah,
      murojaah: values.murojaah,
      sholat: values.sholat,
      sick_days: values.sick_days,
      excused_days: values.excused_days,
      absent_days: values.absent_days,
      early_leave_days: values.early_leave_days,
      notes: values.notes,
    })
    form.resetFields()
    onClose()
  }

  return (
    <AppModal
      open={open}
      title="Isi Massal"
      subtitle="Hanya sel yang masih kosong yang akan terisi — nilai yang sudah ada tidak ditimpa"
      size="lg"
      onCancel={onClose}
      destroyOnHidden
      footer={
        <ModalFooter
          onCancel={onClose}
          onOk={handleApply}
          okText="Terapkan"
        />
      }
    >
      <Typography.Paragraph type="secondary" style={{ fontSize: 12.5, marginTop: 0 }}>
        Isi hanya bagian yang sama untuk semua santri (misal hari kehadiran atau hafalan). Kolom yang dibiarkan kosong tidak akan mengubah data santri mana pun.
      </Typography.Paragraph>

      <Form form={form} layout="vertical">
        <SectionDivider>Nilai (skala 0-{maxScore})</SectionDivider>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '8px 12px' }}>
          {criteria.map((c) => (
            <Form.Item key={c.key} name={['scores', c.key]} label={c.label} style={{ marginBottom: 8 }}>
              <InputNumber<number> style={{ width: '100%' }} min={0} max={maxScore} placeholder="Lewati" />
            </Form.Item>
          ))}
        </div>

        <SectionDivider>Kehadiran (hari)</SectionDivider>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(140px, 100%), 1fr))',
            gap: 12,
          }}
        >
          {FORM_NAMES_ATTENDANCE.map((name, i) => (
            <Form.Item
              key={name}
              name={name}
              label={['Sakit', 'Izin', 'Alpa', 'Pulang'][i]}
              style={{ marginBottom: 8 }}
            >
              <InputNumber<number> style={{ width: '100%' }} min={0} max={365} precision={0} placeholder="Lewati" />
            </Form.Item>
          ))}
        </div>

        <SectionDivider>{isMonthly ? 'Hafalan & Ibadah' : 'Fisik'}</SectionDivider>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(140px, 100%), 1fr))',
            gap: 12,
          }}
        >
          {isMonthly ? (
            FORM_NAMES_MONTHLY_EXTRA.map((name) => (
              <Form.Item key={name} name={name} label={name === 'sholat' ? 'Sholat' : name === 'ziyadah' ? 'Ziyadah' : "Muroja'ah"} style={{ marginBottom: 8 }}>
                <Input placeholder="Lewati" maxLength={60} />
              </Form.Item>
            ))
          ) : (
            <>
              <Form.Item name="weight_kg" label="Berat Badan (kg)" style={{ marginBottom: 8 }}>
                <InputNumber<number> style={{ width: '100%' }} min={0} max={300} placeholder="Lewati" />
              </Form.Item>
              <Form.Item name="height_cm" label="Tinggi Badan (cm)" style={{ marginBottom: 8 }}>
                <InputNumber<number> style={{ width: '100%' }} min={0} max={250} placeholder="Lewati" />
              </Form.Item>
              <Form.Item name="sholat" label="Sholat" style={{ marginBottom: 8 }}>
                <Input placeholder="Lewati" maxLength={60} />
              </Form.Item>
            </>
          )}
        </div>

        <Form.Item name="notes" label="Catatan Musyrif" style={{ marginTop: 12 }}>
          <Input.TextArea rows={2} placeholder="Lewati" maxLength={500} />
        </Form.Item>
      </Form>
    </AppModal>
  )
}
