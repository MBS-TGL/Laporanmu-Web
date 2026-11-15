import { useRef } from 'react'
import { PrinterOutlined } from '@ant-design/icons'
import { QRCodeSVG } from 'qrcode.react'
import { AppModal } from '../../../shared/components/AppModal'
import { ModalFooter } from '../../../shared/components/ModalFooter'
import type { OfficialLetter } from './types'

interface PrintModalProps {
  open: boolean
  letter: OfficialLetter | null
  onClose: () => void
}

export function PrintModal({ open, letter, onClose }: PrintModalProps) {
  const printRef = useRef<HTMLDivElement>(null)

  if (!letter) return null

  const verifyUrl = `${window.location.origin}/verify?token=${letter.verify_token}`

  const handlePrint = () => {
    window.print()
  }

  return (
    <AppModal
      open={open}
      title="Pratinjau & Cetak Surat Resmi"
      subtitle="Dokumen final siap cetak"
      icon={<PrinterOutlined />}
      onCancel={onClose}
      width={720}
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
          padding: '32px 40px',
          fontFamily: 'Times New Roman, serif',
          color: '#000',
          lineHeight: 1.6,
        }}
      >
        {/* Kop Surat */}
        <div style={{ textAlign: 'center', borderBottom: '3px double #000', paddingBottom: 12, marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 'bold', textTransform: 'uppercase' }}>
            MAJELIS PENDIDIKAN DASAR DAN MENENGAH
          </div>
          <div style={{ fontSize: 20, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 }}>
            SMP MUHAMMADIYAH 4 TANGGUL
          </div>
          <div style={{ fontSize: 12, fontStyle: 'italic' }}>
            Jl. K.H. Ahmad Dahlan No. 12 Tanggul - Jember · Telp. (0336) 441234
          </div>
        </div>

        {/* Info Surat */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div><b>Nomor:</b> {letter.letter_no}</div>
            <div><b>Lampiran:</b> -</div>
            <div><b>Perihal:</b> {letter.subject}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            Tanggul, {new Date(letter.issued_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>

        {/* Tujuan Surat */}
        <div style={{ marginBottom: 20 }}>
          Kepada Yth.<br />
          <b>Bapak/Ibu Wali dari {letter.students?.name ?? 'Santri'}</b><br />
          di Tempat
        </div>

        {/* Isi Surat */}
        <div style={{ textAlign: 'justify', marginBottom: 24, minHeight: 180, whiteSpace: 'pre-wrap' }}>
          {letter.body_text}
        </div>

        {/* Tanda Tangan & QR Verifikasi */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 40 }}>
          <div style={{ textAlign: 'center', fontSize: 11 }}>
            <QRCodeSVG value={verifyUrl} size={84} />
            <div style={{ marginTop: 4, fontFamily: 'monospace' }}>Scan Keaslian</div>
            <div style={{ color: '#888', fontSize: 9 }}>Token: {letter.verify_token}</div>
          </div>

          <div style={{ textAlign: 'center', width: 220 }}>
            <div>Guru Bimbingan Konseling / Kepala Sekolah,</div>
            <div style={{ height: 70 }} />
            <div style={{ fontWeight: 'bold', textDecoration: 'underline' }}>
              Ust. Budi Santoso, S.Pd.I
            </div>
            <div style={{ fontSize: 12 }}>NBM. 1122334455</div>
          </div>
        </div>
      </div>
    </AppModal>
  )
}
