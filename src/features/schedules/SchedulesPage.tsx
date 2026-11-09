import { useMemo, useRef, useState } from 'react'
import {
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
  Tag,
  Tooltip,
  type InputRef,
  type TableColumnsType,
} from 'antd'
import {
  CalendarOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
  SyncOutlined,
  UndoOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import Papa from 'papaparse'
import { PageHeader } from '../../shared/components/PageHeader'
import { ShortcutsModal } from '../../shared/components/ShortcutsModal'
import { StatChip } from '../../shared/components/StatChip'
import { useDebounce } from '../../shared/hooks/useDebounce'
import { useShortcuts, type ShortcutItem } from '../../shared/hooks/useShortcuts'
import { usePermissions } from '../../shared/hooks/useProfile'
import {
  findConflicts,
  useClassesBrief,
  useCreateSchedule,
  useDeleteSchedule,
  useSchedules,
  useUpdateSchedule,
} from './hooks'
import { ScheduleForm } from './components/ScheduleForm'
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

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [day, setDay] = useState<string>('')
  const [classId, setClassId] = useState<string | undefined>(undefined)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Schedule | null>(null)
  const [exporting, setExporting] = useState(false)
  const searchRef = useRef<InputRef>(null)

  const schedulesQuery = useSchedules()
  const classesQuery = useClassesBrief()
  const createMutation = useCreateSchedule()
  const updateMutation = useUpdateSchedule()
  const deleteMutation = useDeleteSchedule()
  const allSchedules = useMemo(() => schedulesQuery.data ?? [], [schedulesQuery.data])
  const isRefreshing = schedulesQuery.isFetching

  const todayDay = dbDay()

  const rows = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return allSchedules.filter((s) => {
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
  }, [allSchedules, debouncedSearch, day, classId])

  const paginatedRows = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [rows, page, pageSize],
  )

  const resetFilters = () => {
    setSearch('')
    setDay('')
    setClassId(undefined)
    setPage(1)
  }

  const hasActiveFilters = Boolean(debouncedSearch || day || classId)

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
              • <b>{reason === 'class' ? 'Kelas' : 'Guru'}</b>{' '}
              {reason === 'class'
                ? className
                : schedule.teachers?.name ?? 'yang sama'}{' '}
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

  const handleExport = async () => {
    setExporting(true)
    try {
      const csv = Papa.unparse({
        fields: ['Hari', 'Mulai', 'Selesai', 'Kelas', 'Mapel', 'Pengajar', 'Ruang'],
        data: rows.map((s) => [
          DAY_LABELS[s.day_of_week],
          shortTime(s.start_time),
          shortTime(s.end_time),
          s.classes?.name ?? '',
          s.subjects?.name ?? '',
          s.teachers?.name ?? '',
          s.room ?? '',
        ]),
      })
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `jadwal-kbm-${dayjs().format('YYYY-MM-DD')}.csv`
      link.click()
      URL.revokeObjectURL(url)
      message.success(`${rows.length} jadwal diekspor`)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Gagal mengekspor CSV')
    } finally {
      setExporting(false)
    }
  }

  const stats = useMemo(
    () => ({
      total: allSchedules.length,
      today: allSchedules.filter((s) => s.day_of_week === todayDay).length,
      classes: new Set(allSchedules.map((s) => s.class_id)).size,
      teachers: new Set(allSchedules.map((s) => s.teacher_id).filter(Boolean)).size,
    }),
    [allSchedules, todayDay],
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
      render: (_, row) => row.teachers?.name ?? '-',
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
      title: 'Aksi',
      key: 'actions',
      width: 110,
      render: (_, row) =>
        canWrite || canDelete ? (
          <Space size="small">
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
      <PageHeader
        title="Jadwal KBM"
        subtitle="Jadwal kegiatan belajar-mengajar per kelas, mapel, dan pengajar"
        extra={
          <Space wrap>
            <Tooltip title="Muat ulang (R)">
              <Button icon={<SyncOutlined spin={isRefreshing} />} onClick={() => void schedulesQuery.refetch()} />
            </Tooltip>
            <Button icon={<DownloadOutlined />} loading={exporting} onClick={handleExport}>
              CSV
            </Button>
            <Tooltip title="Palet shortcut (?)">
              <Button icon={<QuestionCircleOutlined />} onClick={shortcuts.open} />
            </Tooltip>
            {canWrite && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Tambah Jadwal
              </Button>
            )}
          </Space>
        }
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <StatChip
          icon={<CalendarOutlined />}
          label="Total Jadwal"
          value={stats.total}
          color="indigo"
          loading={schedulesQuery.isPending}
          active={day === ''}
          onClick={() => {
            setDay('')
            setPage(1)
          }}
        />
        <StatChip
          icon={<CalendarOutlined />}
          label={`Jadwal Hari Ini (${DAY_LABELS[todayDay]})`}
          value={stats.today}
          color="purple"
          loading={schedulesQuery.isPending}
          active={day === String(todayDay)}
          onClick={() => {
            setDay(day === String(todayDay) ? '' : String(todayDay))
            setPage(1)
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
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <Segmented
            value={day}
            onChange={(v) => {
              setDay(v)
              setPage(1)
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
              setPage(1)
            }}
            style={{ flex: '1 1 200px', minWidth: 200 }}
          />
          <Select
            placeholder="Kelas"
            allowClear
            showSearch
            optionFilterProp="label"
            options={(classesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            value={classId}
            onChange={(v) => {
              setClassId(v)
              setPage(1)
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

      <Card>
        <Table<Schedule>
          rowKey="id"
          columns={columns}
          dataSource={paginatedRows}
          loading={schedulesQuery.isPending}
          rowClassName={(row) => (row.day_of_week === todayDay && !day ? 'student-row-risk' : '')}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={hasActiveFilters ? 'Tidak ada jadwal yang cocok dengan filter' : 'Belum ada jadwal KBM'}
              />
            ),
          }}
          pagination={{
            current: page,
            pageSize,
            total: rows.length,
            showSizeChanger: true,
            showTotal: (t) => `Total ${t} jadwal`,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
          scroll={{ x: true }}
        />
      </Card>

      <ScheduleForm
        open={formOpen}
        schedule={editing}
        submitting={createMutation.isPending || updateMutation.isPending}
        onCancel={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />

      <ShortcutsModal open={shortcuts.isOpen} onClose={shortcuts.close} sections={shortcuts.sections} />
    </div>
  )
}
