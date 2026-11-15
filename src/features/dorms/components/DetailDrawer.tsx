import { useMemo } from 'react'
import { Alert, Button, Drawer, Empty, List, Popconfirm, Progress, Space, Tag, Typography, theme } from 'antd'
import { PlusOutlined, PrinterOutlined, SwapOutlined, UserOutlined, UserDeleteOutlined, WarningOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { StatusTag } from '../../../shared/components/StatusTag'
import { usePermissions } from '../../../shared/hooks/useProfile'
import { useStudentDetail } from '../../students/useStudentDetail'
import { GENDER_LABEL } from '../meta'
import { useDormResidents } from '../hooks'
import type { Dorm } from '../types'

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
  /** Cetak daftar penghuni kamar ini */
  onPrint?: () => void
  /** Kosongkan seluruh penghuni kamar ini (Popconfirm ada di UI) */
  onEvictAll?: () => void
}

export function DetailDrawer({
  dorm,
  occupied,
  onClose,
  onFill,
  onMove,
  onEvict,
  onPrint,
  onEvictAll,
}: DetailDrawerProps) {
  const { canWrite, canDelete } = usePermissions()
  const { token } = theme.useToken()
  const navigate = useNavigate()
  const { open: openStudentDetail } = useStudentDetail()
  const residentsQuery = useDormResidents(dorm?.id ?? null)
  const residents = useMemo(() => residentsQuery.data ?? [], [residentsQuery.data])

  const capacity = dorm?.capacity ?? 0
  const over = occupied > capacity
  const remaining = Math.max(0, capacity - occupied)
  const pct = capacity > 0 ? Math.min(100, Math.round((occupied / capacity) * 100)) : 0
  const stroke = pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#10b981'

  // Sebaran kelas penghuni — "Kelas X · n" terurut dari terbanyak
  const classDistribution = useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of residents) {
      const key = s.classes?.name ?? 'Tanpa kelas'
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [residents])

  return (
    <Drawer
      open={!!dorm}
      onClose={onClose}
      width={420}
      title={
        dorm ? (
          <Space size={8} wrap>
            <span style={{ fontWeight: 600 }}>{dorm.name}</span>
            {dorm.gender && <Tag>{GENDER_LABEL[dorm.gender] ?? dorm.gender}</Tag>}
          </Space>
        ) : null
      }
      extra={
        <Space size={4}>
          {onPrint && (
            <Button size="small" icon={<PrinterOutlined />} onClick={onPrint}>
              Cetak
            </Button>
          )}
          {canWrite && onEvictAll && occupied > 0 && (
            <Popconfirm
              title="Kosongkan kamar ini?"
              description={`${occupied} penghuni akan dikosongkan dari kamar ini.`}
              onConfirm={onEvictAll}
              okText="Kosongkan"
              cancelText="Batal"
            >
              <Button size="small" danger icon={<UserDeleteOutlined />}>
                Kosongkan
              </Button>
            </Popconfirm>
          )}
          {canWrite && (
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={onFill}>
              Isi Santri
            </Button>
          )}
        </Space>
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
              border: `1px solid ${token.colorBorderSecondary}`,
              marginBottom: 12,
            }}
          >
            <div style={{ flex: 1 }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Okupansi
              </Typography.Text>
              <div style={{ fontWeight: 700, fontSize: 18, lineHeight: 1.2 }}>
                {occupied}
                <span style={{ fontSize: 13, fontWeight: 500, color: '#64748b' }}>/{capacity}</span>
                {remaining > 0 && (
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#10b981', marginInlineStart: 8 }}>
                    sisa {remaining}
                  </span>
                )}
                {remaining === 0 && !over && capacity > 0 && (
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#f59e0b', marginInlineStart: 8 }}>
                    penuh
                  </span>
                )}
              </div>
              <Progress percent={pct} showInfo={false} size="small" strokeColor={stroke} style={{ marginBottom: 0, marginTop: 4 }} />
            </div>
            <StatusTag color={over ? 'red' : pct >= 100 ? 'red' : pct >= 80 ? 'orange' : 'green'}>
              {Math.round((occupied / Math.max(1, capacity)) * 100)}%
            </StatusTag>
          </div>

          {over && (
            <Alert
              type="error"
              showIcon
              icon={<WarningOutlined />}
              message={`Melebihi kapasitas ${occupied - capacity} santri`}
              description="Kapasitas kamar mungkin baru dikurangi. Pindahkan sebagian penghuni ke kamar lain."
              style={{ marginBottom: 12 }}
            />
          )}

          <div
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              padding: '8px 14px',
              borderRadius: 12,
              border: `1px solid ${token.colorBorderSecondary}`,
              marginBottom: 12,
            }}
          >
            <UserOutlined style={{ color: token.colorTextSecondary }} />
            <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
              Musyrif:
            </Typography.Text>
            <Typography.Text strong style={{ fontSize: 13 }}>
              {dorm.musyrif?.name || '-'}
            </Typography.Text>
          </div>

          {residents.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Sebaran kelas
              </Typography.Text>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                {classDistribution.map(([cls, count]) => (
                  <Tag key={cls} style={{ marginInlineEnd: 0 }}>
                    {cls} · {count}
                  </Tag>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography.Text strong style={{ fontSize: 13 }}>
              Penghuni ({residents.length})
            </Typography.Text>
            <Button
              type="link"
              size="small"
              style={{ padding: 0 }}
              onClick={() => dorm && navigate(`/students?dormId=${dorm.id}`)}
            >
              Kelola di Data Siswa
            </Button>
          </div>

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
                  <Typography.Link
                    style={{ fontWeight: 500, fontSize: 13.5 }}
                    onClick={() => openStudentDetail(s.id)}
                  >
                    {s.name}
                  </Typography.Link>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    {s.classes?.name ?? '-'}
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
