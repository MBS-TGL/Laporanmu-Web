import { useEffect, useState } from 'react'
import { App, Input, Space, Switch, Tag, Typography } from 'antd'
import { WhatsAppOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { ModalNotice } from '../../../shared/components/ModalNotice'
import { usePermissions } from '../../../shared/hooks/useProfile'
import { useUpdateWaSettings, useWaSettingsStatus } from '../hooks'

interface GatewayModalProps {
  open: boolean
  onClose: () => void
}

/** Pengaturan token Fonnte untuk broadcast WA — token tidak pernah dibaca ulang ke browser */
export function GatewayModal({ open, onClose }: GatewayModalProps) {
  const { message } = App.useApp()
  const { canDelete } = usePermissions() // kredensial akun → developer/admin saja
  const statusQuery = useWaSettingsStatus()
  const updateMutation = useUpdateWaSettings()

  const [token, setToken] = useState('')
  const [senderName, setSenderName] = useState('')
  const [autoViolation, setAutoViolation] = useState(false)
  const [autoBk, setAutoBk] = useState(false)
  const [autoSavings, setAutoSavings] = useState(false)
  const [autoSpp, setAutoSpp] = useState(false)
  const [autoCbt, setAutoCbt] = useState(false)
  const [autoAbsenMapel, setAutoAbsenMapel] = useState(false)
  const [autoRohani, setAutoRohani] = useState(false)

  // Prefill nama pengirim & toggle saat data status pertama kali terbaca
  const [prevStatusLoaded, setPrevStatusLoaded] = useState(false)
  const status = statusQuery.data
  if (status && !prevStatusLoaded) {
    setPrevStatusLoaded(true)
    setSenderName(status.sender_name ?? '')
    setAutoViolation(status.auto_violation_wa)
    setAutoBk(status.auto_bk_wa)
    setAutoSavings(status.auto_savings_wa)
    setAutoSpp(status.auto_spp_wa)
    setAutoCbt(status.auto_cbt_wa)
    setAutoAbsenMapel(status.auto_absen_mapel_wa)
    setAutoRohani(status.auto_rohani_wa)
  }

  // Reset field token tiap kali modal dibuka — token lama tidak pernah ditampilkan
  useEffect(() => {
    if (open) setToken('')
  }, [open])

  const configured = status?.configured ?? false

  const handleSave = () => {
    if (!token.trim() && !configured) {
      message.warning('Tempel token Fonnte terlebih dahulu')
      return
    }
    updateMutation.mutate(
      { token, senderName, autoViolation, autoBk, autoSavings, autoSpp, autoCbt, autoAbsenMapel, autoRohani },
      {
        onSuccess: () => {
          message.success('Pengaturan WA disimpan')
          setToken('')
          onClose()
        },
        onError: (err: Error) =>
          message.error(err.message || 'Gagal menyimpan pengaturan, pastikan role developer/admin'),
      },
    )
  }

  return (
    <AppModal
      open={open}
      onCancel={onClose}
      width={520}
      title="Pengaturan WA (Fonnte)"
      subtitle="Token device untuk broadcast WhatsApp ke wali santri"
      icon={<WhatsAppOutlined />}
      okText="Simpan"
      okButtonProps={{ loading: updateMutation.isPending, disabled: !canDelete }}
      onOk={handleSave}
    >
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        <ModalNotice
          tone={configured ? 'success' : 'warning'}
          title={configured ? 'Token Fonnte terpasang, broadcast siap digunakan' : 'Token belum diatur, broadcast WA dinonaktifkan'}
        >
          {configured
            ? 'Biarkan kolom token kosong untuk tetap memakai token yang tersimpan.'
            : 'Isi token untuk mengaktifkan pengiriman broadcast.'}
        </ModalNotice>

        <div>
          <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
            Token Fonnte
          </Typography.Text>
          <Input.Password
            placeholder="Tempel token dari dashboard fonnte.com → Device → Token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="new-password"
          />
          <Typography.Paragraph type="secondary" style={{ fontSize: 12, margin: '6px 0 0' }}>
            Token tersimpan di database internal dan <strong>tidak pernah dikirim ke browser</strong>:{' '}
            pengiriman lewat Edge Function. Device WhatsApp harus tetap online di fonnte.com.
          </Typography.Paragraph>
        </div>

        <div>
          <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
            Nama pengirim <Tag style={{ borderRadius: 6, fontSize: 11 }}>opsional</Tag>
          </Typography.Text>
          <Input
            placeholder="mis. Pengasuhan Laporanmu"
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            maxLength={40}
          />
        </div>

        <div>
          <Typography.Text strong style={{ display: 'block', marginBottom: 10 }}>
            WA otomatis (fire-and-forget ke nomor siswa)
          </Typography.Text>
          <Space direction="vertical" size={14} style={{ width: '100%' }}>
            <AutoWaRow
              title="Saat pelanggaran dicatat"
              description="Wali menerima WA segera setelah poin pelanggaran tersimpan."
              checked={autoViolation}
              disabled={!configured || !canDelete}
              onChange={setAutoViolation}
            />
            <AutoWaRow
              title="Saat surat resmi BK diterbitkan"
              description="Memuat nomor surat dan tautan verifikasi QR yang sama dengan kop surat."
              checked={autoBk}
              disabled={!configured || !canDelete}
              onChange={setAutoBk}
            />
            <AutoWaRow
              title="Saat mutasi tabungan"
              description="Setoran/penarikan beserta saldo akhir setelah dicatat petugas kas."
              checked={autoSavings}
              disabled={!configured || !canDelete}
              onChange={setAutoSavings}
            />
            <AutoWaRow
              title="Saat pembayaran SPP dicatat"
              description="Konfirmasi pembayaran: komponen, nominal, dan sisa tagihan."
              checked={autoSpp}
              disabled={!configured || !canDelete}
              onChange={setAutoSpp}
            />
            <AutoWaRow
              title="Saat nilai ujian difinalisasi"
              description="Nilai CBT dikirim ke wali setelah grading selesai."
              checked={autoCbt}
              disabled={!configured || !canDelete}
              onChange={setAutoCbt}
            />
            <AutoWaRow
              title="Saat santri alpa jam pelajaran"
              description="Per jam pelajaran tanpa keterangan, maksimal 1 pesan per santri per hari."
              checked={autoAbsenMapel}
              disabled={!configured || !canDelete}
              onChange={setAutoAbsenMapel}
            />
            <AutoWaRow
              title="Saat butir ibadah dikuasai"
              description="Kemahiran wudhu, sholat, hafalan hadist, dan doa (modul Ibadah)."
              checked={autoRohani}
              disabled={!configured || !canDelete}
              onChange={setAutoRohani}
            />
          </Space>
        </div>

        {!canDelete && (
          <ModalNotice tone="info" title="Hanya developer/admin yang dapat mengubah token" />
        )}
      </Space>
    </AppModal>
  )
}

/** Baris toggle WA otomatis: judul + deskripsi kiri, switch kanan. */
function AutoWaRow({
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  title: string
  description: string
  checked: boolean
  disabled: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
      <div>
        <Typography.Text strong style={{ display: 'block', marginBottom: 4 }}>
          {title}
        </Typography.Text>
        <Typography.Paragraph type="secondary" style={{ fontSize: 12, margin: 0 }}>
          {description}
        </Typography.Paragraph>
      </div>
      <Switch checked={checked} disabled={disabled} onChange={onChange} />
    </div>
  )
}
