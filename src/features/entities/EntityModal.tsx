import { App, Button, Form, Input, Popconfirm, Select, Space, Switch, Tag, Typography, theme } from 'antd'
import { AppstoreOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { AppModal } from '../../shared/components/AppModal'
import { ModalSection } from '../../shared/components/ModalSection'
import {
  useCreateEntity,
  useDeleteEntity,
  useEntities,
  useUpdateEntity,
  type EntityFormValues,
} from './api'

const TYPE_OPTIONS = [
  { value: 'sekolah', label: 'Sekolah' },
  { value: 'cabang', label: 'Cabang' },
  { value: 'yayasan', label: 'Yayasan' },
]

interface EntityModalProps {
  open: boolean
  onClose: () => void
  /** Entity aktif saat ini — diarsipkan dengan peringatan ekstra */
  currentId: string | null
}

/** Kelola daftar entity (developer/admin) — dibuka dari EntitySwitcher. */
export function EntityModal({ open, onClose, currentId }: EntityModalProps) {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const entitiesQuery = useEntities()
  const createMutation = useCreateEntity()
  const updateMutation = useUpdateEntity()
  const deleteMutation = useDeleteEntity()
  const [form] = Form.useForm<EntityFormValues>()

  const submitCreate = (values: EntityFormValues) => {
    createMutation.mutate(values, {
      onSuccess: () => {
        message.success('Entity dibuat')
        form.resetFields()
      },
      onError: (err: Error) => message.error(err.message || 'Gagal membuat entity'),
    })
  }

  const rows = entitiesQuery.data ?? []

  return (
    <AppModal
      title="Kelola Entity"
      subtitle="Lembaga atau cabang yang datanya dipisah. Baris entity menentukan isolasi data via RLS."
      icon={<AppstoreOutlined />}
      open={open}
      onCancel={onClose}
      footer={null}
      size="md"
      destroyOnHidden
    >
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        {entitiesQuery.isPending ? (
          <Typography.Text type="secondary">Memuat entity…</Typography.Text>
        ) : (
          rows.map((e) => (
            <div
              key={e.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 10,
                border: `1px solid ${e.id === currentId ? token.colorPrimaryBorder : token.colorBorderSecondary}`,
                background: e.id === currentId ? token.colorPrimaryBg : token.colorBgContainer,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <Space size={6} align="center">
                  <Typography.Text strong>{e.name}</Typography.Text>
                  <Tag style={{ borderRadius: 999, marginInlineEnd: 0 }}>{TYPE_OPTIONS.find((t) => t.value === e.type)?.label ?? e.type}</Tag>
                </Space>
                <div style={{ fontSize: 11.5, color: token.colorTextTertiary }}>
                  kode: <code>{e.code}</code>
                </div>
              </div>
              <Switch
                checked={e.is_active}
                checkedChildren="Aktif"
                unCheckedChildren="Nonaktif"
                loading={updateMutation.isPending && updateMutation.variables?.id === e.id}
                onChange={(checked) =>
                  updateMutation.mutate(
                    { id: e.id, values: { is_active: checked } },
                    {
                      onSuccess: () => message.success(checked ? 'Entity diaktifkan' : 'Entity dinonaktifkan'),
                      onError: (err: Error) => message.error(err.message || 'Gagal mengubah entity'),
                    },
                  )
                }
              />
              <Popconfirm
                title="Arsipkan entity ini?"
                description="Data entity tetap ada di database, tapi hilang dari pilihan switcher."
                okText="Ya, Arsipkan"
                cancelText="Batal"
                okButtonProps={{ danger: true, loading: deleteMutation.isPending }}
                onConfirm={() =>
                  deleteMutation.mutate(e.id, {
                    onSuccess: () => message.success('Entity diarsipkan'),
                    onError: (err: Error) =>
                      message.error(err.message || 'Gagal mengarsipkan entity'),
                  })
                }
              >
                <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label={`Arsipkan ${e.name}`} />
              </Popconfirm>
            </div>
          ))
        )}

        <ModalSection
          title="Tambah Entity"
          icon={<PlusOutlined />}
        />
        <Form
          form={form}
          layout="vertical"
          onFinish={submitCreate}
          disabled={createMutation.isPending}
        >
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item
              name="name"
              noStyle
              rules={[{ required: true, message: 'Nama entity wajib diisi' }]}
            >
              <Input placeholder="Nama lembaga, mis. Ponpes Al-Irsyad Cabang 2" />
            </Form.Item>
            <Form.Item
              name="code"
              noStyle
              rules={[{ required: true, message: 'Kode wajib diisi' }]}
            >
              <Input placeholder="kode, mis. cabang-2" style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="type" noStyle initialValue="cabang">
              <Select options={TYPE_OPTIONS} style={{ width: 120 }} />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={createMutation.isPending}>
              Tambah
            </Button>
          </Space.Compact>
        </Form>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Data santri/guru/kelas/tahun ajaran/inventaris/komponen SPP yang dibuat setelah ini otomatis mengikuti
          entity yang sedang dipilih di Topbar.
        </Typography.Text>
      </Space>
    </AppModal>
  )
}
