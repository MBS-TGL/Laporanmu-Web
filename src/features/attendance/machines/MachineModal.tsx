import { useEffect } from 'react'
import { Button, Form, Input, Switch } from 'antd'
import { AuditOutlined, ReloadOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { generateRandomApiKey } from './api'
import type { AttendanceMachine, MachineFormValues } from './types'
import { useCreateMachine, useUpdateMachine } from './hooks'

interface MachineModalProps {
  open: boolean
  editing: AttendanceMachine | null
  onClose: () => void
}

export function MachineModal({ open, editing, onClose }: MachineModalProps) {
  const [form] = Form.useForm<MachineFormValues>()
  const createMutation = useCreateMachine()
  const updateMutation = useUpdateMachine()

  useEffect(() => {
    if (open) {
      if (editing) {
        form.setFieldsValue({
          name: editing.name,
          serial_no: editing.serial_no,
          location: editing.location ?? undefined,
          api_key: editing.api_key,
          is_active: editing.is_active,
        })
      } else {
        form.resetFields()
        form.setFieldsValue({
          api_key: generateRandomApiKey(),
          is_active: true,
        })
      }
    }
  }, [open, editing, form])

  const handleGenerateKey = () => {
    form.setFieldsValue({ api_key: generateRandomApiKey() })
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      if (editing) {
        updateMutation.mutate(
          { id: editing.id, values },
          { onSuccess: onClose },
        )
      } else {
        createMutation.mutate(values, { onSuccess: onClose })
      }
    } catch {
      // validation error
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <AppModal
      open={open}
      title={editing ? 'Edit Mesin Presensi' : 'Tambah Mesin Presensi'}
      subtitle={editing ? 'Perbarui data mesin finger' : 'Daftarkan mesin finger baru'}
      icon={<AuditOutlined />}
      onCancel={onClose}
      onOk={handleSave}
      okText="Simpan"
      confirmLoading={isSaving}
      destroyOnHidden
      size="sm"
    >
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        <Form.Item
          name="name"
          label="Nama Mesin"
          rules={[{ required: true, message: 'Wajib diisi (contoh: Mesin Lobby Putra)' }]}
        >
          <Input placeholder="Contoh: Mesin Fingerprint Gerbang Utama" />
        </Form.Item>

        <Form.Item
          name="serial_no"
          label="Serial Number (SN)"
          rules={[{ required: true, message: 'Nomor seri fisik mesin' }]}
        >
          <Input placeholder="Contoh: ZKT-987234X" disabled={!!editing} />
        </Form.Item>

        <Form.Item name="location" label="Lokasi Penempatan">
          <Input placeholder="Contoh: Depan Kantor TU / Asrama Putra" />
        </Form.Item>

        <Form.Item
          name="api_key"
          label="API Key (Token Push Mesin)"
          rules={[{ required: true, message: 'Wajib ada token otentikasi' }]}
          extra="Mesin / middleware men-POST scan menggunakan token ini."
        >
          <Input
            addonAfter={
              <Button
                type="text"
                size="small"
                icon={<ReloadOutlined />}
                onClick={handleGenerateKey}
              >
                Acak
              </Button>
            }
          />
        </Form.Item>

        <Form.Item name="is_active" label="Status Aktif" valuePropName="checked">
          <Switch checkedChildren="Aktif" unCheckedChildren="Nonaktif" />
        </Form.Item>
      </Form>
    </AppModal>
  )
}
