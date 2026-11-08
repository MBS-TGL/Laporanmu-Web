import { useEffect } from 'react'
import { Col, Form, Input, Row, Select, Switch, Typography } from 'antd'
import { NotificationOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { ANNOUNCEMENT_CATEGORIES, type Announcement } from '../types'

export interface AnnouncementFormValues {
  title: string
  body: string
  category: (typeof ANNOUNCEMENT_CATEGORIES)[number]
  is_published: boolean
  is_pinned: boolean
  is_public: boolean
}

interface AnnouncementModalProps {
  open: boolean
  announcement: Announcement | null
  submitting: boolean
  onCancel: () => void
  onSubmit: (values: AnnouncementFormValues) => void
}

export function AnnouncementModal({
  open,
  announcement,
  submitting,
  onCancel,
  onSubmit,
}: AnnouncementModalProps) {
  const [form] = Form.useForm<AnnouncementFormValues>()

  useEffect(() => {
    if (!open) return
    if (announcement) {
      form.setFieldsValue({
        title: announcement.title,
        body: announcement.body,
        category: announcement.category,
        is_published: announcement.is_published,
        is_pinned: announcement.is_pinned,
        is_public: announcement.is_public,
      })
    } else {
      form.resetFields()
    }
  }, [open, announcement, form])

  return (
    <AppModal
      title={announcement ? 'Edit Pengumuman' : 'Tambah Pengumuman'}
      subtitle={
        announcement
          ? 'Perbarui isi pengumuman'
          : 'Pengumuman untuk staf — opsional tampil juga ke wali santri'
      }
      icon={<NotificationOutlined />}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      width={560}
      destroyOnHidden
    >
      <Form<AnnouncementFormValues>
        form={form}
        layout="vertical"
        onFinish={onSubmit}
        disabled={submitting}
        initialValues={{ category: 'Pengumuman', is_published: false, is_pinned: false, is_public: false }}
      >
        <Form.Item
          name="title"
          label="Judul"
          rules={[
            { required: true, message: 'Judul wajib diisi' },
            { max: 200, message: 'Judul maksimal 200 karakter' },
          ]}
        >
          <Input maxLength={200} showCount placeholder="Contoh: Libur Awal Ramadhan" />
        </Form.Item>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="category" label="Kategori">
              <Select
                options={ANNOUNCEMENT_CATEGORIES.map((c) => ({ value: c, label: c }))}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="is_pinned" label="Sematkan" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="body"
          label="Isi"
          rules={[{ required: true, message: 'Isi pengumuman wajib diisi' }]}
        >
          <Input.TextArea rows={8} placeholder="Tulis isi pengumuman di sini…" />
        </Form.Item>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item
              name="is_published"
              label="Terbitkan"
              valuePropName="checked"
              extra="Pengumuman terlihat oleh seluruh staf"
            >
              <Switch />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="is_public"
              label="Tampil di Portal Wali"
              valuePropName="checked"
              extra={
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Juga tampil di halaman publik /cek (wali santri)
                </Typography.Text>
              }
            >
              <Switch />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </AppModal>
  )
}
