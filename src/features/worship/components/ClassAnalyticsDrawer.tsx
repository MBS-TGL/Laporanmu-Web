import { useMemo } from 'react'
import {
  Alert,
  Card,
  Col,
  Drawer,
  Empty,
  Progress,
  Row,
  Space,
  Table,
  Typography,
  theme,
} from 'antd'
import {
  BarChartOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import { WORSHIP_CATEGORY_LABEL, type WorshipCategory, type WorshipItem } from '../types'

interface ClassAnalyticsDrawerProps {
  open: boolean
  onClose: () => void
  category: WorshipCategory
  className: string
  items: Array<Pick<WorshipItem, 'id' | 'label'>>
  totalStudents: number
  mastery: Array<{ student_id: string; item_id: string; mastered: boolean }>
}

/**
 * Drawer Analitik Capaian Butir Ibadah Kelas:
 * Menampilkan statistik ketuntasan tiap butir ibadah, diagnosis butir yang
 * paling banyak belum dikuasai (evaluasi pembinaan), dan sebaran kemahiran santri.
 */
export function ClassAnalyticsDrawer({
  open,
  onClose,
  category,
  className,
  items,
  totalStudents,
  mastery,
}: ClassAnalyticsDrawerProps) {
  const { token } = theme.useToken()

  // Hitung jumlah santri terampil per butir
  const itemStats = useMemo(() => {
    const counts = new Map<string, number>()
    for (const m of mastery) {
      if (m.mastered) {
        counts.set(m.item_id, (counts.get(m.item_id) ?? 0) + 1)
      }
    }

    return items.map((item) => {
      const mastered = counts.get(item.id) ?? 0
      const unmastered = Math.max(0, totalStudents - mastered)
      const percent = totalStudents > 0 ? Math.round((mastered / totalStudents) * 100) : 0
      return {
        id: item.id,
        label: item.label,
        mastered,
        unmastered,
        percent,
      }
    }).sort((a, b) => a.percent - b.percent) // Urutkan dari yang persentase tuntasnya paling rendah
  }, [items, mastery, totalStudents])

  // Butir yang memerlukan perhatian khusus (tuntas < 50%)
  const needAttentionItems = useMemo(
    () => itemStats.filter((i) => i.percent < 50),
    [itemStats],
  )

  const overallMasteryAvg = useMemo(() => {
    if (itemStats.length === 0) return 0
    const sum = itemStats.reduce((s, i) => s + i.percent, 0)
    return Math.round(sum / itemStats.length)
  }, [itemStats])

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="min(560px, 92vw)"
      title={
        <Space size={8}>
          <BarChartOutlined style={{ color: token.colorPrimary }} />
          <span>Analisis Capaian Kelas: {className || 'Semua'}</span>
        </Space>
      }
    >
      {items.length === 0 || totalStudents === 0 ? (
        <Empty description="Belum ada data materi atau santri untuk dianalisis" />
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {/* Ringkasan Skor Kelas */}
          <Card size="small" style={{ borderRadius: 12, background: token.colorFillQuaternary, border: `1px solid ${token.colorBorderSecondary}` }}>
            <Row gutter={[12, 12]} align="middle">
              <Col span={12}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Rata-rata Ketuntasan {WORSHIP_CATEGORY_LABEL[category]}
                </Typography.Text>
                <div style={{ fontSize: 24, fontWeight: 700, color: token.colorText }}>
                  {overallMasteryAvg}%
                </div>
              </Col>
              <Col span={12}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Total Santri / Butir Materi
                </Typography.Text>
                <div style={{ fontSize: 18, fontWeight: 600, color: token.colorTextSecondary }}>
                  {totalStudents} Santri · {items.length} Butir
                </div>
              </Col>
            </Row>
          </Card>

          {/* Diagnosis Butir Lemah */}
          {needAttentionItems.length > 0 ? (
            <Alert
              type="warning"
              showIcon
              icon={<ExclamationCircleOutlined />}
              message={`${needAttentionItems.length} Butir Memerlukan Bimbingan Ekstra`}
              description={
                <ul style={{ margin: '6px 0 0', paddingInlineStart: 18, fontSize: 12.5 }}>
                  {needAttentionItems.slice(0, 3).map((item) => (
                    <li key={item.id}>
                      <strong>{item.label}</strong>: baru {item.percent}% santri terampil ({item.unmastered} belum tuntas)
                    </li>
                  ))}
                  {needAttentionItems.length > 3 && (
                    <li>dan {needAttentionItems.length - 3} butir lainnya.</li>
                  )}
                </ul>
              }
            />
          ) : (
            <Alert
              type="success"
              showIcon
              icon={<CheckCircleOutlined />}
              message="Ketuntasan Sangat Baik"
              description={`Seluruh butir materi ${WORSHIP_CATEGORY_LABEL[category]} telah dikuasai oleh lebih dari 50% santri kelas ini.`}
            />
          )}

          {/* Tabel Detail Capaian per Butir */}
          <div>
            <Typography.Text strong style={{ fontSize: 14, display: 'block', marginBottom: 8 }}>
              Rincian Ketuntasan per Butir
            </Typography.Text>
            <Table
              size="small"
              rowKey="id"
              dataSource={itemStats}
              pagination={false}
              columns={[
                {
                  title: 'Materi Butir Ibadah',
                  dataIndex: 'label',
                  key: 'label',
                  render: (label: string, r) => (
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{label}</div>
                      <Progress
                        percent={r.percent}
                        size="small"
                        strokeColor={r.percent >= 80 ? token.colorSuccess : r.percent >= 50 ? token.colorPrimary : token.colorWarning}
                        showInfo={false}
                      />
                    </div>
                  ),
                },
                {
                  title: 'Terampil',
                  key: 'stat',
                  width: 120,
                  align: 'right' as const,
                  render: (_, r) => (
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>
                        {r.mastered}/{totalStudents}
                      </span>
                      <span style={{ fontSize: 11, color: token.colorTextTertiary, display: 'block' }}>
                        ({r.percent}%)
                      </span>
                    </div>
                  ),
                },
              ]}
            />
          </div>
        </div>
      )}
    </Drawer>
  )
}
