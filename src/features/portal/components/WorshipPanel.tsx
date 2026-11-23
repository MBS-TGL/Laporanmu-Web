import { Empty, Progress, Tag, Typography, theme } from 'antd'
import { StarFilled } from '@ant-design/icons'
import { WORSHIP_CATEGORY_LABEL } from '../../worship/types'
import type { PortalWorshipProgress } from '../api'

/**
 * Panel Kemahiran Ibadah di Dashboard Portal Santri (/portal).
 * Data datang dari RPC portal_data: portal tidak boleh query tabel
 * worship_* langsung karena RLS-nya hanya untuk staf.
 */
export function WorshipPanel({ categories }: { categories: PortalWorshipProgress[] }) {
  const { token: t } = theme.useToken()

  const totalItems = categories.reduce((sum, c) => sum + c.totalItems, 0)
  const totalMastered = categories.reduce((sum, c) => sum + c.masteredCount, 0)

  if (totalItems === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            Belum ada butir pembinaan ibadah yang aktif
          </Typography.Text>
        }
      />
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
          Total Terampil:{' '}
          <Typography.Text strong style={{ fontVariantNumeric: 'tabular-nums' }}>
            {totalMastered} dari {totalItems} butir
          </Typography.Text>
        </Typography.Text>
        <Tag color={totalMastered === totalItems ? 'gold' : 'blue'} style={{ borderRadius: 6, marginInlineEnd: 0 }}>
          <StarFilled style={{ marginInlineEnd: 4, color: '#f59e0b' }} />
          {totalItems > 0 ? Math.round((totalMastered / totalItems) * 100) : 0}%
        </Tag>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {categories.map((cat) => {
          const pct = cat.totalItems > 0 ? Math.round((cat.masteredCount / cat.totalItems) * 100) : 0
          return (
            <div
              key={cat.category}
              style={{
                padding: '9px 12px',
                borderRadius: 10,
                border: `1px solid ${t.colorBorderSecondary}`,
                display: 'grid',
                gap: 4,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography.Text strong style={{ fontSize: 13 }}>
                  {WORSHIP_CATEGORY_LABEL[cat.category]}
                </Typography.Text>
                <Typography.Text style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                  ★ {cat.masteredCount}/{cat.totalItems}
                </Typography.Text>
              </div>
              <Progress
                percent={pct}
                size="small"
                strokeColor={pct === 100 ? t.colorSuccess : t.colorWarning}
                showInfo={false}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
