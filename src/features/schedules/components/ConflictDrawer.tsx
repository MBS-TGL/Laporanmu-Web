import { Button, Drawer, Empty, Space, Table, Tag } from 'antd'
import { AlertOutlined, EditOutlined, WarningOutlined } from '@ant-design/icons'
import type { DetectedConflictGroup, Schedule } from '../types'
import { DAY_LABELS } from '../SchedulesPage'

interface ConflictDrawerProps {
  open: boolean
  conflictGroups: DetectedConflictGroup[]
  onClose: () => void
  onEditSchedule?: (schedule: Schedule) => void
}

function shortTime(t: string): string {
  return t ? t.slice(0, 5) : '-'
}

export function ConflictDrawer({
  open,
  conflictGroups,
  onClose,
  onEditSchedule,
}: ConflictDrawerProps) {
  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertOutlined style={{ color: '#ef4444' }} />
          <span>Analisis Tabrakan Jadwal ({conflictGroups.length})</span>
        </div>
      }
      placement="right"
      size="min(680px, 96vw)"
      open={open}
      onClose={onClose}
    >
      {conflictGroups.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Luar biasa! Tidak ada bentrok jadwal pengajar, kelas, maupun ruangan."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 13, color: '#64748b' }}>
            Berikut adalah daftar jadwal yang bertabrakan waktu pada hari dan jam yang sama. Silakan tinjau dan sesuaikan jadwal pengajar atau kelas yang bersangkutan.
          </div>

          {conflictGroups.map((group, idx) => {
            let reasonColor: 'volcano' | 'magenta' | 'orange' = 'volcano'
            let reasonText = 'Bentrok Guru'
            if (group.reason === 'class') {
              reasonColor = 'magenta'
              reasonText = 'Bentrok Kelas'
            } else if (group.reason === 'room') {
              reasonColor = 'orange'
              reasonText = 'Bentrok Ruang'
            }

            return (
              <div
                key={group.id || idx}
                style={{
                  border: '1px solid #fee2e2',
                  background: '#fff',
                  borderRadius: 8,
                  padding: 14,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 10,
                  }}
                >
                  <Space wrap size="small">
                    <Tag color={reasonColor} style={{ fontWeight: 600 }}>
                      <WarningOutlined /> {reasonText}
                    </Tag>
                    <Tag color="purple">{DAY_LABELS[group.day_of_week]}</Tag>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>
                      {group.targetName}
                    </span>
                  </Space>
                </div>

                <Table<Schedule>
                  size="small"
                  pagination={false}
                  rowKey="id"
                  dataSource={group.schedules}
                  columns={[
                    {
                      title: 'Waktu',
                      key: 'time',
                      width: 110,
                      render: (_, row) => (
                        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                          {shortTime(row.start_time)}–{shortTime(row.end_time)}
                        </span>
                      ),
                    },
                    {
                      title: 'Kelas',
                      key: 'class',
                      width: 90,
                      render: (_, row) => <Tag color="blue">{row.classes?.name ?? '-'}</Tag>,
                    },
                    {
                      title: 'Mapel',
                      key: 'subject',
                      render: (_, row) => row.subjects?.name ?? '-',
                    },
                    {
                      title: 'Pengajar',
                      key: 'teacher',
                      render: (_, row) => row.teachers?.name ?? '-',
                    },
                    {
                      title: 'Ruang',
                      dataIndex: 'room',
                      key: 'room',
                      width: 80,
                      render: (v) => v || '-',
                    },
                    {
                      title: '',
                      key: 'action',
                      width: 60,
                      render: (_, row) =>
                        onEditSchedule ? (
                          <Button
                            type="link"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => {
                              onEditSchedule(row)
                              onClose()
                            }}
                          >
                            Edit
                          </Button>
                        ) : null,
                    },
                  ]}
                />
              </div>
            )
          })}
        </div>
      )}
    </Drawer>
  )
}
