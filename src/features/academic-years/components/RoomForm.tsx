import { useEffect } from 'react'
import { Form, Input, InputNumber, Switch } from 'antd'
import { ApartmentOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import type { Room, RoomFormValues } from '../types'

interface RoomFormProps {
  open: boolean
  room: Room | null
  submitting: boolean
  onCancel: () => void
  onSubmit: (values: RoomFormValues) => void
}

export function RoomForm({ open, room, submitting, onCancel, onSubmit }: RoomFormProps) {
  const [form] = Form.useForm<RoomFormValues>()

  useEffect(() => {
    if (!open) return
    if (room) {
      form.setFieldsValue({
        name: room.name,
        code: room.code ?? undefined,
        capacity: room.capacity ?? undefined,
        notes: room.notes ?? undefined,
        is_active: room.is_active,
      })
    } else {
      form.resetFields()
    }
  }, [open, room, form])

  return (
    <AppModal
      title={room ? 'Edit Ruang' : 'Tambah Ruang'}
      subtitle={room ? 'Perbarui data ruangan' : 'Ruang KBM: kelas, lab, aula, masjid, dll.'}
      icon={<ApartmentOutlined />}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      size="sm"
      destroyOnHidden
    >
      <Form<RoomFormValues>
        form={form}
        layout="vertical"
        onFinish={onSubmit}
        disabled={submitting}
        initialValues={{ is_active: true }}
      >
        <Form.Item
          name="name"
          label="Nama Ruang"
          rules={[{ required: true, message: 'Nama ruang wajib diisi' }]}
        >
          <Input placeholder="Contoh: Lab IPA / Aula / Masjid" maxLength={60} />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
          <Form.Item name="code" label="Kode">
            <Input placeholder="Contoh: LAB-01" maxLength={30} />
          </Form.Item>
          <Form.Item name="capacity" label="Kapasitas">
            <InputNumber style={{ width: '100%' }} min={1} max={999} precision={0} placeholder="Jumlah orang" />
          </Form.Item>
        </div>

        <Form.Item name="notes" label="Keterangan">
          <Input.TextArea rows={2} placeholder="Keterangan singkat (opsional)" maxLength={300} />
        </Form.Item>

        <Form.Item name="is_active" label="Status" valuePropName="checked">
          <Switch checkedChildren="Aktif" unCheckedChildren="Nonaktif" />
        </Form.Item>
      </Form>
    </AppModal>
  )
}
