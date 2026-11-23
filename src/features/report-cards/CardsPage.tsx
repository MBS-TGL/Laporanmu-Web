import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Card,
  Empty,
  Input,
  Segmented,
  Select,
  Skeleton,
  Space,
  Tag,
  Tooltip,
  Typography,
  theme,
} from 'antd'
import {
  ArrowLeftOutlined,
  BookOutlined,
  CheckCircleOutlined,
  CheckOutlined,
  CloseOutlined,
  EditOutlined,
  HistoryOutlined,
  PrinterOutlined,
  RiseOutlined,
  SearchOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../shared/components/PageHeader'
import { ShellItem, ShellStagger } from '../../shared/components/ShellMotion'
import { StatChip } from '../../shared/components/StatChip'
import {
  BULANAN_CRITERIA,
  isComplete,
  MONTH_NAMES,
  REPORT_CARD_TYPE_LABEL,
  SEMESTER_LABEL,
  calcAverage,
  SEMESTER_KKM,
} from './constants'
import { useAllMonthlyRows, useAllSemesterRows, useAllStudentClasses, useReportCardClasses } from './hooks'
import { useAcademicYearsBrief } from '../classes/hooks'
import { ArchivePage } from './ArchivePage'
import { useUrlTab } from '../../shared/hooks/useUrlTab'
import type { ReportCardType, SemesterType } from './types'

type Mode = 'monthly' | 'semester'
type Program = 'all' | 'boarding' | 'reguler'

type ClassItem = {
  id: string
  name: string
  musyrif: string | null
  total: number
  complete: number
  avg: number | null
}

const LAST_OPENED_KEY = 'raport:last-opened'

type LastOpened = {
  path: string
  className: string
  periodLabel: string
  ts: number
}

function readLastOpened(): LastOpened | null {
  try {
    const raw = localStorage.getItem(LAST_OPENED_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<LastOpened>
    if (
      typeof value.path !== 'string' ||
      typeof value.className !== 'string' ||
      typeof value.periodLabel !== 'string'
    ) {
      return null
    }
    return {
      path: value.path,
      className: value.className,
      periodLabel: value.periodLabel,
      ts: typeof value.ts === 'number' ? value.ts : 0,
    }
  } catch {
    return null
  }
}

function saveLastOpened(value: LastOpened) {
  try {
    localStorage.setItem(LAST_OPENED_KEY, JSON.stringify(value))
  } catch {
    // localStorage bisa diblokir; banner hanya fitur bantu.
  }
}

function clearLastOpened() {
  try {
    localStorage.removeItem(LAST_OPENED_KEY)
  } catch {
    // Sama seperti save: abaikan bila storage tidak tersedia.
  }
}

// ─── Util: pengelompokan kelas (diambil dari nama kelas) ───
const gradeOf = (name: string) => Number(name.match(/^\d+/)?.[0] ?? 99)
const genderOf = (name: string): 'Putra' | 'Putri' | 'Lainnya' =>
  /putri/i.test(name) ? 'Putri' : /putra/i.test(name) ? 'Putra' : 'Lainnya'

function ReportCardsTab() {
  const navigate = useNavigate()
  const { token } = theme.useToken()
  const [searchParams, setSearchParams] = useSearchParams()
  const [defaults] = useState(() => ({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  }))
  const [mode, setMode] = useState<Mode>(() =>
    searchParams.get('mode') === 'semester' ? 'semester' : 'monthly',
  )
  const [month, setMonth] = useState(() => {
    const value = Number(searchParams.get('month'))
    return value >= 1 && value <= 12 ? value : defaults.month
  })
  const [year, setYear] = useState(() => Number(searchParams.get('year')) || defaults.year)
  const [semesterType, setSemesterType] = useState<SemesterType>(() => {
    const value = searchParams.get('semesterType')
    const valid = (Object.keys(REPORT_CARD_TYPE_LABEL) as ReportCardType[]).filter(
      (key) => key !== 'monthly',
    )
    return value && (valid as string[]).includes(value) ? (value as SemesterType) : 'general'
  })
  const [semester, setSemester] = useState<1 | 2>(() =>
    searchParams.get('semester') === '2' ? 2 : 1,
  )
  const [ayState, setAy] = useState(() => searchParams.get('ay') ?? '')
  const [search, setSearch] = useState('')
  const [program, setProgram] = useState<Program>(() => {
    const value = searchParams.get('program')
    return value === 'boarding' || value === 'reguler' ? value : 'all'
  })
  const [lastOpened, setLastOpened] = useState<LastOpened | null>(readLastOpened)

  const classesQuery = useReportCardClasses()
  const studentClassesQuery = useAllStudentClasses()
  const monthlyQuery = useAllMonthlyRows()
  const semesterQuery = useAllSemesterRows(semesterType)
  const yearsQuery = useAcademicYearsBrief()

  // Default tahun ajaran semester = tahun ajaran aktif (bukan tebakan dari kelas pertama)
  const activeYear = (yearsQuery.data ?? []).find((y) => y.is_active)
  const ay = ayState || activeYear?.id || ''
  const ayName = (yearsQuery.data ?? []).find((y) => y.id === ay)?.name

  useEffect(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        const setOrDelete = (key: string, value: string, fallback: string) => {
          if (value === fallback) next.delete(key)
          else next.set(key, value)
        }
        setOrDelete('mode', mode, 'monthly')
        setOrDelete('month', String(month), String(defaults.month))
        setOrDelete('year', String(year), String(defaults.year))
        setOrDelete('semesterType', semesterType, 'general')
        setOrDelete('semester', String(semester), '1')
        if (!ay || ay === (activeYear?.id ?? '')) next.delete('ay')
        else next.set('ay', ay)
        setOrDelete('program', program, 'all')
        return next.toString() === prev.toString() ? prev : next
      },
      { replace: true, preventScrollReset: true },
    )
  }, [
    mode,
    month,
    year,
    semesterType,
    semester,
    ay,
    program,
    activeYear?.id,
    defaults,
    setSearchParams,
  ])

  const classes = useMemo(() => classesQuery.data ?? [], [classesQuery.data])
  const studentClasses = useMemo(() => studentClassesQuery.data ?? [], [studentClassesQuery.data])
  const studentClassMap = useMemo(
    () => new Map(studentClasses.map((s) => [s.id, s.class_id])),
    [studentClasses],
  )
  const classIds = useMemo(() => new Set(classes.map((c) => c.id)), [classes])
  const studentsInClass = useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of studentClasses) {
      if (!s.class_id || !classIds.has(s.class_id)) continue
      counts.set(s.class_id, (counts.get(s.class_id) ?? 0) + 1)
    }
    return counts
  }, [studentClasses, classIds])

  // Rata-rata kelas = rata-rata dari rata-rata tiap santri yang sudah punya nilai
  const classAverage = (
    rows: Record<string, number | null>[],
    type: ReportCardType,
    grade: string | null,
  ): number | null => {
    const avgs = rows
      .map((r) => calcAverage(type, r, grade))
      .filter((v): v is number => v !== null)
    if (avgs.length === 0) return null
    return Math.round((avgs.reduce((a, b) => a + b, 0) / avgs.length) * 100) / 100
  }

  const monthlyItems = useMemo<ClassItem[]>(() => {
    const rowsByClass = new Map<string, Record<string, number | null>[]>()
    for (const row of monthlyQuery.data ?? []) {
      const classId = studentClassMap.get(row.student_id)
      if (!classId) continue
      const list = rowsByClass.get(classId) ?? []
      list.push({
        character_score: row.character_score,
        worship_score: row.worship_score,
        cleanliness_score: row.cleanliness_score,
        quran_score: row.quran_score,
        language_score: row.language_score,
      })
      rowsByClass.set(classId, list)
    }
    return classes.map((c) => {
      const rows = rowsByClass.get(c.id) ?? []
      const complete = rows.filter((r) =>
        BULANAN_CRITERIA.every((k) => typeof r[k.key] === 'number'),
      ).length
      return {
        id: c.id,
        name: c.name,
        musyrif: c.homeroom_teacher?.name ?? null,
        total: studentsInClass.get(c.id) ?? 0,
        complete,
        avg: classAverage(rows, 'monthly', null),
      }
    })
  }, [monthlyQuery.data, studentClassMap, classes, studentsInClass])

  const semesterItems = useMemo<ClassItem[]>(() => {
    const rowsByClass = new Map<string, Record<string, number | null>[]>()
    for (const row of semesterQuery.data ?? []) {
      if (row.semester !== semester) continue
      if (ay && row.academic_year_id !== ay) continue
      const classId = studentClassMap.get(row.student_id)
      if (!classId) continue
      const list = rowsByClass.get(classId) ?? []
      list.push(row.scores ?? {})
      rowsByClass.set(classId, list)
    }
    return classes.map((c) => {
      const grade = c.grade ?? null
      const rows = rowsByClass.get(c.id) ?? []
      const complete = rows.filter((r) => isComplete(semesterType, r, grade)).length
      return {
        id: c.id,
        name: c.name,
        musyrif: c.homeroom_teacher?.name ?? null,
        total: studentsInClass.get(c.id) ?? 0,
        complete,
        avg: classAverage(rows, semesterType, grade),
      }
    })
  }, [semesterQuery.data, studentClassMap, classes, studentsInClass, semester, semesterType, ay])

  const isMonthly = mode === 'monthly'

  const semesterParams = () => {
    const sp = new URLSearchParams({ type: semesterType, semester: String(semester) })
    if (ay) sp.set('ay', ay)
    return sp.toString()
  }

  const openClass = (item: ClassItem) => {
    const path = isMonthly
      ? `/report-cards/input/${item.id}?type=monthly&month=${month}&year=${year}`
      : `/report-cards/input/${item.id}?${semesterParams()}`
    const entry: LastOpened = {
      path,
      className: item.name,
      periodLabel: isMonthly
        ? `${MONTH_NAMES[month - 1]} ${year}`
        : `${SEMESTER_LABEL[semester]} · ${ayName ?? 'tahun ajaran aktif'}`,
      ts: Date.now(),
    }
    saveLastOpened(entry)
    setLastOpened(entry)
    navigate(path)
  }

  const previewClass = (classId: string) => {
    navigate(
      isMonthly
        ? `/report-cards/preview/${classId}?type=monthly&month=${month}&year=${year}`
        : `/report-cards/preview/${classId}?${semesterParams()}`,
    )
  }

  const items = isMonthly ? monthlyItems : semesterItems
  const loading =
    classesQuery.isPending || (isMonthly ? monthlyQuery.isPending : semesterQuery.isPending)

  const hint = isMonthly
    ? `Skala 1–9 · ${BULANAN_CRITERIA.length} kriteria`
    : `Skala 0–100 · KKM ${SEMESTER_KKM} · ${activeYear?.name ?? 'tahun ajaran aktif'}`

  // Filter + kelompok Putra/Putri, urut berdasarkan tingkat lalu nama
  const groups = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = items.filter((c) => {
      if (program === 'boarding' && !/boarding/i.test(c.name)) return false
      if (program === 'reguler' && !/reguler/i.test(c.name)) return false
      if (!q) return true
      return c.name.toLowerCase().includes(q) || (c.musyrif ?? '').toLowerCase().includes(q)
    })
    const sorted = [...filtered].sort(
      (a, b) => gradeOf(a.name) - gradeOf(b.name) || a.name.localeCompare(b.name),
    )
    return (['Putra', 'Putri', 'Lainnya'] as const)
      .map((g) => ({ label: g, list: sorted.filter((c) => genderOf(c.name) === g) }))
      .filter((g) => g.list.length > 0)
  }, [items, search, program])

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {/* Periode + ringkasan dalam satu baris */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <Space wrap size={12} align="center">
          <Segmented<Mode>
            value={mode}
            onChange={setMode}
            options={[
              { value: 'monthly', label: 'Bulanan' },
              { value: 'semester', label: 'Semester' },
            ]}
            aria-label="Pilih jenis raport"
          />

          {isMonthly ? (
            <>
              <Select
                style={{ minWidth: 140 }}
                value={month}
                onChange={setMonth}
                options={MONTH_NAMES.map((m, i) => ({ value: i + 1, label: m }))}
                aria-label="Pilih bulan"
              />
              <Select
                style={{ minWidth: 100 }}
                value={year}
                onChange={setYear}
                options={[year - 1, year, year + 1].map((y) => ({ value: y, label: String(y) }))}
                aria-label="Pilih tahun"
              />
            </>
          ) : (
            <>
              <Select
                style={{ minWidth: 170 }}
                value={semesterType}
                onChange={(v) => setSemesterType(v as SemesterType)}
                options={(Object.entries(REPORT_CARD_TYPE_LABEL) as [ReportCardType, string][])
                  .filter(([k]) => k !== 'monthly')
                  .map(([value, label]) => ({ value, label }))}
                aria-label="Pilih jenis raport semester"
              />
              <Select
                style={{ minWidth: 170 }}
                value={semester}
                onChange={(v) => setSemester(v as 1 | 2)}
                options={[
                  { value: 1, label: 'Semester 1 (Ganjil)' },
                  { value: 2, label: 'Semester 2 (Genap)' },
                ]}
                aria-label="Pilih semester"
              />
              <Select
                style={{ minWidth: 140 }}
                value={ay || undefined}
                onChange={setAy}
                placeholder="Tahun ajaran"
                loading={yearsQuery.isPending}
                options={(yearsQuery.data ?? []).map((y) => ({ value: y.id, label: y.name }))}
                aria-label="Pilih tahun ajaran"
              />
            </>
          )}
        </Space>

        <SummaryStrip items={items} />
      </div>

      {lastOpened && items.some((item) => item.name === lastOpened.className) ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            padding: '8px 12px',
            background: token.colorFillQuaternary,
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: token.borderRadiusLG,
          }}
        >
          <Typography.Text ellipsis style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
            Lanjutkan: <Typography.Text strong>{lastOpened.className}</Typography.Text> ·{' '}
            {lastOpened.periodLabel}
          </Typography.Text>
          <Space size={6}>
            <Button size="small" onClick={() => navigate(lastOpened.path)}>
              Buka
            </Button>
            <Tooltip title="Tutup">
              <Button
                size="small"
                type="text"
                icon={<CloseOutlined />}
                aria-label="Tutup lanjutan"
                onClick={() => {
                  clearLastOpened()
                  setLastOpened(null)
                }}
              />
            </Tooltip>
          </Space>
        </div>
      ) : null}

      {/* Cari + filter */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <Input
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          prefix={<SearchOutlined />}
          placeholder="Cari kelas atau wali kelas"
          style={{ width: 280, maxWidth: '100%' }}
          aria-label="Cari kelas"
        />
        <Space size={8}>
          {(
            [
              ['all', 'Semua'],
              ['boarding', 'Boarding'],
              ['reguler', 'Reguler'],
            ] as [Program, string][]
          ).map(([key, label]) => (
            <Tag.CheckableTag
              key={key}
              checked={program === key}
              onChange={() => setProgram(key)}
              style={{
                marginInlineEnd: 0,
                height: token.controlHeight,
                display: 'inline-flex',
                alignItems: 'center',
                paddingInline: 14,
                fontSize: token.fontSize,
                lineHeight: 1,
                borderRadius: token.borderRadius,
                border: `1px solid ${program === key ? 'transparent' : token.colorBorder}`,
              }}
            >
              {label}
            </Tag.CheckableTag>
          ))}
        </Space>
        <Typography.Text type="secondary" style={{ fontSize: 12.5, marginLeft: 'auto' }}>
          {hint}
        </Typography.Text>
      </div>

      {/* Daftar kelas */}
      {loading ? (
        <Card>
          <Skeleton active paragraph={{ rows: 6 }} />
        </Card>
      ) : groups.length === 0 ? (
        <Card>
          <Empty description="Tidak ada kelas yang cocok" />
        </Card>
      ) : (
        groups.map((g) => (
          <section key={g.label}>
            <GroupHeader label={`Kelas ${g.label}`} count={g.list.length} />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))',
                gap: 12,
              }}
            >
              {g.list.map((c) => (
                <ClassRow key={c.id} item={c} onInput={openClass} onPreview={previewClass} />
              ))}
            </div>
          </section>
        ))
      )}
    </Space>
  )
}

