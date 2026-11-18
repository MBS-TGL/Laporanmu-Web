import { Card, Empty, Progress, Space, Spin, Tag, Typography } from 'antd'
import { StarFilled } from '@ant-design/icons'
import { useFlag } from '../../../shared/hooks/useFeatureFlags'
import { useStudentWorshipProgress } from '../../worship/hooks'
import { WORSHIP_CATEGORY_LABEL } from '../../worship/types'

/**
 * Seksi rekap kemahiran ibadah santri (P3) di DetailDrawer — tab Perilaku.
 * Menampilkan capaian bintang dan butir terampil per kategori ibadah.
 */
export function StudentWorshipRecap({ studentId }: { studentId: string }) {
  const enabled = useFlag('module.spiritual', true)
  const { data: categories = [], isPending } = useStudentWorshipProgress(enabled ? studentId : undefined)

  if (!enabled) return null

  const totalItems = categories.reduce((sum, c) => sum + c.totalItems, 0)
  const totalMastered = categories.reduce((sum, c) => sum + c.masteredCount, 0)
  const percent = totalItems > 0 ? Math.round((totalMastered / totalItems) * 100) : 0

  return (
    <Card
      size="small"
      style={{ marginTop: 16, borderRadius: 13 }}
      styles={{ body: { padding: '12px 16px' } }}
      title={
        <Space size={8} style={{ width: '100%', justifyContent: 'space-between' }}>
          <Typography.Text strong style={{ fontSize: 13 }}>
            <StarFilled style={{ color: '#f59e0b', marginInlineEnd: 6 }} />
            Kemahiran Ibadah Santri
          </Typography.Text>
          <Tag color={percent === 100 ? 'gold' : percent >= 70 ? 'blue' : 'default'} style={{ borderRadius: 999 }}>
            ★ {totalMastered}/{totalItems} ({percent}%)
          </Tag>
        </Space>
      }
    >
      {isPending ? (
        <div style={{ textAlign: 'center', padding: 16 }}>
          <Spin size="small" />
        </div>
      ) : totalItems === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Belum ada data butir kemahiran ibadah yang diinput"
        />
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {categories.map((cat) => {
            const catPct = cat.totalItems > 0 ? Math.round((cat.masteredCount / cat.totalItems) * 100) : 0
            return (
              <div key={cat.category} style={{ display: 'grid', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <Typography.Text strong>{WORSHIP_CATEGORY_LABEL[cat.category]}</Typography.Text>
                  <Typography.Text type="secondary">
                    {cat.masteredCount} dari {cat.totalItems} butir terampil
                  </Typography.Text>
                </div>
                <Progress
                  percent={catPct}
                  size="small"
                  strokeColor={catPct === 100 ? '#10b981' : '#f59e0b'}
                />
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
