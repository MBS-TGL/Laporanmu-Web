import { useState } from 'react'
import { Form, Input, Radio, Select, message } from 'antd'
import { NotificationOutlined, SendOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { useSendPushNotification, type PushSubscriptionRow, type SendPushResult } from '../portal'

interface SendPushModalProps {
  open: boolean
  onClose: () => void
  subscriptions: PushSubscriptionRow[]
}

interface FormValues {
  title: string
  body: string
  kind: 'announcement' | 'spp' | 'report' | 'general'
  url?: string
  target: 'all' | 'specific'
  studentIds?: string[]
}

export function SendPushModal({ open, onClose, subscriptions }: SendPushModalProps) {
  const [form] = Form.useForm<FormValues>()
  const sendMutation = useSendPushNotification()
  const [targetType, setTargetType] = useState<'all' | 'specific'>('all')

  // Opsi santri unik yang memiliki langganan push aktif
  const studentOptions = Array.from(
    new Map(
      subscriptions
        .filter((s) => s.student_id && s.student_name)
        .map((s) => [s.student_id, { label: s.student_name, value: s.student_id }]),
    ).values(),
  )

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      const studentIds = values.target === 'specific' ? values.studentIds : undefined

      sendMutation.mutate(
        {
          title: values.title.trim(),
          body: values.body.trim(),
          kind: values.kind,
          url: values.url?.trim() || '/portal',
          studentIds,
        },
        {
          onSuccess: (res: SendPushResult) => {
            if (res.ok) {
              message.success(`Notifikasi terkirim ke ${res.sent ?? 0} perangkat santri`)
              form.resetFields()
              setTargetType('all')
              onClose()
            } else {
              message.error(res.reason || 'Gagal mengirim push notifikasi')
            }
          },
          onError: (err: Error) => {
            message.error(err.message || 'Gagal memanggil layanan push')
          },
        },
      )
    } catch {
      // validasi form gagal
    }
  }

  const handleCancel = () => {
    form.resetFields()
    setTargetType('all')
    onClose()
  }

  return (
    <AppModal
      open={open}
      title="Kirim Notifikasi Push Portal"
      subtitle="Kirimkan pemberitahuan ke perangkat santri yang berlangganan"
      icon={<NotificationOutlined />}
      onCancel={handleCancel}
      onOk={handleSubmit}
      okText="Kirim Sekarang"
      okButtonProps={{ icon: <SendOutlined />, loading: sendMutation.isPending }}
      cancelButtonProps={{ disabled: sendMutation.isPending }}
      size="md"
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          kind: 'general',
          target: 'all',
          url: '/portal',
        }}
      >
        <Form.Item
          name="title"
          label="Judul Notifikasi"
          rules={[{ required: true, message: 'Judul wajib diisi' }]}
        >
          <Input placeholder="Contoh: Pengumuman Ujian Semester" maxLength={80} showCount />
        </Form.Item>

        <Form.Item
          name="body"
          label="Isi Pesan Singkat"
          rules={[{ required: true, message: 'Isi pesan wajib diisi' }]}
        >
          <Input.TextArea
            rows={3}
            placeholder="Tulis pesan yang akan muncul di notifikasi layar perangkat (maks 140 karakter)..."
            maxLength={140}
            showCount
          />
        </Form.Item>

        <Form.Item name="kind" label="Kategori Notifikasi">
          <Select
            options={[
              { label: 'Umum (General)', value: 'general' },
              { label: 'Pengumuman (Announcement)', value: 'announcement' },
              { label: 'Keuangan / SPP', value: 'spp' },
              { label: 'Rapor / Akademik', value: 'report' },
            ]}
          />
        </Form.Item>

        <Form.Item name="target" label="Target Penerima">
          <Radio.Group onChange={(e) => setTargetType(e.target.value)}>
            <Radio value="all">Semua Perangkat Aktif ({subscriptions.length})</Radio>
            <Radio value="specific">Santri Tertentu</Radio>
          </Radio.Group>
        </Form.Item>

        {targetType === 'specific' && (
          <Form.Item
            name="studentIds"
            label="Pilih Santri"
            rules={[{ required: true, message: 'Pilih minimal satu santri' }]}
          >
            <Select
              mode="multiple"
              placeholder="Pilih santri yang terdaftar push"
              options={studentOptions}
              allowClear
              maxTagCount="responsive"
            />
          </Form.Item>
        )}

        <Form.Item
          name="url"
          label="Tujuan Saat Diklik"
          tooltip="Halaman yang terbuka saat notifikasi disentuh"
        >
          <Input placeholder="/portal" />
        </Form.Item>
      </Form>
    </AppModal>
  )
}
