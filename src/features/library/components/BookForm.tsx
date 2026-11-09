import { useEffect } from 'react'
import { Form, Input, InputNumber } from 'antd'
import { BookOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { bookCodeExists } from '../api'
import type { Book, BookFormValues } from '../types'

interface BookFormProps {
  open: boolean
  book: Book | null
  submitting: boolean
  onCancel: () => void
  onSubmit: (values: BookFormValues) => void
}

export function BookForm({ open, book, submitting, onCancel, onSubmit }: BookFormProps) {
  const [form] = Form.useForm<BookFormValues>()

  useEffect(() => {
    if (!open) return
    if (book) {
      form.setFieldsValue({
        title: book.title,
        code: book.code ?? undefined,
        author: book.author ?? undefined,
        publisher: book.publisher ?? undefined,
        year: book.year ?? undefined,
        category: book.category ?? undefined,
        copies: book.copies,
        shelf: book.shelf ?? undefined,
        description: book.description ?? undefined,
      })
    } else {
      form.resetFields()
    }
  }, [open, book, form])

  return (
    <AppModal
      title={book ? 'Edit Buku' : 'Tambah Buku'}
      subtitle={book ? 'Perbarui data buku' : 'Katalog buku perpustakaan'}
      icon={<BookOutlined />}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      width={520}
      destroyOnHidden
    >
      <Form<BookFormValues>
        form={form}
        layout="vertical"
        onFinish={onSubmit}
        disabled={submitting}
        initialValues={{ copies: 1 }}
      >
        <Form.Item
          name="title"
          label="Judul"
          rules={[{ required: true, message: 'Judul buku wajib diisi' }]}
        >
          <Input placeholder="Contoh: Fiqih Sunnah" maxLength={200} />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
          <Form.Item
            name="code"
            label="Kode Buku"
            rules={[
              {
                validator: async (_, value: string | undefined) => {
                  if (!value?.trim() || value.trim() === book?.code) return
                  if (await bookCodeExists(value.trim())) {
                    throw new Error('Kode buku sudah dipakai')
                  }
                },
              },
            ]}
          >
            <Input placeholder="Contoh: FIQ-001" maxLength={30} />
          </Form.Item>
          <Form.Item name="category" label="Kategori">
            <Input placeholder="Contoh: Fiqih" maxLength={60} />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
          <Form.Item name="author" label="Penulis">
            <Input placeholder="Nama penulis" maxLength={120} />
          </Form.Item>
          <Form.Item name="publisher" label="Penerbit">
            <Input placeholder="Nama penerbit" maxLength={120} />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 12px' }}>
          <Form.Item name="year" label="Tahun">
            <InputNumber style={{ width: '100%' }} min={1900} max={2100} precision={0} />
          </Form.Item>
          <Form.Item
            name="copies"
            label="Jumlah Eksemplar"
            rules={[{ required: true, message: 'Jumlah wajib diisi' }]}
          >
            <InputNumber style={{ width: '100%' }} min={1} max={999} precision={0} />
          </Form.Item>
          <Form.Item name="shelf" label="Rak">
            <Input placeholder="Contoh: A-3" maxLength={30} />
          </Form.Item>
        </div>

        <Form.Item name="description" label="Keterangan">
          <Input.TextArea rows={2} placeholder="Keterangan singkat (opsional)" maxLength={300} />
        </Form.Item>
      </Form>
    </AppModal>
  )
}
