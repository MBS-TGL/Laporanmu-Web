import { useState } from 'react'
import {
  App,
  Button,
  Card,
  Empty,
  Popconfirm,
  Space,
  Table,
  Tooltip,
  type TableColumnsType,
} from 'antd'
import {
  AppstoreOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import { StatChip } from '../../../shared/components/StatChip'
import { useTabActions } from '../../../shared/components/ActionsSlot'
import { ShortcutsModal } from '../../../shared/components/ShortcutsModal'
import { useShortcuts, type ShortcutItem } from '../../../shared/hooks/useShortcuts'
import { usePermissions } from '../../../shared/hooks/useProfile'
import {
  useCocurricularDims,
  useCreateDim,
  useDeleteDim,
  useUpdateDim,
} from '../hooks'
import { DimensionForm } from '../components/DimensionForm'
import type { CocurricularDim } from '../api'

interface DimensionsTabProps {
  /** true saat tab ini aktif — wajib untuk gate portal aksi & shortcut keyboard */
  active: boolean
}

/** Tab "Dimensi Kokurikuler" — master data dimensi penilaian rapor. */
export function DimensionsTab({ active }: DimensionsTabProps) {
  const { message } = App.useApp()
  const { canWrite, canDelete } = usePermissions()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CocurricularDim | null>(null)

  const dimsQuery = useCocurricularDims()
  const createMutation = useCreateDim()
  const updateMutation = useUpdateDim()
  const deleteMutation = useDeleteDim()

  const dims = dimsQuery.data ?? []

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (dim: CocurricularDim) => {
    setEditing(dim)
    setFormOpen(true)
  }

  const handleSubmit = (values: { name: string; sort_order: number }) => {
    const onError = (err: Error) =>
      message.error(err.message || 'Gagal menyimpan dimensi')

    if (editing) {
      updateMutation.mutate(
        { id: editing.id, values },
        {
          onSuccess: () => {
            message.success('Dimensi kokurikuler diperbarui')
            setFormOpen(false)
          },
          onError,
        },
      )
    } else {
      createMutation.mutate(
        { name: values.name, sortOrder: values.sort_order },
        {
          onSuccess: () => {
            message.success('Dimensi kokurikuler ditambahkan')
            setFormOpen(false)
          },
          onError,
        },
      )
    }
  }

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => message.success('Dimensi kokurikuler dihapus'),
      onError: (err: Error) => message.error(err.message || 'Gagal menghapus dimensi'),
    })
  }

  const isBlocked = formOpen || !active

  const shortcutItems: ShortcutItem[] = [
    {
      keys: ['N'],
      label: 'Tambah Dimensi',
      group: 'Aksi',
      icon: <PlusOutlined />,
      run: openCreate,
      when: canWrite,
    },
    {
      keys: ['R'],
      label: 'Muat ulang data',
      group: 'Tampilan',
      icon: <SyncOutlined />,
      run: () => void dimsQuery.refetch(),
    },
    {
      keys: ['?'],
      label: 'Palet shortcut',
      group: 'Bantuan',
      icon: <QuestionCircleOutlined />,
      run: () => shortcuts.toggle(),
    },
  ]

  const shortcuts = useShortcuts({ items: shortcutItems, isBlocked })

  const columns: TableColumnsType<CocurricularDim> = [
    {
      title: 'Urutan',
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 90,
      align: 'center',
      render: (v: number) => <span style={{ fontWeight: 600 }}>{v ?? 0}</span>,
    },
    {
      title: 'Nama Dimensi Kokurikuler',
      dataIndex: 'name',
      key: 'name',
      render: (v: string) => <span style={{ fontWeight: 500 }}>{v}</span>,
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 110,
      render: (_, row) =>
        canWrite || canDelete ? (
          <Space size="small">
            {canWrite && (
              <Tooltip title="Edit">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => openEdit(row)}
                />
              </Tooltip>
            )}
            {canDelete && (
              <Popconfirm
                title="Hapus dimensi ini?"
                description="Nilai kokurikuler yang sudah terinput sebelumnya tidak otomatis hilang."
                onConfirm={() => handleDelete(row.id)}
                okText="Hapus"
                cancelText="Batal"
              >
                <Tooltip title="Hapus">
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    loading={deleteMutation.isPending && deleteMutation.variables === row.id}
                  />
                </Tooltip>
              </Popconfirm>
            )}
          </Space>
        ) : (
          <span style={{ color: '#bbb' }}>—</span>
        ),
    },
  ]

  const tabActions = useTabActions(
    active,
    <Space wrap>
      <Tooltip title="Muat ulang (R)">
        <Button
          icon={<SyncOutlined spin={dimsQuery.isFetching} />}
          onClick={() => void dimsQuery.refetch()}
        />
      </Tooltip>
      <Tooltip title="Palet shortcut (?)">
        <Button icon={<QuestionCircleOutlined />} onClick={shortcuts.open} />
      </Tooltip>
      {canWrite && (
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Tambah Dimensi
        </Button>
      )}
    </Space>,
  )

  return (
    <div>
      {tabActions}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <StatChip
          icon={<AppstoreOutlined />}
          label="Total Dimensi"
          value={dims.length}
          color="indigo"
          loading={dimsQuery.isPending}
        />
      </div>

      <Card>
        <Table<CocurricularDim>
          rowKey="id"
          columns={columns}
          dataSource={dims}
          loading={dimsQuery.isPending}
          pagination={false}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Belum ada dimensi kokurikuler — tambahkan dimensi pertama"
              />
            ),
          }}
          scroll={{ x: true }}
        />
      </Card>

      <DimensionForm
        open={formOpen}
        dimension={editing}
        submitting={createMutation.isPending || updateMutation.isPending}
        onCancel={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />

      <ShortcutsModal open={shortcuts.isOpen} onClose={shortcuts.close} sections={shortcuts.sections} />
    </div>
  )
}
