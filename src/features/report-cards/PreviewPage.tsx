import { useEffect, useMemo, useRef, useState } from 'react'
import {
  App,
  Button,
  Card,
  Dropdown,
  Empty,
  Grid,
  Input,
  Segmented,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  theme,
  type MenuProps,
  type TableColumnsType,
} from 'antd'
import {
  ArrowLeftOutlined,
  CheckOutlined,
  CompressOutlined,
  DownOutlined,
  DownloadOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  PrinterOutlined,
  SearchOutlined,
  SettingOutlined,
  UserOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../shared/components/PageHeader'
import { ExportModal, type ExportColumn } from '../../shared/export/ExportModal'
import { useAcademicYearsBrief } from '../classes/hooks'
import { SetupBar } from './components/SetupBar'
import {
  calcAverage,
  getCriteria,
  getPredicate,
  isComplete,
  MONTH_NAMES,
  REPORT_CARD_TYPE_LABEL,
} from './constants'
import {
  buildReportNumber,
  buildVerifyUrl,
  toPrintMonthly,
  toPrintSemester,
  toPrintSettings,
  toPrintStudent,
} from './print/adapters'
import { getPrintCriteria, getPrintFlags } from './print/criteria'
import { DEFAULT_REPORT_LABELS } from './print/labels'
import {
  loadLayoutConfig,
  saveLayoutConfig,
  type LayoutConfig,
} from './print/layout'
import { LayoutSettings } from './print/LayoutSettings'
import { PrintCard } from './print/PrintCard'
import { printCards } from './print/printDocument'
import { toV1ReportType } from './print/predicates'
import {
  useMonthlyRows,
  useReportCardClasses,
  useReportCardStudents,
  useSchoolSettings,
  useSemesterRows,
} from './hooks'
import type { ReportCardStudent, ReportCardType, SemesterType } from './types'

type ViewMode = 'card' | 'rekap'
type StatusFilter = 'all' | 'complete' | 'incomplete'

const REPORT_CARD_TYPES = Object.keys(REPORT_CARD_TYPE_LABEL) as ReportCardType[]

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  )
}

function initialsOf(name: string): string {
  const words = name.split(' ').filter(Boolean).slice(0, 2)
  return words.map((word) => word[0]).join('').toUpperCase() || '?'
}

