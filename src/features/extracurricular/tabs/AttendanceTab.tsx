import { useEffect, useMemo, useRef, useState } from 'react'
import { App, Badge, Button, Card, DatePicker, Empty, Input, Select, Space, Tooltip } from 'antd'
import {
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CopyOutlined,
  LeftOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  RightOutlined,
  SaveOutlined,
  SearchOutlined,
  StopOutlined,
  TeamOutlined,
  UndoOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useSearchParams } from 'react-router-dom'
import type { InputRef } from 'antd'
import { useTabActions } from '../../../shared/components/ActionsSlot'
import { ShortcutsModal } from '../../../shared/components/ShortcutsModal'
import { StatChip } from '../../../shared/components/StatChip'
import { AttendanceGrid } from '../../../shared/components/AttendanceGrid'
import { useShortcuts } from '../../../shared/hooks/useShortcuts'
import { countWeekdays } from '../../attendance/api'
import { computePresensiStats } from '../../halaqah/presensiStats'
import { NoteModal } from '../../halaqah/components/NoteModal'
import { useActivity } from '../hooks'
import { useAttendance } from '../useAttendance'

// Ambang alert grid tetap (halaqah punya yang bisa diatur; activity v1 pakai default)
const ALERT_THRESHOLD = { alpa: 3, hadirPct: 50 }

const MONTH_LABELS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

