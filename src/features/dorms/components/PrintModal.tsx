import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Spin, Table, Typography, type TableColumnsType } from 'antd'
import { PrinterOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { AppModal } from '../../../shared/components/AppModal'
import { ModalFooter } from '../../../shared/components/ModalFooter'
import { fetchPlacementsForExport } from '../api'
import { GENDER_LABEL } from '../meta'
import { useQuery } from '@tanstack/react-query'
import type { Dorm, Placement } from '../types'

interface PrintModalProps {
  open: boolean
  onClose: () => void
  /** Kamar yang dicetak — satu (dari drawer) atau semua (dari header) */
  dorms: Dorm[]
}

interface RosterData {
  dorm: Dorm
  students: Placement[]
}

/** Satu halaman roster — dipakai di preview modal & target cetak (pola permit-letter) */
function DormRosterPage({ roster, index, total }: { roster: RosterData; index: number; total: number }) {
  const { dorm, students } = roster
  return (
    <div className="roster-page">
      <div className="roster-title">DAFTAR PENGHUNI ASRAMA</div>
      <div className="roster-room">{dorm.name}</div>
      <div className="roster-meta">
        Musyrif: {dorm.musyrif?.name || '-'}
        {dorm.gender ? ` · ${GENDER_LABEL[dorm.gender] ?? dorm.gender}` : ''} · Kapasitas{' '}
        {dorm.capacity} · Penghuni {students.length}
      </div>
      <table className="roster-table">
        <thead>
          <tr>
            <th style={{ width: 44 }}>No</th>
            <th>Nama Santri</th>
            <th style={{ width: 170 }}>Kelas</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s, i) => (
            <tr key={s.id}>
              <td>{i + 1}</td>
              <td>{s.name}</td>
              <td>{s.classes?.name ?? '-'}</td>
            </tr>
          ))}
          {students.length === 0 && (
            <tr>
              <td colSpan={3} style={{ textAlign: 'center', fontStyle: 'italic' }}>
                Belum ada penghuni
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="roster-sign">
        <div>
          <div>Wali Kamar</div>
          <div className="roster-sign-space" />
          <div>{dorm.musyrif?.name ?? '________________'}</div>
        </div>
        <div>
          <div>Kepala Asrama</div>
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

export function PrintModal({ open, onClose, dorms }: PrintModalProps) {
  const [printing, setPrinting] = useState(false)

  const placementsQuery = useQuery({
    queryKey: ['placements', 'roster', dorms.map((d) => d.id).sort()],
    queryFn: () => fetchPlacementsForExport({ placement: 'assigned' }),
    enabled: open && dorms.length > 0,
    staleTime: 30_000,
  })

  const rosters = useMemo<RosterData[]>(() => {
    const byDorm = new Map<string, Placement[]>()
    for (const p of placementsQuery.data ?? []) {
      if (!p.dorm_id) continue
      const list = byDorm.get(p.dorm_id)
      if (list) list.push(p)
      else byDorm.set(p.dorm_id, [p])
    }
    return dorms.map((d) => ({ dorm: d, students: byDorm.get(d.id) ?? [] }))
  }, [dorms, placementsQuery.data])

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

  const columns: TableColumnsType<RosterData> = [
    { title: 'Kamar', dataIndex: ['dorm', 'name'], key: 'name' },
    { title: 'Penghuni', key: 'count', width: 90, render: (_, r) => r.students.length },
    {
      title: 'Okupansi',
      key: 'occ',
      width: 110,
      render: (_, r) => `${r.students.length}/${r.dorm.capacity}`,
    },
    {
      title: 'Musyrif',
      key: 'musyrif',
      render: (_, r) => r.dorm.musyrif?.name || '-',
    },
  ]

  return (
    <>
      <AppModal
        title="Cetak Daftar Penghuni"
        subtitle="Roster per kamar, siap ditempel di pintu kamar / arsip wali kamar"
        icon={<PrinterOutlined />}
        open={open}
        onCancel={onClose}
        width={640}
        footer={
          <ModalFooter
            onCancel={onClose}
            cancelText="Tutup"
            onOk={() => setPrinting(true)}
            okText={`Cetak${dorms.length > 1 ? ` (${dorms.length} kamar)` : ''}`}
            okIcon={<PrinterOutlined />}
            okDisabled={placementsQuery.isPending}
          />
        }
        destroyOnHidden
      >
        {placementsQuery.isPending ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: 48 }}>
            <Spin />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
              {rosters.length} kamar · {rosters.reduce((s, r) => s + r.students.length, 0)} penghuni
            </Typography.Text>
            <Table
              rowKey="id"
              size="small"
              columns={columns}
              dataSource={rosters}
              pagination={false}
            />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Kamar kosong tetap dicetak (daftar halaman kosong untuk pintu kamar). Klik "Cetak"
              lalu pilih printer, ukuran A4 portrait.
            </Typography.Text>
          </div>
        )}
      </AppModal>

      {printing &&
        createPortal(
          <div className="roster-print-root">
            {rosters.map((roster, i) => (
              <DormRosterPage key={roster.dorm.id} roster={roster} index={i} total={rosters.length} />
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
