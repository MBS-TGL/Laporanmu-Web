import { Button, Card, Col, Empty, Progress, Row, Typography } from 'antd'
import { EditOutlined, PrinterOutlined } from '@ant-design/icons'

export interface ClassProgressItem {
  id: string
  name: string
  musyrif: string | null
  total: number
  complete: number
  /** Rata-rata kelas (nilai rata-rata semua santri yang terisi), null bila belum ada data */
  avg: number | null
}

interface ClassGridProps {
  loading: boolean
  items: ClassProgressItem[]
  onInput: (classId: string) => void
  onPreview: (classId: string) => void
}

const skeletonRows = [1, 2, 3]

/** Kartu progres per kelas: tuntas/total, rata-rata kelas, aksi Input & Preview. */
export function ClassGrid({ loading, items, onInput, onPreview }: ClassGridProps) {
  if (loading) {
    return (
      <Row gutter={[16, 16]}>
        {skeletonRows.map((i) => (
          <Col key={i} xs={24} sm={12} lg={8}>
            <Card loading />
          </Col>
        ))}
      </Row>
    )
  }
  if (items.length === 0) {
    return <Empty description="Belum ada kelas aktif. Tambahkan kelas dulu di Master Data." />
  }
  return (
    <Row gutter={[16, 16]}>
      {items.map((item) => {
        const pct = item.total > 0 ? Math.round((item.complete / item.total) * 100) : 0
        const done = pct === 100
        return (
          <Col key={item.id} xs={24} sm={12} lg={8}>
            <Card
              styles={{ body: { padding: '16px 18px' } }}
              actions={[
                <Button key="input" type="link" icon={<EditOutlined />} onClick={() => onInput(item.id)}>
                  Input Nilai
                </Button>,
                <Button key="preview" type="text" icon={<PrinterOutlined />} onClick={() => onPreview(item.id)}>
                  Preview
                </Button>,
              ]}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <Typography.Text strong style={{ fontSize: 15 }}>
                    {item.name}
                  </Typography.Text>
                  <Typography.Paragraph type="secondary" style={{ fontSize: 12, margin: '2px 0 0' }}>
                    {item.musyrif ?? 'Tanpa wali kelas'} · {item.total} santri
                  </Typography.Paragraph>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <Typography.Text strong style={{ fontSize: 18, color: done ? '#10b981' : undefined, fontVariantNumeric: 'tabular-nums' }}>
                    {item.complete}/{item.total}
                  </Typography.Text>
                  {item.avg !== null && (
                    <div style={{ fontSize: 11, color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                      rata-rata {item.avg}
                    </div>
                  )}
                </div>
              </div>
              <Progress
                percent={pct}
                size="small"
                strokeColor={done ? '#10b981' : pct > 0 ? '#6366f1' : '#e2e8f0'}
                style={{ marginTop: 10, marginBottom: 0 }}
              />
            </Card>
          </Col>
        )
      })}
    </Row>
  )
}
