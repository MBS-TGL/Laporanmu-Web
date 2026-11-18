import { Tag, Typography, theme } from 'antd'
import { formatDateId } from '../formatDate'
import type { PortalPointItem } from '../api'

/** Poin & catatan perilaku: catatan terbaru, poin positif = pelanggaran. */
export function PointsPanel({
  total,
  recent,
}: {
  total: number
  recent: PortalPointItem[]
}) {
  const { token: t } = theme.useToken()

  if (recent.length === 0) {
    return (
      <div>
        <Typography.Text style={{ fontSize: 13, color: t.colorSuccess, display: 'block', marginBottom: 4 }}>
          Poin 0, tidak ada catatan pelanggaran
        </Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
          Catatan perilaku dari pembina akan tampil di sini.
        </Typography.Text>
      </div>
    )
  }

  return (
    <div>
      <Typography.Text type="secondary" style={{ fontSize: 12.5, display: 'block', marginBottom: 10 }}>
        Total poin <Typography.Text strong style={{ fontVariantNumeric: 'tabular-nums', color: total > 0 ? t.colorWarning : t.colorSuccess }}>{total}</Typography.Text>
      </Typography.Text>
      <div style={{ display: 'grid', gap: 8 }}>
        {recent.map((p, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              padding: '9px 12px',
              borderRadius: 10,
              border: `1px solid ${t.colorBorderSecondary}`,
            }}
          >
            <Tag
              color={p.points > 0 ? 'error' : 'success'}
              style={{ borderRadius: 6, marginInlineEnd: 0, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}
            >
              {p.points > 0 ? `+${p.points}` : p.points}
            </Tag>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Typography.Text strong style={{ display: 'block', fontSize: 13 }}>
                {p.rule}
              </Typography.Text>
              {p.notes && (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {p.notes}
                </Typography.Text>
              )}
            </div>
            <Typography.Text type="secondary" style={{ fontSize: 12, flexShrink: 0 }}>
              {formatDateId(p.reported_at)}
            </Typography.Text>
          </div>
        ))}
      </div>
    </div>
  )
}
