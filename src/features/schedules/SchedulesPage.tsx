import { useMemo, useRef, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Empty,
  Input,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  type InputRef,
  type TableColumnsType,
} from 'antd'
import {
  AlertOutlined,
  AppstoreOutlined,
  CalendarOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  PlusOutlined,
  PrinterOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
  SyncOutlined,
  UndoOutlined,
  UnorderedListOutlined,
  UploadOutlined,
  WarningOutlined,
  SwapOutlined,
  ScheduleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { PageHeader } from '../../shared/components/PageHeader'
import { ShellItem, ShellStagger } from '../../shared/components/ShellMotion'
import { ShortcutsModal } from '../../shared/components/ShortcutsModal'
import { StatChip } from '../../shared/components/StatChip'
import { useDebounce } from '../../shared/hooks/useDebounce'
import { useShortcuts, type ShortcutItem } from '../../shared/hooks/useShortcuts'
import { usePermissions } from '../../shared/hooks/useProfile'
import { useUrlTab } from '../../shared/hooks/useUrlTab'
import { useTablePagination } from '../../shared/hooks/useTablePagination'
import {
  analyzeAllConflicts,
  findConflicts,
  useClassesBrief,
  useCreateSchedule,
  useDeleteSchedule,
  useSchedules,
  useSubstitutionLogs,
  useUpdateSchedule,
} from './hooks'
import { ScheduleForm } from './components/ScheduleForm'
import { GridView } from './components/GridView'
import { ImportModal } from './components/ImportModal'
import { ExportModal } from './components/ExportModal'
import { SubstitutionModal } from './components/SubstitutionModal'
import { ConflictDrawer } from './components/ConflictDrawer'
import { CalendarTab } from './tabs/CalendarTab'
import { printScheduleSheet, type PrintMeta } from './components/schedulePrint'
import type { Schedule, ScheduleFormValues } from './types'

export const DAY_LABELS: Record<number, string> = {
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
  6: 'Sabtu',
  7: 'Minggu',
}

// Cek apakah grade/tingkat adalah SMA (10, 11, 12)
export function isSmaGrade(grade?: string | null): boolean {
  if (!grade) return false
  const g = Number(grade)
  return g >= 10 && g <= 12
}

// dayjs: 0=Minggu … 6=Sabtu → konvensi DB 1=Senin … 7=Minggu
export function dbDay(d = dayjs()): number {
  return d.day() === 0 ? 7 : d.day()
}

function shortTime(t: string): string {
  return t.slice(0, 5)
}

export function SchedulesPage() {
  const { message, modal } = App.useApp()
  const { canWrite, canDelete } = usePermissions()
  const { tab: activeTab, setTab: setActiveTab } = useUrlTab('smp')

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [day, setDay] = useState<string>('')
  const [classId, setClassId] = useState<string | undefined>(undefined)
  const [onlyConflicts, setOnlyConflicts] = useState(false)
  const [conflictDrawerOpen, setConflictDrawerOpen] = useState(false)
  const [view, setView] = useState<'grid' | 'list'>('grid')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Schedule | null>(null)
  const [substitutionSchedule, setSubstitutionSchedule] = useState<Schedule | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const searchRef = useRef<InputRef>(null)

  const todayStr = useMemo(() => dayjs().format('YYYY-MM-DD'), [])
  const substitutionsQuery = useSubstitutionLogs(todayStr)
  const substitutionsMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const sub of substitutionsQuery.data ?? []) {
      if (sub.substitute_teacher?.name) {
        map.set(sub.schedule_id, sub.substitute_teacher.name)
      }
    }
    return map
  }, [substitutionsQuery.data])

  const schedulesQuery = useSchedules()
  const classesQuery = useClassesBrief()
  const createMutation = useCreateSchedule()
  const updateMutation = useUpdateSchedule()
  const deleteMutation = useDeleteSchedule()
  const allSchedules = useMemo(() => schedulesQuery.data ?? [], [schedulesQuery.data])
  const isRefreshing = schedulesQuery.isFetching

  // Filter kelas berdasarkan tab aktif (SMP: tingkat 7,8,9; SMA: tingkat 10,11,12)
  const tabClasses = useMemo(() => {
    const list = classesQuery.data ?? []
    if (activeTab === 'sma') {
      return list.filter((c) => isSmaGrade(c.grade))
    }
    if (activeTab === 'smp') {
      return list.filter((c) => !isSmaGrade(c.grade))
    }
    return list
  }, [classesQuery.data, activeTab])

  // Jadwal yang sesuai jenjang tab (SMP / SMA)
  const levelSchedules = useMemo(() => {
    if (activeTab === 'sma') {
      return allSchedules.filter((s) => isSmaGrade(s.classes?.grade))
    }
    if (activeTab === 'smp') {
      return allSchedules.filter((s) => !isSmaGrade(s.classes?.grade))
    }
    return allSchedules
  }, [allSchedules, activeTab])

  // Analisis tabrakan / bentrok dihitung terhadap SEMUA jadwal (lintas SMP & SMA)
  const { conflictScheduleIds, conflictInfoMap, conflictGroups } = useMemo(
    () => analyzeAllConflicts(allSchedules),
    [allSchedules],
  )

  const todayDay = dbDay()

  const rows = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return levelSchedules.filter((s) => {
      if (onlyConflicts && !conflictScheduleIds.has(s.id)) return false
      if (
        q &&
        !`${s.classes?.name ?? ''} ${s.subjects?.name ?? ''} ${s.teachers?.name ?? ''} ${s.room ?? ''}`
          .toLowerCase()
          .includes(q)
      )
        return false
      if (day && s.day_of_week !== Number(day)) return false
      if (classId && s.class_id !== classId) return false
      return true
    })
  }, [levelSchedules, onlyConflicts, conflictScheduleIds, debouncedSearch, day, classId])

  const pg = useTablePagination(rows.length, { label: 'jadwal' })

  const paginatedRows = useMemo(
    () => rows.slice((pg.page - 1) * pg.pageSize, pg.page * pg.pageSize),
    [rows, pg.page, pg.pageSize],
  )

  const resetFilters = () => {
    setSearch('')
    setDay('')
    setClassId(undefined)
    setOnlyConflicts(false)
    pg.setPage(1)
  }

  const hasActiveFilters = Boolean(debouncedSearch || day || classId || onlyConflicts)

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (schedule: Schedule) => {
    setEditing(schedule)
    setFormOpen(true)
  }

  /** Simpan setelah cek bentrok — bentrok tetap boleh disimpan lewat konfirmasi */
  const persistSchedule = (values: ScheduleFormValues) => {
    const conflicts = findConflicts(allSchedules, {
      day_of_week: values.day_of_week,
      start_time: values.start_time,
      end_time: values.end_time,
      class_id: values.class_id,
      teacher_id: values.teacher_id,
      room: values.room,
      excludeId: editing?.id,
    })
    const doSave = (onDone: () => void) => {
      const onError = (err: Error) => message.error(err.message || 'Gagal menyimpan jadwal')
      if (editing) {
        updateMutation.mutate(
          { id: editing.id, values },
          {
            onSuccess: () => {
              message.success('Jadwal KBM diperbarui')
              onDone()
            },
            onError,
          },
        )
      } else {
        createMutation.mutate(values, {
          onSuccess: () => {
            message.success('Jadwal KBM ditambahkan')
            onDone()
          },
          onError,
        })
      }
    }

    if (conflicts.length === 0) {
      doSave(() => setFormOpen(false))
      return
    }

    const className = classesQuery.data?.find((c) => c.id === values.class_id)?.name
    modal.confirm({
      title: 'Terdeteksi bentrok jadwal',
      width: 520,
      icon: <WarningOutlined style={{ color: '#faad14' }} />,
      content: (
        <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
          {conflicts.slice(0, 5).map(({ schedule, reason }) => (
            <div key={schedule.id} style={{ fontSize: 13 }}>
              • <b>{reason === 'class' ? 'Kelas' : reason === 'teacher' ? 'Guru' : 'Ruang'}</b>{' '}
              {reason === 'class'
                ? className
                : reason === 'teacher'
                  ? schedule.teachers?.name ?? 'yang sama'
                  : schedule.room ?? 'yang sama'}{' '}
              sudah ada jadwal {schedule.subjects?.name ?? 'lain'} di{' '}
              {schedule.classes?.name ?? '-'} ({DAY_LABELS[schedule.day_of_week]}{' '}
              {shortTime(schedule.start_time)}–{shortTime(schedule.end_time)}).
            </div>
          ))}
          {conflicts.length > 5 && <div>…dan {conflicts.length - 5} bentrok lainnya.</div>}
          <div style={{ color: 'rgba(0,0,0,0.45)', marginTop: 4 }}>
            Tetap simpan jika bentrok ini memang disengaja (mis. mapel praktik paralel).
          </div>
        </div>
      ),
      okText: 'Simpan Saja',
      cancelText: 'Periksa Lagi',
      onOk: () => doSave(() => setFormOpen(false)),
    })
  }

  const handleSubmit = (values: ScheduleFormValues) => persistSchedule(values)

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => message.success('Jadwal KBM dihapus'),
      onError: (err: Error) => message.error(err.message || 'Gagal menghapus jadwal'),
    })
  }

  const printMeta: PrintMeta = useMemo(() => {
    const isSma = activeTab === 'sma'
    return {
      title: isSma ? 'JADWAL PELAJARAN SMA MUHAMMADIYAH TANGGUL' : 'JADWAL PELAJARAN SMP MUHAMMADIYAH 4 TANGGUL',
      subtitle: 'SEMESTER GANJIL · TAHUN PELAJARAN 2026/2027',
    }
  }, [activeTab])

  const stats = useMemo(
    () => ({
      total: levelSchedules.length,
      today: levelSchedules.filter((s) => s.day_of_week === todayDay).length,
      classes: new Set(levelSchedules.map((s) => s.class_id)).size,
      teachers: new Set(levelSchedules.map((s) => s.teacher_id).filter(Boolean)).size,
      conflicts: levelSchedules.filter((s) => conflictScheduleIds.has(s.id)).length,
    }),
    [levelSchedules, todayDay, conflictScheduleIds],
  )

  const shortcutItems = useMemo<ShortcutItem[]>(
    () => [
      {
        keys: ['N'],
        label: 'Tambah Jadwal',
        group: 'Aksi',
        icon: <PlusOutlined />,
        run: openCreate,
        when: canWrite,
      },
      {
        keys: ['Ctrl', 'K'],
        label: 'Fokus pencarian',
        group: 'Navigasi',
        icon: <SearchOutlined />,
        run: () => searchRef.current?.focus(),
      },
      {
        keys: ['Esc'],
        label: 'Reset semua filter',
        group: 'Navigasi',
        icon: <UndoOutlined />,
        run: resetFilters,
        when: hasActiveFilters,
      },
    ],
    [canWrite, hasActiveFilters],
  )

  const shortcuts = useShortcuts({
    items: [
      ...shortcutItems,
      {
        keys: ['?'],
        label: 'Palet shortcut',
        group: 'Bantuan',
        icon: <QuestionCircleOutlined />,
        run: () => shortcuts.toggle(),
      },
    ],
    isBlocked: formOpen,
  })

  const columns: TableColumnsType<Schedule> = [
    {
      title: 'Hari',
      dataIndex: 'day_of_week',
      key: 'day',
      width: 100,
      render: (v: number) => <Tag color={v === todayDay ? 'purple' : 'default'}>{DAY_LABELS[v] ?? v}</Tag>,
    },
    {
      title: 'Waktu',
      key: 'time',
      width: 130,
      render: (_, row) => (
        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
          {shortTime(row.start_time)}–{shortTime(row.end_time)}
        </span>
      ),
    },
    {
      title: 'Kelas',
      key: 'class',
      width: 110,
      render: (_, row) => (row.classes?.name ? <Tag color="blue">{row.classes.name}</Tag> : '-'),
    },
    {
      title: 'Mata Pelajaran',
      key: 'subject',
      render: (_, row) => <span style={{ fontWeight: 500 }}>{row.subjects?.name ?? '-'}</span>,
    },
    {
      title: 'Pengajar',
      key: 'teacher',
      render: (_, row) => {
        const subName = substitutionsMap.get(row.id)
        if (subName) {
          return (
            <div>
              <span style={{ textDecoration: 'line-through', color: '#999', fontSize: 12 }}>
                {row.teachers?.name ?? '-'}
              </span>
              <div>
                <Tag color="purple">Diganti: {subName}</Tag>
              </div>
            </div>
          )
        }
        return row.teachers?.name ?? '-'
      },
      responsive: ['md'],
    },
    {
      title: 'Ruang',
      dataIndex: 'room',
      key: 'room',
      width: 130,
      render: (v: string | null) => v ?? '-',
      responsive: ['md'],
    },
    {
      title: 'Status',
      key: 'status',
      width: 120,
      render: (_, row) => {
        const isConflict = conflictScheduleIds.has(row.id)
        if (!isConflict) {
          return <Tag color="success">Normal</Tag>
        }
        const reasons = conflictInfoMap.get(row.id)
        return (
          <Tooltip title={reasons ? reasons.join(' • ') : 'Jadwal bertabrakan'}>
            <Tag color="error" icon={<WarningOutlined />}>
              Tabrakan
            </Tag>
          </Tooltip>
        )
      },
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 140,
      render: (_, row) =>
        canWrite || canDelete ? (
          <Space size="small">
            {canWrite && (
              <Tooltip title="Tunjuk Guru Pengganti (Hari Ini)">
                <Button type="text" icon={<SwapOutlined />} onClick={() => setSubstitutionSchedule(row)} />
              </Tooltip>
            )}
            {canWrite && (
              <Tooltip title="Edit">
                <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(row)} />
              </Tooltip>
            )}
            {canDelete && (
              <Popconfirm
                title="Hapus jadwal ini?"
                onConfirm={() => handleDelete(row.id)}
                okText="Hapus"
                cancelText="Batal"
              >
                <Tooltip title="Hapus">
                  <Button type="text" danger icon={<DeleteOutlined />} />
                </Tooltip>
              </Popconfirm>
            )}
          </Space>
        ) : (
          <span style={{ color: '#bbb' }}>—</span>
        ),
    },
  ]

  return (
    <div>
      <ShellStagger>
        <ShellItem>
          <PageHeader
            title="Jadwal & Kalender Akademik"
            subtitle="Jadwal kegiatan belajar-mengajar SMP & SMA serta kalender agenda pondok"
            extra={
          activeTab !== 'calendar' && (
            <Space wrap>
              <Tooltip title="Muat ulang (R)">
                <Button icon={<SyncOutlined spin={isRefreshing} />} onClick={() => void schedulesQuery.refetch()} />
              </Tooltip>
              {canWrite && (
                <Tooltip title="Impor data jadwal (Excel / CSV / Sheets)">
                  <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)} />
                </Tooltip>
              )}
              <Tooltip title="Ekspor data jadwal (Excel / CSV)">
                <Button icon={<DownloadOutlined />} onClick={() => setExportOpen(true)} />
              </Tooltip>
              <Tooltip title="Cetak sesuai filter saat ini. Pilih “Save as PDF” untuk PDF (1–2 halaman A4).">
                <Button
                  icon={<PrinterOutlined />}
                  disabled={rows.length === 0}
                  onClick={() => printScheduleSheet(rows, printMeta, allSchedules)}
                />
              </Tooltip>
              <Tooltip title="Palet shortcut (?)">
                <Button icon={<QuestionCircleOutlined />} onClick={shortcuts.open} />
              </Tooltip>
              {canWrite && (
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                  Tambah Jadwal
                </Button>
              )}
            </Space>
          )
        }
        >
          </PageHeader>
        </ShellItem>
        <ShellItem>
          <Tabs
            activeKey={activeTab}
            onChange={(k) => {
              setActiveTab(k)
              setDay('')
              setClassId(undefined)
              setOnlyConflicts(false)
              pg.setPage(1)
            }}
        items={[
          {
            key: 'smp',
            label: (
              <span>
                <ScheduleOutlined style={{ marginRight: 6 }} />
                Jadwal KBM SMP
              </span>
            ),
          },
          {
            key: 'sma',
            label: (
              <span>
                <ScheduleOutlined style={{ marginRight: 6 }} />
                Jadwal KBM SMA
              </span>
            ),
          },
          {
            key: 'calendar',
            label: (
              <span>
                <CalendarOutlined style={{ marginRight: 6 }} />
                Kalender Pendidikan & Pondok
              </span>
            ),
          },
        ]}
          style={{ marginBottom: 16 }}
        />
        </ShellItem>
        <ShellItem>
          {activeTab === 'calendar' ? (
            <CalendarTab />
          ) : (
        <>
          {conflictScheduleIds.size > 0 && (
            <Alert
              type="error"
              showIcon
              icon={<AlertOutlined />}
              style={{ marginBottom: 16 }}
              message={
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <span>
                    <b>Terdeteksi {conflictScheduleIds.size} Jadwal Bertabrakan ({conflictGroups.length} insiden konflik).</b>{' '}
                    Mohon tinjau jadwal guru, kelas, atau ruang agar KBM berjalan lancar.
                  </span>
                  <Space size="small">
                    <Button
                      size="small"
                      type={onlyConflicts ? 'primary' : 'default'}
                      danger
                      onClick={() => {
                        setOnlyConflicts((prev) => !prev)
                        pg.setPage(1)
                      }}
                    >
                      {onlyConflicts ? 'Tampilkan Semua Jadwal' : 'Filter Jadwal Bentrok Saja'}
                    </Button>
                    <Button
                      size="small"
                      type="primary"
                      danger
                      onClick={() => setConflictDrawerOpen(true)}
                    >
                      Lihat Analisis Detail
                    </Button>
                  </Space>
                </div>
              }
            />
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            <StatChip
              icon={<CalendarOutlined />}
              label="Total Jadwal"
              value={stats.total}
              color="indigo"
              loading={schedulesQuery.isPending}
              active={day === '' && !onlyConflicts}
              onClick={() => {
                setDay('')
                setOnlyConflicts(false)
                pg.setPage(1)
              }}
            />
            <StatChip
              icon={<CalendarOutlined />}
              label={`Jadwal Hari Ini (${DAY_LABELS[todayDay]})`}
              value={stats.today}
              color="purple"
              loading={schedulesQuery.isPending}
              active={day === String(todayDay) && !onlyConflicts}
              onClick={() => {
                setDay(day === String(todayDay) ? '' : String(todayDay))
                setOnlyConflicts(false)
                pg.setPage(1)
              }}
            />
            <StatChip
              icon={<CalendarOutlined />}
              label="Kelas Terjadwal"
              value={stats.classes}
              color="sky"
              loading={schedulesQuery.isPending}
            />
            <StatChip
              icon={<CalendarOutlined />}
              label="Pengajar Terplotting"
              value={stats.teachers}
              color="emerald"
              loading={schedulesQuery.isPending}
            />
            {stats.conflicts > 0 && (
              <StatChip
                icon={<WarningOutlined />}
                label="Jadwal Tabrakan"
                value={stats.conflicts}
                color="rose"
                loading={schedulesQuery.isPending}
                active={onlyConflicts}
                onClick={() => {
                  setOnlyConflicts((prev) => !prev)
                  pg.setPage(1)
                }}
              />
            )}
          </div>

          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <Segmented
                value={view}
                onChange={(v) => setView(v as 'grid' | 'list')}
                options={[
                  { label: 'Grid', value: 'grid', icon: <AppstoreOutlined /> },
                  { label: 'Daftar', value: 'list', icon: <UnorderedListOutlined /> },
                ]}
              />
              <Segmented
                value={day}
                onChange={(v) => {
                  setDay(v)
                  pg.setPage(1)
                }}
                options={[
                  { label: 'Semua', value: '' },
                  ...Object.entries(DAY_LABELS).map(([value, label]) => ({
                    label,
                    value,
                  })),
                ]}
              />
              <Input
                ref={searchRef}
                placeholder="Cari kelas, mapel, guru, atau ruang"
                prefix={<SearchOutlined />}
                allowClear
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  pg.setPage(1)
                }}
                style={{ flex: '1 1 200px', minWidth: 200 }}
              />
              <Select
                placeholder="Kelas"
                allowClear
                showSearch
                optionFilterProp="label"
                options={tabClasses.map((c) => ({ value: c.id, label: c.name }))}
                value={classId}
                onChange={(v) => {
                  setClassId(v)
                  pg.setPage(1)
                }}
                style={{ minWidth: 140 }}
              />
              {hasActiveFilters && (
                <Button icon={<UndoOutlined />} onClick={resetFilters}>
                  Reset
                </Button>
              )}
            </div>
          </Card>

          {view === 'grid' ? (
            <Card loading={schedulesQuery.isPending}>
              <GridView
                schedules={rows}
                days={Object.entries(DAY_LABELS)
                  .map(([value, label]) => ({ value: Number(value), label }))
                  .filter((d) => d.value <= 6 || rows.some((r) => r.day_of_week === d.value))}
                todayDay={todayDay}
                colorSource={allSchedules}
                conflictIds={conflictScheduleIds}
                conflictInfoMap={conflictInfoMap}
                onCellClick={canWrite ? openEdit : undefined}
              />
            </Card>
          ) : (
            <Card>
              <Table<Schedule>
                rowKey="id"
                columns={columns}
                dataSource={paginatedRows}
                loading={schedulesQuery.isPending}
                rowClassName={(row) => {
                  if (conflictScheduleIds.has(row.id)) return 'student-row-risk'
                  return row.day_of_week === todayDay && !day ? 'student-row-risk' : ''
                }}
                locale={{
                  emptyText: (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={hasActiveFilters ? 'Tidak ada jadwal yang cocok dengan filter' : 'Belum ada jadwal KBM'}
                    />
                  ),
                }}
                pagination={pg.pagination}
                scroll={{ x: true }}
              />
            </Card>
          )}
        </>
        )}
      </ShellItem>
      </ShellStagger>

      <ScheduleForm
        open={formOpen}
        schedule={editing}
        submitting={createMutation.isPending || updateMutation.isPending}
        existingSchedules={allSchedules}
        onCancel={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />

      <ConflictDrawer
        open={conflictDrawerOpen}
        conflictGroups={conflictGroups}
        onClose={() => setConflictDrawerOpen(false)}
        onEditSchedule={canWrite ? openEdit : undefined}
      />

      <ImportModal
        open={importOpen}
        existing={allSchedules}
        onClose={() => setImportOpen(false)}
      />

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        activeLevelName={activeTab === 'sma' ? 'SMA' : 'SMP'}
        filteredSchedules={rows}
        levelSchedules={levelSchedules}
        allSchedules={allSchedules}
        conflictSchedules={allSchedules.filter((s) => conflictScheduleIds.has(s.id))}
      />

      <SubstitutionModal
        open={substitutionSchedule !== null}
        schedule={substitutionSchedule}
        date={dayjs()}
        onClose={() => setSubstitutionSchedule(null)}
      />

      <ShortcutsModal open={shortcuts.isOpen} onClose={shortcuts.close} sections={shortcuts.sections} />
    </div>
  )
}
