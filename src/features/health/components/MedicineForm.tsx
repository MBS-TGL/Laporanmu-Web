import { useEffect } from 'react'
import { Form, Input, InputNumber, Select } from 'antd'
import { MedicineBoxOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import type { HealthMedicine, HealthMedicineFormValues } from '../types'

const CATEGORY_OPTIONS = [
  'Analgesik / Antipiretik',
  'Antibiotik',
  'Obat Lambung',
  'Obat Flu & Batuk',
  'Antiseptik',
  'Anti-alergi',
  'Multivitamin',
].map((c) => ({ value: c, label: c }))

const UNIT_OPTIONS = [
  { value: 'tablet', label: 'Tablet / Kaplet' },
  { value: 'botol', label: 'Botol / Syrup' },
  { value: 'tube', label: 'Tube / Salep' },
  { value: 'sachet', label: 'Sachet / Puyer' },
]

interface MedicineFormProps {
  open: boolean
  medicine: HealthMedicine | null
  submitting: boolean
  onCancel: () => void
  onSubmit: (values: HealthMedicineFormValues) => void
}

export function MedicineForm({ open, medicine, submitting, onCancel, onSubmit }: MedicineFormProps) {
  const [form] = Form.useForm<HealthMedicineFormValues>()

  useEffect(() => {
    if (!open) return
    if (medicine) {
      form.setFieldsValue({
        name: medicine.name,
        category: medicine.category ?? undefined,
        stock: medicine.stock,
        unit: medicine.unit,
        min_stock: medicine.min_stock,
        description: medicine.description ?? undefined,
      })
    } else {
      form.resetFields()
      form.setFieldsValue({ unit: 'tablet', min_stock: 15, stock: 0 })
    }
  }, [open, medicine, form])

  return (
    <AppModal
      title={medicine ? 'Edit Obat' : 'Tambah Obat'}
      subtitle={medicine ? 'Perbarui data obat' : 'Data stok obat pos kesehatan'}
      icon={<MedicineBoxOutlined />}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      width={520}
      destroyOnHidden
    >
      <Form<HealthMedicineFormValues> form={form} layout="vertical" onFinish={onSubmit} disabled={submitting}>
        <Form.Item
          name="name"
          label="Nama Obat / Merek"
          rules={[{ required: true, message: 'Nama obat wajib diisi' }]}
        >
          <Input placeholder="Contoh: Paracetamol 500mg" maxLength={100} />
        </Form.Item>

        <Form.Item name="category" label="Kategori">
          <Select placeholder="Pilih kategori" allowClear options={CATEGORY_OPTIONS} />
        </Form.Item>

        <Form.Item name="unit" label="Satuan" rules={[{ required: true, message: 'Satuan wajib dipilih' }]}>
          <Select options={UNIT_OPTIONS} />
        </Form.Item>

        <Form.Item name="stock" label="Stok Tersedia" rules={[{ required: true, message: 'Stok wajib diisi' }]}>
          <InputNumber style={{ width: '100%' }} min={0} precision={0} />
        </Form.Item>

        <Form.Item
          name="min_stock"
          label="Stok Minimum (Alert)"
          rules={[{ required: true, message: 'Stok minimum wajib diisi' }]}
        >
          <InputNumber style={{ width: '100%' }} min={0} precision={0} />
        </Form.Item>

        <Form.Item name="description" label="Indikasi / Keterangan">
          <Input.TextArea rows={2} maxLength={300} placeholder="Contoh: Untuk demam & sakit kepala" />
        </Form.Item>
      </Form>
    </AppModal>
  )
}
