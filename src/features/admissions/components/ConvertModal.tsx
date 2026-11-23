import { useEffect } from 'react'
import { App, Form, Input, Select, Typography } from 'antd'
import { SwapOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { ModalFooter } from '../../../shared/components/ModalFooter'
import { ModalNotice } from '../../../shared/components/ModalNotice'
import { useClassesBrief } from '../../students/hooks'
import { useConvertAdmission } from '../hooks'
import type { Admission } from '../types'

interface ConvertModalProps {
  open: boolean
  onClose: () => void
  admission: Admission | null
  onConverted: () => void
}

interface FormValues {
  classId: string
  registrationCode?: string
}

export function ConvertModal({ open, onClose, admission, onConverted }: ConvertModalProps) {
  const { message } = App.useApp()
  const [form] = Form.useForm<FormValues>()
  const classesQuery = useClassesBrief()
  const convertMutation = useConvertAdmission()

  useEffect(() => {
    if (open) form.resetFields()
  }, [open, form])

  const handleSubmit = () => {
    if (!admission) return
    form
      .validateFields()
      .then((values) => {
        convertMutation.mutate(
          {
            admissionId: admission.id,
            classId: values.classId,
            registrationCode: values.registrationCode,
          },
          {
            onSuccess: () => {
              message.success('Pendaftar dikonversi menjadi santri aktif')
              onConverted()
              onClose()
            },
            onError: (err: Error) => message.error(err.message || 'Gagal mengonversi pendaftar'),
          },
        )
      })
      .catch(() => undefined)
  }

  return (
    <AppModal
      open={open}
      onCancel={onClose}
      size="md"
      title="Konversi Menjadi Santri"
      subtitle={admission ? admission.full_name : undefined}
      icon={<SwapOutlined />}
      footer={
        <ModalFooter
          onCancel={onClose}
          onOk={handleSubmit}
          okText="Konversi"
          okLoading={convertMutation.isPending}
          okDisabled={!admission}
        />
      }
    >
      <ModalNotice tone="info" title="Data pendaftar disalin ke Santri">
        Nama, jenis kelamin, tempat/tanggal lahir, asal sekolah, alamat, dan kontak wali ikut dipindahkan.
        Tahap pendaftar otomatis menjadi Diterima.
      </ModalNotice>

      <Form<FormValues> form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          name="classId"
          label="Kelas Tujuan"
          rules={[{ required: true, message: 'Pilih kelas tujuan' }]}
        >
          <Select
            showSearch
            placeholder="Pilih kelas"
            optionFilterProp="label"
            loading={classesQuery.isLoading}
            options={(classesQuery.data ?? []).map((c) => ({
              value: c.id,
              label: c.grade ? `${c.name} (Kelas ${c.grade})` : c.name,
            }))}
          />
        </Form.Item>

        <Form.Item
          name="registrationCode"
          label="Kode Registrasi (opsional)"
          extra="Kosongkan untuk membuat kode REG-XXXX-XXXX otomatis"
        >
          <Input placeholder="REG-XXXX-XXXX" maxLength={24} />
        </Form.Item>

        {classesQuery.isError && (
          <Typography.Text type="danger" style={{ fontSize: 13 }}>
            Gagal memuat daftar kelas: {(classesQuery.error as Error).message}
          </Typography.Text>
        )}
      </Form>
    </AppModal>
  )
}