export function PreviewPage() {
  const { message } = App.useApp()
  const { classId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const { token } = theme.useToken()
  const screens = Grid.useBreakpoint()
  const isMobile = screens.md === false

  const [view, setView] = useState<ViewMode>('card')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [zoomMode, setZoomMode] = useState<'fit' | 'custom'>('custom')
  const [fitZoom, setFitZoom] = useState(1)
  const [customZoom, setCustomZoom] = useState(1)
  const [printTarget, setPrintTarget] = useState<'all' | string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [lang, setLang] = useState<'id' | 'ar'>('id')
  const [pageSize, setPageSize] = useState<'a4' | 'f4'>('f4')
  const [signMode, setSignMode] = useState<'basah' | 'qrcode'>('basah')
  const [layoutConfig, setLayoutConfig] = useState<LayoutConfig>(loadLayoutConfig)
  const [layoutOpen, setLayoutOpen] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [panelHeight, setPanelHeight] = useState(640)
  const listRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const panelsRef = useRef<HTMLDivElement>(null)
  const printRef = useRef<HTMLDivElement>(null)

  const PAGE_WIDTH = pageSize === 'f4' ? 813 : 794
  const PAGE_HEIGHT = pageSize === 'f4' ? 1247 : 1123

  const typeRaw = searchParams.get('type')
  const type: ReportCardType =
    typeRaw && (REPORT_CARD_TYPES as string[]).includes(typeRaw)
      ? (typeRaw as ReportCardType)
      : 'monthly'
  const month = Number(searchParams.get('month')) || new Date().getMonth() + 1
  const year = Number(searchParams.get('year')) || new Date().getFullYear()
  const semester = (searchParams.get('semester') === '2' ? 2 : 1) as 1 | 2
  const ay = searchParams.get('ay') ?? ''
  const musyrif = searchParams.get('musyrif') ?? ''

  const classesQuery = useReportCardClasses()
  const classRow = (classesQuery.data ?? []).find((c) => c.id === classId)
  const grade = classRow?.grade ?? null

  const studentsQuery = useReportCardStudents(classId || undefined)
  const students = useMemo(() => studentsQuery.data ?? [], [studentsQuery.data])
  const studentIds = useMemo(() => students.map((s) => s.id), [students])

  const isMonthly = type === 'monthly'
  const monthlyQuery = useMonthlyRows(studentIds, month, year)
  const semesterQuery = useSemesterRows(studentIds, type as SemesterType, semester, ay || undefined)
  const schoolQuery = useSchoolSettings()
  const yearsQuery = useAcademicYearsBrief()
  const yearName = (yearsQuery.data ?? []).find((y) => y.id === ay)?.name

  const monthlyById = useMemo(
    () => new Map((monthlyQuery.data ?? []).map((r) => [r.student_id, r])),
    [monthlyQuery.data],
  )
  const semesterById = useMemo(
    () => new Map((semesterQuery.data ?? []).map((r) => [r.student_id, r])),
    [semesterQuery.data],
  )

  const savedMusyrif =
    (isMonthly
      ? (monthlyQuery.data ?? []).find((r) => r.musyrif_name)?.musyrif_name
      : (semesterQuery.data ?? []).find((r) => r.musyrif_name)?.musyrif_name) ?? null
  const musyrifName = musyrif || savedMusyrif || classRow?.homeroom_teacher?.name || null

  const criteria = getCriteria(type, grade)
  const classNameLabel = classRow?.name ?? '—'
  const period = isMonthly
    ? `${MONTH_NAMES[month - 1]} ${year}`
    : `Semester ${semester} · ${yearName ?? 'Tahun Ajaran'}`

  const scoresByStudent = new Map<string, Record<string, number | null>>()
  for (const student of students) {
    const scores: Record<string, number | null> = {}
    for (const criterion of criteria) {
      scores[criterion.key] = isMonthly
        ? ((monthlyById.get(student.id) as unknown as Record<string, number | null> | undefined)?.[
            criterion.key
          ] ?? null)
        : (semesterById.get(student.id)?.scores?.[criterion.key] ?? null)
    }
    scoresByStudent.set(student.id, scores)
  }
  const completeById = new Map<string, boolean>()
  for (const student of students) {
    completeById.set(student.id, isComplete(type, scoresByStudent.get(student.id) ?? {}, grade))
  }

  const completedCount = students.reduce(
    (count, student) => count + (completeById.get(student.id) ? 1 : 0),
    0,
  )
  const incompleteCount = students.length - completedCount

  const query = search.trim().toLowerCase()
  const filteredStudents = students.filter((student) => {
    const complete = completeById.get(student.id) ?? false
    if (statusFilter === 'complete' && !complete) return false
    if (statusFilter === 'incomplete' && complete) return false
    if (!query) return true
    return (
      student.name.toLowerCase().includes(query) ||
      student.registration_code.toLowerCase().includes(query)
    )
  })

  const selectedStudent =
    filteredStudents.find((student) => student.id === selectedId) ?? filteredStudents[0] ?? null

  const filteredRef = useRef(filteredStudents)
  const selectedRef = useRef(selectedStudent)
  useEffect(() => {
    filteredRef.current = filteredStudents
    selectedRef.current = selectedStudent
  })

  const v1Type = toV1ReportType(type)
  const printCriteria = getPrintCriteria(type, grade)
  const printFlags = getPrintFlags(type)
  const printSettings = toPrintSettings(schoolQuery.data ?? null)
  const reportPrefix =
    printSettings.report_labels.report_number_prefix ?? DEFAULT_REPORT_LABELS.report_number_prefix

  const cardProps = (student: ReportCardStudent) => {
    const studentIndex = students.findIndex((s) => s.id === student.id) + 1
    const payload = isMonthly
      ? toPrintMonthly(monthlyById.get(student.id) ?? null)
      : toPrintSemester(semesterById.get(student.id) ?? null)
    const reportNo = buildReportNumber({
      prefix: reportPrefix,
      className: classNameLabel,
      reportType: v1Type,
      month,
      year,
      semester,
      studentIndex,
    })
    const verifyUrl = buildVerifyUrl({
      studentId: student.id,
      reportNo,
      reportType: v1Type,
      dbReportType: type,
      semester,
      academicYearId: ay,
      appDomain: printSettings.app_domain,
    })
    return {
      student: toPrintStudent(student),
      criteria: printCriteria,
      scores: payload.scores,
      extra: payload.extra,
      settings: printSettings,
      reportType: v1Type,
      flags: printFlags,
      bulan: month,
      year,
      semester,
      academicYear: yearName ?? '',
      className: classNameLabel,
      musyrif: musyrifName,
      lang,
      pageSize,
      studentIndex,
      reportNo,
      verifyUrl,
      signMode,
      layoutConfig,
    }
  }

  const rekapColumns: TableColumnsType<ReportCardStudent> = [
    {
      title: 'No',
      key: 'no',
      width: 50,
      render: (_: unknown, row: ReportCardStudent) => students.indexOf(row) + 1,
    },
    { title: 'Nama', key: 'name', render: (_: unknown, row: ReportCardStudent) => row.name },
    ...criteria.map((criterion) => ({
      title: criterion.label,
      key: criterion.key,
      width: 86,
      render: (_: unknown, row: ReportCardStudent) =>
        scoresByStudent.get(row.id)?.[criterion.key] ?? '—',
    })),
    {
      title: 'Rata-rata',
      key: 'avg',
      width: 90,
      render: (_: unknown, row: ReportCardStudent) => {
        const average = calcAverage(type, scoresByStudent.get(row.id) ?? {}, grade)
        return <Typography.Text strong>{average ?? '—'}</Typography.Text>
      },
    },
    {
      title: 'Predikat',
      key: 'pred',
      width: 130,
      render: (_: unknown, row: ReportCardStudent) =>
        getPredicate(type, calcAverage(type, scoresByStudent.get(row.id) ?? {}, grade)),
    },
  ]

  const exportColumns: ExportColumn<ReportCardStudent>[] = [
    { key: 'no', header: 'No', value: (row) => students.indexOf(row) + 1 },
    { key: 'name', header: 'Nama', value: (row) => row.name },
    ...criteria.map((criterion) => ({
      key: criterion.key,
      header: criterion.label,
      value: (row: ReportCardStudent) => scoresByStudent.get(row.id)?.[criterion.key] ?? '',
    })),
    {
      key: 'avg',
      header: 'Rata-rata',
      value: (row) => calcAverage(type, scoresByStudent.get(row.id) ?? {}, grade) ?? '',
    },
    {
      key: 'pred',
      header: 'Predikat',
      value: (row) =>
        getPredicate(type, calcAverage(type, scoresByStudent.get(row.id) ?? {}, grade)),
    },
  ]

  const backPath = useMemo(() => {
    const sp = new URLSearchParams(searchParams)
    return `/report-cards/input/${classId}?${sp.toString()}`
  }, [searchParams, classId])

  const zoom = zoomMode === 'fit' ? fitZoom : customZoom
  const setZoom = (value: number) => {
    setZoomMode('custom')
    setCustomZoom(Number(Math.max(0.35, Math.min(1.2, value)).toFixed(2)))
  }

  useEffect(() => {
    if (view !== 'card') return
    const element = previewRef.current
    if (!element) return

    const cardWidth = pageSize === 'f4' ? 813 : 794
    const cardHeight = pageSize === 'f4' ? 1247 : 1123
    const updateFit = () => {
      if (!element.clientWidth) return
      // Ruang efektif: kurangi padding panel dan tinggi bar zoom di atas kertas.
      const availableWidth = Math.max(200, element.clientWidth - 32)
      const availableHeight = Math.max(
        240,
        (focusMode ? window.innerHeight : element.clientHeight) - 32 - 56,
      )
      const scale = Math.min(availableWidth / cardWidth, availableHeight / cardHeight)
      const next = Math.min(1, Math.max(0.3, Number(scale.toFixed(3))))
      setFitZoom(next)
    }

    updateFit()
    const observer = new ResizeObserver(updateFit)
    observer.observe(element)
    window.addEventListener('resize', updateFit)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateFit)
    }
  }, [view, isMobile, pageSize, focusMode])

  useEffect(() => {
    if (!focusMode) return
    const handler = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setFocusMode(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [focusMode])

  // Tinggi panel dihitung dari posisi panel sampai dasar viewport, bukan angka tetap,
  // agar sidebar dan area preview selalu mengisi layar tanpa scroll halaman luar.
  useEffect(() => {
    if (view !== 'card' || focusMode) return
    const element = panelsRef.current
    if (!element) return

    const measure = () => {
      const top = element.getBoundingClientRect().top
      // Minimal 680px agar daftar santri punya ruang untuk 10 baris yang nyaman.
      // Pada layar pendek, halaman boleh sedikit scroll daripada baris dipaksa rapat.
      setPanelHeight(Math.max(680, Math.round(window.innerHeight - top - 24)))
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [view, focusMode, isMobile])

  useEffect(() => {
    if (!selectedStudent) return
    const element = listRef.current?.querySelector<HTMLElement>(
      `[data-student-id="${selectedStudent.id}"]`,
    )
    element?.scrollIntoView({ block: 'nearest' })
  }, [selectedStudent])

  useEffect(() => {
    if (view !== 'card') return
    const handler = (event: globalThis.KeyboardEvent) => {
      if (isTypingTarget(event.target)) return
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
      const list = filteredRef.current
      if (list.length === 0) return
      event.preventDefault()
      const currentIndex = Math.max(
        0,
        list.findIndex((student) => student.id === selectedRef.current?.id),
      )
      const nextIndex =
        event.key === 'ArrowDown'
          ? (currentIndex + 1) % list.length
          : (currentIndex - 1 + list.length) % list.length
      setSelectedId(list[nextIndex].id)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [view])

  const printStudents =
    printTarget === 'all'
      ? filteredStudents
      : printTarget
        ? filteredStudents.filter((student) => student.id === printTarget)
        : []

  useEffect(() => {
    if (!printTarget) return
    // Kertas dicetak lewat jendela mandiri dengan CSS-nya sendiri, supaya aturan
    // @page global aplikasi (A4 + margin) tidak menimpa ukuran kertas raport.
    const nodes = printRef.current?.querySelectorAll<HTMLElement>('.raport-card')
    // Buang <style> dari klon: dokumen cetak sudah punya aturannya sendiri.
    const cardsHtml = nodes
      ? Array.from(nodes)
          .map((node) => {
            const clone = node.cloneNode(true) as HTMLElement
            clone.querySelectorAll('style').forEach((el) => el.remove())
            return clone.outerHTML
          })
          .join('')
      : ''
    if (cardsHtml) {
      const title = printTarget === 'all' ? `Rapor Kelas ${classNameLabel}` : 'Rapor'
      const opened = printCards({ cardsHtml, pageSize, title })
      if (!opened) message.warning('Popup diblokir browser. Izinkan popup untuk mencetak.')
    }
    // Reset lewat timer agar tidak setState sinkron di body effect.
    const timer = window.setTimeout(() => setPrintTarget(null), 0)
    return () => window.clearTimeout(timer)
  }, [printTarget, pageSize, classNameLabel, message])

  const handlePrintMenu: MenuProps['onClick'] = ({ key }) => {
    if (key === 'all') {
      if (filteredStudents.length > 0) setPrintTarget('all')
      return
    }
    if (selectedStudent) setPrintTarget(selectedStudent.id)
  }

  const printMenu: MenuProps = {
    items: [
      {
        key: 'current',
        icon: <PrinterOutlined />,
        label: selectedStudent ? `Cetak kartu ini (${selectedStudent.name})` : 'Cetak kartu ini',
        disabled: !selectedStudent,
      },
      {
        key: 'all',
        icon: <PrinterOutlined />,
        label: `Cetak semua kartu (${filteredStudents.length})`,
        disabled: filteredStudents.length === 0,
      },
    ],
    onClick: handlePrintMenu,
  }

  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'Semua' },
    { value: 'complete', label: 'Lengkap' },
    { value: 'incomplete', label: 'Belum' },
  ]

  return (
    <div>
      <PageHeader
        title="Pratinjau & Cetak Rapor"
        subtitle={
          classRow
            ? `Kelas ${classRow.name} · ${period} · ${students.length} santri · ${completedCount} terisi`
            : '...'
        }
        extra={
          <Space wrap>
            <Link to={backPath}>
              <Button icon={<ArrowLeftOutlined />}>Kembali ke Input</Button>
            </Link>
            <Button icon={<DownloadOutlined />} onClick={() => setExportOpen(true)}>
              Ekspor Rekap
            </Button>
            <Dropdown menu={printMenu} trigger={['click']}>
              <Button type="primary" icon={<PrinterOutlined />}>
                Cetak <DownOutlined />
              </Button>
            </Dropdown>
          </Space>
        }
      />

      <div className="no-print">
        <SetupBar
          classId={classId}
          homeroomTeacherName={classRow?.homeroom_teacher?.name ?? null}
        />
      </div>

      {students.length === 0 ? (
        <Card className="no-print">
          <Empty description="Belum ada data untuk periode ini" />
        </Card>
      ) : (
        <>
          <div
            className="no-print"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 10,
              marginBottom: 12,
            }}
          >
            <Segmented<ViewMode>
              value={view}
              onChange={(value) => setView(value)}
              options={[
                { value: 'card', label: 'Kartu Rapor' },
                { value: 'rekap', label: 'Rekapitulasi' },
              ]}
            />
            {view === 'card' && (
              <>
                <Space
                  size={10}
                  wrap
                  style={{
                    padding: '4px 10px',
                    border: `1px solid ${token.colorBorderSecondary}`,
                    borderRadius: token.borderRadiusLG,
                    background: token.colorBgContainer,
                  }}
                >
                  <Space size={6}>
                    <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>
                      Bahasa
                    </Typography.Text>
                    <Segmented<'id' | 'ar'>
                      size="small"
                      value={lang}
                      onChange={(value) => setLang(value)}
                      options={[
                        { value: 'id', label: 'ID' },
                        { value: 'ar', label: 'AR' },
                      ]}
                      aria-label="Bahasa raport"
                    />
                  </Space>
                  <Space size={6}>
                    <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>
                      Kertas
                    </Typography.Text>
                    <Segmented<'a4' | 'f4'>
                      size="small"
                      value={pageSize}
                      onChange={(value) => setPageSize(value)}
                      options={[
                        { value: 'a4', label: 'A4' },
                        { value: 'f4', label: 'F4' },
                      ]}
                      aria-label="Ukuran kertas"
                    />
                  </Space>
                  <Space size={6}>
                    <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>
                      TTD
                    </Typography.Text>
                    <Segmented<'basah' | 'qrcode'>
                      size="small"
                      value={signMode}
                      onChange={(value) => setSignMode(value)}
                      options={[
                        { value: 'basah', label: 'Manual' },
                        { value: 'qrcode', label: 'QR' },
                      ]}
                      aria-label="Mode tanda tangan"
                    />
                  </Space>
                  <Button
                    size="small"
                    icon={<SettingOutlined />}
                    onClick={() => setLayoutOpen(true)}
                  >
                    Layout
                  </Button>
                </Space>
                <Space size={6} style={{ marginLeft: 'auto' }}>
                  <Tooltip title={focusMode ? 'Keluar layar penuh (Esc)' : 'Layar penuh'}>
                    <Button
                      size="small"
                      icon={focusMode ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                      onClick={() => setFocusMode((value) => !value)}
                      aria-label={focusMode ? 'Keluar layar penuh' : 'Layar penuh'}
                    >
                      {focusMode ? 'Keluar' : 'Penuh'}
                    </Button>
                  </Tooltip>
                </Space>
              </>
            )}
            {view === 'rekap' && (
              <Space wrap size={8} style={{ marginLeft: 'auto' }}>
                <Input
                  allowClear
                  prefix={<SearchOutlined style={{ color: token.colorTextQuaternary }} />}
                  placeholder="Cari nama atau kode santri"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  style={{ width: 240, maxWidth: '100%' }}
                  aria-label="Cari santri"
                />
                <Segmented<StatusFilter>
                  value={statusFilter}
                  onChange={(value) => setStatusFilter(value)}
                  options={statusOptions}
                />
              </Space>
            )}
          </div>

          {view === 'card' ? (
            <div
              ref={focusMode ? undefined : panelsRef}
              style={
                focusMode
                  ? {
                      position: 'fixed',
                      inset: 0,
                      zIndex: 1300,
                      display: 'flex',
                      flexDirection: 'column',
                      // Scrim gelap: fokus ke kertas, halaman di belakang tidak mengganggu.
                      background: token.colorBgMask,
                      padding: 12,
                    }
                  : {
                      display: 'flex',
                      flexDirection: isMobile ? 'column' : 'row',
                      gap: 16,
                      alignItems: 'stretch',
                      minHeight: panelHeight,
                    }
              }
            >
              {!focusMode && (
                <div
                  className="no-print"
                  style={{
                    width: isMobile ? '100%' : 320,
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    border: `1px solid ${token.colorBorderSecondary}`,
                    borderRadius: token.borderRadiusLG,
                    background: token.colorBgContainer,
                    overflow: 'hidden',
                    maxHeight: isMobile ? 340 : panelHeight,
                    minHeight: isMobile ? 0 : panelHeight,
                  }}
                >
                <div
                  style={{
                    padding: '10px 12px',
                    borderBottom: `1px solid ${token.colorBorderSecondary}`,
                    background: token.colorFillQuaternary,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <Space size={6}>
                      <UserOutlined style={{ color: token.colorPrimary }} />
                      <Typography.Text strong style={{ fontSize: 13 }}>
                        Daftar Santri
                      </Typography.Text>
                    </Space>
                    <Tag style={{ marginInlineEnd: 0 }}>
                      {filteredStudents.length}/{students.length}
                    </Tag>
                  </div>
                  <Input
                    allowClear
                    size="small"
                    prefix={<SearchOutlined style={{ color: token.colorTextQuaternary }} />}
                    placeholder="Cari nama atau kode santri"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    aria-label="Cari santri"
                  />
                  <Segmented<StatusFilter>
                    block
                    size="small"
                    value={statusFilter}
                    onChange={(value) => setStatusFilter(value)}
                    options={statusOptions}
                    style={{ marginTop: 8 }}
                  />
                </div>

                <div
                  ref={listRef}
                  style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                    padding: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  {filteredStudents.length === 0 ? (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="Santri tidak ditemukan"
                      style={{ margin: 'auto 0' }}
                    />
                  ) : (
                    filteredStudents.map((student) => {
                      const selected = selectedStudent?.id === student.id
                      const complete = completeById.get(student.id) ?? false
                      const originalIndex = students.indexOf(student) + 1
                      return (
                        <div
                          key={student.id}
                          data-student-id={student.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedId(student.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              setSelectedId(student.id)
                            }
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 9,
                            padding: '8px 10px',
                            borderRadius: token.borderRadius,
                            border: `1px solid ${
                              selected ? token.colorPrimaryBorder : token.colorBorderSecondary
                            }`,
                            background: selected ? token.colorPrimaryBg : token.colorBgContainer,
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <div
                            aria-hidden
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: '50%',
                              display: 'grid',
                              placeItems: 'center',
                              flexShrink: 0,
                              fontSize: 11.5,
                              fontWeight: 700,
                              background: selected ? token.colorPrimary : token.colorFillQuaternary,
                              color: selected ? token.colorWhite : token.colorTextSecondary,
                            }}
                          >
                            {initialsOf(student.name)}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <Typography.Text
                              strong
                              ellipsis
                              style={{
                                display: 'block',
                                fontSize: 13,
                                lineHeight: 1.35,
                                color: selected ? token.colorPrimary : token.colorText,
                              }}
                            >
                              {student.name}
                            </Typography.Text>
                            <Typography.Text
                              type="secondary"
                              ellipsis
                              style={{ display: 'block', fontSize: 11.5, lineHeight: 1.35 }}
                            >
                              #{originalIndex} · {student.registration_code}
                            </Typography.Text>
                          </div>
                          <Tag
                            color={complete ? 'success' : 'warning'}
                            style={{ marginInlineEnd: 0, fontSize: 11 }}
                          >
                            {complete ? 'Lengkap' : 'Belum'}
                          </Tag>
                          <Tooltip title="Cetak kartu ini">
                            <Button
                              type="text"
                              size="small"
                              icon={<PrinterOutlined />}
                              aria-label={`Cetak raport ${student.name}`}
                              onClick={(event) => {
                                event.stopPropagation()
                                setSelectedId(student.id)
                                setPrintTarget(student.id)
                              }}
                            />
                          </Tooltip>
                          {selected && (
                            <CheckOutlined
                              aria-hidden
                              style={{ color: token.colorPrimary, fontSize: 12 }}
                            />
                          )}
                        </div>
                      )
                    })
                  )}
                </div>

                <div
                  style={{
                    padding: '8px 12px',
                    borderTop: `1px solid ${token.colorBorderSecondary}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 8,
                    fontSize: 11.5,
                    color: token.colorTextSecondary,
                  }}
                >
                  <span>
                    {completedCount}/{students.length} lengkap · {incompleteCount} belum
                  </span>
                  <span>↑ ↓ navigasi</span>
                </div>
              </div>
              )}

              <div
                ref={previewRef}
                className="no-print"
                style={{
                  flex: 1,
                  minWidth: 0,
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 12,
                  padding: focusMode ? 0 : 16,
                  border: focusMode ? 'none' : `1px solid ${token.colorBorderSecondary}`,
                  borderRadius: focusMode ? 0 : token.borderRadiusLG,
                  background: focusMode ? 'transparent' : token.colorFillQuaternary,
                  overflow: 'auto',
                  ...(focusMode
                    ? { width: '100%', maxHeight: 'none' }
                    : {
                        maxHeight: isMobile ? 'none' : panelHeight,
                        minHeight: isMobile ? 420 : panelHeight,
                      }),
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '3px 5px',
                    background: token.colorBgContainer,
                    border: `1px solid ${token.colorBorderSecondary}`,
                    borderRadius: token.borderRadius,
                    boxShadow: focusMode ? token.boxShadowSecondary : undefined,
                    flexShrink: 0,
                    position: focusMode ? 'sticky' : undefined,
                    top: focusMode ? 0 : undefined,
                    zIndex: focusMode ? 2 : undefined,
                  }}
                >
                  <Tooltip title="Perkecil">
                    <Button
                      type="text"
                      size="small"
                      icon={<ZoomOutOutlined />}
                      onClick={() => setZoom(zoom - 0.05)}
                      aria-label="Perkecil zoom"
                    />
                  </Tooltip>
                  <Typography.Text
                    style={{
                      minWidth: 44,
                      textAlign: 'center',
                      fontSize: 12,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {Math.round(zoom * 100)}%
                  </Typography.Text>
                  <Tooltip title="Perbesar">
                    <Button
                      type="text"
                      size="small"
                      icon={<ZoomInOutlined />}
                      onClick={() => setZoom(zoom + 0.05)}
                      aria-label="Perbesar zoom"
                    />
                  </Tooltip>
                  <Button
                    size="small"
                    type={zoomMode === 'fit' ? 'primary' : 'default'}
                    icon={<CompressOutlined />}
                    onClick={() => setZoomMode('fit')}
                  >
                    Fit
                  </Button>
                  <Segmented
                    size="small"
                    value={
                      zoomMode === 'custom' && [50, 65, 80, 100].includes(Math.round(zoom * 100))
                        ? `${Math.round(zoom * 100)}%`
                        : undefined
                    }
                    options={['50%', '65%', '80%', '100%']}
                    onChange={(value) => setZoom(Number(String(value).replace('%', '')) / 100)}
                  />
                  {focusMode && (
                    <Button
                      size="small"
                      icon={<FullscreenExitOutlined />}
                      onClick={() => setFocusMode(false)}
                    >
                      Keluar
                    </Button>
                  )}
                </div>

                {selectedStudent ? (
                  <div
                    style={{
                      width: PAGE_WIDTH * zoom,
                      height: PAGE_HEIGHT * zoom,
                      position: 'relative',
                      overflow: 'hidden',
                      flexShrink: 0,
                      boxShadow: '0 6px 24px rgba(15, 23, 42, 0.12)',
                      borderRadius: 2,
                    }}
                  >
                    <div
                      style={{
                        transform: `scale(${zoom})`,
                        transformOrigin: 'top left',
                        width: PAGE_WIDTH,
                        height: PAGE_HEIGHT,
                      }}
                    >
                      <PrintCard {...cardProps(selectedStudent)} />
                    </div>
                  </div>
                ) : (
                  <Empty description="Pilih santri di daftar untuk melihat preview" />
                )}
              </div>
            </div>
          ) : (
            <Card className="no-print" title="Rekapitulasi Nilai" size="small">
              <Table<ReportCardStudent>
                rowKey="id"
                size="small"
                columns={rekapColumns}
                dataSource={filteredStudents}
                pagination={false}
                scroll={{ x: true }}
                locale={{
                  emptyText: (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Tidak ada santri yang cocok" />
                  ),
                }}
              />
            </Card>
          )}
        </>
      )}

      {printTarget && printStudents.length > 0 && (
        <div
          ref={printRef}
          className="report-card-print-root report-card-print-root--hidden"
          aria-hidden
        >
          {printStudents.map((student) => (
            <PrintCard key={student.id} {...cardProps(student)} />
          ))}
        </div>
      )}

      <LayoutSettings
        open={layoutOpen}
        onClose={() => setLayoutOpen(false)}
        value={layoutConfig}
        onChange={(next) => {
          setLayoutConfig(next)
          saveLayoutConfig(next)
        }}
      />

      <ExportModal<ReportCardStudent>
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Ekspor Rekap Nilai"
        subtitle={`${REPORT_CARD_TYPE_LABEL[type]} · ${period}`}
        filename={`Rapor-${classNameLabel}`}
        sheetName="Rekap Nilai"
        columns={exportColumns}
        scopes={[
          {
            key: 'periode',
            label: 'Kelas ini (periode terpilih)',
            count: students.length,
            getRows: async () => students,
          },
        ]}
        auditTable={isMonthly ? 'student_monthly_reports' : 'student_semester_reports'}
        auditSource="OPERATIONAL"
      />
    </div>
  )
}
