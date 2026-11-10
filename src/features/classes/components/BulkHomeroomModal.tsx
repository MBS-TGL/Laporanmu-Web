import { useEffect } from 'react'
import { Alert, Form, Select } from 'antd'
import { TeamOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { useTeachersBriefForClasses } from '../hooks'

interface BulkHomeroomModalProps {
  open: boolean
  /** Jumlah kelas yang sedang dipilih di halaman */
  count: number
  submitting: boolean
  onCancel: () => void
  onSubmit: (teacherId: string | null) => void
}

/** Aksi massal "Set Wali Kelas" — padanan halaman Wali Kelas Sidikmu (select wali + Simpan Semua).
 *  Kosongkan pilihan lalu simpan = hapus wali dari semua kelas terpilih. */
export function BulkHomeroomModal({ open, count, submitting, onCancel, onSubmit }: BulkHomeroomModalProps) {
  const [form] = Form.useForm<{ homeroom_teacher_id?: string }>()
  const teachersQuery = useTeachersBriefForClasses()

  useEffect(() => {
    if (!open) return
    form.resetFields()
  }, [open, form])

  const handleFinish = (values: { homeroom_teacher_id?: string }) => {
    onSubmit(values.homeroom_teacher_id ?? null)
  }

  return (
    <AppModal
      title="Set Wali Kelas Massal"
      subtitle={`${count} kelas terpilih`}
      icon={<TeamOutlined />}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      width={480}
      destroyOnHidden
    >
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16, borderRadius: 10 }}
        message={`Wali kelas ${count} kelas terpilih akan diganti sekaligus.`}
      />
      <Form form={form} layout="vertical" onFinish={handleFinish} disabled={submitting}>
        <Form.Item name="homeroom_teacher_id" label="Wali Kelas" extra="Kosongkan lalu simpan untuk menghapus wali kelas dari kelas terpilih.">
          <Select
            placeholder="Pilih guru (atau kosongkan untuk menghapus)"
            allowClear
            loading={teachersQuery.isPending}
            showSearch
            optionFilterProp="label"
            options={(teachersQuery.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
          />
        </Form.Item>
      </Form>
    </AppModal>
  )
}
