import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Typography } from 'antd'
import { PrinterOutlined } from '@ant-design/icons'
import { QRCodeCanvas } from 'qrcode.react'
import { AppModal } from '../../../shared/components/AppModal'
import { ModalFooter } from '../../../shared/components/ModalFooter'
import { formatDisplayName } from '../../../shared/utils/displayName'
import {
  formatPermitDate,
  formatPermitDateTime,
  permitNo,
} from '../permitUtils'
import type { LeavePermit } from '../types'

/** Satu lembar surat izin — dipakai modal cetak tunggal & cetak massal */
export function PermitLetterBody({ permit }: { permit: LeavePermit }) {
  return (
    <div className="permit-letter">
      <div className="permit-letter-head">
        <img src="/logo-icon.png" alt="Logo Laporanmu" width={44} height={44} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: '#1a5c35' }}>PENGASUHAN SANTRI</div>
          <div style={{ fontSize: 11, color: '#475569' }}>Muhammadiyah Boarding School Tanggul · Jember</div>
        </div>
        <div className="permit-letter-qr" title="Scan untuk proses izin di gerbang">
          <QRCodeCanvas value={`permit:${permit.id}`} size={72} level="M" />
        </div>
      </div>
      <div style={{ textAlign: 'center', margin: '12px 0 4px', fontWeight: 800, fontSize: 15, textDecoration: 'underline' }}>
        IZIN KELUAR PONDOK
      </div>
      <div style={{ textAlign: 'center', fontSize: 10.5, color: '#64748b', marginBottom: 10 }}>
        No: {permitNo(permit.id)} · {formatPermitDate(permit.leave_date)}
      </div>
      <table className="permit-letter-table">
        <tbody>
          <tr><td>Nama</td><td>{permit.student ? formatDisplayName(permit.student.name) : '-'}</td></tr>
          <tr><td>Kode / Kelas</td><td>{permit.student?.registration_code ?? '-'} · {permit.student?.classes?.name ?? '-'}</td></tr>
          <tr><td>No. Telepon</td><td>{permit.phone ?? '-'}</td></tr>
          <tr><td>Tujuan</td><td>{permit.destination}</td></tr>
          <tr><td>Keperluan</td><td>{permit.purpose}</td></tr>
          <tr><td>Hari / Tanggal Keluar</td><td>{formatPermitDate(permit.leave_date)}</td></tr>
          <tr><td>Batas Kembali</td><td>{formatPermitDateTime(permit.return_deadline)}</td></tr>
        </tbody>
      </table>
      <table className="permit-letter-sign">
        <tbody>
          <tr>
            <td>
              <div>Staf Pengasuhan Santri</div>
              <div className="permit-sign-space" />
              <div style={{ fontWeight: 700 }}>( .............................. )</div>
            </td>
            <td>
              <div>Wali Santri</div>
              <div className="permit-sign-space" />
              <div style={{ fontWeight: 700 }}>( .............................. )</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

/**
 * Preview & cetak surat izin keluar. QR di surat berisi `permit:<id>`
 * sehingga bisa discan balik lewat fitur Scan (mode Gerbang).
 */
export function PrintModal({ permit, onClose }: { permit: LeavePermit | null; onClose: () => void }) {
  if (!permit) return null

  return (
    <AppModal
      title="Cetak Surat Izin Keluar"
      subtitle="Dokumen final siap cetak"
      icon={<PrinterOutlined />}
      open={!!permit}
      onCancel={onClose}
      width={560}
      footer={
        <ModalFooter
          onCancel={onClose}
          cancelText="Tutup"
          onOk={() => window.print()}
          okText="Cetak"
          okIcon={<PrinterOutlined />}
        />
      }
    >
      <div className="permit-print-root">
        <PermitLetterBody permit={permit} />
      </div>
    </AppModal>
  )
}

// ------------------------------------------------------------
// Cetak massal — N surat sekaligus, 1 surat per halaman
// ------------------------------------------------------------

interface BatchPrintProps {
  permits: LeavePermit[]
  printing: boolean
  onDone: () => void
}

