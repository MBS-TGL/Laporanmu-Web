import { useEffect } from 'react'
import { AutoComplete, DatePicker, Form, Input, InputNumber, Select } from 'antd'
import { InboxOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { AppModal } from '../../../shared/components/AppModal'
import { itemCodeExists } from '../api'
import type { InventoryItem, ItemCondition, ItemFormValues } from '../types'

export const CONDITION_OPTIONS: { value: ItemCondition; label: string }[] = [
  { value: 'good', label: 'Baik' },
  { value: 'light_damaged', label: 'Rusak Ringan' },
  { value: 'heavy_damaged', label: 'Rusak Berat' },
  { value: 'lost', label: 'Hilang' },
]

const PRESET_CATEGORIES = ['Elektronik', 'Furniture', 'Alat Belajar', 'Olahraga', 'Sanitasi', 'Lainnya']

interface ItemFormShape {
  name: string
  code?: string
  category?: string
  quantity: number
  unit?: string
  condition: ItemCondition
  location?: string
  min_quantity: number
  acquired_at?: Dayjs
  price?: number
  source?: string
  notes?: string
}

interface ItemFormProps {
  open: boolean
  item: InventoryItem | null
  submitting: boolean
  onCancel: () => void
  onSubmit: (values: ItemFormValues) => void
}

export function ItemForm({ open, item, submitting, onCancel, onSubmit }: ItemFormProps) {
  const [form] = Form.useForm<ItemFormShape>()

  useEffect(() => {
    if (!open) return
    if (item) {
      form.setFieldsValue({
        name: item.name,
        code: item.code ?? undefined,
        category: item.category ?? undefined,
        quantity: item.quantity,
        unit: item.unit ?? undefined,
        condition: item.condition,
        location: item.location ?? undefined,
        min_quantity: item.min_quantity,
        acquired_at: item.acquired_at ? dayjs(item.acquired_at) : undefined,
        price: item.price ?? undefined,
        source: item.source ?? undefined,
        notes: item.notes ?? undefined,
      })
    } else {
      form.resetFields()
    }
  }, [open, item, form])

  const handleFinish = (values: ItemFormShape) => {
    onSubmit({
      ...values,
      acquired_at: values.acquired_at?.format('YYYY-MM-DD'),
    })
  }

  return (
    <AppModal
      title={item ? 'Edit Barang' : 'Tambah Barang'}
      subtitle={item ? 'Perbarui data inventaris' : 'Aset dan barang inventaris pondok/sekolah'}
      icon={<InboxOutlined />}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      width={540}
      destroyOnHidden
    >
      <Form<ItemFormShape>
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        disabled={submitting}
        initialValues={{ quantity: 1, condition: 'good', min_quantity: 0 }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0 12px' }}>
          <Form.Item
            name="name"
            label="Nama Barang"
            rules={[{ required: true, message: 'Nama barang wajib diisi' }]}
          >
            <Input placeholder="Contoh: Proyektor Epson" maxLength={120} />
          </Form.Item>
          <Form.Item
            name="code"
            label="Kode"
            rules={[
              {
                validator: async (_, value: string | undefined) => {
                  if (!value?.trim() || value.trim() === item?.code) return
                  if (await itemCodeExists(value.trim())) {
                    throw new Error('Kode barang sudah dipakai')
                  }
                },
              },
            ]}
          >
            <Input placeholder="INV-001" maxLength={30} />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 12px' }}>
          <Form.Item name="category" label="Kategori">
            <AutoComplete
              options={PRESET_CATEGORIES.map((c) => ({ value: c }))}
              filterOption={(input, option) =>
                String(option?.value ?? '').toLowerCase().includes(input.toLowerCase())
              }
              placeholder="Kategori"
            />
          </Form.Item>
          <Form.Item
            name="quantity"
            label="Jumlah"
            rules={[{ required: true, message: 'Jumlah wajib diisi' }]}
          >
            <InputNumber style={{ width: '100%' }} min={0} max={99999} precision={0} />
          </Form.Item>
          <Form.Item name="unit" label="Satuan">
            <Input placeholder="unit / set / pcs" maxLength={20} />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
          <Form.Item name="condition" label="Kondisi">
            <Select options={CONDITION_OPTIONS} />
          </Form.Item>
          <Form.Item name="location" label="Lokasi">
            <Input placeholder="Contoh: Ruang Guru" maxLength={80} />
          </Form.Item>
        </div>

        <Form.Item
          name="min_quantity"
          label="Stok Minimum"
          tooltip="Peringatan muncul saat jumlah menyentuh batas ini"
        >
          <InputNumber style={{ width: '100%' }} min={0} max={9999} precision={0} />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 12px' }}>
          <Form.Item name="acquired_at" label="Tanggal Perolehan">
            <DatePicker format="DD MMM YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="price" label="Nilai (Rp)">
            <InputNumber<number>
              style={{ width: '100%' }}
              min={0}
              step={100000}
              formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
              parser={(v) => Number((v ?? '').replace(/\./g, ''))}
            />
          </Form.Item>
          <Form.Item name="source" label="Sumber">
            <Input placeholder="Bantuan / Pembelian" maxLength={60} />
          </Form.Item>
        </div>

        <Form.Item name="notes" label="Keterangan">
          <Input.TextArea rows={2} placeholder="Keterangan singkat (opsional)" maxLength={300} />
        </Form.Item>
      </Form>
    </AppModal>
  )
}
