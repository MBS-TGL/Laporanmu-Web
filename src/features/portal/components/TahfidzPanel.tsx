import { Empty, Tag, Typography, theme } from 'antd'
import { formatDateId } from '../formatDate'
import type { PortalTahfidzItem } from '../api'

const QUALITY_LABEL: Record<string, { label: string; color: string }> = {
  excellent: { label: 'Baik Sekali', color: 'success' },
  good: { label: 'Baik', color: 'processing' },
  needs_work: { label: 'Perlu Dibina', color: 'warning' },
}

/** Setoran tahfidz: rekap ziyadah/murojaah + catatan terbaru. */
export function TahfidzPanel({ items }: { items: PortalTahfidzItem[] }) {
  const { token: t } = theme.useToken()

  if (items.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            Belum ada setoran tahfidz tercatat
          </Typography.Text>
        }
      />
    )
  }

  const ziyadah = items.filter((r) => r.kind === 'ziyadah').length
  const murojaah = items.filter((r) => r.kind === 'murojaah').length

  return (
    <div>
      <Typography.Text type="secondary" style={{ fontSize: 12.5, display: 'block', marginBottom: 10 }}>
        Ziyadah <Typography.Text strong style={{ fontVariantNumeric: 'tabular-nums' }}>{ziyadah}</Typography.Text>
        {' · '}
        Murojaah <Typography.Text strong style={{ fontVariantNumeric: 'tabular-nums' }}>{murojaah}</Typography.Text>
      </Typography.Text>
      <div style={{ display: 'grid', gap: 8 }}>
        {items.map((r, i) => {
          const q = r.quality ? QUALITY_LABEL[r.quality] : null
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '9px 12px',
                borderRadius: 10,
                border: `1px solid ${t.colorBorderSecondary}`,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <Typography.Text strong style={{ display: 'block', fontSize: 13 }}>
                  {r.surah}
                  {r.from_ayat ? ` · ayat ${r.from_ayat}${r.to_ayat ? `–${r.to_ayat}` : ''}` : ''}
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12, textTransform: 'capitalize' }}>
                  {r.kind}
                </Typography.Text>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                {q && <Tag color={q.color} style={{ borderRadius: 6, marginInlineEnd: 0 }}>{q.label}</Tag>}
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {formatDateId(r.recorded_at)}
                </Typography.Text>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