/** Cetak banyak surat izin via portal + CSS print terisolasi (pola CardModal) */
export function PermitBatchPrint({ permits, printing, onDone }: BatchPrintProps) {
  useEffect(() => {
    if (!printing) return
    document.body.classList.add('printing-permit-batch')
    const done = () => {
      document.body.classList.remove('printing-permit-batch')
      onDone()
    }
    window.addEventListener('afterprint', done)
    // afterprint tidak selalu terpecetus (dibatalkan) — fallback timer
    const timer = window.setTimeout(done, 120_000)
    const immediate = window.setTimeout(() => window.print(), 150)
    return () => {
      window.removeEventListener('afterprint', done)
      window.clearTimeout(timer)
      window.clearTimeout(immediate)
      document.body.classList.remove('printing-permit-batch')
    }
  }, [printing, onDone])

  if (!printing || permits.length === 0) return null

  return createPortal(
    <div className="permit-batch-root">
      {permits.map((p) => (
        <div key={p.id} className="permit-batch-item">
          <PermitLetterBody permit={p} />
        </div>
      ))}
    </div>,
    document.body,
  )
}

// ------------------------------------------------------------
// Cetak rekap harian — tabel semua izin pada rentang tanggal terpilih
// ------------------------------------------------------------

interface RecapPrintProps {
  /** null = tidak sedang mencetak */
  dateRange: { from: string; to: string }
  permits: LeavePermit[]
  printing: boolean
  onDone: () => void
}

/** Cetak rekap izin via portal ke body + CSS print terisolasi (pola CardModal) */
export function PermitRecapPrint({ dateRange, permits, printing, onDone }: RecapPrintProps) {
  useEffect(() => {
    if (!printing) return
    document.body.classList.add('printing-permit-recap')
    const done = () => {
      document.body.classList.remove('printing-permit-recap')
      onDone()
    }
    window.addEventListener('afterprint', done)
    // afterprint tidak selalu terpecetus (dibatalkan) — fallback timer
    const timer = window.setTimeout(done, 60_000)
    const immediate = window.setTimeout(() => window.print(), 120)
    return () => {
      window.removeEventListener('afterprint', done)
      window.clearTimeout(timer)
      window.clearTimeout(immediate)
      document.body.classList.remove('printing-permit-recap')
    }
  }, [printing, onDone])

  if (!printing) return null

  const rows = [...permits].sort((a, b) => a.leave_date.localeCompare(b.leave_date))

  return createPortal(
    <div className="permit-recap-root">
      <Typography.Title level={4} style={{ textAlign: 'center', marginBottom: 2 }}>
        Rekap Izin Keluar Pondok
      </Typography.Title>
      <Typography.Paragraph style={{ textAlign: 'center', fontSize: 12, marginBottom: 14 }}>
        {formatPermitDate(dateRange.from)} s.d. {formatPermitDate(dateRange.to)} · {rows.length} izin
      </Typography.Paragraph>
      <table className="permit-recap-table">
        <thead>
          <tr>
            <th>No</th>
            <th>Santri</th>
            <th>Kode</th>
            <th>Kelas</th>
            <th>Tujuan</th>
            <th>Keperluan</th>
            <th>Keluar</th>
            <th>Batas Kembali</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => (
            <tr key={p.id}>
              <td>{i + 1}</td>
              <td>{p.student ? formatDisplayName(p.student.name) : '-'}</td>
              <td>{p.student?.registration_code ?? '-'}</td>
              <td>{p.student?.classes?.name ?? '-'}</td>
              <td>{p.destination}</td>
              <td>{p.purpose}</td>
              <td>{formatPermitDate(p.leave_date)}</td>
              <td>{formatPermitDateTime(p.return_deadline)}</td>
              <td>{p.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="permit-recap-sign">
        <div>
          <div>Jember, {formatPermitDate(new Date().toISOString())}</div>
          <div style={{ marginTop: 4 }}>Pengasuhan Santri</div>
          <div style={{ height: 64 }} />
          <div>( .................................... )</div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
