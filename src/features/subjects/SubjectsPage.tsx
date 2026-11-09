import { useMemo, useRef, useState } from 'react'
import {
  App,
  Button,
  Card,
  Empty,
  Input,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  type InputRef,
  type TableColumnsType,
} from 'antd'
import {
  BookOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
  StopOutlined,
  SyncOutlined,
  UndoOutlined,
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
  useCreateSubject,
  useDeleteSubject,
  useSubjects,
  useUpdateSubject,
} from './hooks'
import { SubjectForm } from './components/SubjectForm'
import type { Subject, SubjectFormValues } from './types'

type ActiveFilter = '' | 'active' | 'inactive'

export function SubjectsPage() {
  const { message } = App.useApp()
  const { canWrite, canDelete } = usePermissions()

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [category, setCategory] = useState<string | undefined>(undefined)
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Subject | null>(null)
  const [exporting, setExporting] = useState(false)
  const searchRef = useRef<InputRef>(null)

  const subjectsQuery = useSubjects()
  const createMutation = useCreateSubject()
  const updateMutation = useUpdateSubject()
  const deleteMutation = useDeleteSubject()
  const allSubjects = subjectsQuery.data ?? []
  const isRefreshing = subjectsQuery.isFetching

  const categoryOptions = useMemo(() => {
    const set = new Set<string>()
    for (const s of allSubjects) if (s.category) set.add(s.category)
    return [...set].sort((a, b) => a.localeCompare(b)).map((c) => ({ value: c, label: c }))
  }, [allSubjects])

  // Pola fetch-sekali: mapel volumenya kecil, filter + paginate di memori
  const rows = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return allSubjects.filter((s) => {
      if (q && !`${s.name} ${s.code ?? ''} ${s.category ?? ''}`.toLowerCase().includes(q)) return false
      if (category && s.category !== category) return false
      if (activeFilter === 'active' && !s.is_active) return false
      if (activeFilter === 'inactive' && s.is_active) return false
      return true
    })
  }, [allSubjects, debouncedSearch, category, activeFilter])

  const paginatedRows = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [rows, page, pageSize],
  )

  const resetFilters = () => {
    setSearch('')
    setCategory(undefined)
    setActiveFilter('')
    setPage(1)
  }

  const hasActiveFilters = Boolean(debouncedSearch || category || activeFilter)

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (subject: Subject) => {
    setEditing(subject)
    setFormOpen(true)
  }

  const handleSubmit = (values: SubjectFormValues) => {
    const onError = (err: Error) => message.error(err.message || 'Gagal menyimpan mapel')
    if (editing) {
      updateMutation.mutate(
        { id: editing.id, values },
        {
          onSuccess: () => {
            message.success('Mata pelajaran diperbarui')
            setFormOpen(false)
          },
          onError,
        },
      )
    } else {
      createMutation.mutate(values, {
        onSuccess: () => {
          message.success('Mata pelajaran ditambahkan')
          setFormOpen(false)
        },
        onError,
      })
    }
  }

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => message.success('Mata pelajaran dihapus'),
      onError: (err: Error) => message.error(err.message || 'Gagal menghapus mata pelajaran'),
    })
  }

  const handleToggleActive = (subject: Subject) => {
    updateMutation.mutate(
      { id: subject.id, values: { name: subject.name, code: subject.code ?? undefined, weekly_hours: subject.weekly_hours, category: subject.category ?? undefined, description: subject.description ?? undefined, is_active: !subject.is_active } },
      {
        onSuccess: () =>
          message.success(subject.is_active ? 'Mapel dinonaktifkan' : 'Mapel diaktifkan'),
        onError: (err: Error) => message.error(err.message || 'Gagal mengubah status mapel'),
      },
    )
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const csv = Papa.unparse({
        fields: ['Nama Mapel', 'Kode', 'Kelompok', 'JP/Minggu', 'Status'],
        data: rows.map((s) => [
          s.name,
          s.code ?? '',
          s.category ?? '',
          s.weekly_hours,
          s.is_active ? 'Aktif' : 'Nonaktif',
        ]),
      })
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `mata-pelajaran-${dayjs().format('YYYY-MM-DD')}.csv`
      link.click()
      URL.revokeObjectURL(url)
      message.success(`${rows.length} mapel diekspor`)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Gagal mengekspor CSV')
    } finally {
      setExporting(false)
    }
  }

  const stats = useMemo(
    () => ({
      total: allSubjects.length,
      active: allSubjects.filter((s) => s.is_active).length,
      inactive: allSubjects.filter((s) => !s.is_active).length,
      hours: allSubjects
        .filter((s) => s.is_active)
        .reduce((sum, s) => sum + (s.weekly_hours || 0), 0),
    }),
    [allSubjects],
  )

  const shortcutItems = useMemo<ShortcutItem[]>(
    () => [
      {
        keys: ['N'],
        label: 'Tambah Mapel',
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

  const columns: TableColumnsType<Subject> = [
    {
      title: 'Mata Pelajaran',
      dataIndex: 'name',
      key: 'name',
      render: (_, row) => (
        <div>
          <span style={{ fontWeight: 500 }}>{row.name}</span>
          {row.code && (
            <Tag style={{ marginLeft: 8, borderRadius: 6, fontSize: 11 }}>{row.code}</Tag>
          )}
          {row.description && (
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>{row.description}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Kelompok',
      dataIndex: 'category',
      key: 'category',
      width: 140,
      render: (v: string | null) => (v ? <Tag>{v}</Tag> : '-'),
      responsive: ['md'],
    },
    {
      title: 'JP/Minggu',
      dataIndex: 'weekly_hours',
      key: 'weekly_hours',
      width: 110,
      align: 'center',
      render: (v: number) => <span style={{ fontWeight: 600 }}>{v}</span>,
      responsive: ['md'],
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 120,
      render: (v: boolean, row) =>
        canWrite ? (
          <Switch
            size="small"
            checked={v}
            checkedChildren="Aktif"
            unCheckedChildren="Off"
            loading={updateMutation.isPending && updateMutation.variables?.id === row.id}
            onChange={() => handleToggleActive(row)}
          />
        ) : v ? (
          <Tag color="green">Aktif</Tag>
        ) : (
          <Tag>Nonaktif</Tag>
        ),
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
                title="Hapus mapel ini?"
                description="Jadwal KBM yang memakai mapel ini tidak ikut terhapus."
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
        title="Mata Pelajaran"
        subtitle="Kelola daftar mapel, kelompok, dan beban jam per minggu"
        extra={
          <Space wrap>
            <Tooltip title="Muat ulang (R)">
              <Button icon={<SyncOutlined spin={isRefreshing} />} onClick={() => void subjectsQuery.refetch()} />
            </Tooltip>
            <Button icon={<DownloadOutlined />} loading={exporting} onClick={handleExport}>
              CSV
            </Button>
            <Tooltip title="Palet shortcut (?)">
              <Button icon={<QuestionCircleOutlined />} onClick={shortcuts.open} />
            </Tooltip>
            {canWrite && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Tambah Mapel
              </Button>
            )}
          </Space>
        }
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <StatChip
          icon={<BookOutlined />}
          label="Total Mapel"
          value={stats.total}
          color="indigo"
          loading={subjectsQuery.isPending}
          active={activeFilter === ''}
          onClick={() => {
            setActiveFilter('')
            setPage(1)
          }}
        />
        <StatChip
          icon={<BookOutlined />}
          label="Aktif"
          value={stats.active}
          color="emerald"
          loading={subjectsQuery.isPending}
          active={activeFilter === 'active'}
          onClick={() => {
            setActiveFilter(activeFilter === 'active' ? '' : 'active')
            setPage(1)
          }}
        />
        <StatChip
          icon={<StopOutlined />}
          label="Nonaktif"
          value={stats.inactive}
          color="rose"
          loading={subjectsQuery.isPending}
          active={activeFilter === 'inactive'}
          onClick={() => {
            setActiveFilter(activeFilter === 'inactive' ? '' : 'inactive')
            setPage(1)
          }}
        />
        <StatChip
          icon={<BookOutlined />}
          label="Total JP Aktif"
          value={stats.hours}
          color="purple"
          loading={subjectsQuery.isPending}
        />
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <Input
            ref={searchRef}
            placeholder="Cari nama, kode, atau kelompok mapel"
            prefix={<SearchOutlined />}
            allowClear
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            style={{ flex: '1 1 240px', minWidth: 220 }}
          />
          <Select
            placeholder="Kelompok"
            allowClear
            options={categoryOptions}
            value={category}
            onChange={(v) => {
              setCategory(v)
              setPage(1)
            }}
            style={{ minWidth: 150 }}
          />
          {hasActiveFilters && (
            <Button icon={<UndoOutlined />} onClick={resetFilters}>
              Reset
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <Table<Subject>
          rowKey="id"
          columns={columns}
          dataSource={paginatedRows}
          loading={subjectsQuery.isPending}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={hasActiveFilters ? 'Tidak ada mapel yang cocok dengan filter' : 'Belum ada mata pelajaran'}
              />
            ),
          }}
          pagination={{
            current: page,
            pageSize,
            total: rows.length,
            showSizeChanger: true,
            showTotal: (t) => `Total ${t} mapel`,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
          scroll={{ x: true }}
        />
      </Card>

      <SubjectForm
        open={formOpen}
        subject={editing}
        submitting={createMutation.isPending || updateMutation.isPending}
        onCancel={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />

      <ShortcutsModal open={shortcuts.isOpen} onClose={shortcuts.close} sections={shortcuts.sections} />
    </div>
  )
}