/** Tab Presensi: grid absensi bulanan per kegiatan ekstrakurikuler. */
export function AttendanceTab({ active }: { active: boolean }) {
  const { modal } = App.useApp()
  const [searchParams, setSearchParams] = useSearchParams()
  const searchRef = useRef<InputRef>(null)

  // ── Periode (URL: ?activity=&month=&year= — default tak ditulis, pola AttendancePage) ──
  const now = new Date()
  const [month, setMonth] = useState(() => {
    const m = Number(searchParams.get('month'))
    return m >= 1 && m <= 12 ? m : now.getMonth() + 1
  })
  const [year, setYear] = useState(() => {
    const y = Number(searchParams.get('year'))
    return y >= 2000 && y <= 2100 ? y : now.getFullYear()
  })
  const [activityId, setActivityId] = useState<string | undefined>(
    () => searchParams.get('activity') ?? undefined,
  )
  const [search, setSearch] = useState('')

  const activityQuery = useActivity()
  const activityList = useMemo(() => activityQuery.data ?? [], [activityQuery.data])
  const activeActivityId =
    activityId && activityList.some((e) => e.id === activityId) ? activityId : activityList[0]?.id

  const syncParams = (next: { activity?: string; month?: number; year?: number }) => {
    const sp = new URLSearchParams(searchParams)
    const e = next.activity ?? activeActivityId
    if (e) sp.set('activity', e)
    sp.set('month', String(next.month ?? month))
    sp.set('year', String(next.year ?? year))
    setSearchParams(sp, { replace: true, preventScrollReset: true })
  }

  const grid = useAttendance({ activeActivityId, year, month, search })

  const daysInMonth = new Date(year, month, 0).getDate()
  const weekdays = countWeekdays(year, month)
  const isCurrentPeriod = now.getFullYear() === year && now.getMonth() + 1 === month
  const todayCol = isCurrentPeriod ? now.getDate() : 0

  // ── Guard draf belum disimpan + navigasi periode ─────────────────────────
  const guarded = (next: () => void) => {
    if (grid.dirtyCount === 0) {
      next()
      return
    }
    modal.confirm({
      title: 'Buang draf presensi?',
      content: `${grid.dirtyCount} anggota punya perubahan yang belum disimpan. Mengganti kegiatan/periode akan membuang draf tersebut.`,
      okText: 'Buang & Lanjut',
      okButtonProps: { danger: true },
      cancelText: 'Batal',
      onOk: () => {
        grid.dropDrafts()
        next()
      },
    })
  }

  const goMonth = (delta: number) =>
    guarded(() => {
      const d = new Date(year, month - 1 + delta, 1)
      const m = d.getMonth() + 1
      const y = d.getFullYear()
      setMonth(m)
      setYear(y)
      syncParams({ month: m, year: y })
    })

  const changeActivity = (id?: string) =>
    guarded(() => {
      setActivityId(id)
      syncParams({ activity: id })
    })

  const scrollToToday = () => {
    document.getElementById('presensi-today-col')?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }

  useEffect(() => {
    if (grid.dirtyCount === 0) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [grid.dirtyCount])

  const stats = useMemo(
    () => computePresensiStats(grid.students, grid.daysById, year, month),
    [grid.students, grid.daysById, year, month],
  )

  // ── Shortcut ─────────────────────────────────────────────────────────────
  const shortcuts = useShortcuts({
    isBlocked: grid.noteTarget !== null,
    items: [
      {
        keys: ['S'],
        label: 'Simpan presensi',
        group: 'Aksi',
        icon: <SaveOutlined />,
        run: grid.handleSave,
        when: grid.canWrite && grid.dirtyCount > 0,
      },
      {
        keys: ['Ctrl', 'Z'],
        label: 'Batalkan perubahan terakhir',
        group: 'Aksi',
        icon: <UndoOutlined />,
        run: grid.undo,
        when: grid.canWrite && grid.undoDepth > 0,
      },
      {
        keys: ['['],
        label: 'Bulan sebelumnya',
        group: 'Navigasi',
        icon: <LeftOutlined />,
        run: () => goMonth(-1),
      },
      {
        keys: [']'],
        label: 'Bulan berikutnya',
        group: 'Navigasi',
        icon: <RightOutlined />,
        run: () => goMonth(1),
      },
      {
        keys: ['F'],
        label: 'Fokus pencarian',
        group: 'Navigasi',
        icon: <SearchOutlined />,
        run: () => searchRef.current?.focus(),
      },
      {
        keys: ['?'],
        label: 'Palet shortcut',
        group: 'Bantuan',
        icon: <QuestionCircleOutlined />,
        run: () => shortcuts.toggle(),
      },
    ],
  })

  // ── Render ───────────────────────────────────────────────────────────────
  const tabActions = useTabActions(
    active,
    <Space wrap>
      <Tooltip title="Palet shortcut (?)">
        <Button icon={<QuestionCircleOutlined />} onClick={shortcuts.open} />
      </Tooltip>
      <Tooltip title="Salin presensi bulan lalu">
        <Button icon={<CopyOutlined />} onClick={grid.copyLastMonth} disabled={!grid.canWrite} />
      </Tooltip>
      <Tooltip title="Kosongkan grid & catatan">
        <Button icon={<StopOutlined />} onClick={grid.clearAll} disabled={!grid.canWrite} />
      </Tooltip>
      {grid.canWrite && (
        <Button
          type="primary"
          icon={<SaveOutlined />}
          onClick={grid.handleSave}
          loading={grid.saveMutation.isPending}
          disabled={grid.dirtyCount === 0}
        >
          {grid.dirtyCount > 0 ? (
            <Badge count={grid.dirtyCount} color="#6366f1" offset={[4, -2]}>
              Simpan Perubahan
            </Badge>
          ) : (
            'Simpan Perubahan'
          )}
        </Button>
      )}
    </Space>,
  )

  if (activityQuery.isPending) {
    return <Card loading style={{ minHeight: 300 }} />
  }

  if (activityList.length === 0) {
    return (
      <Card>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Belum ada kegiatan ekstrakurikuler. Tambahkan kegiatan terlebih dahulu."
        />
      </Card>
    )
  }

  const selectedActivity = activityList.find((e) => e.id === activeActivityId)

  return (
    <div>
      {tabActions}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <StatChip
          icon={<TeamOutlined />}
          label="Anggota"
          value={grid.students.length}
          color="indigo"
          loading={grid.membersQuery.isPending}
        />
        <StatChip
          icon={<CheckCircleOutlined />}
          label="Total Hadir"
          value={stats.totals.H}
          color="emerald"
          loading={grid.attendanceQuery.isPending}
        />
        <StatChip
          icon={<CloseCircleOutlined />}
          label="Total Alpa"
          value={stats.totals.A}
          color="rose"
          loading={grid.attendanceQuery.isPending}
        />
        <StatChip
          icon={<CalendarOutlined />}
          label="Kelengkapan"
          value={`${stats.completion}%`}
          color="sky"
          loading={grid.attendanceQuery.isPending}
        />
      </div>

      <Card
        style={{ marginBottom: 16 }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <Select
            placeholder="Pilih kegiatan"
            showSearch
            optionFilterProp="label"
            value={activeActivityId}
            onChange={(v) => changeActivity(v)}
            loading={activityQuery.isPending}
            options={activityList.map((e) => ({ value: e.id, label: e.name }))}
            style={{ minWidth: 220 }}
          />
          <Button icon={<LeftOutlined />} onClick={() => goMonth(-1)} />
          <span style={{ fontWeight: 600, minWidth: 120, textAlign: 'center' }}>
            {MONTH_LABELS[month - 1]} {year}
          </span>
          <Button icon={<RightOutlined />} onClick={() => goMonth(1)} />
          <Tooltip title="Ke hari ini">
            <Button
              icon={<CalendarOutlined />}
              onClick={scrollToToday}
              disabled={isCurrentPeriod}
            />
          </Tooltip>
          <DatePicker
            picker="month"
            value={dayjs(`${year}-${String(month).padStart(2, '0')}-01`)}
            onChange={(d) => {
              if (!d) return
              guarded(() => {
                setMonth(d.month() + 1)
                setYear(d.year())
                syncParams({ month: d.month() + 1, year: d.year() })
              })
            }}
            allowClear={false}
            style={{ width: 130 }}
          />
          <Input
            ref={searchRef}
            placeholder="Cari anggota…"
            prefix={<SearchOutlined />}
            allowClear
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: '1 1 180px', minWidth: 160 }}
          />
        </div>
      </Card>

      <Card>
        {grid.students.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <>
                <div>Kegiatan &quot;{selectedActivity?.name}&quot; belum punya anggota.</div>
                <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', marginTop: 4 }}>
                  Buka tab Kegiatan, klik nama kegiatan untuk mengelola anggota.
                </div>
              </>
            }
          />
        ) : grid.filteredStudents.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Tidak ada anggota yang cocok dengan pencarian" />
        ) : (
          <AttendanceGrid
            students={grid.filteredStudents}
            daysById={grid.daysById}
            notesById={grid.notesById}
            year={year}
            month={month}
            daysInMonth={daysInMonth}
            todayCol={todayCol}
            weekdays={weekdays}
            canWrite={grid.canWrite}
            hideWeekend={false}
            loading={grid.membersQuery.isFetching || grid.attendanceQuery.isFetching}
            cursor={grid.cursor}
            onCursorChange={grid.setCursor}
            onCellMouseDown={grid.handleCellMouseDown}
            onDragPaint={grid.handleDragPaint}
            onSetCell={grid.setCell}
            onFillColumn={grid.fillColumn}
            onOpenNote={grid.openNote}
            onOpenStudent={grid.openStudentDetail}
            alertThreshold={ALERT_THRESHOLD}
          />
        )}
      </Card>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12, gap: 8 }}>
        <Tooltip title="Muat ulang data tersimpan">
          <Button
            icon={<ReloadOutlined spin={grid.attendanceQuery.isFetching} />}
            onClick={() => void grid.refetchAttendance()}
          />
        </Tooltip>
      </div>

      <NoteModal
        noteTarget={grid.noteTarget}
        initialNote={grid.noteTarget ? (grid.notesById.get(grid.noteTarget.id) ?? '') : ''}
        onCancel={() => grid.setNoteTarget(null)}
        onSave={grid.saveNote}
      />

      <ShortcutsModal open={shortcuts.isOpen} onClose={shortcuts.close} sections={shortcuts.sections} />
    </div>
  )
}
