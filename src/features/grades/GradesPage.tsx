import { useMemo, useState } from 'react'
import {
  Button,
  Card,
  Empty,
  Input,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  theme,
  type TableColumnsType,
} from 'antd'
import {
  BookOutlined,
  EditOutlined,
  SearchOutlined,
  SettingOutlined,
  TableOutlined,
} from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../shared/components/PageHeader'
import { ShellItem, ShellStagger } from '../../shared/components/ShellMotion'
import { StatChip } from '../../shared/components/StatChip'
import { useAcademicYearsBrief } from '../classes/hooks'
import { usePermissions } from '../../shared/hooks/useProfile'
import { useTablePagination } from '../../shared/hooks/useTablePagination'
import { useClassSubjectsBrief, useGradeConfig } from './hooks'
import { ConfigModal } from './components/ConfigModal'
import { DEFAULT_WEIGHT, type ClassSubjectInfo } from './types'
import { LegerPage } from './LegerPage'
import { useUrlTab } from '../../shared/hooks/useUrlTab'

function GradesTab({ onNavigateTab }: { onNavigateTab: (tab: string) => void }) {
  const { token } = theme.useToken()
  const { canWrite } = usePermissions()

  const yearsQuery = useAcademicYearsBrief()
  const activeYear = useMemo(
    () => yearsQuery.data?.find((y) => y.is_active) ?? yearsQuery.data?.[0],
    [yearsQuery.data],
  )
  const [selectedYearId, setSelectedYearId] = useState<string | undefined>()
  const effectiveYearId = selectedYearId ?? activeYear?.id

  const [search, setSearch] = useState('')
  const [gradeFilter, setGradeFilter] = useState<string | undefined>()
  const [configOpen, setConfigOpen] = useState(false)

  const csQuery = useClassSubjectsBrief(effectiveYearId)
  const configQuery = useGradeConfig(effectiveYearId)
  const bobot = configQuery.data?.bobot ?? DEFAULT_WEIGHT

  const allRows = csQuery.data ?? []

  const gradeOptions = useMemo(() => {
    const grades = new Set<string>()
    for (const r of allRows) {
      if (r.classes?.grade) grades.add(String(r.classes.grade))
    }
    return [...grades].sort((a, b) => Number(a) - Number(b)).map((g) => ({
      value: g,
      label: `Tingkat ${g}`,
    }))
  }, [allRows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allRows.filter((r) => {
      if (gradeFilter && String(r.classes?.grade) !== gradeFilter) return false
      if (!q) return true
      const text = `${r.classes?.name ?? ''} ${r.subjects?.name ?? ''} ${r.subjects?.code ?? ''} ${r.teachers?.name ?? ''}`.toLowerCase()
      return text.includes(q)
    })
  }, [allRows, search, gradeFilter])

  const pg = useTablePagination(filtered.length, { label: 'mapel kelas', defaultPageSize: 15 })

  const counts = useMemo(() => {
    return {
      total: allRows.length,
      withTeacher: allRows.filter((r) => r.teacher_id).length,
      withoutTeacher: allRows.filter((r) => !r.teacher_id).length,
    }
  }, [allRows])

  const columns: TableColumnsType<ClassSubjectInfo> = [
    {
      title: 'Kelas',
      key: 'class',
      width: 140,
      render: (_, r) => (
        <div>
          <span style={{ fontWeight: 600 }}>{r.classes?.name ?? '—'}</span>
          {r.classes?.grade && (
            <Tag style={{ marginLeft: 6, fontSize: 11 }}>Tingkat {r.classes.grade}</Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Mata Pelajaran',
      key: 'subject',
      render: (_, r) => (
        <div>
          <span style={{ fontWeight: 500 }}>{r.subjects?.name ?? '—'}</span>
          {r.subjects?.code && (
            <Tag style={{ marginLeft: 6, fontSize: 11 }}>{r.subjects.code}</Tag>
          )}
          <div style={{ fontSize: 11.5, color: token.colorTextTertiary }}>
            {r.subjects?.weekly_hours ?? 0} JP/minggu
          </div>
        </div>
      ),
    },
    {
      title: 'Guru Pengampu',
      key: 'teacher',
      render: (_, r) =>
        r.teachers?.name ? (
          <span>{r.teachers.name}</span>
        ) : (
          <Tag color="warning">Belum ditentukan</Tag>
        ),
    },
    {
      title: 'KKM',
      key: 'kkm',
      width: 80,
      align: 'center',
      render: (_, r) => {
        const kkm = r.kkm_override ?? r.subjects?.kkm ?? 50
        const isOverride = r.kkm_override !== null && r.kkm_override !== undefined
        return (
          <Tooltip title={isOverride ? 'KKM kustom kelas ini' : 'KKM standar mapel'}>
            <span style={{ fontWeight: isOverride ? 700 : 400 }}>{kkm}</span>
            {isOverride && <Tag color="blue" style={{ marginLeft: 4, fontSize: 10 }}>kustom</Tag>}
          </Tooltip>
        )
      },
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 160,
      align: 'right',
      render: (_, r) => (
        <Space size={4}>
          <Link to={`/grades/${r.id}`}>
            <Button size="small" type="primary" icon={<EditOutlined />}>
              Input Nilai
            </Button>
          </Link>
        </Space>
      ),
    },
  ]

  const currentYearName =
    yearsQuery.data?.find((y) => y.id === effectiveYearId)?.name ?? '—'

  return (
    <div>
      <PageHeader
        title="Penilaian Akademik"
        subtitle={`Input dan pantau nilai formatif, sumatif, PTS, dan PAS per mapel.`}
        extra={
          <Space wrap>
            <Select
              style={{ width: 170 }}
              value={effectiveYearId}
              onChange={setSelectedYearId}
              loading={yearsQuery.isPending}
              options={(yearsQuery.data ?? []).map((y) => ({
                value: y.id,
                label: `${y.name}${y.is_active ? ' (Aktif)' : ''}`,
              }))}
            />
            <Button icon={<TableOutlined />} onClick={() => onNavigateTab('leger')}>Leger Nilai</Button>
            {canWrite && (
              <Button
                icon={<SettingOutlined />}
                onClick={() => setConfigOpen(true)}
              >
                Bobot Nilai
              </Button>
            )}
          </Space>
        }
      />

      {/* Info bobot aktif */}
      <div
        style={{
          marginBottom: 14,
          padding: '8px 14px',
          background: token.colorBgContainer,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 8,
          fontSize: 12.5,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <span>
          Bobot nilai {currentYearName}: <b>Formatif {bobot.formatif}%</b> ·{' '}
          <b>Sumatif {bobot.sumatif}%</b> · <b>PTS {bobot.pts}%</b> · <b>PAS {bobot.pas}%</b>
        </span>
        <span style={{ color: token.colorTextTertiary }}>
          Nilai akhir dihitung otomatis saat generate ke rapor semester
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <StatChip
          icon={<BookOutlined />}
          label="Total Mapel Kelas"
          value={counts.total}
          color="indigo"
          loading={csQuery.isPending}
        />
        <StatChip
          icon={<BookOutlined />}
          label="Ada Guru"
          value={counts.withTeacher}
          color="emerald"
          loading={csQuery.isPending}
        />
        <StatChip
          icon={<BookOutlined />}
          label="Belum Ada Guru"
          value={counts.withoutTeacher}
          color={counts.withoutTeacher > 0 ? 'rose' : 'slate'}
          loading={csQuery.isPending}
        />
      </div>

      <Card>
        <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          <Input
            placeholder="Cari kelas, mapel, atau guru…"
            prefix={<SearchOutlined />}
            allowClear
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: '1 1 240px', minWidth: 200 }}
          />
          <Select
            placeholder="Semua tingkat"
            allowClear
            style={{ width: 140 }}
            value={gradeFilter}
            onChange={setGradeFilter}
            options={gradeOptions}
          />
        </div>

        <Table<ClassSubjectInfo>
          rowKey="id"
          size="middle"
          columns={columns}
          dataSource={filtered}
          loading={csQuery.isPending}
          pagination={pg.pagination}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  allRows.length === 0
                    ? 'Belum ada mapel di kelas untuk tahun ajaran ini — tambahkan di Data Kelas'
                    : 'Tidak ada mapel yang cocok dengan pencarian'
                }
              />
            ),
          }}
          scroll={{ x: true }}
        />
      </Card>

      <ConfigModal
        open={configOpen}
        academicYearId={effectiveYearId}
        academicYearName={currentYearName}
        onClose={() => setConfigOpen(false)}
      />
    </div>
  )
}

// ─── Shell: satu halaman Penilaian bertab (pola ?tab= — SKILLS.md §Skill 2) ─
const GRADE_TAB_ITEMS = [
  { key: 'nilai', label: 'Nilai Kelas' },
  { key: 'leger', label: 'Leger' },
]

/** Halaman Penilaian: input nilai per kelas-mapel dan leger dalam satu route (?tab=). */
export function GradesPage() {
  const { tab, setTab } = useUrlTab('nilai')

  return (
    <ShellStagger>
      <ShellItem>
        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={GRADE_TAB_ITEMS.map((t) => ({
            ...t,
            children: t.key === 'leger' ? <LegerPage /> : <GradesTab onNavigateTab={setTab} />,
          }))}
        />
      </ShellItem>
    </ShellStagger>
  )
}
