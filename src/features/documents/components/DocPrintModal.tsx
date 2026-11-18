import { useEffect, useState, type ReactNode } from 'react'
import { Button, theme } from 'antd'
import { PrinterOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { fetchSchoolSettings } from '../../report-cards/api'

/**
 * Modal cetak dokumen P4 dengan kop sekolah (school_settings) — sheet
 * hitam-putih ala surat resmi. CSS cetak: `.docs-print-area` di index.css.
 */
export function DocPrintModal({
  open,
  onClose,
  title,
  subtitle,
  footerNote,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  footerNote?: ReactNode
  children: ReactNode
}) {
  const { token } = theme.useToken()
  const [settings, setSettings] = useState<{
    school_name: string
    school_address: string | null
    headmaster_name: string | null
  } | null>(null)

  useEffect(() => {
    if (!open) return
    let active = true
    fetchSchoolSettings()
      .then((s) => {
        if (!active) return
        setSettings({
          school_name: s.school_name,
          school_address: s.school_address ?? null,
          headmaster_name: s.headmaster_name ?? null,
        })
      })
      .catch(() => {
        if (active) setSettings(null)
      })
    return () => {
      active = false
    }
  }, [open])

  return (
    <AppModal
      title={title}
      subtitle={subtitle}
      icon={<PrinterOutlined />}
      open={open}
      onCancel={onClose}
      width={860}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose}>Batal</Button>
          <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>
            Cetak
          </Button>
        </div>
      }
    >
      {/* Kop + konten cetak (hitam-putih untuk kebutuhan dokumen resmi) */}
      <div className="docs-print-area" style={{ background: '#fff', color: '#0f172a' }}>
        <div style={{ textAlign: 'center', borderBottom: '3px double #000', paddingBottom: 10, marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '0.02em' }}>
            {settings?.school_name ?? 'SEKOLAH'}
          </div>
          <div style={{ fontSize: 11.5 }}>{settings?.school_address ?? ''}</div>
        </div>
        <div style={{ textAlign: 'center', fontWeight: 800, marginBottom: 4 }}>{title}</div>
        {subtitle && (
          <div style={{ textAlign: 'center', fontSize: 11.5, marginBottom: 14 }}>{subtitle}</div>
        )}
        {children}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24, fontSize: 11.5 }}>
          <div style={{ textAlign: 'center', minWidth: 200 }}>
            <div>Mengetahui,</div>
            <div>Kepala Madrasah</div>
            <div style={{ height: 56 }} />
            <div style={{ fontWeight: 700, textDecoration: 'underline' }}>
              {settings?.headmaster_name ?? '..............................'}
            </div>
          </div>
        </div>
        {footerNote && <div style={{ fontSize: 10, color: '#475569', marginTop: 16 }}>{footerNote}</div>}
      </div>
      <span style={{ display: 'none' }}>{token.colorPrimary}</span>
    </AppModal>
  )
}
