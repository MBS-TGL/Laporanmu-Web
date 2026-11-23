import { Alert, Button, Card, Col, Progress, Row, Space, Tag, Typography, theme } from 'antd'
import {
  AlertOutlined,
  CalendarOutlined,
  CommentOutlined,
  UserAddOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useFlag } from '../../../shared/hooks/useFeatureFlags'
import { formatRupiah } from '../../finance/sppUtil'

export interface DashboardOps {
  attendance_today: { hadir: number; total: number }
  spp_month: { collected: number; outstanding: number }
  arrears_top: { student_id: string; name: string; class_name: string | null; outstanding: number }[]
  ppdb_pipeline: Record<string, number>
  counseling_urgent: number
}

const STAGE_LABEL: Record<string, string> = {
  registered: 'Terdaftar',
  selection: 'Seleksi',
  accepted: 'Diterima',
  rejected: 'Ditolak',
  enrolled: 'Daftar Ulang',
}

async function fetchDashboardOps(): Promise<DashboardOps> {
  const { data, error } = await supabase.rpc('dashboard_ops')
  if (error) throw error
  return data as DashboardOps
}

/**
 * Widget operasional harian: kehadiran, SPP, tunggakan, PPDB, dan BK.
 * Satu RPC agregat (dashboard_ops) mengikuti pola admin_table_stats.
 */
export function OpsWidgets() {
  const { token } = theme.useToken()
  const navigate = useNavigate()
  const financeEnabled = useFlag('module.finance_spp', true)
  const ppdbEnabled = useFlag('module.ppdb', true)
  const counselingEnabled = useFlag('module.counseling', true)

  const query = useQuery({
    queryKey: ['dashboard', 'ops'],
    queryFn: fetchDashboardOps,
    staleTime: 60_000,
    retry: 1,
  })

  if (query.isError) {
    return (
      <Alert
        type="warning"
        showIcon
        message="Ringkasan operasional gagal dimuat"
        description={(query.error as Error).message}
        action={
          <Button size="small" onClick={() => void query.refetch()}>
            Coba lagi
          </Button>
        }
      />
    )
  }

  const data = query.data
  const pending = query.isPending

  const attendancePct =
    data && data.attendance_today.total > 0
      ? Math.round((data.attendance_today.hadir / data.attendance_today.total) * 100)
      : 0

  const ppdbEntries = Object.entries(data?.ppdb_pipeline ?? {})

  return (
    <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
      <Col xs={24} md={12} xl={financeEnabled ? 6 : 8}>
        <Card title={<Space size={6}><CalendarOutlined /> Kehadiran Hari Ini</Space>} loading={pending}>
          {data && data.attendance_today.total > 0 ? (
            <>
              <Typography.Text strong style={{ fontSize: 22, fontVariantNumeric: 'tabular-nums' }}>
                {data.attendance_today.hadir}
              </Typography.Text>
              <Typography.Text type="secondary"> dari {data.attendance_today.total} santri</Typography.Text>
              <Progress
                percent={attendancePct}
                size="small"
                strokeColor={attendancePct >= 90 ? token.colorSuccess : token.colorWarning}
              />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {attendancePct}% tercatat hadir hari ini
              </Typography.Text>
            </>
          ) : (
            <Typography.Text type="secondary">Belum ada absensi tercatat hari ini</Typography.Text>
          )}
          <div style={{ marginTop: 8 }}>
            <Button type="link" size="small" onClick={() => navigate('/attendance?tab=students&view=rekap')}>
              Isi absensi
            </Button>
          </div>
        </Card>
      </Col>

      {financeEnabled && (
        <Col xs={24} md={12} xl={6}>
          <Card title={<Space size={6}><WalletOutlined /> SPP Bulan Ini</Space>} loading={pending}>
            {data ? (
              <>
                <Typography.Text strong style={{ fontSize: 22, fontVariantNumeric: 'tabular-nums' }}>
                  {formatRupiah(data.spp_month.collected)}
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                  terkumpul bulan ini
                </Typography.Text>
                <Tag color={data.spp_month.outstanding > 0 ? 'orange' : 'green'} style={{ marginTop: 8 }}>
                  Tunggakan {formatRupiah(data.spp_month.outstanding)}
                </Tag>
                <div style={{ marginTop: 8 }}>
                  <Button type="link" size="small" onClick={() => navigate('/finance?tab=arrears')}>
                    Lihat tunggakan
                  </Button>
                </div>
              </>
            ) : null}
          </Card>
        </Col>
      )}

      {ppdbEnabled && (
        <Col xs={24} md={12} xl={6}>
          <Card title={<Space size={6}><UserAddOutlined /> PPDB</Space>} loading={pending}>
            {ppdbEntries.length === 0 ? (
              <Typography.Text type="secondary">Belum ada pendaftar</Typography.Text>
            ) : (
              <Space size={[6, 6]} wrap>
                {ppdbEntries.map(([stage, count]) => (
                  <Tag key={stage} color={stage === 'accepted' ? 'green' : stage === 'rejected' ? 'red' : 'blue'}>
                    {STAGE_LABEL[stage] ?? stage}: {count}
                  </Tag>
                ))}
              </Space>
            )}
            <div style={{ marginTop: 8 }}>
              <Button type="link" size="small" onClick={() => navigate('/admissions')}>
                Buka PPDB
              </Button>
            </div>
          </Card>
        </Col>
      )}

      {counselingEnabled && (
        <Col xs={24} md={12} xl={6}>
          <Card title={<Space size={6}><CommentOutlined /> BK Perlu Perhatian</Space>} loading={pending}>
            <Typography.Text strong style={{ fontSize: 22, fontVariantNumeric: 'tabular-nums' }}>
              {data?.counseling_urgent ?? 0}
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
              sesi urgensi tinggi yang masih proses
            </Typography.Text>
            {(data?.counseling_urgent ?? 0) > 0 ? (
              <Tag color="red" style={{ marginTop: 8 }}>
                <AlertOutlined /> Perlu tindak lanjut
              </Tag>
            ) : (
              <Tag color="green" style={{ marginTop: 8 }}>Tidak ada yang tertunda</Tag>
            )}
            <div style={{ marginTop: 8 }}>
              <Button type="link" size="small" onClick={() => navigate('/counseling')}>
                Buka BK
              </Button>
            </div>
          </Card>
        </Col>
      )}

      {financeEnabled && (
        <Col xs={24}>
          <Card title="Tunggakan Teratas" loading={pending}>
            {!data || data.arrears_top.length === 0 ? (
              <Typography.Text type="secondary">Tidak ada tunggakan aktif</Typography.Text>
            ) : (
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                {data.arrears_top.map((row) => (
                  <div
                    key={row.student_id}
                    style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}
                  >
                    <span>
                      {row.name}
                      {row.class_name ? (
                        <Typography.Text type="secondary" style={{ fontSize: 12, marginLeft: 6 }}>
                          {row.class_name}
                        </Typography.Text>
                      ) : null}
                    </span>
                    <Typography.Text strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatRupiah(row.outstanding)}
                    </Typography.Text>
                  </div>
                ))}
              </Space>
            )}
            <div style={{ marginTop: 8 }}>
              <Button type="link" size="small" onClick={() => navigate('/finance?tab=arrears')}>
                Semua tunggakan
              </Button>
            </div>
          </Card>
        </Col>
      )}
    </Row>
  )
}
