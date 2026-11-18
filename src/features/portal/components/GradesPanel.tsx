import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Empty, Segmented, Table, Tag, Typography, theme } from 'antd'
import { formatDateId } from '../formatDate'
import dayjs from 'dayjs'
import type { PortalGradeItem } from '../api'
import { swapVariants, swapTransition } from '../../../shared/motion'
import { useTablePagination } from '../../../shared/hooks/useTablePagination'

const GRADE_TYPE_LABEL: Record<string, string> = {
  formatif: 'Formatif',
  sumatif: 'Sumatif',
  pts: 'PTS',
  pas: 'PAS',
}

/** Nilai terbaru: filter jenis + rata-rata; tabel di desktop, kartu di mobile. */
export function GradesPanel({ grades, isDesktop }: { grades: PortalGradeItem[]; isDesktop: boolean }) {
  const { token: t } = theme.useToken()
  const [filter, setFilter] = useState<string>('all')

  const types = useMemo(() => [...new Set(grades.map((g) => g.type))], [grades])
  const filtered = filter === 'all' ? grades : grades.filter((g) => g.type === filter)

  // Rata-rata tertimbang (score/max_score) hanya dari nilai yang sudah keluar
  const scored = filtered.filter((g) => g.score !== null)
  const avg =
    scored.length > 0
      ? Math.round((scored.reduce((acc, g) => acc + (g.score as number) / g.max_score, 0) / scored.length) * 100)
      : null

  if (grades.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            Belum ada nilai yang dibagikan guru
          </Typography.Text>
        }
      />
    )
  }

  const filterNode = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      {/* Bungkus scroll-x: Segmented AntD nowrap, amankan di layar sempit (R-03) */}
      <div style={{ maxWidth: '100%', overflowX: 'auto', paddingBottom: 2 }}>
        <Segmented
          value={filter}
          onChange={(v) => setFilter(String(v))}
          options={[
            { label: 'Semua', value: 'all' },
            ...types.map((ty) => ({ label: GRADE_TYPE_LABEL[ty] ?? ty, value: ty })),
          ]}
        />
      </div>
      {avg !== null && (
        <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
          Rata-rata <Typography.Text strong style={{ fontVariantNumeric: 'tabular-nums', color: t.colorPrimary }}>{avg}</Typography.Text>
        </Typography.Text>
      )}
    </div>
  )

  return (
    <div>
      {filterNode}
      {/* Remount per filter (pola InsightsPage): entrance saja tanpa AnimatePresence —
          mode="wait" bisa macet bila animasi exit terganggu dan konten lama tertahan */}
      <motion.div key={filter} variants={swapVariants} initial="initial" animate="animate" transition={swapTransition}>
        {isDesktop ? <GradesTable rows={filtered} /> : <GradesCards rows={filtered} />}
      </motion.div>
    </div>
  )
}

function scoreColor(pct: number, token: ReturnType<typeof theme.useToken>['token']): string {
  if (pct >= 85) return token.colorSuccess
  if (pct >= 70) return token.colorPrimary
  if (pct >= 60) return token.colorWarning
  return token.colorError
}

function GradesTable({ rows }: { rows: PortalGradeItem[] }) {
  const { token: t } = theme.useToken()
  const pg = useTablePagination(rows.length, { defaultPageSize: 8, hideOnSinglePage: true })
  return (
    <Table
      rowKey={(_, i) => {
        const idx = i ?? 0
        return `${rows[idx]?.subject}-${rows[idx]?.title}-${idx}`
      }}
      size="small"
      pagination={pg.pagination}
      dataSource={rows}
      columns={[
        {
          title: 'Tanggal',
          dataIndex: 'date',
          width: 80,
          render: (v: string | null) => (v ? dayjs(v).format('DD/MM') : '-'),
        },
        { title: 'Mapel', dataIndex: 'subject', render: (v: string | null) => v ?? '-' },
        {
          title: 'Jenis',
          dataIndex: 'type',
          width: 90,
          render: (v: string) => <Tag style={{ borderRadius: 6, marginInlineEnd: 0 }}>{GRADE_TYPE_LABEL[v] ?? v}</Tag>,
        },
        {
          title: 'Nilai',
          key: 'score',
          width: 110,
          align: 'right',
          render: (_: unknown, r: PortalGradeItem) => {
            if (r.score === null) return <Typography.Text type="secondary">Belum keluar</Typography.Text>
            const pct = Math.round((r.score / r.max_score) * 100)
            return (
              <Typography.Text strong style={{ fontVariantNumeric: 'tabular-nums', color: scoreColor(pct, t) }}>
                {r.score} <Typography.Text type="secondary" style={{ fontSize: 12 }}>/ {r.max_score}</Typography.Text>
              </Typography.Text>
            )
          },
        },
      ]}
    />
  )
}

function GradesCards({ rows }: { rows: PortalGradeItem[] }) {
  const { token: t } = theme.useToken()
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {rows.map((r, i) => {
        const pct = r.score !== null ? Math.round((r.score / r.max_score) * 100) : null
        return (
          <div
            key={`${r.subject}-${r.title}-${i}`}
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              borderRadius: 10,
              border: `1px solid ${t.colorBorderSecondary}`,
              background: '#fff',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <Typography.Text strong style={{ display: 'block', fontSize: 13.5 }}>
                {r.subject ?? '-'}
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {GRADE_TYPE_LABEL[r.type] ?? r.type}
                {r.date ? ` · ${formatDateId(r.date)}` : ''}
              </Typography.Text>
            </div>
            {r.score === null ? (
              <Typography.Text type="secondary" style={{ fontSize: 12, flexShrink: 0 }}>
                Belum keluar
              </Typography.Text>
            ) : (
              <Typography.Text
                strong
                style={{ fontSize: 16, flexShrink: 0, fontVariantNumeric: 'tabular-nums', color: scoreColor(pct as number, t) }}
              >
                {r.score}
                <Typography.Text type="secondary" style={{ fontSize: 11.5, fontWeight: 400 }}>
                  {' '}
                  / {r.max_score}
                </Typography.Text>
              </Typography.Text>
            )}
          </div>
        )
      })}
    </div>
  )
}
