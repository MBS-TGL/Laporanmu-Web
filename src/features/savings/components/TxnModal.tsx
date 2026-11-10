import { useEffect } from 'react'
import { DatePicker, Form, Input, InputNumber, Segmented } from 'antd'
import { FallOutlined, RiseOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { AppModal } from '../../../shared/components/AppModal'
import type { SavingsTxnKind } from '../types'

interface TxnFormShape {
  kind: SavingsTxnKind
  amount: number
  note?: string
  occurred_at: Dayjs
}

interface TxnModalProps {
  open: boolean
  kind: SavingsTxnKind
  studentName?: string
  submitting: boolean
  onCancel: () => void
  onSubmit: (values: { amount: number; note?: string; occurred_at: string }) => void
}

export function TxnModal({ open, kind, studentName, submitting, onCancel, onSubmit }: TxnModalProps) {
  const [form] = Form.useForm<TxnFormShape>()
  const isDeposit = kind === 'deposit'

  useEffect(() => {
    if (!open) return
    form.resetFields()
    form.setFieldsValue({ kind, occurred_at: dayjs() })
  }, [open, kind, form])

  const handleFinish = (values: TxnFormShape) => {
    onSubmit({
      amount: values.amount,
      note: values.note,
      occurred_at: values.occurred_at.format('YYYY-MM-DD'),
    })
  }

  return (
    <AppModal
      title={isDeposit ? 'Setor Tabungan' : 'Tarik Tabungan'}
      subtitle={studentName ? `Rekening ${studentName}` : undefined}
      icon={isDeposit ? <RiseOutlined /> : <FallOutlined />}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      width={440}
      destroyOnHidden
    >
      <Form<TxnFormShape>
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        disabled={submitting}
        initialValues={{ kind }}
      >
        <Form.Item name="kind" label="Jenis Transaksi">
          <Segmented
            block
            options={[
              { label: 'Setor', value: 'deposit', icon: <RiseOutlined /> },
              { label: 'Tarik', value: 'withdrawal', icon: <FallOutlined /> },
            ]}
          />
        </Form.Item>

        <Form.Item
          name="amount"
          label="Jumlah"
          rules={[
            { required: true, message: 'Jumlah wajib diisi' },
            {
              validator: (_, value: number | undefined) =>
                value && value > 0
                  ? Promise.resolve()
                  : Promise.reject(new Error('Jumlah harus lebih besar dari nol')),
            },
          ]}
        >
          <InputNumber<number>
            style={{ width: '100%' }}
            min={500}
            step={1000}
            precision={0}
            formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
            parser={(v) => Number((v ?? '').replace(/\./g, ''))}
            placeholder="Contoh: 50000"
            addonBefore="Rp"
          />
        </Form.Item>

        {!isDeposit && (
          <div style={{ marginBottom: 12, fontSize: 12.5, color: 'rgba(0,0,0,0.45)' }}>
            Penarikan melebihi saldo akan ditolak sistem — saldo tidak bisa minus.
          </div>
        )}

        <Form.Item name="occurred_at" label="Tanggal" rules={[{ required: true, message: 'Tanggal wajib diisi' }]}>
          <DatePicker format="DD MMM YYYY" style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item name="note" label="Keterangan">
          <Input.TextArea rows={2} placeholder="Contoh: setor harian, uang jajan (opsional)" maxLength={200} />
        </Form.Item>
      </Form>
    </AppModal>
  )
}
