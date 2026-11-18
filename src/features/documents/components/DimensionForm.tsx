import { useEffect } from 'react'
import { Form, Input, InputNumber } from 'antd'
import { AppstoreOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import type { CocurricularDim } from '../api'

interface DimensionFormProps {
  open: boolean
  dimension: CocurricularDim | null
  submitting: boolean
  onCancel: () => void
  onSubmit: (values: { name: string; sort_order: number }) => void
}

/** Form tambah / edit Dimensi Kokurikuler. */
export function DimensionForm({
  open,
  dimension,
  submitting,
  onCancel,
  onSubmit,
}: DimensionFormProps) {
  const [form] = Form.useForm<{ name: string; sort_order: number }>()

  useEffect(() => {
    if (!open) return
    if (dimension) {
      form.setFieldsValue({
        name: dimension.name,
        sort_order: dimension.sort_order ?? 0,
      })
    } else {
      form.resetFields()
    }
  }, [open, dimension, form])

  return (
    <AppModal
      title={dimension ? 'Edit Dimensi Kokurikuler' : 'Tambah Dimensi Kokurikuler'}
      subtitle={
        dimension
          ? 'Perbarui nama atau urutan dimensi kokurikuler'
          : 'Dimensi penilaian kokurikuler yang dinilai per semester'
      }
      icon={<AppstoreOutlined />}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      width={480}
      destroyOnHidden
    >
      <Form<{ name: string; sort_order: number }>
        form={form}
        layout="vertical"
        onFinish={onSubmit}
        disabled={submitting}
        initialValues={{ sort_order: 0 }}
      >
        <Form.Item
          name="name"
          label="Nama Dimensi"
          rules={[{ required: true, message: 'Nama dimensi wajib diisi' }]}
        >
          <Input
            placeholder="Contoh: Beriman, Bertakwa, dan Berakhlak Mulia"
            maxLength={100}
            autoFocus
          />
        </Form.Item>

        <Form.Item
          name="sort_order"
          label="Urutan Tampil"
          tooltip="Urutan tampil di rapor (0 = paling atas)"
        >
          <InputNumber
            style={{ width: '100%' }}
            min={0}
            max={999}
            precision={0}
            placeholder="0"
          />
        </Form.Item>
      </Form>
    </AppModal>
  )
}
