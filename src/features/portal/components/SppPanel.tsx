import { Empty, Typography, theme } from 'antd'
import dayjs from 'dayjs'
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import { formatRupiah } from '../../finance/sppUtil'
import { formatDateId } from '../formatDate'
import type { PortalSppItem } from '../api'

/** SPP & tagihan: bar proporsi terbayar vs total + daftar tagihan. */
export function SppPanel({
  items,
  totalDue,
  totalPaid,
}: {
  items: PortalSppItem[]
  totalDue: number
  totalPaid: number
}) {
  const { token: t } = theme.useToken()
  const outstanding = totalDue - totalPaid
  const paidPct = totalDue > 0 ? Math.min(100, Math.round((totalPaid / totalDue) * 100)) : 100

  return (
    <div>
      {/* Ringkasan proporsi terbayar: bar satu warna semantik, bukan dekorasi */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Typography.Text strong style={{ fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>
            {formatRupiah(totalPaid)}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
            dari {formatRupiah(totalDue)}
          </Typography.Text>
        </div>
        <div
          style={{
            height: 8,
            borderRadius: 999,
            background: t.colorFillSecondary,
            marginTop: 6,
            overflow: 'hidden',
          }}
          role="progressbar"
          aria-valuenow={paidPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Terbayar ${paidPct}% dari total tagihan`}
        >
          <div
            style={{
              width: `${paidPct}%`,
              height: '100%',
              borderRadius: 999,
              background: outstanding > 0 ? t.colorWarning : t.colorSuccess,
              transition: 'width 0.2s',
            }}
          />
        </div>
        <Typography.Text
          style={{ fontSize: 12, marginTop: 6, display: 'block', color: outstanding > 0 ? t.colorWarning : t.colorSuccess }}
        >
          {outstanding > 0 ? `Tunggakan ${formatRupiah(outstanding)}` : 'Semua tagihan lunas'}
        </Typography.Text>
      </div>

      {items.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              Belum ada tagihan SPP
            </Typography.Text>
          }
        />
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {items.map((b, i) => {
            const itemOutstanding = b.amount - b.paid
            const overdue = itemOutstanding > 0 && b.due_date && dayjs(b.due_date).isBefore(dayjs(), 'day')
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
                  border: `1px solid ${overdue ? t.colorWarningBorder : t.colorBorderSecondary}`,
                  background: overdue ? t.colorWarningBg : '#fff',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <Typography.Text strong style={{ display: 'block', fontSize: 13 }}>
                    {b.component}
                    {b.period ? ` · ${b.period}` : ''}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {formatRupiah(b.amount)}
                    {b.due_date ? ` · jatuh tempo ${formatDateId(b.due_date, true)}` : ''}
                  </Typography.Text>
                </div>
                {itemOutstanding <= 0 ? (
                  <Typography.Text style={{ fontSize: 12, color: t.colorSuccess, flexShrink: 0 }}>
                    <CheckCircleOutlined /> Lunas
                  </Typography.Text>
                ) : (
                  <Typography.Text style={{ fontSize: 12, color: t.colorWarning, flexShrink: 0 }}>
                    <CloseCircleOutlined /> Kurang {formatRupiah(itemOutstanding)}
                  </Typography.Text>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
