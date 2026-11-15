import { useMemo, useRef, useState } from 'react'
import {
  App,
  Avatar,
  Button,
  Card,
  Empty,
  Input,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  theme,
  Tooltip,
  type InputRef,
  type TableColumnsType,
  type TableProps,
} from 'antd'
import {
  CheckSquareOutlined,
  CrownFilled,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FileExcelOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
  StopOutlined,
  SyncOutlined,
  TeamOutlined,
  TrophyOutlined,
  UndoOutlined,
  UserOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { ShortcutsModal } from '../../../shared/components/ShortcutsModal'
import { StatChip } from '../../../shared/components/StatChip'
import { FilterChips, type FilterChip } from '../../../shared/components/FilterChips'
import { ActionBar } from '../../../shared/components/ActionBar'
import { ShellItem, ShellStagger } from '../../../shared/components/ShellMotion'
import { SortIcon } from '../../../shared/components/SortIcon'
import { columnSortOrder, sortByFromTableChange } from '../../../shared/utils/tableSort'
import { downloadCsv } from '../../../shared/utils/csv'
import { useDebounce } from '../../../shared/hooks/useDebounce'
import { useShortcuts, type ShortcutItem } from '../../../shared/hooks/useShortcuts'
import { useTabActions } from '../../../shared/components/ActionsSlot'
import { usePermissions } from '../../../shared/hooks/useProfile'
import {
  useBulkDeleteEkskul,
  useCreateEkskul,
  useDeleteEkskul,
  useEkskul,
  useTeachersBrief,
  useUpdateEkskul,
} from '../hooks'
import { EkskulForm } from '../components/EkskulForm'
import { ImportModal } from '../components/ImportModal'
import { MemberDrawer } from '../components/MemberDrawer'
import type { Ekskul, EkskulFormValues } from '../types'

// Pasangan [asc, desc] per kolom sorter — dipakai header tabel & onChange sorter
type SortOption = 'name_asc' | 'name_desc' | 'members_asc' | 'members_desc'

const SORT_PAIRS: Record<string, readonly [SortOption, SortOption]> = {
  name: ['name_asc', 'name_desc'],
  members: ['members_asc', 'members_desc'],
}

function memberCount(ekskul: Ekskul): number {
  return ekskul.members?.[0]?.count ?? 0
}

export function KegiatanTab({ active }: { active: boolean }) {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const { canWrite, canDelete } = usePermissions()

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  // undefined = semua, 'coached' = ada pembina, 'uncoached' = tanpa pembina
  const [coachFilter, setCoachFilter] = useState<'coached' | 'uncoached' | undefined>()
  const [coachId, setCoachId] = useState<string | undefined>()
  // Default undefined: fetch sudah urut nama, dan highlight kolom ter-sort antd
  // tidak boleh menyala permanen di kolom Kegiatan
  const [sortBy, setSortBy] = useState<SortOption | undefined>()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editing, setEditing] = useState<Ekskul | null>(null)
  const [memberEkskul, setMemberEkskul] = useState<Ekskul | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const searchRef = useRef<InputRef>(null)

  const ekskulQuery = useEkskul()
  const teachersQuery = useTeachersBrief()
  const createMutation = useCreateEkskul()
  const updateMutation = useUpdateEkskul()
  const deleteMutation = useDeleteEkskul()
  const bulkDeleteMutation = useBulkDeleteEkskul()
  const allEkskul = ekskulQuery.data ?? []
  const isRefreshing = ekskulQuery.isFetching || teachersQuery.isFetching

  // Filter + sort di memori sebelum slice pagination — sorter antd bekerja pada
  // dataSource yang sudah dipaginasi, jadi urutan HARUS selesai di sini (pola StudentsPage)
  const rows = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    const filtered = allEkskul.filter((e) => {
      if (
        q &&
        !`${e.name} ${e.teachers?.name ?? ''} ${e.place ?? ''} ${e.schedule ?? ''}`
          .toLowerCase()
          .includes(q)
      )
        return false
      if (coachFilter === 'coached' && !e.coach_id) return false
      if (coachFilter === 'uncoached' && e.coach_id) return false
      if (coachId && e.coach_id !== coachId) return false
      return true
    })

    const cmpName = (a: Ekskul, b: Ekskul) => a.name.localeCompare(b.name, 'id')
    const cmpMembers = (a: Ekskul, b: Ekskul) => memberCount(a) - memberCount(b) || cmpName(a, b)
    const comparators: Record<SortOption, (a: Ekskul, b: Ekskul) => number> = {
      name_asc: cmpName,
      name_desc: (a, b) => cmpName(b, a),
      members_asc: cmpMembers,
      members_desc: (a, b) => cmpMembers(b, a),
    }
    return [...filtered].sort(comparators[sortBy ?? 'name_asc'])
  }, [allEkskul, debouncedSearch, coachFilter, coachId, sortBy])

  const paginatedRows = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [rows, page, pageSize],
  )

  const resetFilters = () => {
    setSearch('')
    setCoachFilter(undefined)
    setCoachId(undefined)
    setPage(1)
  }

  const hasActiveFilters = Boolean(debouncedSearch || coachFilter || coachId)

  // Chip filter aktif — bisa dihapus satu per satu (pola StudentsPage)
  const filterChips = useMemo<FilterChip[]>(() => {
    const chips: FilterChip[] = []
    if (debouncedSearch.trim())
      chips.push({
        key: 'search',
        label: `Cari: "${debouncedSearch.trim()}"`,
        onClear: () => {
          setSearch('')
          setPage(1)
        },
      })
    if (coachFilter)
      chips.push({
        key: 'coach',
        label: coachFilter === 'coached' ? 'Ada pembina' : 'Tanpa pembina',
        onClear: () => {
          setCoachFilter(undefined)
          setPage(1)
        },
      })
    if (coachId) {
      const name = teachersQuery.data?.find((t) => t.id === coachId)?.name
      chips.push({
        key: 'coach-id',
        label: `Pembina: ${name ?? coachId}`,
        onClear: () => {
          setCoachId(undefined)
          setPage(1)
        },
      })
    }
    return chips
  }, [debouncedSearch, coachFilter, coachId, teachersQuery.data])

  const stats = useMemo(
    () => ({
      total: allEkskul.length,
      members: allEkskul.reduce((sum, e) => sum + memberCount(e), 0),
      coached: allEkskul.filter((e) => e.coach_id).length,
    }),
    [allEkskul],
  )

  // Kegiatan dengan anggota terbanyak — chip insight ala "Terbaik" StudentsPage (data nyata)
  const topEkskul = useMemo(
    () =>
      [...allEkskul].sort((a, b) => memberCount(b) - memberCount(a)).find((e) => memberCount(e) > 0),
    [allEkskul],
  )

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const toggleSelectAllFiltered = () => {
    // Memilih semua baris hasil filter (lintas halaman) — bukan hanya halaman aktif
    const filteredIds = rows.map((r) => r.id)
    const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIdSet.has(id))
    setSelectedIds(
      allSelected
        ? selectedIds.filter((id) => !filteredIds.includes(id))
        : Array.from(new Set([...selectedIds, ...filteredIds])),
    )
  }

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (ekskul: Ekskul) => {
    setEditing(ekskul)
    setFormOpen(true)
  }

  const handleSubmit = (values: EkskulFormValues) => {
    const onError = (err: Error) => message.error(err.message || 'Gagal menyimpan kegiatan')
    if (editing) {
      updateMutation.mutate(
        { id: editing.id, values },
        {
          onSuccess: () => {
            message.success('Ekstrakurikuler diperbarui')
            setFormOpen(false)
          },
          onError,
        },
      )
    } else {
      createMutation.mutate(values, {
        onSuccess: () => {
          message.success('Ekstrakurikuler ditambahkan')
          setFormOpen(false)
        },
        onError,
      })
    }
  }

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        message.success('Ekstrakurikuler diarsipkan')
        // bersihkan dari seleksi massal bila kegiatan ini sedang dipilih
        setSelectedIds((prev) => prev.filter((sid) => sid !== id))
      },
      onError: (err: Error) => message.error(err.message || 'Gagal mengarsipkan ekstrakurikuler'),
    })
  }

  const bulkArchive = (ids: string[]) => {
    bulkDeleteMutation
      .mutateAsync(ids)
      .then(() => setSelectedIds([]))
      .catch((err: Error) => message.error(err.message || 'Gagal mengarsipkan kegiatan'))
  }

  const handleExport = () => {
    downloadCsv(
      `ekstrakurikuler-${dayjs().format('YYYY-MM-DD')}.csv`,
      ['Nama Kegiatan', 'Pembina', 'Jadwal', 'Tempat', 'Jumlah Anggota', 'Deskripsi'],
      rows.map((e) => [
        e.name,
        e.teachers?.name ?? '',
        e.schedule ?? '',
        e.place ?? '',
        memberCount(e),
        e.description ?? '',
      ]),
    )
    message.success(`${rows.length} kegiatan diekspor`)
  }

  const shortcutItems = useMemo<ShortcutItem[]>(
    () => [
      {
        keys: ['N'],
        label: 'Tambah kegiatan',
        group: 'Aksi',
        icon: <PlusOutlined />,
        run: openCreate,
        when: canWrite,
      },
      {
        keys: ['I'],
        label: 'Impor kegiatan',
        group: 'Aksi',
        icon: <FileExcelOutlined />,
        run: () => setImportOpen(true),
        when: canWrite,
      },
      {
        keys: ['Ctrl', 'A'],
        label: 'Pilih semua / deselect',
        group: 'Aksi',
        icon: <CheckSquareOutlined />,
        run: toggleSelectAllFiltered,
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
        run: () => void ekskulQuery.refetch(),
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
    isBlocked: formOpen || importOpen || memberEkskul !== null,
  })

  // Ikon sorter gaya tabel lain — dibungkus fungsi agar hooks komponen legal (pola StudentsPage)
  const sortIcon = ({ sortOrder }: { sortOrder?: 'ascend' | 'descend' | null }) => (
    <SortIcon sortOrder={sortOrder} />
  )

  const sortOrderOf = (key: keyof typeof SORT_PAIRS) => columnSortOrder(sortBy, key, SORT_PAIRS)

  const handleTableChange: TableProps<Ekskul>['onChange'] = (_pagination, _filters, sorter, extra) => {
    if (extra.action !== 'sort') return
    const s = Array.isArray(sorter) ? sorter[0] : sorter
    setSortBy(sortByFromTableChange(s, SORT_PAIRS) ?? 'name_asc')
    setPage(1)
  }

  const columns: TableColumnsType<Ekskul> = [
    {
      title: 'Kegiatan',
      dataIndex: 'name',
      key: 'name',
      // Tanpa width — Kegiatan & Pembina sama-sama fleksibel membagi sisa ruang
      // agar nama pembina tidak wrap (kolom ber-width diskalakan antd, bukan diberi sisa)
      sorter: true,
      sortIcon,
      sortOrder: sortOrderOf('name'),
      render: (_, row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar
            size={32}
            style={{
              background: token.colorPrimaryBg,
              color: token.colorPrimaryTextActive,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {row.name.charAt(0).toUpperCase()}
          </Avatar>
          <div style={{ minWidth: 0 }}>
            <Button
              type="link"
              style={{ padding: 0, height: 'auto', fontWeight: 600, fontSize: 14 }}
              onClick={() => setMemberEkskul(row)}
            >
              {row.name}
            </Button>
            {row.description && (
              <div style={{ fontSize: 12, color: token.colorTextTertiary }}>{row.description}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      title: 'Pembina',
      key: 'coach',
      render: (_, row) =>
        row.teachers?.name ?? (
          <Tag color="warning" style={{ borderRadius: 6 }}>
            Tanpa pembina
          </Tag>
        ),
      responsive: ['md'],
    },
    {
      // Jadwal + tempat satu kolom — pola kolom Kelas siswa (tag utama + keterangan sekunder)
      title: 'Jadwal & Tempat',
      key: 'schedule',
      width: 170,
      render: (_, row) => (
        <div>
          {row.schedule ? <Tag style={{ borderRadius: 6 }}>{row.schedule}</Tag> : '-'}
          {row.place && (
            <div style={{ fontSize: 12, color: token.colorTextTertiary }}>{row.place}</div>
          )}
        </div>
      ),
      responsive: ['md'],
    },
    {
      title: 'Anggota',
      key: 'members',
      width: 100,
      align: 'center',
      sorter: true,
      sortIcon,
      // Klik pertama = terbanyak — arah yang paling sering dicari (pola kolom Poin)
      sortDirections: ['descend', 'ascend'],
      sortOrder: sortOrderOf('members'),
      render: (_, row) => (
        <Button
          type="link"
          style={{ padding: 0, height: 'auto', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
          onClick={() => setMemberEkskul(row)}
        >
          {memberCount(row)}
        </Button>
      ),
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 150,
      render: (_, row) =>
        canWrite || canDelete ? (
          <Space size="small">
            <Tooltip title="Kelola anggota">
              <Button type="text" icon={<TeamOutlined />} onClick={() => setMemberEkskul(row)} />
            </Tooltip>
            {canWrite && (
              <Tooltip title="Edit">
                <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(row)} />
              </Tooltip>
            )}
            {canDelete && (
              <Popconfirm
                title="Arsipkan kegiatan ini?"
                description="Data akan ditandai terhapus (soft delete)."
                onConfirm={() => handleDelete(row.id)}
                okText="Ya, Arsipkan"
                cancelText="Batal"
              >
                <Tooltip title="Hapus">
                  <Button type="text" danger icon={<DeleteOutlined />} />
                </Tooltip>
              </Popconfirm>
            )}
          </Space>
        ) : (
          <span style={{ color: token.colorTextQuaternary }}>-</span>
        ),
    },
  ]

  // Aksi halaman di ujung kanan judul halaman shell — dirender via useTabActions (pola tab)
  const tabActions = useTabActions(
    active,
    <Space wrap>
      <Tooltip title="Muat ulang (R)">
        <Button icon={<SyncOutlined spin={isRefreshing} />} onClick={() => void ekskulQuery.refetch()} />
      </Tooltip>
      {canWrite && (
        <Tooltip title="Impor dari Excel/CSV (I)">
          <Button icon={<FileExcelOutlined />} onClick={() => setImportOpen(true)} />
        </Tooltip>
      )}
      <Tooltip title="Ekspor CSV hasil filter">
        <Button icon={<DownloadOutlined />} onClick={handleExport} />
      </Tooltip>
      <Tooltip title="Palet shortcut (?)">
        <Button icon={<QuestionCircleOutlined />} onClick={shortcuts.open} />
      </Tooltip>
      {canWrite && (
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Tambah Kegiatan
        </Button>
      )}
    </Space>,
  )

  return (
    <ShellStagger>
      {tabActions}

      <ShellItem>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          <StatChip
            icon={<TrophyOutlined />}
            label="Total Kegiatan"
            value={stats.total}
            color="indigo"
            loading={ekskulQuery.isPending}
            active={coachFilter === undefined}
            onClick={() => {
              setCoachFilter(undefined)
              setPage(1)
            }}
          />
          <StatChip
            icon={<UserOutlined />}
            label="Ada Pembina"
            value={stats.coached}
            color="emerald"
            loading={ekskulQuery.isPending}
            active={coachFilter === 'coached'}
            onClick={() => {
              setCoachFilter(coachFilter === 'coached' ? undefined : 'coached')
              setPage(1)
            }}
          />
          <StatChip
            icon={<StopOutlined />}
            label="Tanpa Pembina"
            value={stats.total - stats.coached}
            color="amber"
            loading={ekskulQuery.isPending}
            active={coachFilter === 'uncoached'}
            hideIfZero
            onClick={() => {
              setCoachFilter(coachFilter === 'uncoached' ? undefined : 'uncoached')
              setPage(1)
            }}
          />
          <StatChip
            icon={<TeamOutlined />}
            label="Total Anggota"
            value={stats.members}
            color="sky"
            loading={ekskulQuery.isPending}
          />
          {topEkskul && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '12px 14px',
                borderRadius: 12,
                border: `1px solid ${token.colorBorderSecondary}`,
                background: token.colorBgContainer,
                fontSize: 12.5,
                minHeight: 44,
              }}
            >
              <CrownFilled style={{ color: '#f59e0b' }} />
              <span style={{ color: token.colorTextSecondary }}>Terpopuler:</span>
              <span style={{ fontWeight: 600 }}>{topEkskul.name}</span>
              <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {memberCount(topEkskul)} anggota
              </span>
            </span>
          )}
        </div>
      </ShellItem>

      <ShellItem>
        <Card>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              alignItems: 'center',
              marginBottom: 14,
              paddingBottom: 14,
              borderBottom: `1px dashed ${token.colorBorderSecondary}`,
            }}
          >
            <Input
              ref={searchRef}
              placeholder="Cari nama kegiatan, pembina, atau tempat"
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
              placeholder="Pembina"
              allowClear
              showSearch
              optionFilterProp="label"
              value={coachId}
              onChange={(v) => {
                setCoachId(v)
                setPage(1)
              }}
              loading={teachersQuery.isPending}
              options={(teachersQuery.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
              style={{ minWidth: 170 }}
            />
            {hasActiveFilters && (
              <Button icon={<UndoOutlined />} onClick={resetFilters}>
                Reset
              </Button>
            )}
          </div>

          <FilterChips chips={filterChips} marginTop={0} />

          <Table<Ekskul>
            rowKey="id"
            columns={columns}
            dataSource={paginatedRows}
            loading={ekskulQuery.isPending}
            onChange={handleTableChange}
            showSorterTooltip={false}
            rowSelection={
              canWrite
                ? {
                    selectedRowKeys: selectedIds,
                    onChange: (keys) => setSelectedIds(keys as string[]),
                    selections: [
                      {
                        key: 'all-filtered',
                        text: `Pilih semua hasil filter (${rows.length} kegiatan)`,
                        onSelect: () => setSelectedIds(rows.map((r) => r.id)),
                      },
                      Table.SELECTION_INVERT,
                      {
                        key: 'none',
                        text: 'Kosongkan pilihan',
                        onSelect: () => setSelectedIds([]),
                      },
                    ],
                  }
                : undefined
            }
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    hasActiveFilters
                      ? 'Tidak ada kegiatan yang cocok dengan filter'
                      : 'Belum ada ekstrakurikuler. Tambahkan kegiatan pertama, lalu kelola anggotanya.'
                  }
                />
              ),
            }}
            pagination={{
              current: page,
              pageSize,
              total: rows.length,
              showSizeChanger: true,
              showTotal: (t) => `Total ${t} kegiatan`,
              onChange: (p, ps) => {
                setPage(p)
                setPageSize(ps)
              },
            }}
            scroll={{ x: true }}
          />
        </Card>
      </ShellItem>

      {/* Bar aksi massal — muncul saat ada kegiatan yang dipilih */}
      <ActionBar
        count={selectedIds.length}
        onClear={() => setSelectedIds([])}
        actions={[
          {
            key: 'archive',
            label: 'Arsipkan',
            icon: <DeleteOutlined />,
            variant: 'danger',
            loading: bulkDeleteMutation.isPending,
            confirm: {
              title: `Arsipkan ${selectedIds.length} kegiatan terpilih?`,
              description: 'Data akan ditandai terhapus (soft delete).',
              okText: 'Ya, Arsipkan',
            },
            onClick: () => bulkArchive(selectedIds),
          },
        ]}
      />

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />

      <EkskulForm
        open={formOpen}
        ekskul={editing}
        submitting={createMutation.isPending || updateMutation.isPending}
        onCancel={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />

      <MemberDrawer
        open={memberEkskul !== null}
        ekskul={memberEkskul}
        onClose={() => setMemberEkskul(null)}
      />

      <ShortcutsModal open={shortcuts.isOpen} onClose={shortcuts.close} sections={shortcuts.sections} />
    </ShellStagger>
  )
}
