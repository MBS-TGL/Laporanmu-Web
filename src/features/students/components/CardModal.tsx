import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Alert, App, Button, Popconfirm, Typography } from 'antd'
import { IdcardOutlined, KeyOutlined, PrinterOutlined } from '@ant-design/icons'
import { QRCodeCanvas } from 'qrcode.react'
import { AppModal } from '../../../shared/components/AppModal'
import { useGenerateStudentPins } from '../hooks'
import { GENDER_LABEL } from '../status'
import type { Student } from '../types'

/** Maksimum kartu dirender/cetak sekali kali — hindari halaman cetak ribuan */
const MAX_CARDS = 500

/** Kode registrasi → tampilan XXX-XXXX-XXXX (format sama dengan portal wali) */
function formatCode(raw: string): string {
  const clean = raw.replace(/-/g, '').toUpperCase().slice(0, 11)
  const parts = [clean.slice(0, 3), clean.slice(3, 7), clean.slice(7, 11)].filter(Boolean)
  return parts.join('-')
}

function checkUrl(student: Student): string {
  const pinParam = student.pin ? `&pin=${encodeURIComponent(student.pin)}` : ''
  return `${window.location.origin}/check?code=${encodeURIComponent(student.registration_code)}${pinParam}`
}

/**
 * Foto siswa dengan fallback inisial — dipakai juga saat cetak:
 * jika foto gagal dimuat, inisial tetap tampil (bukan kotak kosong).
 */
function CardAvatar({ student }: { student: Student }) {
  const [photoLoaded, setPhotoLoaded] = useState(false)
  const initial = student.name?.charAt(0).toUpperCase() ?? '?'
  return (
    <div className="student-id-card-avatar">
      {student.photo_url ? (
        <img
          src={student.photo_url}
          alt=""
          onLoad={() => setPhotoLoaded(true)}
          style={{ opacity: photoLoaded ? 1 : 0 }}
        />
      ) : null}
      <span style={{ opacity: photoLoaded ? 0 : 1 }}>{initial}</span>
    </div>
  )
}

interface CardModalProps {
  open: boolean
  onClose: () => void
  /** Siswa yang kartunya ditampilkan — dari aksi baris (1), seleksi massal, atau cetak massal */
  students: Student[]
}

