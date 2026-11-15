import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Spin, Table, Typography, type TableColumnsType } from 'antd'
import { PrinterOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { AppModal } from '../../../shared/components/AppModal'
import { ModalFooter } from '../../../shared/components/ModalFooter'
import { useActivityMembers } from '../hooks'
import type { Activity, ActivityMember } from '../types'

interface PrintModalProps {
  open: boolean
  onClose: () => void
  activity: Activity | null
}

/** Satu halaman roster — dipakai di preview modal & target cetak (pola roster asrama) */
function ActivityRosterPage({
  activity,
  members,
  index,
  total,
}: {
  activity: Activity
  members: ActivityMember[]
  index: number
  total: number
}) {
  return (
    <div className="roster-page">
      <div className="roster-title">DAFTAR ANGGOTA EKSTRAKURIKULER</div>
      <div className="roster-room">{activity.name}</div>
      <div className="roster-meta">
        Pembina: {activity.teachers?.name || '-'}
        {activity.schedule ? ` · ${activity.schedule}` : ''}
        {activity.place ? ` · ${activity.place}` : ''} · Anggota {members.length}
      </div>
      <table className="roster-table">
        <thead>
          <tr>
            <th style={{ width: 44 }}>No</th>
            <th style={{ width: 110 }}>NIS</th>
            <th>Nama Santri</th>
            <th style={{ width: 130 }}>Kelas</th>
            <th style={{ width: 120 }}>Peran</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m, i) => (
            <tr key={m.id}>
              <td>{i + 1}</td>
              <td>{m.students?.registration_code ?? '-'}</td>
              <td>{m.students?.name ?? '-'}</td>
              <td>{m.students?.classes?.name ?? '-'}</td>
              <td>{m.role || 'Anggota'}</td>
            </tr>
          ))}
          {members.length === 0 && (
            <tr>
              <td colSpan={5} style={{ textAlign: 'center', fontStyle: 'italic' }}>
                Belum ada anggota
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="roster-sign">
        <div>
          <div>Pembina</div>
          <div className="roster-sign-space" />
          <div>{activity.teachers?.name ?? '________________'}</div>
        </div>
        <div>
          <div>Kepala Sekolah</div>
          <div className="roster-sign-space" />
          <div>________________</div>
        </div>
      </div>
      <div className="roster-foot">
        <span>Dicetak {dayjs().format('DD/MM/YYYY HH:mm')}</span>
        <span>
          Halaman {index + 1}/{total}
        </span>
      </div>
    </div>
  )
}

/** Cetak daftar anggota satu kegiatan — pola PrintModal asrama (body class + portal + window.print). */
export function PrintModal({ open, onClose, activity }: PrintModalProps) {
  const [printing, setPrinting] = useState(false)

  const membersQuery = useActivityMembers(open && activity ? activity.id : undefined)
  const members = membersQuery.data ?? []

  // Pola cetak portal (ala printing-student-cards): body class + portal ke body +
  // window.print() delay kecil, cleanup di afterprint + fallback timer.
  useEffect(() => {
    if (!printing) return
    document.body.classList.add('printing-roster')
    const timer = window.setTimeout(() => window.print(), 150)
    const onAfter = () => setPrinting(false)
    const fallback = window.setTimeout(() => setPrinting(false), 60_000)
    window.addEventListener('afterprint', onAfter)
    return () => {
      document.body.classList.remove('printing-roster')
      window.clearTimeout(timer)
      window.clearTimeout(fallback)
      window.removeEventListener('afterprint', onAfter)
    }
  }, [printing])

  const columns: TableColumnsType<ActivityMember> = [
    { title: 'Santri', key: 'name', render: (_, m) => m.students?.name ?? '-' },
    { title: 'Kelas', key: 'class', width: 120, render: (_, m) => m.students?.classes?.name ?? '-' },
    { title: 'Peran', key: 'role', width: 110, render: (_, m) => m.role || 'Anggota' },
  ]

  if (!activity) return null

  return (
    <>
      <AppModal
        title="Cetak Daftar Anggota"
        subtitle="Roster kegiatan, siap dibawa pembina saat latihan / arsip"
        icon={<PrinterOutlined />}
        open={open}
        onCancel={onClose}
        width={640}
        footer={
          <ModalFooter
            onCancel={onClose}
            cancelText="Tutup"
            onOk={() => setPrinting(true)}
            okText="Cetak"
            okIcon={<PrinterOutlined />}
            okDisabled={membersQuery.isPending}
          />
        }
        destroyOnHidden
      >
        {membersQuery.isPending ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: 48 }}>
            <Spin />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
              {activity.name} · {members.length} anggota
            </Typography.Text>
            <Table
              rowKey="id"
              size="small"
              columns={columns}
              dataSource={members}
              pagination={false}
            />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Klik "Cetak" lalu pilih printer, ukuran A4 portrait.
            </Typography.Text>
          </div>
        )}
      </AppModal>

      {printing &&
        createPortal(
          <div className="roster-print-root">
            <ActivityRosterPage activity={activity} members={members} index={0} total={1} />
          </div>,
          document.body,
        )}
    </>
  )
}
