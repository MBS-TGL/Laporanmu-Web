import { useState } from 'react'
import {
  Button,
  Card,
  Empty,
  Input,
  Popconfirm,
  Progress,
  Skeleton,
  Space,
  Tag,
  Tooltip,
  Typography,
  theme,
} from 'antd'
import {
  DeleteOutlined,
  DownOutlined,
  EditOutlined,
  LeftOutlined,
  PlusOutlined,
  RightOutlined,
  ThunderboltOutlined,
  UpOutlined,
} from '@ant-design/icons'
import type { WorshipItem } from '../types'
import { AppModal } from '../../../shared/components/AppModal'

interface ItemsPanelProps {
  items: WorshipItem[]
  loading: boolean
  canWrite: boolean
  open: boolean
  onToggle: () => void
  /** Jumlah santri di kelas terpilih; undefined = belum pilih kelas (progres disembunyikan). */
  studentCount?: number
  /** item_id -> jumlah santri terampil (kelas terpilih). */
  masteredByItem?: Map<string, number>
  allPresetsExist: boolean
  loadingPresets: boolean
  deleting: boolean
  saving: boolean
  onAdd: () => void
  onLoadPresets: () => void
  onDelete: (id: string) => void
  onRename: (id: string, label: string, done: () => void) => void
  onMove: (updates: Array<{ id: string; sort_order: number }>) => void
}

/**
 * Daftar butir ibadah per kategori sebagai grid kartu ringkas. Selalu terlihat
 * (tanpa harus memilih kelas): ubah nama, geser urutan, hapus, dan – bila
 * kelas dipilih – lihat penguasaan per butir.
 */
