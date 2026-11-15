import { useEffect, useMemo, useState } from 'react'
import { App, DatePicker, Form, Input, InputNumber, Radio, Select, Typography, theme } from 'antd'
import { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { StudentSelect } from '../../../shared/components/StudentSelect'
import { AppModal } from '../../../shared/components/AppModal'
import { useProfile } from '../../../shared/hooks/useProfile'
import { useCreateSppPayment, useSppWithPayments } from '../hooks'
import { formatRupiah, outstandingOf } from '../sppUtil'
import { METHOD_LABEL, type PaymentFormValues, type SppMethod } from '../types'

interface PaymentModalProps {
  open: boolean
  onClose: () => void
  /** Pra-pilih santri (mis. dari baris tunggakan). */
  presetStudentId?: string
  presetStudentName?: string
}

/**
 * Catat pembayaran SPP: pilih santri, tampilkan kewajiban yang belum
 * lunas, isi nominal (default sisa tagihan), metode & tanggal.
 */
export function PaymentModal({ open, onClose, presetStudentId, presetStudentName }: PaymentModalProps) {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const { profile } = useProfile()
  const { obligations } = useSppWithPayments()
  const createPayment = useCreateSppPayment()

  const [studentId, setStudentId] = useState<string | undefined>(presetStudentId)
  const [obligationId, setObligationId] = useState<string | undefined>()
  const [amount, setAmount] = useState<number | undefined>()
  const [method, setMethod] = useState<SppMethod>('tunai')
  const [paidAt, setPaidAt] = useState<Dayjs>(dayjs())
  const [note, setNote] = useState('')

  useEffect(() => {
    if (open) {
      setStudentId(presetStudentId)
      setObligationId(undefined)
      setAmount(undefined)
      setMethod('tunai')
      setPaidAt(dayjs())
      setNote('')
    }
  }, [open, presetStudentId])

  const unpaid = useMemo(
    () =>
      obligations
        .filter((o) => o.student_id === studentId && outstandingOf({ amount: o.amount, paid: o.paid ?? 0 }) > 0)
        .map((o) => ({ ...o, sisa: outstandingOf({ amount: o.amount, paid: o.paid ?? 0 }) })),
    [obligations, studentId],
  )

  const selected = unpaid.find((o) => o.id === obligationId)

  const handleOk = async () => {
    if (!obligationId || !amount || amount <= 0) {
      message.warning('Pilih kewajiban dan isi nominal pembayaran')
      return
    }
    const values: PaymentFormValues = {
      obligation_id: obligationId,
      amount,
      method,
      paid_at: paidAt.format('YYYY-MM-DD'),
      note,
    }
    try {
      await createPayment.mutateAsync({ values, createdBy: profile?.id ?? null })
      message.success('Pembayaran dicatat')
      onClose()
    } catch (err) {
      message.error((err as Error).message)
    }
  }

  return (
    <AppModal
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      okText="Catat Pembayaran"
      okButtonProps={{ loading: createPayment.isPending }}
      title="Catat Pembayaran SPP"
      subtitle="Pilih santri, lalu kewajiban yang belum lunas"
      width={560}
      destroyOnHidden
      maskClosable={false}
    >
      <Form layout="vertical" requiredMark={false}>
        <Form.Item label="Santri" required>
          <StudentSelect
            value={studentId}
            onChange={(v) => {
              setStudentId(v)
              setObligationId(undefined)
              setAmount(undefined)
            }}
            initialOptions={
              presetStudentId && presetStudentName ? [{ value: presetStudentId, label: presetStudentName }] : undefined
            }
          />
        </Form.Item>

        <Form.Item label="Kewajiban (belum lunas)" required>
          <Select
            showSearch
            placeholder={studentId ? 'Pilih kewajiban' : 'Pilih santri dulu'}
            disabled={!studentId}
            value={obligationId}
            onChange={(v) => {
              setObligationId(v)
              const o = unpaid.find((x) => x.id === v)
              setAmount(o?.sisa)
            }}
            options={unpaid.map((o) => ({
              value: o.id,
              label: `${o.component?.name ?? 'Komponen'}${o.period ? ` · ${o.period}` : ''} · sisa ${formatRupiah(o.sisa)}`,
            }))}
            filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
            notFoundContent={studentId ? 'Semua kewajiban santri ini sudah lunas' : '—'}
          />
        </Form.Item>

        {selected && (
          <Typography.Paragraph type="secondary" style={{ fontSize: 12.5, marginTop: -8 }}>
            Nominal kewajiban {formatRupiah(selected.amount)} · terbayar {formatRupiah(selected.paid ?? 0)} · sisa{' '}
            <b style={{ color: token.colorWarning }}>{formatRupiah(selected.sisa)}</b>
          </Typography.Paragraph>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          <Form.Item label="Nominal (Rp)" required style={{ width: 180, marginBottom: 16 }}>
            <InputNumber<number>
              min={1}
              step={10000}
              style={{ width: '100%' }}
              value={amount}
              onChange={(v) => setAmount(v ?? undefined)}
              formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
              parser={(v) => Number((v ?? '').replace(/[^\d]/g, ''))}
            />
          </Form.Item>
          <Form.Item label="Metode" style={{ width: 220, marginBottom: 16 }}>
            <Radio.Group
              optionType="button"
              buttonStyle="solid"
              value={method}
              onChange={(e) => setMethod(e.target.value as SppMethod)}
              options={(Object.keys(METHOD_LABEL) as SppMethod[]).map((k) => ({ value: k, label: METHOD_LABEL[k] }))}
            />
          </Form.Item>
          <Form.Item label="Tanggal" style={{ width: 150, marginBottom: 16 }}>
            <DatePicker style={{ width: '100%' }} value={paidAt} onChange={(v) => v && setPaidAt(v)} allowClear={false} />
          </Form.Item>
        </div>

        <Form.Item label="Catatan (opsional)">
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={150} placeholder="mis. cicilan ke-2" />
        </Form.Item>
      </Form>
    </AppModal>
  )
}
