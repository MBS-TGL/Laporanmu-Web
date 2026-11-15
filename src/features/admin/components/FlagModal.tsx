import { useEffect } from 'react'
import { App, Button, Form, Input, InputNumber, Popconfirm, Select, Switch } from 'antd'
import { AppstoreOutlined, DeleteOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { useDeleteFlag, useSaveFlag, type FeatureFlag } from '../../../shared/hooks/useFeatureFlags'

interface FlagFormValues {
  key: string
  label: string
  category: string
  description: string
  sort_order: number
  enabled: boolean
}

const CATEGORY_OPTIONS = [
  { value: 'system', label: 'Sistem' },
  { value: 'module', label: 'Modul' },
]

// Modal buat/edit feature flag. Key dikunci saat edit (identitas konsumen
// useFlag); hapus hanya tersedia pada mode edit dengan konfirmasi eksplisit.
export function FlagModal({
  open,
  flag,
  onClose,
}: {
  open: boolean
  flag: FeatureFlag | null
  onClose: () => void
}) {
  const [form] = Form.useForm<FlagFormValues>()
  const { message } = App.useApp()
  const saveMutation = useSaveFlag()
  const deleteMutation = useDeleteFlag()
  const editing = flag !== null

  useEffect(() => {
    if (!open) return
    if (flag) {
      form.setFieldsValue({
        key: flag.key,
        label: flag.label,
        category: flag.category,
        description: flag.description ?? '',
        sort_order: flag.sort_order,
        enabled: flag.enabled,
      })
    } else {
      form.setFieldsValue({
        key: '',
        label: '',
        category: 'module',
        description: '',
        sort_order: 100,
        enabled: true,
      })
    }
  }, [open, flag, form])

  const submit = async () => {
    const values = await form.validateFields()
    saveMutation.mutate(
      {
        id: flag?.id,
        key: values.key.trim(),
        label: values.label.trim(),
        category: values.category,
        description: values.description.trim() || null,
        sort_order: values.sort_order ?? 0,
        enabled: values.enabled,
      },
      {
        onSuccess: () => {
          message.success(editing ? `Flag "${values.label}" diperbarui` : `Flag "${values.label}" dibuat`)
          onClose()
        },
        onError: (err: Error) => message.error(err.message || 'Gagal menyimpan flag'),
      },
    )
  }

  const handleDelete = () => {
    if (!flag) return
    deleteMutation.mutate(
      { id: flag.id, key: flag.key },
      {
        onSuccess: () => {
          message.success(`Flag "${flag.label}" dihapus`)
          onClose()
        },
        onError: (err: Error) => message.error(err.message || 'Gagal menghapus flag'),
      },
    )
  }

  return (
    <AppModal
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText="Simpan"
      okButtonProps={{ loading: saveMutation.isPending }}
      title={editing ? 'Edit Feature Flag' : 'Tambah Feature Flag'}
      subtitle="Flag baru langsung dipakai konsumen useFlag: flag yang belum di-seed berperilaku fail-open (dianggap aktif)"
      icon={<AppstoreOutlined />}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
        <Form.Item
          name="key"
          label="Key"
          rules={[
            { required: true, message: 'Key wajib diisi' },
            { pattern: /^[a-z0-9_.]+$/, message: 'Hanya huruf kecil, angka, titik, dan underscore' },
          ]}
          extra={editing ? 'Key tidak bisa diubah, konsumen memakai key ini.' : 'Pola umum: module.nama atau system.nama'}
        >
          <Input disabled={editing} placeholder="module.nama_modul" maxLength={80} />
        </Form.Item>
        <Form.Item name="label" label="Label" rules={[{ required: true, message: 'Label wajib diisi' }]}>
          <Input placeholder="Modul Contoh" maxLength={80} />
        </Form.Item>
        <Form.Item name="category" label="Kategori" rules={[{ required: true }]}>
          <Select options={CATEGORY_OPTIONS} />
        </Form.Item>
        <Form.Item name="description" label="Deskripsi">
          <Input.TextArea rows={2} maxLength={300} placeholder="Untuk apa flag ini dipakai" />
        </Form.Item>
        <Form.Item name="sort_order" label="Urutan tampil" hidden={false}>
          <InputNumber min={0} max={9999} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="enabled" label="Status awal" valuePropName="checked">
          <Switch checkedChildren="AKTIF" unCheckedChildren="MATI" />
        </Form.Item>
        {editing && (
          <Popconfirm
            title="Hapus flag ini?"
            description="Konsumen useFlag akan kembali ke fallback (fail-open). Tindakan tercatat di audit log."
            okText="Hapus"
            okButtonProps={{ danger: true }}
            cancelText="Batal"
            onConfirm={handleDelete}
          >
            <Button danger icon={<DeleteOutlined />} loading={deleteMutation.isPending}>
              Hapus Flag
            </Button>
          </Popconfirm>
        )}
      </Form>
    </AppModal>
  )
}
