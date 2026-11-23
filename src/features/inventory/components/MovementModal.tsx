import { useState } from 'react'
import { App, Button, Drawer, Empty, Input, InputNumber, Select, Table, Tag, Typography, type TableColumnsType } from 'antd'
import { SwapOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { AppModal } from '../../../shared/components/AppModal'
import { useProfile } from '../../../shared/hooks/useProfile'
import { MOVEMENT_LABEL, type InventoryMovement, type MovementKind } from '../api'
import { useCreateMovement, useMovements } from '../hooks'
import type { InventoryItem } from '../types'

const MOVE_OPTIONS = (Object.keys(MOVEMENT_LABEL) as MovementKind[]).map((k) => ({
  value: k,
  label: MOVEMENT_LABEL[k],
}))

const KIND_COLOR: Record<MovementKind, string> = {
  in: 'green',
  out: 'blue',
  damage: 'orange',
  loss: 'red',
  adjustment: 'purple',
}

interface MovementModalProps {
  open: boolean
  item: InventoryItem | null
  onClose: () => void
}

/** Catat mutasi stok. quantity item disinkronkan trigger DB, bukan diedit langsung. */
export function MovementModal({ open, item, onClose }: MovementModalProps) {
  const { message } = App.useApp()
  const { profile } = useProfile()
  const mutation = useCreateMovement()

  const [kind, setKind] = useState<MovementKind>('in')
  const [quantity, setQuantity] = useState<number | null>(1)
  const [note, setNote] = useState('')

  // Reset saat modal dibuka kembali — diterapkan saat render (adjust state),
  // bukan setState di effect (react-hooks/set-state-in-effect).
  const [openedToken, setOpenedToken] = useState<string | null>(null)
  const currentToken = open && item ? item.id : null
  if (currentToken && currentToken !== openedToken) {
    setOpenedToken(currentToken)
    setKind('in')
    setQuantity(1)
    setNote('')
  }
  if (!open && openedToken) setOpenedToken(null)

  if (!item) return null

  const handleSubmit = () => {
    const qty = Number(quantity ?? 0)
    if (!qty || qty <= 0) {
      message.warning('Jumlah mutasi wajib lebih dari 0')
      return
    }
    mutation.mutate(
      { itemId: item.id, kind, quantity: qty, note, actorId: profile?.id ?? null },
      {
        onSuccess: () => {
          message.success(`Mutasi ${MOVEMENT_LABEL[kind]} tercatat`)
          onClose()
        },
        onError: (err: Error) => message.error(err.message || 'Gagal mencatat mutasi'),
      },
    )
  }

  return (
    <AppModal
      open={open}
      title={`Mutasi Stok: ${item.name}`}
      subtitle={`Stok saat ini ${item.quantity}${item.unit ? ` ${item.unit}` : ''}`}
      icon={<SwapOutlined />}
      onCancel={onClose}
      onOk={handleSubmit}
      okText="Catat Mutasi"
      confirmLoading={mutation.isPending}
      width={480}
      destroyOnHidden
    >
      <div style={{ display: 'grid', gap: 12 }}>
        <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
          Jenis mutasi
          <Select value={kind} options={MOVE_OPTIONS} onChange={setKind} aria-label="Jenis mutasi" />
        </label>
        <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
          Jumlah
          <InputNumber
            min={1}
            max={100000}
            value={quantity}
            onChange={setQuantity}
            style={{ width: '100%' }}
            aria-label="Jumlah mutasi"
          />
        </label>
        <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
          Catatan (opsional)
          <Input.TextArea
            rows={2}
            maxLength={200}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nomor nota, penerima, atau alasan penyesuaian"
          />
        </label>
        {kind === 'adjustment' && (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Penyesuaian menetapkan stok menjadi jumlah di atas, bukan menambah atau mengurangi.
          </Typography.Text>
        )}
      </div>
    </AppModal>
  )
}

/** Riwayat mutasi stok satu barang (drawer). */
export function MovementDrawer({
  item,
  onClose,
}: {
  item: InventoryItem | null
  onClose: () => void
}) {
  const query = useMovements(item?.id ?? null)
  const rows = query.data ?? []

  const columns: TableColumnsType<InventoryMovement> = [
    {
      title: 'Tanggal',
      key: 'created_at',
      width: 130,
      render: (_, r) => dayjs(r.created_at).format('DD MMM YYYY HH:mm'),
    },
    {
      title: 'Jenis',
      key: 'kind',
      width: 130,
      render: (_, r) => <Tag color={KIND_COLOR[r.kind]}>{MOVEMENT_LABEL[r.kind]}</Tag>,
    },
    { title: 'Jumlah', key: 'quantity', width: 80, align: 'center', render: (_, r) => r.quantity },
    { title: 'Catatan', key: 'note', render: (_, r) => r.note ?? '—' },
    { title: 'Petugas', key: 'actor', width: 130, render: (_, r) => r.profiles?.name ?? '—' },
  ]

  return (
    <Drawer
      open={Boolean(item)}
      onClose={onClose}
      size="min(720px, 96vw)"
      title={item ? `Riwayat Mutasi: ${item.name}` : 'Riwayat Mutasi'}
    >
      {query.isError ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <Typography.Text type="secondary">Riwayat mutasi gagal dimuat.</Typography.Text>
          <Button size="small" onClick={() => void query.refetch()}>
            Coba lagi
          </Button>
        </div>
      ) : (
        <Table
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={rows}
          loading={query.isPending}
          pagination={{ pageSize: 15, hideOnSinglePage: true }}
          scroll={{ x: 'max-content' }}
          locale={{
            emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada mutasi tercatat" />,
          }}
        />
      )}
    </Drawer>
  )
}
