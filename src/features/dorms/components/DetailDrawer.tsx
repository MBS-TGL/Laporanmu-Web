import { Button, Drawer, Empty, List, Popconfirm, Progress, Space, Tag, Typography } from 'antd'
import { PlusOutlined, SwapOutlined, UserDeleteOutlined } from '@ant-design/icons'
import { StatusTag } from '../../../shared/components/StatusTag'
import { usePermissions } from '../../../shared/hooks/useProfile'
import { useDormResidents } from '../hooks'
import type { Dorm } from '../types'

const GENDER_LABEL: Record<string, string> = {
  L: 'Laki-laki',
  P: 'Perempuan',
}

interface DetailDrawerProps {
  /** null = drawer tertutup */
  dorm: Dorm | null
  occupied: number
  onClose: () => void
  /** Buka modal penempatan dengan kamar ini sebagai tujuan tetap */
  onFill: () => void
  /** Pindahkan satu santri (buka modal dengan santri terpilih) */
  onMove: (studentId: string) => void
  onEvict: (studentId: string) => void
}

export function DetailDrawer({
  dorm,
  occupied,
  onClose,
  onFill,
  onMove,
  onEvict,
}: DetailDrawerProps) {
  const { canWrite, canDelete } = usePermissions()
  const residentsQuery = useDormResidents(dorm?.id ?? null)
  const residents = residentsQuery.data ?? []

  const capacity = dorm?.capacity ?? 0
  const pct = capacity > 0 ? Math.min(100, Math.round((occupied / capacity) * 100)) : 0
  const stroke = pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#10b981'

  return (
    <Drawer
      open={!!dorm}
      onClose={onClose}
      width={420}
      title={
        dorm ? (
          <Space size={8} wrap>
            <span style={{ fontWeight: 600 }}>{dorm.name}</span>
            {dorm.gender && <Tag>{dorm.gender === 'mixed' ? 'Campur' : dorm.gender === 'male' ? 'Putra' : 'Putri'}</Tag>}
          </Space>
        ) : null
      }
      extra={
        canWrite ? (
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={onFill}>
            Isi Santri
          </Button>
        ) : undefined
      }
    >
      {dorm && (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 14px',
              borderRadius: 12,
              border: '1px solid #eef2f7',
              marginBottom: 16,
            }}
          >
            <div style={{ flex: 1 }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Okupansi
              </Typography.Text>
              <div style={{ fontWeight: 700, fontSize: 18, lineHeight: 1.2 }}>
                {occupied}
                <span style={{ fontSize: 13, fontWeight: 500, color: '#64748b' }}>/{capacity}</span>
              </div>
              <Progress percent={pct} showInfo={false} size="small" strokeColor={stroke} style={{ marginBottom: 0, marginTop: 4 }} />
            </div>
            <StatusTag color={pct >= 100 ? 'red' : pct >= 80 ? 'orange' : 'green'}>
              {pct}%
            </StatusTag>
          </div>

          <Typography.Text strong style={{ fontSize: 13 }}>
            Penghuni ({residents.length})
          </Typography.Text>

          <List
            style={{ marginTop: 8 }}
            loading={residentsQuery.isLoading}
            dataSource={residents}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada penghuni" /> }}
            renderItem={(s) => (
              <List.Item
                actions={
                  canWrite || canDelete
                    ? [
                        canWrite && (
                          <Button
                            key="move"
                            type="text"
                            size="small"
                            icon={<SwapOutlined />}
                            onClick={() => onMove(s.id)}
                          >
                            Pindah
                          </Button>
                        ),
                        canDelete && (
                          <Popconfirm
                            key="evict"
                            title="Kosongkan penempatan santri ini?"
                            onConfirm={() => onEvict(s.id)}
                            okText="Kosongkan"
                            cancelText="Batal"
                          >
                            <Button type="text" size="small" danger icon={<UserDeleteOutlined />} />
                          </Popconfirm>
                        ),
                      ].filter(Boolean)
                    : undefined
                }
              >
                <div>
                  <Typography.Text style={{ fontWeight: 500, fontSize: 13.5 }}>{s.name}</Typography.Text>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    {s.classes?.name ?? '—'}
                    {s.gender && ` · ${GENDER_LABEL[s.gender] ?? s.gender}`}
                  </div>
                </div>
              </List.Item>
            )}
          />
        </>
      )}
    </Drawer>
  )
}
