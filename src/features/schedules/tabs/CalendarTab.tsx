import { useMemo, useState } from 'react'
import {
  Button,
  Calendar,
  Card,
  Empty,
  Grid,
  Input,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  type TableColumnsType,
} from 'antd'
import {
  CalendarOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  EnvironmentOutlined,
  PlusOutlined,
  SearchOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import isBetween from 'dayjs/plugin/isBetween'
import { StatChip } from '../../../shared/components/StatChip'
import { usePermissions } from '../../../shared/hooks/useProfile'
import { useTablePagination } from '../../../shared/hooks/useTablePagination'
import {
  useCalendarEvents,
  useCreateCalendarEvent,
  useDeleteCalendarEvent,
  useUpdateCalendarEvent,
} from '../calendarHooks'
import { EventModal } from '../components/EventModal'
import type { CalendarEvent, CalendarEventCategory, CalendarEventFormValues } from '../calendarTypes'

dayjs.extend(isBetween)

const CATEGORY_MAP: Record<CalendarEventCategory, { label: string; color: string; badgeStatus: 'processing' | 'success' | 'warning' | 'error' | 'default' }> = {
  akademik: { label: 'Akademik', color: 'blue', badgeStatus: 'processing' },
  pondok: { label: 'Pondok', color: 'purple', badgeStatus: 'processing' },
  ujian: { label: 'Ujian', color: 'orange', badgeStatus: 'warning' },
  libur: { label: 'Libur', color: 'green', badgeStatus: 'success' },
  umum: { label: 'Umum', color: 'cyan', badgeStatus: 'default' },
}

export function CalendarTab() {
  const screens = Grid.useBreakpoint()
  const isMobile = screens.md === false
  const { canWrite, canDelete } = usePermissions()

  const [view, setView] = useState<'calendar' | 'list'>('calendar')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [levelFilter, setLevelFilter] = useState<string>('')
  const [search, setSearch] = useState('')
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs())

  const [formOpen, setFormOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)

  const eventsQuery = useCalendarEvents()
  const createMutation = useCreateCalendarEvent()
  const updateMutation = useUpdateCalendarEvent()
  const deleteMutation = useDeleteCalendarEvent()

  const allEvents = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data])

  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allEvents.filter((ev) => {
      if (categoryFilter && ev.category !== categoryFilter) return false
      if (levelFilter && ev.target_level !== 'ALL' && ev.target_level !== levelFilter) return false
      if (q && !`${ev.title} ${ev.location ?? ''} ${ev.description ?? ''}`.toLowerCase().includes(q)) {
        return false
      }
      return true
    })
  }, [allEvents, categoryFilter, levelFilter, search])

  const pg = useTablePagination(filteredEvents.length, { label: 'kegiatan', defaultPageSize: 10 })

  // Events on currently selected date
  const selectedDateEvents = useMemo(() => {
    const dStr = selectedDate.format('YYYY-MM-DD')
    return allEvents.filter((ev) => dStr >= ev.start_date && dStr <= ev.end_date)
  }, [allEvents, selectedDate])

  const stats = useMemo(() => {
    const todayStr = dayjs().format('YYYY-MM-DD')
    const pondokCount = allEvents.filter((e) => e.category === 'pondok').length
    const ujianCount = allEvents.filter((e) => e.category === 'ujian').length
    const liburCount = allEvents.filter((e) => e.category === 'libur').length
    const ongoingCount = allEvents.filter((e) => todayStr >= e.start_date && todayStr <= e.end_date).length

    return {
      total: allEvents.length,
      ongoing: ongoingCount,
      pondok: pondokCount,
      ujian: ujianCount,
      libur: liburCount,
    }
  }, [allEvents])

  const handleOpenCreate = (date?: Dayjs) => {
    setEditingEvent(null)
    if (date) setSelectedDate(date)
    setFormOpen(true)
  }

  const handleOpenEdit = (event: CalendarEvent) => {
    setEditingEvent(event)
    setFormOpen(true)
  }

  const handleSubmit = (values: CalendarEventFormValues) => {
    if (editingEvent) {
      updateMutation.mutate(
        { id: editingEvent.id, values },
        { onSuccess: () => setFormOpen(false) },
      )
    } else {
      createMutation.mutate(values, {
        onSuccess: () => setFormOpen(false),
      })
    }
  }

  const dateCellRender = (date: Dayjs) => {
    const dStr = date.format('YYYY-MM-DD')
    const list = filteredEvents.filter((ev) => dStr >= ev.start_date && dStr <= ev.end_date)

    if (list.length === 0) return null

    return (
      <div style={{ padding: 2 }}>
        {list.slice(0, 3).map((item) => {
          const cat = CATEGORY_MAP[item.category]
          return (
            <div
              key={item.id}
              onClick={(e) => {
                e.stopPropagation()
                handleOpenEdit(item)
              }}
              style={{
                fontSize: 11,
                lineHeight: '16px',
                padding: '1px 4px',
                marginBottom: 2,
                borderRadius: 4,
                background: item.category === 'libur' ? '#f6ffed' : item.category === 'ujian' ? '#fff7e6' : item.category === 'pondok' ? '#f9f0ff' : '#e6f4ff',
                border: `1px solid ${item.category === 'libur' ? '#b7eb8f' : item.category === 'ujian' ? '#ffd591' : item.category === 'pondok' ? '#d3adf7' : '#91caff'}`,
                color: item.category === 'libur' ? '#389e0d' : item.category === 'ujian' ? '#d46b08' : item.category === 'pondok' ? '#531dab' : '#0958d9',
                cursor: canWrite ? 'pointer' : 'default',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={`${item.title} (${cat.label})`}
            >
              {item.title}
            </div>
          )
        })}
        {list.length > 3 && (
          <div style={{ fontSize: 10, color: '#8c8c8c', paddingLeft: 4 }}>
            +{list.length - 3} kegiatan
          </div>
        )}
      </div>
    )
  }

  const columns: TableColumnsType<CalendarEvent> = [
    {
      title: 'Tanggal',
      key: 'date',
      width: 170,
      render: (_, row) => {
        const isSame = row.start_date === row.end_date
        return (
          <div>
            <div style={{ fontWeight: 600 }}>
              {dayjs(row.start_date).format('DD MMM YYYY')}
              {!isSame && ` – ${dayjs(row.end_date).format('DD MMM YYYY')}`}
            </div>
            {row.start_time && (
              <div style={{ fontSize: 11.5, color: '#8c8c8c', display: 'flex', alignItems: 'center', gap: 4 }}>
                <ClockCircleOutlined />
                {row.start_time.slice(0, 5)} {row.end_time ? `– ${row.end_time.slice(0, 5)}` : 'WIB'}
              </div>
            )}
          </div>
        )
      },
    },
    {
      title: 'Agenda / Kegiatan',
      key: 'title',
      render: (_, row) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{row.title}</div>
          {row.description && (
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{row.description}</div>
          )}
          {row.location && (
            <div style={{ fontSize: 11.5, color: '#8c8c8c', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
              <EnvironmentOutlined /> {row.location}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Kategori',
      key: 'category',
      width: 120,
      render: (_, row) => {
        const cat = CATEGORY_MAP[row.category]
        return <Tag color={cat.color}>{cat.label}</Tag>
      },
    },
    {
      title: 'Sasaran',
      key: 'target',
      width: 110,
      render: (_, row) => (
        <Tag color={row.target_level === 'ALL' ? 'blue' : 'purple'}>
          {row.target_level === 'ALL' ? 'Semua' : row.target_level}
        </Tag>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 130,
      render: (_, row) => {
        const today = dayjs().startOf('day')
        const start = dayjs(row.start_date).startOf('day')
        const end = dayjs(row.end_date).endOf('day')

        if (today.isBetween(start, end, null, '[]')) {
          return <Tag color="processing">Berlangsung</Tag>
        }
        if (today.isBefore(start)) {
          const diffDays = start.diff(today, 'day')
          if (diffDays === 1) return <Tag color="warning">Besok</Tag>
          return <Tag color="default">{diffDays} hari lagi</Tag>
        }
        return <Tag color="default">Selesai</Tag>
      },
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 100,
      render: (_, row) =>
        canWrite || canDelete ? (
          <Space size="small">
            {canWrite && (
              <Tooltip title="Edit">
                <Button type="text" icon={<EditOutlined />} onClick={() => handleOpenEdit(row)} />
              </Tooltip>
            )}
            {canDelete && (
              <Popconfirm
                title="Hapus agenda ini?"
                onConfirm={() => deleteMutation.mutate(row.id)}
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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <StatChip
          icon={<CalendarOutlined />}
          label="Total Agenda"
          value={stats.total}
          color="indigo"
          loading={eventsQuery.isPending}
          active={categoryFilter === ''}
          onClick={() => setCategoryFilter('')}
        />
        <StatChip
          icon={<ClockCircleOutlined />}
          label="Sedang Berlangsung"
          value={stats.ongoing}
          color="sky"
          loading={eventsQuery.isPending}
        />
        <StatChip
          icon={<CalendarOutlined />}
          label="Kegiatan Pondok"
          value={stats.pondok}
          color="purple"
          loading={eventsQuery.isPending}
          active={categoryFilter === 'pondok'}
          onClick={() => setCategoryFilter(categoryFilter === 'pondok' ? '' : 'pondok')}
        />
        <StatChip
          icon={<CalendarOutlined />}
          label="Ujian & Asesmen"
          value={stats.ujian}
          color="amber"
          loading={eventsQuery.isPending}
          active={categoryFilter === 'ujian'}
          onClick={() => setCategoryFilter(categoryFilter === 'ujian' ? '' : 'ujian')}
        />
        <StatChip
          icon={<CalendarOutlined />}
          label="Libur & Perpulangan"
          value={stats.libur}
          color="emerald"
          loading={eventsQuery.isPending}
          active={categoryFilter === 'libur'}
          onClick={() => setCategoryFilter(categoryFilter === 'libur' ? '' : 'libur')}
        />
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
          <Space wrap size="small">
            <Segmented
              value={view}
              onChange={(v) => setView(v as 'calendar' | 'list')}
              options={[
                { label: 'Kalender', value: 'calendar', icon: <CalendarOutlined /> },
                { label: 'Daftar Agenda', value: 'list', icon: <UnorderedListOutlined /> },
              ]}
            />
            <Select
              placeholder="Semua Kategori"
              allowClear
              value={categoryFilter || undefined}
              onChange={(v) => setCategoryFilter(v ?? '')}
              style={{ minWidth: 150 }}
              options={[
                { value: 'akademik', label: 'Akademik / KBM' },
                { value: 'pondok', label: 'Kegiatan Pondok' },
                { value: 'ujian', label: 'Ujian / Asesmen' },
                { value: 'libur', label: 'Libur / Perpulangan' },
                { value: 'umum', label: 'Agenda Umum' },
              ]}
            />
            <Select
              placeholder="Semua Jenjang"
              allowClear
              value={levelFilter || undefined}
              onChange={(v) => setLevelFilter(v ?? '')}
              style={{ minWidth: 130 }}
              options={[
                { value: 'ALL', label: 'Semua Jenjang' },
                { value: 'SMP', label: 'Khusus SMP' },
                { value: 'SMA', label: 'Khusus SMA' },
              ]}
            />
            <Input
              placeholder="Cari kegiatan, lokasi, info..."
              prefix={<SearchOutlined />}
              allowClear
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ minWidth: 200 }}
            />
          </Space>

          {canWrite && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => handleOpenCreate(selectedDate)}
            >
              Tambah Agenda
            </Button>
          )}
        </div>
      </Card>

      {view === 'calendar' ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 300px',
            gap: 16,
            alignItems: 'start',
          }}
        >
          <Card loading={eventsQuery.isPending}>
            <Calendar
              cellRender={dateCellRender}
              value={selectedDate}
              onSelect={(d) => setSelectedDate(d)}
            />
          </Card>

          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14 }}>
                  {selectedDate.format('D MMMM YYYY')}
                </span>
                {canWrite && (
                  <Button
                    type="link"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => handleOpenCreate(selectedDate)}
                  >
                    Tambah
                  </Button>
                )}
              </div>
            }
          >
            {selectedDateEvents.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Tidak ada agenda pada tanggal ini"
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {selectedDateEvents.map((ev) => {
                  const cat = CATEGORY_MAP[ev.category]
                  return (
                    <div
                      key={ev.id}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: '1px solid #f0f0f0',
                        background: '#fafafa',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                        <span style={{ fontWeight: 600, fontSize: 13.5 }}>{ev.title}</span>
                        <Tag color={cat.color}>{cat.label}</Tag>
                      </div>
                      {ev.start_time && (
                        <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <ClockCircleOutlined /> {ev.start_time.slice(0, 5)} {ev.end_time ? `– ${ev.end_time.slice(0, 5)}` : 'WIB'}
                        </div>
                      )}
                      {ev.location && (
                        <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <EnvironmentOutlined /> {ev.location}
                        </div>
                      )}
                      {ev.description && (
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 6, lineHeight: 1.4 }}>
                          {ev.description}
                        </div>
                      )}
                      {canWrite && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                          <Button size="small" type="link" icon={<EditOutlined />} onClick={() => handleOpenEdit(ev)}>
                            Edit
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </div>
      ) : (
        <Card>
          <Table<CalendarEvent>
            rowKey="id"
            columns={columns}
            dataSource={filteredEvents}
            scroll={{ x: 'max-content' }}
            loading={eventsQuery.isPending}
            locale={{
              emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada agenda kegiatan" />,
            }}
            pagination={pg.pagination}
          />
        </Card>
      )}

      <EventModal
        open={formOpen}
        event={editingEvent}
        initialDate={selectedDate}
        submitting={createMutation.isPending || updateMutation.isPending}
        onCancel={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