export function CardModal({ open, onClose, students }: CardModalProps) {
  const { message } = App.useApp()
  const generatePins = useGenerateStudentPins()
  // PIN hasil generate ditempelkan lokal agar kartu langsung menampilkan
  // PIN baru tanpa menunggu refetch daftar siswa di halaman
  const [pinOverrides, setPinOverrides] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    // reset hanya saat modal dibuka — JANGAN bergantung pada students:
    // refetch daftar siswa (invalidasi query) membuat array props baru
    // dan akan menghapus override PIN yang baru dibuat
    if (open) setPinOverrides(new Map())
  }, [open])

  const visible = students.slice(0, MAX_CARDS).map((s) => {
    const override = pinOverrides.get(s.id)
    return override ? { ...s, pin: override } : s
  })
  const overflow = students.length - visible.length
  const missingPinStudents = visible.filter((s) => !s.pin)
  const missingPin = missingPinStudents.length
  const hasPinCount = visible.length - missingPin

  const handleGenerate = (targets: Student[]) => {
    if (targets.length === 0) return
    generatePins.mutate(
      targets.map((s) => s.id),
      {
        onSuccess: (results) => {
          setPinOverrides((prev) => {
            const next = new Map(prev)
            for (const r of results) next.set(r.student_id, r.new_pin)
            return next
          })
          message.success(
            results.length === 1 ? 'PIN berhasil dibuat' : `${results.length} PIN berhasil dibuat`,
          )
        },
        onError: (err: Error) => message.error(err.message || 'Gagal membuat PIN'),
      },
    )
  }

  // Cetak via portal ke <body>: elemen kartu keluar dari struktur modal sehingga
  // posisi cetak selalu pojok kiri atas halaman (tidak ikut posisi/scroll modal)
  const [printing, setPrinting] = useState(false)
  useEffect(() => {
    if (!printing) return
    document.body.classList.add('printing-student-cards')
    const done = () => setPrinting(false)
    window.addEventListener('afterprint', done)
    const timer = window.setTimeout(() => window.print(), 120)
    return () => {
      document.body.classList.remove('printing-student-cards')
      window.removeEventListener('afterprint', done)
      window.clearTimeout(timer)
    }
  }, [printing])

  const cards = visible.map((s) => (
    <div className="student-id-card" key={s.id}>
      <div className="student-id-card-head">Kartu Portal Santri</div>
      <div className="student-id-card-body">
        <CardAvatar student={s} />
        <div className="student-id-card-info">
          <div className="student-id-card-name">{s.name}</div>
          <div className="student-id-card-meta">
            {s.classes?.name ?? '—'}
            {s.gender ? ` · ${GENDER_LABEL[s.gender]}` : ''}
          </div>
          <div className="student-id-card-code">{formatCode(s.registration_code)}</div>
          <div className={`student-id-card-pin${s.pin ? '' : ' is-missing'}`}>
            PIN: {s.pin ?? 'belum diatur'}
          </div>
        </div>
        <div className="student-id-card-qr">
          <QRCodeCanvas
            value={checkUrl(s)}
            size={168}
            level="M"
            style={{ width: '14.6mm', height: '14.6mm', display: 'block' }}
          />
        </div>
      </div>
      <div className="student-id-card-foot">Scan untuk masuk portal wali · laporanmu</div>
    </div>
  ))

  return (
    <AppModal
      open={open}
      onCancel={onClose}
      width={760}
      title="Kartu Portal Santri"
      subtitle="Berisi kode registrasi, PIN, dan QR untuk masuk portal wali"
      icon={<IdcardOutlined />}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Ukuran kartu asli 85,6 × 54 mm (ID-1) — tersusun 10 kartu per lembar A4, siap potong
          </Typography.Text>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={onClose}>Tutup</Button>
            <Button
              type="primary"
              icon={<PrinterOutlined />}
              disabled={visible.length === 0}
              onClick={() => {
                message.info('Gunakan kertas A4 & margin "Default" pada dialog cetak')
                setPrinting(true)
              }}
            >
              Cetak
            </Button>
          </div>
        </div>
      }
    >
      {overflow > 0 && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12, borderRadius: 10 }}
          message={`Menampilkan ${MAX_CARDS} kartu pertama dari ${students.length} siswa`}
          description="Pilih lebih sedikit siswa untuk mencetak semuanya."
        />
      )}

      {students.length === 1 && visible[0] && (
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
          {visible[0].pin ? (
            <Popconfirm
              title="Buat ulang PIN?"
              description="PIN lama berhenti berlaku — kartu yang sudah tercetak harus dicetak ulang."
              okText="Buat Ulang"
              cancelText="Batal"
              onConfirm={() => handleGenerate([visible[0]])}
            >
              <Button icon={<KeyOutlined />} loading={generatePins.isPending}>
                Buat Ulang PIN
              </Button>
            </Popconfirm>
          ) : (
            <Button
              type="primary"
              ghost
              icon={<KeyOutlined />}
              loading={generatePins.isPending}
              onClick={() => handleGenerate([visible[0]])}
            >
              Buat PIN
            </Button>
          )}
        </div>
      )}

      {missingPin > 0 && students.length > 1 && (
        <Alert
          type="warning"
          showIcon
          icon={<KeyOutlined />}
          style={{ marginBottom: 12, borderRadius: 10 }}
          message={`${missingPin} siswa belum memiliki PIN`}
          description={
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span>Wali memakai PIN untuk masuk ke portal — buat PIN sebelum kartu dibagikan.</span>
              <Button
                size="small"
                type="primary"
                ghost
                icon={<KeyOutlined />}
                loading={generatePins.isPending}
                onClick={() => handleGenerate(missingPinStudents)}
              >
                Buat PIN untuk {missingPin} siswa
              </Button>
            </div>
          }
        />
      )}

      {hasPinCount > 0 && students.length > 1 && (
        <div style={{ marginBottom: 12, textAlign: 'right' }}>
          <Popconfirm
            title="Buat ulang semua PIN?"
            description={`${hasPinCount} PIN yang sudah ada akan diganti — kartu tercetak harus dicetak ulang.`}
            okText="Buat Ulang Semua"
            cancelText="Batal"
            onConfirm={() => handleGenerate(visible)}
          >
            <Button size="small" icon={<KeyOutlined />} loading={generatePins.isPending}>
              Buat Ulang Semua PIN ({hasPinCount})
            </Button>
          </Popconfirm>
        </div>
      )}

      <div className="student-card-print-root">{cards}</div>

      {printing && createPortal(<div className="student-card-print-root is-printing">{cards}</div>, document.body)}
    </AppModal>
  )
}
