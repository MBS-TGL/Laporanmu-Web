import { useEffect } from 'react'
import { Form, Input, InputNumber, Radio, Select } from 'antd'
import { WalletOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { FREQUENCY_LABEL, type ComponentFormValues, type SppComponent, type SppFrequency } from '../types'

interface ComponentModalProps {
  open: boolean
  onClose: () => void
  initial?: SppComponent | null
  onSave: (values: ComponentFormValues, id?: string) => Promise<void>
}

/** Form komponen biaya: nama, nominal rupiah, frekuensi, target tingkat. */
export function ComponentModal({ open, onClose, initial, onSave }: ComponentModalProps) {
  const [form] = Form.useForm<ComponentFormValues>()
  const editing = Boolean(initial)

  useEffect(() => {
    if (!open) return
    if (initial) {
      form.setFieldsValue({
        name: initial.name,
        amount: initial.amount,
        frequency: initial.frequency,
        grade: initial.grade ?? undefined,
      })
    } else {
      form.setFieldsValue({ name: '', amount: undefined, frequency: 'bulanan', grade: undefined })
    }
  }, [open, initial, form])

  const handleOk = async () => {
    const values = await form.validateFields()
    await onSave(values, initial?.id)
  }

  return (
    <AppModal
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      okText={editing ? 'Simpan' : 'Tambah Komponen'}
      title={editing ? 'Ubah Komponen Biaya' : 'Tambah Komponen Biaya'}
      subtitle="Komponen menjadi kewajiban santri saat digenerate"
      icon={<WalletOutlined />}
      width={520}
      destroyOnHidden
      maskClosable={false}
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item name="name" label="Nama komponen" rules={[{ required: true, message: 'Nama wajib diisi' }]}>
          <Input placeholder="Contoh: SPP Bulanan, DSP, Seragam" maxLength={80} />
        </Form.Item>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          <Form.Item
            name="amount"
            label="Nominal (Rp)"
            rules={[{ required: true, message: 'Nominal wajib diisi' }]}
            style={{ width: 180, marginBottom: 16 }}
          >
            <InputNumber<number>
              min={0}
              step={10000}
              style={{ width: '100%' }}
              formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
              parser={(v) => Number((v ?? '').replace(/[^\d]/g, ''))}
              placeholder="150000"
            />
          </Form.Item>
          <Form.Item name="frequency" label="Frekuensi" rules={[{ required: true }]} style={{ width: 160, marginBottom: 16 }}>
            <Radio.Group
              optionType="button"
              buttonStyle="solid"
              options={(Object.keys(FREQUENCY_LABEL) as SppFrequency[]).map((k) => ({ value: k, label: FREQUENCY_LABEL[k] }))}
            />
          </Form.Item>
          <Form.Item name="grade" label="Target tingkat" style={{ width: 150, marginBottom: 16 }} extra="Kosong = semua">
            <Select
              allowClear
              placeholder="Semua"
              options={[
                { value: '7', label: 'Kelas 7' },
                { value: '8', label: 'Kelas 8' },
                { value: '9', label: 'Kelas 9' },
              ]}
            />
          </Form.Item>
        </div>
      </Form>
    </AppModal>
  )
}
