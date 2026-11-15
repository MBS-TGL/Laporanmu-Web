import { useEffect } from 'react'
import { Form, Input, InputNumber, Typography } from 'antd'
import { PlusCircleOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import type { HealthMedicine } from '../types'

interface RestockModalProps {
  open: boolean
  medicine: HealthMedicine | null
  submitting: boolean
  onCancel: () => void
  onSubmit: (amount: number, note: string) => void
}

interface RestockFormShape {
  amount: number
  note?: string
}

/** Penambahan stok cepat (stock-in) — stok akhir = stok kini + jumlah. */
export function RestockModal({ open, medicine, submitting, onCancel, onSubmit }: RestockModalProps) {
  const [form] = Form.useForm<RestockFormShape>()
  const amount = Form.useWatch('amount', form)

  useEffect(() => {
    if (!open) return
    form.resetFields()
    form.setFieldsValue({ amount: 10 })
  }, [open, medicine, form])

  const nextStock = medicine ? medicine.stock + (typeof amount === 'number' && amount > 0 ? amount : 0) : 0

  return (
    <AppModal
      title={`Tambah Stok (${medicine?.name ?? ''})`}
      subtitle="Restock obat masuk ke penyimpanan"
      icon={<PlusCircleOutlined />}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      width={440}
      destroyOnHidden
    >
      <Form<RestockFormShape> form={form} layout="vertical" onFinish={(v) => onSubmit(v.amount, v.note ?? '')} disabled={submitting}>
        {medicine && (
          <Typography.Paragraph type="secondary" style={{ fontSize: 13, marginTop: 0 }}>
            Stok saat ini: <Typography.Text strong>{medicine.stock} {medicine.unit}</Typography.Text>
            {' · '}min. {medicine.min_stock}
          </Typography.Paragraph>
        )}
        <Form.Item
          name="amount"
          label="Jumlah Masuk"
          rules={[{ required: true, message: 'Jumlah wajib diisi' }]}
        >
          <InputNumber style={{ width: '100%' }} min={1} max={100000} precision={0} placeholder="Contoh: 50" />
        </Form.Item>
        <Form.Item name="note" label="Catatan (opsional)">
          <Input maxLength={120} placeholder="Contoh: Pengadaan bulan November" />
        </Form.Item>
        {medicine && amount > 0 && (
          <Typography.Text style={{ fontSize: 13 }}>
            Stok menjadi: <Typography.Text strong type="success">{nextStock} {medicine.unit}</Typography.Text>
          </Typography.Text>
        )}
      </Form>
    </AppModal>
  )
}