/** Ringkasan: chip kompak rata kiri (pola sama dengan Data Siswa). */
function SummaryStrip({ items }: { items: Pick<ClassItem, 'id' | 'total' | 'complete'>[] }) {
  const totalComplete = items.reduce((a, b) => a + b.complete, 0)
  const totalStudents = items.reduce((a, b) => a + b.total, 0)
  const pct = totalStudents > 0 ? Math.round((totalComplete / totalStudents) * 100) : 0
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      <StatChip icon={<BookOutlined />} label="Kelas" value={items.length} color="indigo" />
      <StatChip icon={<TeamOutlined />} label="Santri" value={totalStudents} color="sky" />
      <StatChip icon={<CheckCircleOutlined />} label="Tuntas" value={`${totalComplete}/${totalStudents}`} color="emerald" />
      <StatChip icon={<RiseOutlined />} label="Progres" value={`${pct}%`} color="amber" />
    </div>
  )
}

function GroupHeader({ label, count }: { label: string; count: number }) {
  const { token } = theme.useToken()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <Typography.Text strong>{label}</Typography.Text>
      <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
        {count} kelas
      </Typography.Text>
      <div style={{ flex: 1, height: 1, background: token.colorBorderSecondary }} />
    </div>
  )
}

/** Satu kelas = satu baris padat: tingkat, nama + wali, progres, aksi. */
function ClassRow({
  item,
  onInput,
  onPreview,
}: {
  item: ClassItem
  onInput: (item: ClassItem) => void
  onPreview: (id: string) => void
}) {
  const { token } = theme.useToken()
  const pct = item.total > 0 ? Math.round((item.complete / item.total) * 100) : 0
  const done = item.total > 0 && item.complete === item.total
  const running = item.total > 0 && item.complete > 0 && item.complete < item.total
  const grade = item.name.match(/^\d+/)?.[0] ?? '–'

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px 12px',
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
      }}
    >
      <div
        aria-hidden
        style={{
          width: 32,
          height: 32,
          flex: 'none',
          display: 'grid',
          placeItems: 'center',
          fontWeight: 600,
          fontSize: 13,
          borderRadius: token.borderRadius,
          background: token.colorFillQuaternary,
          color: token.colorTextSecondary,
        }}
      >
        {grade}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <Typography.Text strong ellipsis style={{ display: 'block' }}>
          {item.name}
        </Typography.Text>
        <Typography.Text type="secondary" ellipsis style={{ display: 'block', fontSize: 12 }}>
          {item.musyrif ? (
            <>
              {item.musyrif}
              {item.avg !== null ? ` · rata-rata ${item.avg}` : ''}
            </>
          ) : (
            <>
              <span style={{ color: token.colorTextQuaternary }}>—</span>
              {item.avg !== null ? ` · rata-rata ${item.avg}` : ''}
            </>
          )}
        </Typography.Text>
      </div>

      <Space size={6} style={{ flex: 'none' }}>
        <span
          style={{
            fontSize: 12,
            whiteSpace: 'nowrap',
            fontVariantNumeric: 'tabular-nums',
            color: done ? token.colorSuccess : token.colorTextSecondary,
          }}
        >
          {done ? <CheckOutlined aria-hidden style={{ fontSize: 11, marginInlineEnd: 3 }} /> : null}
          {item.complete}/{item.total}
        </span>
        <Button
          type={running ? 'primary' : 'default'}
          size="small"
          icon={<EditOutlined />}
          onClick={() => onInput(item)}
          disabled={item.total === 0}
        >
          Input
        </Button>
        <Tooltip title="Preview & cetak">
          <Button
            size="small"
            icon={<PrinterOutlined />}
            onClick={() => onPreview(item.id)}
            aria-label={`Preview ${item.name}`}
          />
        </Tooltip>
      </Space>

      <div
        role="progressbar"
        aria-label={`Progres ${item.name}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={`${item.complete}/${item.total}`}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 3,
          background: token.colorFillQuaternary,
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: done ? token.colorSuccess : token.colorPrimary,
          }}
        />
      </div>
    </div>
  )
}

/** Halaman Rapor: raport per kelas dan arsip dalam satu route (?tab=). */
export function CardsPage() {
  const { tab, setTab } = useUrlTab('report-cards', {
    legacy: { raport: 'report-cards', arsip: 'archive' },
  })
  const archive = tab === 'archive'

  return (
    <ShellStagger>
      <ShellItem>
        <PageHeader
          title={archive ? 'Arsip Rapor' : 'Rapor'}
          subtitle={
            archive
              ? 'Riwayat rapor per periode'
              : 'Rapor bulanan dan semester per kelas'
          }
          extra={
            archive ? (
              <Button icon={<ArrowLeftOutlined />} onClick={() => setTab('report-cards')}>
                Kembali ke Rapor
              </Button>
            ) : (
              <Button icon={<HistoryOutlined />} onClick={() => setTab('archive')}>
                Riwayat Arsip
              </Button>
            )
          }
        />
      </ShellItem>
      <ShellItem>
        <div key={tab}>{archive ? <ArchivePage /> : <ReportCardsTab />}</div>
      </ShellItem>
    </ShellStagger>
  )
}