export function ItemsPanel({
  items,
  loading,
  canWrite,
  open,
  onToggle,
  studentCount,
  masteredByItem,
  allPresetsExist,
  loadingPresets,
  deleting,
  saving,
  onAdd,
  onLoadPresets,
  onDelete,
  onRename,
  onMove,
}: ItemsPanelProps) {
  const { token } = theme.useToken()
  const [editing, setEditing] = useState<{ id: string; label: string } | null>(null)

  const showMastery = studentCount !== undefined

  const move = (index: number, dir: -1 | 1) => {
    const order = items.map((i) => i.id)
    const target = index + dir
    if (target < 0 || target >= order.length) return
    ;[order[index], order[target]] = [order[target], order[index]]
    const current = new Map(items.map((i) => [i.id, i.sort_order]))
    const updates = order
      .map((id, i) => ({ id, sort_order: (i + 1) * 10 }))
      .filter((u) => current.get(u.id) !== u.sort_order)
    onMove(updates)
  }

  const submitRename = () => {
    if (editing && editing.label.trim().length >= 2) {
      onRename(editing.id, editing.label, () => setEditing(null))
    }
  }

  return (
    <Card styles={{ body: { padding: 0 } }}>
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          flexWrap: 'wrap',
          borderBottom: open ? `1px solid ${token.colorBorderSecondary}` : undefined,
        }}
      >
        <Space size={8}>
          <Typography.Text strong style={{ fontSize: 13.5 }}>
            Daftar Butir
          </Typography.Text>
          <Tag style={{ borderRadius: 999, marginInlineEnd: 0 }}>{items.length}</Tag>
          {!open && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Kelola nama, urutan, dan penghapusan butir
            </Typography.Text>
          )}
        </Space>
        <Space size={8}>
          {open && canWrite && !allPresetsExist && items.length > 0 && (
            <Button size="small" icon={<ThunderboltOutlined />} loading={loadingPresets} onClick={onLoadPresets}>
              Muat Preset
            </Button>
          )}
          <Button size="small" type="text" icon={open ? <UpOutlined /> : <DownOutlined />} onClick={onToggle}>
            {open ? 'Sembunyikan' : 'Tampilkan'}
          </Button>
        </Space>
      </div>

      {/* Isi */}
      {open &&
        (loading ? (
          <div style={{ padding: 16 }}>
            <Skeleton active paragraph={{ rows: 3 }} title={false} />
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: 32 }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Belum ada butir. Muat preset atau tambah butir manual."
            >
              {canWrite && (
                <Space>
                  <Button icon={<ThunderboltOutlined />} loading={loadingPresets} onClick={onLoadPresets}>
                    Muat Preset
                  </Button>
                  <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>
                    Tambah Butir
                  </Button>
                </Space>
              )}
            </Empty>
          </div>
        ) : (
          <div
            role="list"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
              gap: 10,
              padding: 12,
            }}
          >
            {items.map((item, index) => {
              const count = masteredByItem?.get(item.id) ?? 0
              const total = studentCount ?? 0
              const percent = total > 0 ? Math.round((count / total) * 100) : 0
              return (
                <div
                  key={item.id}
                  role="listitem"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: `1px solid ${token.colorBorderSecondary}`,
                    background: token.colorBgContainer,
                  }}
                >
                  {/* Nomor + nama + jenis dalam satu baris */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 700,
                        background: token.colorPrimaryBg,
                        color: token.colorPrimary,
                      }}
                    >
                      {index + 1}
                    </div>
                    <Typography.Text
                      ellipsis={{ tooltip: item.label }}
                      style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600 }}
                    >
                      {item.label}
                    </Typography.Text>
                    <Tag
                      bordered={false}
                      color={item.is_preset ? 'blue' : undefined}
                      style={{ marginInlineEnd: 0, fontSize: 10.5, lineHeight: '16px', padding: '0 6px', flexShrink: 0 }}
                    >
                      {item.is_preset ? 'Preset' : 'Manual'}
                    </Tag>
                  </div>

                  {/* Penguasaan kelas */}
                  {showMastery && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Progress
                        percent={percent}
                        size="small"
                        showInfo={false}
                        status={percent === 100 ? 'success' : 'normal'}
                        style={{ flex: 1, margin: 0 }}
                      />
                      <Typography.Text type="secondary" style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>
                        {count}/{total} santri
                      </Typography.Text>
                    </div>
                  )}

                  {/* Aksi (ikon kecil) */}
                  {canWrite && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Space size={0}>
                        <Tooltip title="Geser ke kiri">
                          <Button
                            type="text"
                            size="small"
                            icon={<LeftOutlined />}
                            disabled={index === 0 || saving}
                            aria-label={`Geser ${item.label} ke kiri`}
                            onClick={() => move(index, -1)}
                          />
                        </Tooltip>
                        <Tooltip title="Geser ke kanan">
                          <Button
                            type="text"
                            size="small"
                            icon={<RightOutlined />}
                            disabled={index === items.length - 1 || saving}
                            aria-label={`Geser ${item.label} ke kanan`}
                            onClick={() => move(index, 1)}
                          />
                        </Tooltip>
                      </Space>
                      <Space size={0}>
                        <Tooltip title="Ubah nama">
                          <Button
                            type="text"
                            size="small"
                            icon={<EditOutlined />}
                            aria-label={`Ubah nama ${item.label}`}
                            onClick={() => setEditing({ id: item.id, label: item.label })}
                          />
                        </Tooltip>
                        <Popconfirm
                          title="Hapus butir ini?"
                          description="Butir disembunyikan dan tidak dihitung lagi di papan, nilai, dan rapor. Data lama tetap tersimpan."
                          okText="Ya, Hapus"
                          cancelText="Batal"
                          okButtonProps={{ loading: deleting }}
                          onConfirm={() => onDelete(item.id)}
                        >
                          <Button
                            type="text"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            aria-label={`Hapus butir ${item.label}`}
                          />
                        </Popconfirm>
                      </Space>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}

      <AppModal
        title="Ubah Nama Butir"
        open={editing !== null}
        okText="Simpan"
        cancelText="Batal"
        size="sm"
        confirmLoading={saving}
        okButtonProps={{ disabled: !editing || editing.label.trim().length < 2 }}
        onCancel={() => setEditing(null)}
        onOk={submitRename}
        destroyOnHidden
      >
        <Input
          autoFocus
          value={editing?.label ?? ''}
          maxLength={120}
          onChange={(e) => setEditing((prev) => (prev ? { ...prev, label: e.target.value } : prev))}
          onPressEnter={submitRename}
        />
      </AppModal>
    </Card>
  )
}
