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
  Table,
  Tag,
  Tooltip,
  type InputRef,
  type TableColumnsType,
} from 'antd'
import {
  AimOutlined,
  AlertOutlined,
  DeleteOutlined,
  EditOutlined,
  OrderedListOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
  SyncOutlined,
  UndoOutlined,
} from '@ant-design/icons'
import { StatChip } from '../../../shared/components/StatChip'
import { useTabActions } from '../../../shared/components/ActionsSlot'
import { ShortcutsModal } from '../../../shared/components/ShortcutsModal'
import { useShortcuts, type ShortcutItem } from '../../../shared/hooks/useShortcuts'
import { useDebounce } from '../../../shared/hooks/useDebounce'
import { usePermissions } from '../../../shared/hooks/useProfile'
import { useTablePagination } from '../../../shared/hooks/useTablePagination'
import {
  useCreateCp,
  useCurriculumCps,
  useCurriculumTps,
  useDeleteCp,
  useSubjectsBrief,
  useUpdateCp,
} from '../hooks'
import { PHASE_OPTIONS, type CpFormValues } from '../types'
import { CpForm } from '../components/CpForm'
import { TpDrawer } from '../components/TpDrawer'
import type { CurriculumCp } from '../../documents/api'

interface CurriculumTabProps {
  /** true saat tab ini aktif — wajib untuk gate portal aksi & shortcut keyboard */
  active: boolean
}

