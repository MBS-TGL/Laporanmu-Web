import { useEffect, useMemo } from 'react'
import { Alert, DatePicker, Form, Input, Select } from 'antd'
import { ExportOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { AppModal } from '../../../shared/components/AppModal'
import { StudentSelect } from '../../../shared/components/StudentSelect'
import { useBooks, useLoans } from '../hooks'
import type { LoanFormValues } from '../types'

interface LoanFormShape {
  book_id: string
  student_id: string
  borrowed_at: Dayjs
  due_date?: Dayjs | null
  notes?: string
}

interface LoanModalProps {
  open: boolean
  submitting: boolean
  onCancel: () => void
  onSubmit: (values: LoanFormValues) => void
}

export function LoanModal({ open, submitting, onCancel, onSubmit }: LoanModalProps) {
  const [form] = Form.useForm<LoanFormShape>()
  const booksQuery = useBooks()
  const loansQuery = useLoans()

  // Ketersediaan per buku = eksemplar − sedang dipinjam
  const availability = useMemo(() => {
    const active = new Map<string, number>()
    for (const loan of loansQuery.data ?? []) {
      if (!loan.returned_at) active.set(loan.book_id, (active.get(loan.book_id) ?? 0) + 1)
    }
    const map = new Map<string, number>()
    for (const book of booksQuery.data ?? []) {
      map.set(book.id, book.copies - (active.get(book.id) ?? 0))
    }
    return map
  }, [booksQuery.data, loansQuery.data])

  useEffect(() => {
    if (!open) return
    form.resetFields()
    form.setFieldsValue({ borrowed_at: dayjs(), due_date: dayjs().add(7, 'day') })
  }, [open, form])

  const handleFinish = (values: LoanFormShape) => {
    onSubmit({
      book_id: values.book_id,
      student_id: values.student_id,
      borrowed_at: values.borrowed_at.format('YYYY-MM-DD'),
      due_date: values.due_date?.format('YYYY-MM-DD'),
      notes: values.notes,
    })
  }

  const selectedBookId = Form.useWatch('book_id', form)
  const selectedAvailability = selectedBookId ? availability.get(selectedBookId) : undefined

  return (
    <AppModal
      title="Pinjamkan Buku"
      subtitle="Catat peminjaman buku oleh santri"
      icon={<ExportOutlined />}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      width={500}
      destroyOnHidden
    >
      <Form<LoanFormShape> form={form} layout="vertical" onFinish={handleFinish} disabled={submitting}>
        <Form.Item
          name="book_id"
          label="Buku"
          rules={[{ required: true, message: 'Buku wajib dipilih' }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Pilih buku"
            loading={booksQuery.isPending}
            options={(booksQuery.data ?? []).map((b) => {
              const available = availability.get(b.id) ?? b.copies
              return {
                value: b.id,
                label: `${b.title}${b.code ? ` (${b.code})` : ''} — ${available > 0 ? `${available} tersedia` : 'habis'}`,
                disabled: available <= 0,
              }
            })}
          />
        </Form.Item>

        {selectedAvailability !== undefined && selectedAvailability <= 0 && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message="Semua eksemplar buku ini sedang dipinjam"
          />
        )}

        <Form.Item
          name="student_id"
          label="Peminjam"
          rules={[{ required: true, message: 'Santri wajib dipilih' }]}
        >
          <StudentSelect />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
          <Form.Item
            name="borrowed_at"
            label="Tanggal Pinjam"
            rules={[{ required: true, message: 'Tanggal pinjam wajib diisi' }]}
          >
            <DatePicker format="DD MMM YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="due_date" label="Batas Kembali">
            <DatePicker format="DD MMM YYYY" style={{ width: '100%' }} />
          </Form.Item>
        </div>

        <Form.Item name="notes" label="Keterangan">
          <Input.TextArea rows={2} placeholder="Kondisi buku, catatan lain (opsional)" maxLength={200} />
        </Form.Item>
      </Form>
    </AppModal>
  )
}
