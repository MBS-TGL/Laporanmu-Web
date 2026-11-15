import { memo } from 'react'
import { Button, Card, Empty, Popconfirm, Progress, Spin, Tag, Tooltip, Typography, theme } from 'antd'
import {
  ApartmentOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  UserOutlined,
  UserDeleteOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { StatusTag } from '../../../shared/components/StatusTag'
import { GENDER_COLOR, GENDER_LABEL, occupancyStroke, STATUS_META } from '../meta'
import type { Dorm } from '../types'

export interface BoardViewProps {
  dorms: Dorm[]
  occupancyMap: Map<string, number>
  canWrite: boolean
  canDelete: boolean
  loading?: boolean
  onOpen: (dorm: Dorm) => void
  onFill: (dorm: Dorm) => void
  onEdit: (dorm: Dorm) => void
  onDelete: (dorm: Dorm) => void
  /** Kosongkan seluruh penghuni kamar (fetch id di halaman, Popconfirm di kartu) */
  onEvictAll?: (dorm: Dorm) => void
}

interface DormCardProps {
  dorm: Dorm
  occupied: number
  canWrite: boolean
  canDelete: boolean
  onOpen: (dorm: Dorm) => void
  onFill: (dorm: Dorm) => void
  onEdit: (dorm: Dorm) => void
  onDelete: (dorm: Dorm) => void
  onEvictAll?: (dorm: Dorm) => void
}

/** Kartu kamar — di-memo karena satu grid bisa menampilkan puluhan kartu */
const DormCard = memo(function DormCard({
  dorm,
  occupied,
  canWrite,
  canDelete,
  onOpen,
  onFill,
  onEdit,
  onDelete,
  onEvictAll,
}: DormCardProps) {
  const { token } = theme.useToken()
  const capacity = dorm.capacity
  const over = occupied > capacity
  const pct = capacity > 0 ? Math.min(100, Math.round((occupied / capacity) * 100)) : 0
  const remaining = Math.max(0, capacity - occupied)
  const stroke = occupancyStroke(pct)

  return (
    <Card
      hoverable
      size="small"
      onClick={() => onOpen(dorm)}
      styles={{ body: { padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 } }}
      style={{ borderRadius: 12 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <Typography.Text strong ellipsis style={{ flex: 1, fontSize: 14 }}>
          {dorm.name}
        </Typography.Text>
        {dorm.gender && (
          <StatusTag color={GENDER_COLOR[dorm.gender]}>{GENDER_LABEL[dorm.gender]}</StatusTag>
        )}
        {dorm.status === 'inactive' && <Tag>{STATUS_META.inactive.label}</Tag>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Progress
          percent={pct}
          showInfo={false}
          size="small"
          style={{ flex: 1, marginBottom: 0 }}
          strokeColor={stroke}
        />
        <Typography.Text style={{ fontSize: 12.5, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {occupied}/{capacity}
        </Typography.Text>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minHeight: 22 }}>
        {over ? (
          <Tag color="red" icon={<WarningOutlined />} style={{ marginInlineEnd: 0 }}>
            Lebih {occupied - capacity}
          </Tag>
        ) : remaining === 0 && capacity > 0 ? (
          <Tag color="orange" style={{ marginInlineEnd: 0 }}>
            Penuh
          </Tag>
        ) : (
          <Tag style={{ marginInlineEnd: 0 }}>Sisa {remaining}</Tag>
        )}
        <Tooltip title="Musyrif">
          <Typography.Text type="secondary" ellipsis style={{ fontSize: 12, flex: 1, minWidth: 0 }}>
            <UserOutlined style={{ marginInlineEnd: 4 }} />
            {dorm.musyrif?.name || '—'}
          </Typography.Text>
        </Tooltip>
      </div>

      {(canWrite || canDelete) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 2,
            borderTop: `1px solid ${token.colorBorderSecondary}`,
            paddingTop: 6,
          }}
        >
          {canWrite && (
            <>
              <Tooltip title="Isi santri">
                <Button
                  type="text"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={(e) => {
                    e.stopPropagation()
                    onFill(dorm)
                  }}
                />
              </Tooltip>
              <Tooltip title="Edit kamar">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit(dorm)
                  }}
                />
              </Tooltip>
              {occupied > 0 && onEvictAll && (
                <Popconfirm
                  title="Kosongkan kamar ini?"
                  description={`${occupied} penghuni akan dikosongkan.`}
                  onConfirm={(e) => {
                    e?.stopPropagation()
                    onEvictAll(dorm)
                  }}
                  onCancel={(e) => e?.stopPropagation()}
                  okText="Kosongkan"
                  cancelText="Batal"
                >
                  <Tooltip title="Kosongkan kamar">
                    <Button
                      type="text"
                      size="small"
                      icon={<UserDeleteOutlined />}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Tooltip>
                </Popconfirm>
              )}
            </>
          )}
          {canDelete && (
            <Popconfirm
              title="Hapus kamar ini?"
              description={
                occupied > 0
                  ? `${occupied} penghuni akan dikosongkan dari kamar ini.`
                  : 'Data akan ditandai terhapus (soft delete).'
              }
              onConfirm={(e) => {
                e?.stopPropagation()
                onDelete(dorm)
              }}
              onCancel={(e) => e?.stopPropagation()}
              okText="Hapus"
              cancelText="Batal"
            >
              <Tooltip title="Hapus kamar">
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={(e) => e.stopPropagation()}
                />
              </Tooltip>
            </Popconfirm>
          )}
        </div>
      )}
    </Card>
  )
})

export function BoardView({
  dorms,
  occupancyMap,
  canWrite,
  canDelete,
  loading = false,
  onOpen,
  onFill,
  onEdit,
  onDelete,
  onEvictAll,
}: BoardViewProps) {
  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', padding: 80 }}>
        <Spin indicator={<ApartmentOutlined spin style={{ fontSize: 32, color: '#6366f1' }} />} />
      </div>
    )
  }
  if (dorms.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="Belum ada kamar"
        style={{ padding: 48 }}
      />
    )
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(235px, 1fr))',
        gap: 12,
      }}
    >
      {dorms.map((dorm) => (
        <DormCard
          key={dorm.id}
          dorm={dorm}
          occupied={occupancyMap.get(dorm.id) ?? 0}
          canWrite={canWrite}
          canDelete={canDelete}
          onOpen={onOpen}
          onFill={onFill}
          onEdit={onEdit}
          onDelete={onDelete}
          onEvictAll={onEvictAll}
        />
      ))}
    </div>
  )
}