/** Tab "CP/TP" — kelola Capaian & Tujuan Pembelajaran per mata pelajaran. */
export function CurriculumTab({ active }: CurriculumTabProps) {
  const { message } = App.useApp()
  const { canWrite, canDelete } = usePermissions()

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [subjectFilter, setSubjectFilter] = useState<string | undefined>(undefined)
  const [phaseFilter, setPhaseFilter] = useState<string | undefined>(undefined)
  const [onlyWithoutTp, setOnlyWithoutTp] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CurriculumCp | null>(null)
  const [drawerCp, setDrawerCp] = useState<CurriculumCp | null>(null)
  const searchRef = useRef<InputRef>(null)

  const cpsQuery = useCurriculumCps()
  const tpsQuery = useCurriculumTps()
  const subjectsBriefQuery = useSubjectsBrief()

  const createMutation = useCreateCp()
  const updateMutation = useUpdateCp()
  const deleteMutation = useDeleteCp()

  const allCps = useMemo(() => cpsQuery.data ?? [], [cpsQuery.data])
  const allTps = useMemo(() => tpsQuery.data ?? [], [tpsQuery.data])

  // Hitung jumlah TP per CP
  const tpCountMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of allTps) {
      map.set(t.cp_id, (map.get(t.cp_id) ?? 0) + 1)
    }
    return map
  }, [allTps])

  // Pilihan mapel untuk form: gabungkan mapel aktif + mapel yang sudah dipakai di CP (anti-typo)
  const subjectOptions = useMemo(() => {
    const set = new Set<string>()
    for (const s of subjectsBriefQuery.data ?? []) set.add(s.name)
    for (const c of allCps) set.add(c.subject)
    return [...set].sort((a, b) => a.localeCompare(b, 'id')).map((s) => ({ value: s }))
  }, [subjectsBriefQuery.data, allCps])

  // Pilihan filter mapel
  const filterSubjectOptions = useMemo(() => {
    const set = new Set<string>()
    for (const c of allCps) set.add(c.subject)
    return [...set].sort((a, b) => a.localeCompare(b, 'id')).map((s) => ({ value: s, label: s }))
  }, [allCps])

  // Filter baris CP
  const rows = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return allCps.filter((c) => {
      if (q && !`${c.subject} ${c.description}`.toLowerCase().includes(q)) return false
      if (subjectFilter && c.subject !== subjectFilter) return false
      if (phaseFilter && c.phase !== phaseFilter) return false
      if (onlyWithoutTp && (tpCountMap.get(c.id) ?? 0) > 0) return false
      return true
    })
  }, [allCps, debouncedSearch, subjectFilter, phaseFilter, onlyWithoutTp, tpCountMap])

  const pg = useTablePagination(rows.length, { label: 'CP' })

  const paginatedRows = useMemo(
    () => rows.slice((pg.page - 1) * pg.pageSize, pg.page * pg.pageSize),
    [rows, pg.page, pg.pageSize],
  )

  const resetFilters = () => {
    setSearch('')
    setSubjectFilter(undefined)
    setPhaseFilter(undefined)
    setOnlyWithoutTp(false)
    pg.setPage(1)
  }

  const hasActiveFilters = Boolean(
    debouncedSearch || subjectFilter || phaseFilter || onlyWithoutTp,
  )

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (cp: CurriculumCp) => {
    setEditing(cp)
    setFormOpen(true)
  }

  const handleSubmit = (values: CpFormValues) => {
    const onError = (err: Error) =>
      message.error(err.message || 'Gagal menyimpan capaian pembelajaran')

    if (editing) {
      updateMutation.mutate(
        { id: editing.id, values },
        {
          onSuccess: () => {
            message.success('Capaian pembelajaran diperbarui')
            setFormOpen(false)
          },
          onError,
        },
      )
    } else {
      createMutation.mutate(values, {
        onSuccess: () => {
          message.success('Capaian pembelajaran ditambahkan')
          setFormOpen(false)
        },
        onError,
      })
    }
  }

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => message.success('CP beserta tujuan pembelajarannya dihapus'),
      onError: (err: Error) => message.error(err.message || 'Gagal menghapus CP'),
    })
  }

  const withoutTpCount = useMemo(
    () => allCps.filter((c) => (tpCountMap.get(c.id) ?? 0) === 0).length,
    [allCps, tpCountMap],
  )

  const isBlocked = formOpen || drawerCp !== null || !active

  const shortcutItems: ShortcutItem[] = [
    {
      keys: ['N'],
      label: 'Tambah CP',
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
      label: 'Reset filter',
      group: 'Navigasi',
      icon: <UndoOutlined />,
      run: resetFilters,
      when: hasActiveFilters,
    },
    {
      keys: ['R'],
      label: 'Muat ulang data',
      group: 'Tampilan',
      icon: <SyncOutlined />,
      run: () => {
        void cpsQuery.refetch()
        void tpsQuery.refetch()
      },
    },
    {
      keys: ['?'],
      label: 'Palet shortcut',
      group: 'Bantuan',
      icon: <QuestionCircleOutlined />,
      run: () => shortcuts.toggle(),
    },
  ]

  const shortcuts = useShortcuts({ items: shortcutItems, isBlocked })

  const columns: TableColumnsType<CurriculumCp> = [
    {
      title: 'Mata Pelajaran',
      dataIndex: 'subject',
      key: 'subject',
      width: 200,
      render: (v: string) => <span style={{ fontWeight: 600 }}>{v}</span>,
    },
    {
      title: 'Fase',
      dataIndex: 'phase',
      key: 'phase',
      width: 90,
      align: 'center',
      render: (v: string) => <Tag color="purple">Fase {v}</Tag>,
    },
    {
      title: 'Deskripsi Capaian',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (v: string) => (
        <span style={{ fontSize: 13, color: 'rgba(0,0,0,0.85)' }}>{v}</span>
      ),
    },
    {
      title: 'Urutan',
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 80,
      align: 'center',
      responsive: ['md'],
      render: (v: number) => v ?? 0,
    },
    {
      title: 'TP',
      key: 'tp_count',
      width: 100,
      align: 'center',
      render: (_, row) => {
        const count = tpCountMap.get(row.id) ?? 0
        return (
          <Tag color={count > 0 ? 'blue' : 'default'} style={{ borderRadius: 6, fontWeight: 500 }}>
            {count} TP
          </Tag>
        )
      },
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 160,
      render: (_, row) => (
        <Space size="small">
          <Tooltip title="Kelola Tujuan Pembelajaran (TP)">
            <Button
              size="small"
              icon={<OrderedListOutlined />}
              onClick={() => setDrawerCp(row)}
            >
              Kelola TP
            </Button>
          </Tooltip>
          {canWrite && (
            <Tooltip title="Edit CP">
              <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
            </Tooltip>
          )}
          {canDelete && (
            <Popconfirm
              title="Hapus CP ini?"
              description="Tujuan pembelajaran (TP) milik CP ini akan ikut ditandai terhapus."
              onConfirm={() => handleDelete(row.id)}
              okText="Hapus"
              cancelText="Batal"
            >
              <Tooltip title="Hapus">
                <Button
                  type="text"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  loading={deleteMutation.isPending && deleteMutation.variables === row.id}
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  const tabActions = useTabActions(
    active,
    <Space wrap>
      <Tooltip title="Muat ulang (R)">
        <Button
          icon={<SyncOutlined spin={cpsQuery.isFetching || tpsQuery.isFetching} />}
          onClick={() => {
            void cpsQuery.refetch()
            void tpsQuery.refetch()
          }}
        />
      </Tooltip>
      <Tooltip title="Palet shortcut (?)">
        <Button icon={<QuestionCircleOutlined />} onClick={shortcuts.open} />
      </Tooltip>
      {canWrite && (
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Tambah CP
        </Button>
      )}
    </Space>,
  )

  return (
    <div>
      {tabActions}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <StatChip
          icon={<AimOutlined />}
          label="Total CP"
          value={allCps.length}
          color="indigo"
          loading={cpsQuery.isPending}
          active={!hasActiveFilters}
          onClick={resetFilters}
        />
        <StatChip
          icon={<OrderedListOutlined />}
          label="Total TP"
          value={allTps.length}
          color="purple"
          loading={tpsQuery.isPending}
        />
        <StatChip
          icon={<AlertOutlined />}
          label="Tanpa TP"
          value={withoutTpCount}
          color="amber"
          loading={cpsQuery.isPending}
          hideIfZero
          active={onlyWithoutTp}
          onClick={() => {
            setOnlyWithoutTp((v) => !v)
            pg.setPage(1)
          }}
        />
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <Input
            ref={searchRef}
            placeholder="Cari mapel atau deskripsi capaian"
            prefix={<SearchOutlined />}
            allowClear
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              pg.setPage(1)
            }}
            style={{ flex: '1 1 240px', minWidth: 220 }}
          />
          <Select
            placeholder="Pilih Mapel"
            allowClear
            showSearch
            options={filterSubjectOptions}
            value={subjectFilter}
            onChange={(v) => {
              setSubjectFilter(v)
              pg.setPage(1)
            }}
            style={{ minWidth: 180 }}
          />
          <Select
            placeholder="Fase"
            allowClear
            options={PHASE_OPTIONS}
            value={phaseFilter}
            onChange={(v) => {
              setPhaseFilter(v)
              pg.setPage(1)
            }}
            style={{ minWidth: 130 }}
          />
          {hasActiveFilters && (
            <Button icon={<UndoOutlined />} onClick={resetFilters}>
              Reset
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <Table<CurriculumCp>
          rowKey="id"
          columns={columns}
          dataSource={paginatedRows}
          loading={cpsQuery.isPending || tpsQuery.isPending}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  hasActiveFilters
                    ? 'Tidak ada CP yang cocok dengan filter'
                    : 'Belum ada capaian pembelajaran — tambahkan CP pertama'
                }
              />
            ),
          }}
          pagination={pg.pagination}
          scroll={{ x: true }}
        />
      </Card>

      <CpForm
        open={formOpen}
        cp={editing}
        submitting={createMutation.isPending || updateMutation.isPending}
        subjectOptions={subjectOptions}
        onCancel={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />

      <TpDrawer
        key={drawerCp?.id ?? 'closed'}
        open={drawerCp !== null}
        cp={drawerCp}
        onClose={() => setDrawerCp(null)}
      />

      <ShortcutsModal open={shortcuts.isOpen} onClose={shortcuts.close} sections={shortcuts.sections} />
    </div>
  )
}
