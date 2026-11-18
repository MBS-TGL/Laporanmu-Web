import { useMemo, useState } from 'react'
import {
  App,
  Button,
  Card,
  Drawer,
  Empty,
  Input,
  Popconfirm,
  Space,
  Tag,
  Tooltip,
  Typography,
  theme,
} from 'antd'
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  OrderedListOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { usePermissions } from '../../../shared/hooks/useProfile'
import {
  useCreateTp,
  useCurriculumTps,
  useDeleteTp,
  useMoveTp,
  useUpdateTp,
} from '../hooks'
import type { CurriculumCp, CurriculumTp } from '../../documents/api'

const { Text, Paragraph } = Typography

interface TpDrawerProps {
  open: boolean
  cp: CurriculumCp | null
  onClose: () => void
}

/** Drawer kelola Tujuan Pembelajaran (TP) untuk satu Capaian (CP). */
export function TpDrawer({ open, cp, onClose }: TpDrawerProps) {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const { canWrite, canDelete } = usePermissions()

  const tpsQuery = useCurriculumTps()
  const createMutation = useCreateTp()
  const updateMutation = useUpdateTp()
  const deleteMutation = useDeleteTp()
  const moveMutation = useMoveTp()

  const [isAdding, setIsAdding] = useState(false)
  const [newDesc, setNewDesc] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDesc, setEditDesc] = useState('')

  const tps = useMemo(() => {
    if (!cp) return []
    return (tpsQuery.data ?? []).filter((t) => t.cp_id === cp.id)
  }, [tpsQuery.data, cp])

  const handleCreate = () => {
    if (!cp) return
    const text = newDesc.trim()
    if (!text) {
      message.warning('Deskripsi tujuan pembelajaran wajib diisi')
      return
    }
    // Hitung max sort_order + 1 di klien agar urutan stabil
    const maxSort = tps.reduce((max, t) => Math.max(max, t.sort_order ?? 0), 0)
    createMutation.mutate(
      { cpId: cp.id, description: text, sortOrder: maxSort + 1 },
      {
        onSuccess: () => {
          message.success('Tujuan pembelajaran ditambahkan')
          setNewDesc('')
          setIsAdding(false)
        },
        onError: (err: Error) => message.error(err.message || 'Gagal menambahkan TP'),
      },
    )
  }

  const handleStartEdit = (item: CurriculumTp) => {
    setEditingId(item.id)
    setEditDesc(item.description)
  }

  const handleSaveEdit = (id: string) => {
    const text = editDesc.trim()
    if (!text) {
      message.warning('Deskripsi tujuan pembelajaran wajib diisi')
      return
    }
    updateMutation.mutate(
      { id, description: text },
      {
        onSuccess: () => {
          message.success('Tujuan pembelajaran diperbarui')
          setEditingId(null)
          setEditDesc('')
        },
        onError: (err: Error) => message.error(err.message || 'Gagal memperbarui TP'),
      },
    )
  }

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => message.success('Tujuan pembelajaran dihapus'),
      onError: (err: Error) => message.error(err.message || 'Gagal menghapus TP'),
    })
  }

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <OrderedListOutlined style={{ color: token.colorPrimary, fontSize: 18 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Tujuan Pembelajaran</div>
            {cp && (
              <div style={{ fontSize: 12, color: token.colorTextSecondary }}>
                {cp.subject} · <Tag color="purple" style={{ marginInline: 0, fontSize: 11 }}>Fase {cp.phase}</Tag>
              </div>
            )}
          </div>
        </div>
      }
      placement="right"
      width="min(640px, 92vw)"
      open={open}
      onClose={onClose}
      destroyOnHidden
    >
      {cp && (
        <Card
          size="small"
          style={{
            marginBottom: 16,
            background: token.colorFillAlter,
            borderColor: token.colorBorderSecondary,
          }}
        >
          <Text type="secondary" style={{ fontSize: 12, fontWeight: 500, textTransform: 'uppercase' }}>
            Rumusan Capaian (CP)
          </Text>
          <Paragraph
            style={{
              marginBottom: 0,
              marginTop: 4,
              fontSize: 13,
              lineHeight: 1.5,
              color: token.colorText,
            }}
          >
            {cp.description}
          </Paragraph>
        </Card>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text strong style={{ fontSize: 14 }}>
          Daftar TP ({tps.length})
        </Text>
        {canWrite && !isAdding && (
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => setIsAdding(true)}
          >
            Tambah TP
          </Button>
        )}
      </div>

      {isAdding && (
        <Card
          size="small"
          style={{
            marginBottom: 16,
            borderColor: token.colorPrimaryBorder,
            background: token.colorPrimaryBg,
          }}
        >
          <Input.TextArea
            rows={3}
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Tuliskan rumusan tujuan pembelajaran (kompetensi terukur yang harus dicapai santri)"
            maxLength={400}
            autoFocus
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <Button size="small" onClick={() => { setIsAdding(false); setNewDesc('') }}>
              Batal
            </Button>
            <Button
              type="primary"
              size="small"
              loading={createMutation.isPending}
              onClick={handleCreate}
            >
              Simpan
            </Button>
          </div>
        </Card>
      )}

      {tps.length === 0 && !isAdding ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Belum ada tujuan pembelajaran untuk CP ini"
        >
          {canWrite && (
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setIsAdding(true)}>
              Tambah TP Pertama
            </Button>
          )}
        </Empty>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tps.map((item, index) => {
            const isEditing = editingId === item.id

            if (isEditing) {
              return (
                <Card key={item.id} size="small" style={{ borderColor: token.colorPrimaryBorder }}>
                  <Input.TextArea
                    rows={3}
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    maxLength={400}
                    autoFocus
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                    <Button
                      size="small"
                      icon={<CloseOutlined />}
                      onClick={() => { setEditingId(null); setEditDesc('') }}
                    >
                      Batal
                    </Button>
                    <Button
                      type="primary"
                      size="small"
                      icon={<CheckOutlined />}
                      loading={updateMutation.isPending}
                      onClick={() => handleSaveEdit(item.id)}
                    >
                      Simpan
                    </Button>
                  </div>
                </Card>
              )
            }

            return (
              <Card
                key={item.id}
                size="small"
                style={{
                  transition: 'border-color 0.2s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      background: token.colorFillSecondary,
                      color: token.colorTextSecondary,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 600,
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    {index + 1}
                  </span>
                  <div style={{ flex: '1 1 auto', minWidth: 0, fontSize: 13, lineHeight: 1.5 }}>
                    {item.description}
                  </div>
                  {canWrite && tps.length > 1 && (
                    <Space size={0} style={{ flexShrink: 0 }}>
                      <Tooltip title="Naikkan">
                        <Button
                          type="text"
                          size="small"
                          icon={<ArrowUpOutlined />}
                          disabled={index === 0 || moveMutation.isPending}
                          onClick={() => moveMutation.mutate({ id: item.id, dir: 'up' })}
                        />
                      </Tooltip>
                      <Tooltip title="Turunkan">
                        <Button
                          type="text"
                          size="small"
                          icon={<ArrowDownOutlined />}
                          disabled={index === tps.length - 1 || moveMutation.isPending}
                          onClick={() => moveMutation.mutate({ id: item.id, dir: 'down' })}
                        />
                      </Tooltip>
                    </Space>
                  )}
                  {(canWrite || canDelete) && (
                    <Space size={0} style={{ flexShrink: 0 }}>
                      {canWrite && (
                        <Tooltip title="Edit">
                          <Button
                            type="text"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => handleStartEdit(item)}
                          />
                        </Tooltip>
                      )}
                      {canDelete && (
                        <Popconfirm
                          title="Hapus TP ini?"
                          description="Tujuan pembelajaran akan ditandai terhapus."
                          onConfirm={() => handleDelete(item.id)}
                          okText="Hapus"
                          cancelText="Batal"
                        >
                          <Tooltip title="Hapus">
                            <Button
                              type="text"
                              danger
                              size="small"
                              icon={<DeleteOutlined />}
                              loading={deleteMutation.isPending && deleteMutation.variables === item.id}
                            />
                          </Tooltip>
                        </Popconfirm>
                      )}
                    </Space>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </Drawer>
  )
}
