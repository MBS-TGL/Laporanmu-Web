import { useRef } from 'react'
import { PrinterOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { AppModal } from '../../../shared/components/AppModal'
import { ModalFooter } from '../../../shared/components/ModalFooter'
import { useSchoolSettings } from '../../report-cards/hooks'
import { formatRupiah, periodLabel } from '../sppUtil'
import { METHOD_LABEL, type SppPayment } from '../types'

interface ReceiptModalProps {
  open: boolean
  payment: SppPayment | null
  /** Total kewajiban - total terbayar setelah pembayaran ini */
  outstandingAfter: number | null
  onClose: () => void
}

/**
 * Kwitansi pembayaran SPP. Kop diambil dari Profil Sekolah, bukan hardcode,
 * supaya dokumen ikut berubah saat identitas sekolah diperbarui.
 */
export function ReceiptModal({ open, payment, outstandingAfter, onClose }: ReceiptModalProps) {
  const printRef = useRef<HTMLDivElement>(null)
  const { data: school } = useSchoolSettings()

  if (!payment) return null

  const student = payment.obligation?.student
  const obligation = payment.obligation
  const receiptNo = `SPP-${payment.id.slice(0, 8).toUpperCase()}`

  return (
    <AppModal
      open={open}
      title="Kwitansi Pembayaran SPP"
      subtitle="Bukti pembayaran siap cetak"
      icon={<PrinterOutlined />}
      onCancel={onClose}
      width={720}
      footer={
        <ModalFooter
          onCancel={onClose}
          cancelText="Tutup"
          onOk={() => window.print()}
          okText="Cetak Kwitansi"
          okIcon={<PrinterOutlined />}
        />
      }
    >
      <div
        ref={printRef}
        style={{
          background: '#fff',
          padding: '20px 28px',
          color: '#000',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          lineHeight: 1.5,
        }}
      >
        <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: 10, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase' }}>
            Kwitansi Pembayaran
          </div>
          <div style={{ fontSize: 18, fontWeight: 'bold', letterSpacing: 0.5 }}>
            {school?.school_name ?? 'Sekolah'}
          </div>
          {school?.school_address && (
            <div style={{ fontSize: 11, color: '#444' }}>{school.school_address}</div>
          )}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '4px 20px',
            fontSize: 12.5,
            marginBottom: 16,
            background: '#f8fafc',
            padding: 12,
            borderRadius: 8,
          }}
        >
          <div>
            <span style={{ color: '#666' }}>No. Kwitansi: </span>
            <b>{receiptNo}</b>
          </div>
          <div>
            <span style={{ color: '#666' }}>Tanggal: </span>
            <b>{dayjs(payment.paid_at).format('DD/MM/YYYY')}</b>
          </div>
          <div>
            <span style={{ color: '#666' }}>Nama Santri: </span>
            <b>{student?.name ?? '-'}</b>
          </div>
          <div>
            <span style={{ color: '#666' }}>Kode Registrasi: </span>
            <b>{student?.registration_code ?? '-'}</b>
          </div>
          <div>
            <span style={{ color: '#666' }}>Kelas: </span>
            <b>{student?.class?.name ?? '-'}</b>
          </div>
          <div>
            <span style={{ color: '#666' }}>Metode: </span>
            <b>{METHOD_LABEL[payment.method] ?? payment.method}</b>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
              <th style={{ padding: '6px 8px', textAlign: 'left' }}>Komponen</th>
              <th style={{ padding: '6px 8px', textAlign: 'left', width: 110 }}>Periode</th>
              <th style={{ padding: '6px 8px', textAlign: 'right', width: 130 }}>Jumlah</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '6px 8px' }}>{obligation?.component?.name ?? 'SPP'}</td>
              <td style={{ padding: '6px 8px' }}>{periodLabel(obligation?.period ?? '') || '-'}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>
                {formatRupiah(payment.amount)}
              </td>
            </tr>
          </tbody>
        </table>

        <div style={{ marginTop: 12, fontSize: 12.5 }}>
          {outstandingAfter !== null && (
            <div>
              <span style={{ color: '#666' }}>Sisa tagihan setelah pembayaran ini: </span>
              <b>{formatRupiah(Math.max(0, outstandingAfter))}</b>
            </div>
          )}
          {payment.note && (
            <div>
              <span style={{ color: '#666' }}>Catatan: </span>
              <span>{payment.note}</span>
            </div>
          )}
        </div>

        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
          <div style={{ color: '#888' }}>
            Dicetak {dayjs().format('DD/MM/YYYY HH:mm')} · Sistem Laporanmu
          </div>
          <div style={{ textAlign: 'center', width: 170 }}>
            <div>Petugas Kas,</div>
            <div style={{ height: 45 }} />
            <div style={{ fontWeight: 'bold', borderBottom: '1px solid #000' }}>
              {payment.creator?.name ?? 'Bendahara'}
            </div>
          </div>
        </div>
      </div>
    </AppModal>
  )
}
