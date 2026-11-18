import { useMemo } from 'react'
import {
  App,
  Avatar,
  Card,
  Col,
  Drawer,
  Empty,
  Progress,
  Row,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Typography,
  theme,
} from 'antd'
import {
  BookOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FireOutlined,
  StarFilled,
  StarOutlined,
  TrophyOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useQuery } from '@tanstack/react-query'
import { fetchTahfidzByStudent } from '../../halaqah/api'
import {
  useStudentWorshipProgress,
  useStudentMonthlyWorshipScores,
  useUpsertWorshipMastery,
} from '../hooks'
import { maybeSendMasteryWa } from '../waAuto'
import { WORSHIP_CATEGORY_LABEL, type WorshipCategory } from '../types'

interface WorshipDrawerProps {
  open: boolean
  onClose: () => void
  student: { id: string; name: string; class_name?: string } | null
  canWrite?: boolean
}

const QUALITY_COLOR: Record<string, string> = {
  excellent: 'green',
  good: 'blue',
  needs_work: 'orange',
}

const QUALITY_LABEL: Record<string, string> = {
  excellent: 'Sangat Baik',
  good: 'Baik',
  needs_work: 'Perlu Perbaikan',
}

/**
 * Drawer Profil Spiritual Terpadu Santri (P3):
 * Menggabungkan Kemahiran Ibadah (Wudhu, Sholat, Hadist, Doa),
 * Riwayat Setoran Tahfidz (Halaqah), dan Tren Nilai Ibadah Bulanan.
 * Mendukung evaluasi / checklist vertikal langsung per butir.
 */
