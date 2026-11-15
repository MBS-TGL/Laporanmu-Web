import { useEffect } from 'react'
import { Col, Form, Input, InputNumber, Row, Switch, TimePicker } from 'antd'
import { ClockCircleOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { AppModal } from '../../../shared/components/AppModal'
import type { TimeSlot, SlotFormValues } from '../types'

interface SlotFormProps {
  open: boolean
  academicYearName?: string
  slot: TimeSlot | null
  submitting: boolean
  onCancel: () => void
  onSubmit: (values: SlotFormValues) => void
}

interface InternalValues {
  name: string
  start_time: Dayjs
  end_time: Dayjs
  sort_order: number
  is_break: boolean
}

export function SlotForm({ open, academicYearName, slot, submitting, onCancel, onSubmit }: SlotFormProps) {
  const [form] = Form.useForm<InternalValues>()

  useEffect(() => {
    if (!open) return
    if (slot) {
      form.setFieldsValue({
        name: slot.name,
        start_time: dayjs(slot.start_time, 'HH:mm'),
        end_time: dayjs(slot.end_time, 'HH:mm'),
        sort_order: slot.sort_order,
        is_break: slot.is_break,
      })
    } else {
      form.resetFields()
    }
  }, [open, slot, form])

  const handleSubmit = (values: InternalValues) => {
    onSubmit({
      name: values.name.trim(),
      start_time: values.start_time.format('HH:mm'),
      end_time: values.end_time.format('HH:mm'),
      sort_order: values.sort_order ?? 0,
      is_break: values.is_break,
    })
  }

  return (
    <AppModal
      title={slot ? 'Edit Slot Jam' : 'Tambah Slot Jam'}
      subtitle={academicYearName ? `Periode ${academicYearName}` : undefined}
      icon={<ClockCircleOutlined />}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      size="sm"
      destroyOnHidden
    >
      <Form<InternalValues>
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        disabled={submitting}
        initialValues={{ sort_order: 0, is_break: false }}
      >
        <Form.Item
          name="name"
          label="Nama Slot"
          rules={[{ required: true, message: 'Nama slot wajib diisi' }]}
        >
          <Input placeholder="Contoh: Jam Ke-1 / Istirahat / Sholat Dzuhur" maxLength={60} />
        </Form.Item>

        <Row gutter={12}>
          <Col span={8}>
            <Form.Item
              name="start_time"
              label="Mulai"
              rules={[{ required: true, message: 'Jam mulai wajib diisi' }]}
            >
              <TimePicker format="HH:mm" minuteStep={5} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="end_time"
              label="Selesai"
              dependencies={['start_time']}
              rules={[
                { required: true, message: 'Jam selesai wajib diisi' },
                ({ getFieldValue }) => ({
                  validator(_, value: Dayjs | undefined) {
                    const start = getFieldValue('start_time') as Dayjs | undefined
                    if (!value || !start || value.isAfter(start)) return Promise.resolve()
                    return Promise.reject(new Error('Jam selesai harus setelah jam mulai'))
                  },
                }),
              ]}
            >
              <TimePicker format="HH:mm" minuteStep={5} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="sort_order"
              label="Urutan"
              tooltip="Urutan tampil di form jadwal (0 = paling atas)"
            >
              <InputNumber style={{ width: '100%' }} min={0} max={99} precision={0} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="is_break" label="Jenis" valuePropName="checked">
          <Switch checkedChildren="Jam istirahat/non-KBM" unCheckedChildren="Jam KBM" />
        </Form.Item>
      </Form>
    </AppModal>
  )
}
