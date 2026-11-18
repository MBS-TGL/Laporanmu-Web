import { Empty, Progress, Space, Tag, Typography, theme } from 'antd'
import { StarFilled } from '@ant-design/icons'
import { useStudentWorshipProgress } from '../../worship/hooks'
import { WORSHIP_CATEGORY_LABEL } from '../../worship/types'

/**
 * Panel Kemahiran Ibadah di Dashboard Portal Santri (/portal).
 * Menampilkan ringkasan butir terampil per kategori (Wudhu, Sholat, Hadist, Doa).
 */
export function WorshipPanel({ studentId }: { studentId: string }) {
  const { token: t } = theme.useToken()
  const { data: categories = [], isPending } = useStudentWorshipProgress(studentId)

  const totalItems = categories.reduce((sum, c) => sum + c.totalItems, 0)
  const totalMastered = categories.reduce((sum, c) => sum + c.masteredCount, 0)

  if (isPending) {
    return (
      <div style={{ padding: '16px 0', textAlign: 'center' }}>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          Memuat capaian ibadah...
        </Typography.Text>
      </div>
    )
  }

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
                <Space size={4}>
                  <Typography.Text style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                    ★ {cat.masteredCount}/{cat.totalItems}
                  </Typography.Text>
                </Space>
              </div>
              <Progress
                percent={pct}
                size="small"
                strokeColor={pct === 100 ? '#10b981' : '#f59e0b'}
                showInfo={false}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
