import { useMemo, useState } from 'react'
import { Button, Drawer, Empty, Input, Space, Tag, Typography, theme } from 'antd'
import { DownloadOutlined, LoginOutlined, LogoutOutlined, SearchOutlined } from '@ant-design/icons'
import { StatusTag } from '../../../shared/components/StatusTag'
import { formatDisplayName } from '../../../shared/utils/displayName'
import { downloadOutsideStudentsCsv } from '../api'
import type { GateOutsideStudent } from '../types'
import type { LeavePermit } from '../../leave-permit/types'

// ------------------------------------------------------------------
// Drawer: santri yang sedang di luar gerbang (arah terakhir = keluar)
// ------------------------------------------------------------------
interface OutsideDrawerProps {
  open: boolean
  onClose: () => void
  outside: GateOutsideStudent[]
}

export function OutsideStudentsDrawer({ open, onClose, outside }: OutsideDrawerProps) {
  const { token } = theme.useToken()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return outside
    return outside.filter(
      (o) => o.name.toLowerCase().includes(q) || o.registration_code.toLowerCase().includes(q),
    )
  }, [outside, search])

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={460}
      title={
        <Space>
          <span>Santri di Luar Gerbang</span>
          <Tag color="red">{outside.length}</Tag>
        </Space>
      }
      extra={
        <Button
          size="small"
          icon={<DownloadOutlined />}
          disabled={filtered.length === 0}
          onClick={() => downloadOutsideStudentsCsv(filtered)}
        >
          Unduh CSV
        </Button>
      }
    >
      <Input
        placeholder="Cari nama atau kode registrasi"
        prefix={<SearchOutlined />}
        allowClear
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 12 }}
      />
      {filtered.length === 0 ? (
        <Empty description="Tidak ada santri di luar gerbang" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map((o) => (
            <div
              key={o.student_id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 12px',
                borderRadius: 10,
                border: `1px solid ${token.colorBorderSecondary}`,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <Typography.Text strong style={{ fontSize: 13.5 }}>
                  {formatDisplayName(o.name)}
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                  {o.registration_code}
                  {o.class_name ? ` · ${o.class_name}` : ''}
                </Typography.Text>
              </div>
              <Typography.Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                keluar{' '}
                {new Date(o.last_exit_at).toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Typography.Text>
            </div>
          ))}
        </div>
      )}
    </Drawer>
  )
}

// ------------------------------------------------------------------
// Baris izin aktif — dipakai kartu di halaman & drawer "izin aktif"
// ------------------------------------------------------------------
interface PermitItemProps {
  permit: LeavePermit
  departing: boolean
  returning: boolean
  onDepart: (permitId: string) => void
  onReturn: (permitId: string) => void
}

export function PermitItem({ permit, departing, returning, onDepart, onReturn }: PermitItemProps) {
  const { token } = theme.useToken()
  const overdue = permit.status === 'departed' && new Date(permit.return_deadline) < new Date()

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
        padding: '8px 12px',
        borderRadius: 10,
        border: `1px solid ${overdue ? '#fca5a5' : token.colorBorderSecondary}`,
        background: overdue ? '#fff1f0' : undefined,
      }}
    >
      <div>
        <Typography.Text strong style={{ fontSize: 13 }}>
          {permit.student?.name ? formatDisplayName(permit.student.name) : '-'}
        </Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
          → {permit.destination} · batas{' '}
          {new Date(permit.return_deadline).toLocaleString('id-ID', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Typography.Text>
      </div>
      <Space size="small">
        {overdue && <StatusTag color="red">Terlambat</StatusTag>}
        {permit.status === 'issued' ? (
          <Button
            size="small"
            icon={<LogoutOutlined />}
            loading={departing}
            onClick={() => onDepart(permit.id)}
          >
            Berangkat
          </Button>
        ) : (
          <Button
            size="small"
            type="primary"
            ghost
            icon={<LoginOutlined />}
            loading={returning}
            onClick={() => onReturn(permit.id)}
          >
            Kembali
          </Button>
        )}
      </Space>
    </div>
  )
}

// ------------------------------------------------------------------
// Drawer: seluruh izin aktif (berangkat / kembali)
// ------------------------------------------------------------------
interface ActivePermitsDrawerProps {
  open: boolean
  onClose: () => void
  permits: LeavePermit[]
  pending: { id: string; kind: 'depart' | 'return' } | null
  onDepart: (permitId: string) => void
  onReturn: (permitId: string) => void
}

export function ActivePermitsDrawer({
  open,
  onClose,
  permits,
  pending,
  onDepart,
  onReturn,
}: ActivePermitsDrawerProps) {
  return (
    <Drawer open={open} onClose={onClose} width={520} title={`Izin Santri Aktif (${permits.length})`}>
      {permits.length === 0 ? (
        <Empty description="Tidak ada izin aktif" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {permits.map((p) => (
            <PermitItem
              key={p.id}
              permit={p}
              departing={pending?.id === p.id && pending.kind === 'depart'}
              returning={pending?.id === p.id && pending.kind === 'return'}
              onDepart={onDepart}
              onReturn={onReturn}
            />
          ))}
        </div>
      )}
    </Drawer>
  )
}
