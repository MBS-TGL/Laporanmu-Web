import { Typography, theme } from 'antd'
import { formatRupiah } from '../../finance/sppUtil'

export interface PortalSummary {
  attendancePct: number | null
  points: number
  sppOutstanding: number
}

/**
 * Hero portal: sapaan + identitas santri + tiga ringkasan kunci.
 * Fokus visual per layar ada di sini (persen kehadiran paling besar);
 * angka semuanya nyata dari PortalData (R-17).
 */
export function PortalHeader({
  name,
  className,
  dateLabel,
  greeting,
  summary,
  actions,
  isDesktop,
}: {
  name: string
  className: string | null
  dateLabel: string
  greeting: string
  summary: PortalSummary
  actions: React.ReactNode
  isDesktop: boolean
}) {
  const { token: t } = theme.useToken()

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 14,
        border: `1px solid ${t.colorBorderSecondary}`,
        padding: isDesktop ? '20px 24px' : '16px',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
            {greeting}, {dateLabel}
          </Typography.Text>
          <Typography.Title level={isDesktop ? 3 : 4} style={{ margin: '2px 0 0', letterSpacing: '-0.02em' }}>
            {name}
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            {className ?? 'Tanpa kelas'}
          </Typography.Text>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>{actions}</div>
      </div>

      <div
        style={{
          display: 'grid',
          // Mobile: Tunggakan turun ke baris sendiri agar nominal tidak patah digit
          gridTemplateColumns: isDesktop ? 'repeat(3, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))',
          gap: isDesktop ? 10 : '10px 12px',
          marginTop: isDesktop ? 18 : 14,
          paddingTop: isDesktop ? 16 : 12,
          borderTop: `1px solid ${t.colorBorderSecondary}`,
        }}
      >
        {/* Kehadiran: angka dominan, titik fokus hero */}
        <div>
          <Typography.Text type="secondary" style={{ fontSize: 11.5, display: 'block' }}>
            Kehadiran bulan ini
          </Typography.Text>
          <Typography.Text
            strong
            style={{ fontSize: isDesktop ? 28 : 22, color: t.colorPrimary, fontVariantNumeric: 'tabular-nums', lineHeight: 1.3 }}
          >
            {summary.attendancePct !== null ? `${summary.attendancePct}%` : '-'}
          </Typography.Text>
        </div>
        <div style={{ borderInlineStart: `1px solid ${t.colorBorderSecondary}`, paddingInlineStart: 10 }}>
          <Typography.Text type="secondary" style={{ fontSize: 11.5, display: 'block' }}>
            Poin pelanggaran
          </Typography.Text>
          <Typography.Text
            strong
            style={{
              fontSize: isDesktop ? 28 : 22,
              color: summary.points > 0 ? t.colorWarning : t.colorSuccess,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.3,
            }}
          >
            {summary.points}
          </Typography.Text>
        </div>
        <div
          style={
            isDesktop
              ? { borderInlineStart: `1px solid ${t.colorBorderSecondary}`, paddingInlineStart: 10 }
              : { gridColumn: '1 / -1', borderTop: `1px solid ${t.colorBorderSecondary}`, paddingTop: 10 }
          }
        >
          <Typography.Text type="secondary" style={{ fontSize: 11.5, display: 'block' }}>
            Tunggakan SPP
          </Typography.Text>
          <Typography.Text
            strong
            style={{
              fontSize: isDesktop ? 20 : 18,
              color: summary.sppOutstanding > 0 ? t.colorWarning : t.colorSuccess,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.4,
            }}
          >
            {summary.sppOutstanding > 0 ? formatRupiah(summary.sppOutstanding) : 'Lunas'}
          </Typography.Text>
        </div>
      </div>
    </div>
  )
}
