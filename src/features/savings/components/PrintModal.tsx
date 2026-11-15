import { useRef } from 'react'
import { PrinterOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { AppModal } from '../../../shared/components/AppModal'
import { ModalFooter } from '../../../shared/components/ModalFooter'
import { formatRupiah } from '../api'
import type { SavingsAccount, SavingsTxn } from '../types'

interface PrintModalProps {
  open: boolean
  account: SavingsAccount | null
  transactions: SavingsTxn[]
  onClose: () => void
}

export function PrintModal({ open, account, transactions, onClose }: PrintModalProps) {
  const printRef = useRef<HTMLDivElement>(null)

  if (!account) return null

  const handlePrint = () => {
    window.print()
  }

  return (
    <AppModal
      open={open}
      title="Pratinjau & Cetak Buku Tabungan"
      subtitle="Dokumen final siap cetak"
      icon={<PrinterOutlined />}
      onCancel={onClose}
      width={780}
      footer={
        <ModalFooter
          onCancel={onClose}
          cancelText="Tutup"
          onOk={handlePrint}
          okText="Cetak Dokumen"
          okIcon={<PrinterOutlined />}
        />
      }
    >
      <div
        ref={printRef}
        style={{
          background: '#fff',
          padding: '24px 32px',
          color: '#000',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          lineHeight: 1.5,
        }}
      >
        {/* Kop Resmi */}
        <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: 10, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase' }}>
            BADAN PENGELOLA KEUANGAN & KAS SANTRI
          </div>
          <div style={{ fontSize: 18, fontWeight: 'bold', letterSpacing: 0.5 }}>
            SMP MUHAMMADIYAH 4 TANGGUL
          </div>
          <div style={{ fontSize: 11, color: '#444' }}>
            Jl. K.H. Ahmad Dahlan No. 12 Tanggul - Jember · Laporan Mutasi Rekening Tabungan
          </div>
        </div>

        {/* Info Pemilik */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 20px', fontSize: 12.5, marginBottom: 16, background: '#f8fafc', padding: 12, borderRadius: 8 }}>
          <div>
            <span style={{ color: '#666' }}>Nama Santri: </span>
            <b>{account.students?.name}</b>
          </div>
          <div>
            <span style={{ color: '#666' }}>ID / NIS: </span>
            <b>{account.students?.registration_code}</b>
          </div>
          <div>
            <span style={{ color: '#666' }}>Kelas: </span>
            <b>{account.students?.classes?.name ?? '-'}</b>
          </div>
          <div>
            <span style={{ color: '#666' }}>Saldo Saat Ini: </span>
            <b style={{ color: '#16a34a' }}>{formatRupiah(account.balance)}</b>
          </div>
        </div>

        {/* Tabel Mutasi */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
          <thead>
            <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
              <th style={{ padding: '6px 8px', textAlign: 'center', width: 35 }}>No</th>
              <th style={{ padding: '6px 8px', textAlign: 'left', width: 95 }}>Tanggal</th>
              <th style={{ padding: '6px 8px', textAlign: 'left', width: 70 }}>Jenis</th>
              <th style={{ padding: '6px 8px', textAlign: 'right', width: 110 }}>Jumlah</th>
              <th style={{ padding: '6px 8px', textAlign: 'right', width: 110 }}>Saldo</th>
              <th style={{ padding: '6px 8px', textAlign: 'left' }}>Keterangan / Petugas</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 20, color: '#999' }}>
                  Belum ada transaksi tercatat
                </td>
              </tr>
            ) : (
              transactions.map((t, i) => (
                <tr key={t.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>{i + 1}</td>
                  <td style={{ padding: '6px 8px' }}>{dayjs(t.occurred_at).format('DD/MM/YYYY')}</td>
                  <td style={{ padding: '6px 8px', fontWeight: 600, color: t.kind === 'deposit' ? '#16a34a' : '#dc2626' }}>
                    {t.kind === 'deposit' ? 'Setor' : 'Tarik'}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 500 }}>
                    {formatRupiah(t.amount)}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>
                    {formatRupiah(t.balance_after)}
                  </td>
                  <td style={{ padding: '6px 8px', color: '#555' }}>
                    {t.note ? `${t.note} ` : ''}
                    {t.profiles?.name ? `(${t.profiles.name})` : ''}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Footer Cetak */}
        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
          <div style={{ color: '#888' }}>
            Dicetak pada: {dayjs().format('DD/MM/YYYY HH:mm')} · Sistem Laporanmu
          </div>
          <div style={{ textAlign: 'center', width: 160 }}>
            <div>Petugas Kas Keuangan,</div>
            <div style={{ height: 45 }} />
            <div style={{ fontWeight: 'bold', borderBottom: '1px solid #000' }}>
              Bendahara Sekolah
            </div>
          </div>
        </div>
      </div>
    </AppModal>
  )
}
