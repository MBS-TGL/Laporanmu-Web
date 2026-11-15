import { useEffect, useMemo, useRef, useState } from 'react'
import { App, Badge, Button, Card, Empty, Space, Tooltip, type InputRef } from 'antd'
import {
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DownloadOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  LeftOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  RightOutlined,
  SaveOutlined,
  SearchOutlined,
  TeamOutlined,
  UndoOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import { useTabActions } from '../../../shared/components/ActionsSlot'
import { ShortcutsModal } from '../../../shared/components/ShortcutsModal'
import { StatChip } from '../../../shared/components/StatChip'
import { useShortcuts } from '../../../shared/hooks/useShortcuts'
import { usePermissions } from '../../../shared/hooks/useProfile'
import { countWeekdays } from '../../attendance/api'
import { AttendanceGrid } from '../../../shared/components/AttendanceGrid'
import { ImportModal } from '../components/ImportModal'
import { ExportModal } from '../components/ExportModal'
import { NoteModal } from '../components/NoteModal'
import { PresensiToolbar } from '../components/PresensiToolbar'
import { computePresensiStats } from '../presensiStats'
import { usePresensiGrid } from '../usePresensiGrid'
import { usePresensiPeriod } from '../usePresensiPeriod'
import type { HalaqahSession } from '../types'

/** Tab Presensi: grid absensi bulanan per halaqah per sesi (port fitur V1). */
export function PresensiTab({ active }: { active: boolean }) {
  const { modal } = App.useApp()
  const [, setSearchParams] = useSearchParams()
  const searchRef = useRef<InputRef>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)

  const period = usePresensiPeriod()
  const { canWrite: canWriteRole } = usePermissions()
  // Musyrif pemegang kelompok (akun guru) boleh mengelola presensi kelompoknya
  const canManage = canWriteRole || period.scoped
  const grid = usePresensiGrid({
    activeGroupId: period.activeGroupId,
    session: period.session,
    year: period.year,
    month: period.month,
    search: period.search,
    canWrite: canManage,
  })

  const now = new Date()
  const daysInMonth = new Date(period.year, period.month, 0).getDate()
  const weekdays = countWeekdays(period.year, period.month)
  const isCurrentPeriod = now.getFullYear() === period.year && now.getMonth() + 1 === period.month
  const todayCol = isCurrentPeriod ? now.getDate() : 0

  // ── Guard draf belum disimpan + navigasi periode ─────────────────────────
  const guarded = (next: () => void) => {
    if (grid.dirtyCount === 0) {
      next()
      return
    }
    modal.confirm({
      title: 'Buang draf presensi?',
      content: `${grid.dirtyCount} anggota punya perubahan yang belum disimpan. Mengganti halaqah/sesi/periode akan membuang draf tersebut.`,
      okText: 'Buang & Lanjut',
      okButtonProps: { danger: true },
      cancelText: 'Batal',
      onOk: () => {
        grid.dropDrafts()
        next()
      },
    })
  }

  const goMonth = (delta: number) => guarded(() => period.goMonth(delta))
  const changeGroup = (id?: string) => guarded(() => period.changeGroup(id))
  const changeSession = (s: HalaqahSession) => {
    if (s === period.session) return
    guarded(() => period.changeSession(s))
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
    () => computePresensiStats(grid.students, grid.daysById, period.year, period.month),
    [grid.students, grid.daysById, period.year, period.month],
  )

  // ── Shortcut ─────────────────────────────────────────────────────────────
  const shortcuts = useShortcuts({
    isBlocked: importOpen || exportOpen || grid.noteTarget !== null,
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
        keys: ['W'],
        label: 'Sembunyikan/tampilkan weekend',
        group: 'Tampilan',
        icon: period.hideWeekend ? <EyeOutlined /> : <EyeInvisibleOutlined />,
        run: period.toggleWeekend,
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
  // Aksi halaman di ujung kanan tab bar — pola sama dengan tab lain (judul & subtitle dirender shell)
  const tabActions = useTabActions(
    active,
    <Space wrap>
      <Tooltip title="Palet shortcut (?)">
        <Button icon={<QuestionCircleOutlined />} onClick={shortcuts.open} />
      </Tooltip>
      <Tooltip title="Impor Excel/CSV">
        <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)} disabled={!grid.canWrite} />
      </Tooltip>
      <Tooltip title="Ekspor grid presensi">
        <Button icon={<DownloadOutlined />} onClick={() => setExportOpen(true)} />
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

  if (period.isLoading) {
    return <Card loading style={{ minHeight: 300 }} />
  }

  if (period.groups.length === 0) {
    return (
        <Card>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              period.scoped
                ? 'Kamu belum ditunjuk sebagai musyrif kelompok halaqah. Hubungi admin untuk ditugaskan.'
                : 'Belum ada halaqah. Buat kelompok halaqah terlebih dahulu.'
            }
          >
            {!period.scoped && (
              <Button type="primary" onClick={() => setSearchParams({ tab: 'kelompok' })}>
                Ke tab Kelompok
              </Button>
            )}
          </Empty>
        </Card>
    )
  }

  const selectedGroup = period.groups.find((g) => g.id === period.activeGroupId)

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

      <PresensiToolbar
        groups={period.groups}
        activeGroupId={period.activeGroupId}
        changeGroup={changeGroup}
        month={period.month}
        year={period.year}
        goMonth={goMonth}
        session={period.session}
        changeSession={changeSession}
        searchRef={searchRef}
        search={period.search}
        setSearch={period.setSearch}
        hideWeekend={period.hideWeekend}
        toggleWeekend={period.toggleWeekend}
        undoDepth={grid.undoDepth}
        undo={grid.undo}
        canWrite={grid.canWrite}
        fillAllWeekdays={grid.fillAllWeekdays}
        clearAll={grid.clearAll}
        copyLastMonth={grid.copyLastMonth}
        scrollToToday={period.scrollToToday}
        isCurrentPeriod={isCurrentPeriod}
        threshold={period.threshold}
        setThreshold={period.setThreshold}
      />

      <Card>
        {grid.students.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <>
                <div>Halaqah &quot;{selectedGroup?.name}&quot; belum punya anggota.</div>
                <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', marginTop: 4 }}>
                  Tambahkan anggota lewat tab Kelompok → kelola anggota.
                </div>
              </>
            }
          >
            <Button icon={<TeamOutlined />} onClick={() => setSearchParams({ tab: 'kelompok' })}>
              Ke tab Kelompok
            </Button>
          </Empty>
        ) : grid.filteredStudents.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Tidak ada anggota yang cocok dengan pencarian" />
        ) : (
          <AttendanceGrid
            students={grid.filteredStudents}
            daysById={grid.daysById}
            notesById={grid.notesById}
            year={period.year}
            month={period.month}
            daysInMonth={daysInMonth}
            todayCol={todayCol}
            weekdays={weekdays}
            canWrite={grid.canWrite}
            hideWeekend={period.hideWeekend}
            loading={grid.membersQuery.isFetching || grid.attendanceQuery.isFetching}
            cursor={grid.cursor}
            onCursorChange={grid.setCursor}
            onCellMouseDown={grid.handleCellMouseDown}
            onDragPaint={grid.handleDragPaint}
            onSetCell={grid.setCell}
            onFillColumn={grid.fillColumn}
            onOpenNote={grid.openNote}
            onOpenStudent={grid.openStudentDetail}
            alertThreshold={period.threshold}
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

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        year={period.year}
        month={period.month}
        daysInMonth={daysInMonth}
        roster={grid.students.map((s) => ({
          id: s.id,
          name: s.name,
          registration_code: s.registration_code,
        }))}
        onApply={grid.handleImportApply}
      />

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        year={period.year}
        month={period.month}
        session={period.session}
        groupName={selectedGroup?.name ?? 'halaqah'}
        rows={grid.students.map((s) => ({
          name: s.name,
          className: s.className,
          code: s.registration_code,
          days: grid.getDays(s.id),
          note: grid.notesById.get(s.id) ?? '',
        }))}
      />

      <ShortcutsModal open={shortcuts.isOpen} onClose={shortcuts.close} sections={shortcuts.sections} />
    </div>
  )
}