export function WorshipDrawer({ open, onClose, student, canWrite = true }: WorshipDrawerProps) {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const studentId = student?.id

  const progressQuery = useStudentWorshipProgress(studentId)
  const categories = useMemo(() => progressQuery.data ?? [], [progressQuery.data])

  const tahfidzQuery = useQuery({
    queryKey: ['tahfidz', 'by-student', studentId],
    queryFn: () => fetchTahfidzByStudent(studentId!, 15),
    enabled: Boolean(studentId) && open,
  })
  const tahfidzRecords = useMemo(() => tahfidzQuery.data ?? [], [tahfidzQuery.data])

  const scoresQuery = useStudentMonthlyWorshipScores(studentId)
  const scores = useMemo(() => scoresQuery.data ?? [], [scoresQuery.data])

  // Mutasi untuk evaluasi / checklist langsung di drawer
  const upsertWudhu = useUpsertWorshipMastery('wudhu')
  const upsertSholat = useUpsertWorshipMastery('sholat')
  const upsertHadist = useUpsertWorshipMastery('hafalan_hadist')
  const upsertDoa = useUpsertWorshipMastery('hafalan_doa')

  const toggleMasteryInDrawer = async (
    category: WorshipCategory,
    item: { id: string; label: string; mastered: boolean },
  ) => {
    if (!studentId || !canWrite) return
    const next = !item.mastered
    const mut =
      category === 'wudhu'
        ? upsertWudhu
        : category === 'sholat'
          ? upsertSholat
          : category === 'hafalan_hadist'
            ? upsertHadist
            : upsertDoa

    try {
      await mut.mutateAsync([
        {
          student_id: studentId,
          item_id: item.id,
          mastered: next,
          mastered_at: next ? dayjs().format('YYYY-MM-DD') : null,
          recorded_by: null,
        },
      ])
      void progressQuery.refetch()
      if (next) void maybeSendMasteryWa(studentId, item.id, category, item.label)
      message.success(`Status "${item.label}" diperbarui`)
    } catch (err) {
      message.error((err as Error).message || 'Gagal mengubah status kemahiran')
    }
  }

  // Agregasi capaian
  const totalItems = categories.reduce((s, c) => s + c.totalItems, 0)
  const masteredCount = categories.reduce((s, c) => s + c.masteredCount, 0)
  const overallPct = totalItems > 0 ? Math.round((masteredCount / totalItems) * 100) : 0

  // Status Level Spiritual Gamifikasi
  const levelBadge = useMemo(() => {
    if (overallPct === 100) return { label: 'Mutqin (Tuntas Penuh)', color: token.colorSuccess, icon: <TrophyOutlined /> }
    if (overallPct >= 75) return { label: 'Mumtaz (Sangat Baik)', color: token.colorPrimary, icon: <StarFilled /> }
    if (overallPct >= 50) return { label: 'Jayyid (Berkembang)', color: token.colorInfo, icon: <FireOutlined /> }
    return { label: 'Mubtadi (Pemula)', color: token.colorTextTertiary, icon: <ClockCircleOutlined /> }
  }, [overallPct, token])

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="min(640px, 92vw)"
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar style={{ background: token.colorWarning }} icon={<StarFilled />} size={36} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>
              {student?.name || 'Profil Spiritual Santri'}
            </div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {student?.class_name ? `Kelas ${student.class_name}` : 'Kerohanian & Tahfidz'}
            </Typography.Text>
          </div>
        </div>
      }
    >
      {!student ? (
        <Empty description="Pilih santri untuk melihat profil spiritual" />
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {/* Ringkasan Level & Capaian Bintang */}
          <Card size="small" style={{ borderRadius: 12, border: `1px solid ${token.colorBorderSecondary}`, background: token.colorFillQuaternary }}>
            <Row gutter={[12, 12]} align="middle">
              <Col xs={24} sm={14}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Tag
                    color={levelBadge.color}
                    style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, fontWeight: 600 }}
                  >
                    {levelBadge.icon} {levelBadge.label}
                  </Tag>
                  <Typography.Text strong style={{ fontSize: 14 }}>
                    ★ {masteredCount} / {totalItems} Butir
                  </Typography.Text>
                </div>
                <Progress
                  percent={overallPct}
                  size="small"
                  strokeColor={overallPct === 100 ? token.colorSuccess : token.colorWarning}
                  status={overallPct === 100 ? 'success' : 'active'}
                />
              </Col>
              <Col xs={24} sm={10}>
                <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                  <div>
                    <div style={{ fontSize: 11, color: token.colorTextTertiary }}>Setoran Tahfidz</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: token.colorText }}>
                      {tahfidzQuery.isPending ? '...' : tahfidzRecords.length}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: token.colorTextTertiary }}>Nilai Tercatat</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: token.colorText }}>
                      {scoresQuery.isPending ? '...' : scores.length}
                    </div>
                  </div>
                </div>
              </Col>
            </Row>
          </Card>

          {/* Tab Rincian */}
          <Tabs
            defaultActiveKey="mastery"
            items={[
              {
                key: 'mastery',
                label: (
                  <span>
                    <CheckCircleOutlined /> Kemahiran ({masteredCount}/{totalItems})
                  </span>
                ),
                children: (
                  <div style={{ display: 'grid', gap: 14 }}>
                    {progressQuery.isPending ? (
                      <div style={{ textAlign: 'center', padding: 24 }}>
                        <Spin />
                      </div>
                    ) : (
                      categories.map((cat) => (
                        <Card
                          key={cat.category}
                          size="small"
                          title={
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>{WORSHIP_CATEGORY_LABEL[cat.category]}</span>
                              <Tag color={cat.masteredCount === cat.totalItems && cat.totalItems > 0 ? 'gold' : 'default'}>
                                ★ {cat.masteredCount}/{cat.totalItems}
                              </Tag>
                            </div>
                          }
                          styles={{ body: { padding: '8px 12px' } }}
                        >
                          {cat.items.length === 0 ? (
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                              Belum ada butir materi
                            </Typography.Text>
                          ) : (
                            <div style={{ display: 'grid', gap: 6 }}>
                              {cat.items.map((item) => (
                                <div
                                  key={item.id}
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '6px 8px',
                                    borderRadius: 6,
                                    background: item.mastered ? token.colorWarningBg : 'transparent',
                                    border: `1px solid ${item.mastered ? token.colorWarningBorder : token.colorBorderSecondary}`,
                                  }}
                                >
                                  <Space size={8}>
                                    <button
                                      type="button"
                                      disabled={!canWrite}
                                      onClick={() => void toggleMasteryInDrawer(cat.category, item)}
                                      style={{
                                        border: 'none',
                                        background: 'none',
                                        padding: 0,
                                        cursor: canWrite ? 'pointer' : 'default',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        fontSize: 16,
                                        color: item.mastered ? token.colorWarning : token.colorTextQuaternary,
                                      }}
                                      title={item.mastered ? 'Klik untuk tandai belum terampil' : 'Klik untuk tandai terampil'}
                                    >
                                      {item.mastered ? <StarFilled /> : <StarOutlined />}
                                    </button>
                                    <span style={{ fontSize: 13, fontWeight: item.mastered ? 600 : 400 }}>
                                      {item.label}
                                    </span>
                                  </Space>
                                  {item.mastered && item.mastered_at && (
                                    <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                                      {dayjs(item.mastered_at).format('DD/MM/YYYY')}
                                    </Typography.Text>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </Card>
                      ))
                    )}
                  </div>
                ),
              },
              {
                key: 'tahfidz',
                label: (
                  <span>
                    <BookOutlined /> Riwayat Tahfidz ({tahfidzRecords.length})
                  </span>
                ),
                children: (
                  <div>
                    {tahfidzQuery.isPending ? (
                      <div style={{ textAlign: 'center', padding: 24 }}>
                        <Spin />
                      </div>
                    ) : tahfidzRecords.length === 0 ? (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada riwayat setoran tahfidz" />
                    ) : (
                      <Table
                        size="small"
                        rowKey="id"
                        pagination={{ pageSize: 6, size: 'small' }}
                        dataSource={tahfidzRecords}
                        columns={[
                          {
                            title: 'Tanggal',
                            dataIndex: 'recorded_at',
                            key: 'recorded_at',
                            width: 95,
                            render: (d: string) => dayjs(d).format('DD/MM/YY'),
                          },
                          {
                            title: 'Surah & Ayat',
                            key: 'surah',
                            render: (_, r) => (
                              <div>
                                <Typography.Text strong style={{ fontSize: 12.5 }}>
                                  {r.surah}
                                </Typography.Text>
                                {r.from_ayat && (
                                  <span style={{ fontSize: 11, color: token.colorTextTertiary, display: 'block' }}>
                                    Ayat {r.from_ayat}–{r.to_ayat || r.from_ayat}
                                  </span>
                                )}
                              </div>
                            ),
                          },
                          {
                            title: 'Jenis',
                            dataIndex: 'kind',
                            key: 'kind',
                            width: 90,
                            render: (k: string) => (
                              <Tag color={k === 'ziyadah' ? 'green' : 'blue'} style={{ textTransform: 'capitalize' }}>
                                {k}
                              </Tag>
                            ),
                          },
                          {
                            title: 'Kualitas',
                            dataIndex: 'quality',
                            key: 'quality',
                            width: 110,
                            render: (q: string) =>
                              q ? <Tag color={QUALITY_COLOR[q] || 'default'}>{QUALITY_LABEL[q] || q}</Tag> : '–',
                          },
                        ]}
                      />
                    )}
                  </div>
                ),
              },
              {
                key: 'scores',
                label: (
                  <span>
                    <ClockCircleOutlined /> Riwayat Nilai ({scores.length})
                  </span>
                ),
                children: (
                  <div>
                    {scoresQuery.isPending ? (
                      <div style={{ textAlign: 'center', padding: 24 }}>
                        <Spin />
                      </div>
                    ) : scores.length === 0 ? (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada catatan nilai bulanan" />
                    ) : (
                      <Table
                        size="small"
                        rowKey="id"
                        pagination={{ pageSize: 8, size: 'small' }}
                        dataSource={scores}
                        columns={[
                          {
                            title: 'Periode',
                            key: 'period',
                            render: (_, r) => `${r.year}-${String(r.month).padStart(2, '0')}`,
                          },
                          {
                            title: 'Nilai Angka',
                            dataIndex: 'grade',
                            key: 'grade',
                            render: (g: number) => {
                              const color = g >= 85 ? 'green' : g >= 70 ? 'blue' : g >= 60 ? 'orange' : 'red'
                              return <Tag color={color}>{g}</Tag>
                            },
                          },
                        ]}
                      />
                    )}
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}
    </Drawer>
  )
}
