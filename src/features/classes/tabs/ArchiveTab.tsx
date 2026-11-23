import { useMemo, useState } from 'react'
import {
  App,
  Button,
  Card,
  Empty,
  Input,
  Popconfirm,
  Space,
  Table,
  Tag,
  theme,
  type TableColumnsType,
  type TableProps,
} from 'antd'
import { RedoOutlined, SearchOutlined, UndoOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { FilterChips, type FilterChip } from '../../../shared/components/FilterChips'
import { useTablePagination } from '../../../shared/hooks/useTablePagination'
import { useDebounce } from '../../../shared/hooks/useDebounce'
import { usePermissions } from '../../../shared/hooks/useProfile'
import { sortByFromTableChange } from '../../../shared/utils/tableSort'
import { useArchivedClasses, useRestoreClass } from '../hooks'
import type { ClassRow } from '../types'

type ArchiveSort = 'date_desc' | 'date_asc' | 'name_asc' | 'name_desc'

const SORT_PAIRS = {
  name: ['name_asc', 'name_desc'],
  date: ['date_desc', 'date_asc'],
} as const

interface ArchiveTabProps {
  /** Tab arsip sedang terbuka — mengatur kapan query arsip di-fetch */
  active: boolean
}

/**
 * Tab Arsip kelas: daftar kelas soft delete + pulihkan. Soft delete saja —
 * tidak ada jalur hapus permanen (data operasional tak pernah di-hard delete).
 */
export function ArchiveTab({ active }: ArchiveTabProps) {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const { canWrite } = usePermissions()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search)
  const [sortBy, setSortBy] = useState<ArchiveSort>('date_desc')

  const archivedQuery = useArchivedClasses(active)
  const restoreMutation = useRestoreClass()
  const archived = useMemo(() => archivedQuery.data ?? [], [archivedQuery.data])

  const rows = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    const data = archived.filter((c) => {
      if (
        q &&
        !`${c.name} ${c.major ?? ''} ${c.homeroom_teacher?.name ?? ''}`.toLowerCase().includes(q)
      )
        return false
      return true
    })

    const cmpName = (a: ClassRow, b: ClassRow) => a.name.localeCompare(b.name, 'id')
    const cmpDate = (a: ClassRow, b: ClassRow) =>
      (b.deleted_at ?? '').localeCompare(a.deleted_at ?? '') || cmpName(a, b)

    const comparators: Record<ArchiveSort, (a: ClassRow, b: ClassRow) => number> = {
      date_desc: cmpDate,
      date_asc: (a, b) => cmpDate(b, a),
      name_asc: cmpName,
      name_desc: (a, b) => cmpName(b, a),
    }
    return [...data].sort(comparators[sortBy])
  }, [archived, debouncedSearch, sortBy])

  const pg = useTablePagination(rows.length, { label: 'kelas terarsip' })

  const paginatedRows = useMemo(
    () => rows.slice((pg.page - 1) * pg.pageSize, pg.page * pg.pageSize),
    [rows, pg.page, pg.pageSize],
  )
  const resetPage = pg.reset

  const filterChips = useMemo<FilterChip[]>(() => {
    if (!debouncedSearch.trim()) return []
    return [
      {
        key: 'search',
        label: `Cari: "${debouncedSearch.trim()}"`,
        onClear: () => {
          setSearch('')
          resetPage()
        },
      },
    ]
  }, [debouncedSearch, resetPage])

  const handleRestore = (cls: ClassRow) => {
    restoreMutation.mutate(cls.id, {
      onSuccess: () => message.success(`Kelas ${cls.name} dipulihkan`),
      onError: (err: Error) => message.error(err.message || 'Gagal memulihkan kelas'),
    })
  }

  const handleTableChange: TableProps<ClassRow>['onChange'] = (_pagination, _filters, sorter, extra) => {
    if (extra.action !== 'sort') return
    const s = Array.isArray(sorter) ? sorter[0] : sorter
    setSortBy(sortByFromTableChange(s, SORT_PAIRS) ?? 'date_desc')
    resetPage()
  }

  const columns: TableColumnsType<ClassRow> = [
    {
      title: 'Kelas',
      dataIndex: 'name',
      key: 'name',
      sorter: true,
      sortOrder: sortBy === 'name_asc' ? 'ascend' : sortBy === 'name_desc' ? 'descend' : null,
      render: (_, row) => (
        <div>
          <span style={{ fontWeight: 600 }}>{row.name}</span>
          {row.major && (
            <div style={{ fontSize: 12, color: token.colorTextTertiary }}>{row.major}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Tingkat',
      dataIndex: 'grade',
      key: 'grade',
      width: 110,
      responsive: ['md'],
      render: (v: string | null) => (v ? <Tag>{v}</Tag> : '-'),
    },
    {
      title: 'Tahun Akademik',
      key: 'year',
      responsive: ['md'],
      render: (_, row) => row.academic_year?.name || '-',
    },
    {
      title: 'Wali Kelas',
      key: 'homeroom',
      responsive: ['md'],
      render: (_, row) => row.homeroom_teacher?.name || <Tag color="warning">Belum ada</Tag>,
    },
    {
      title: 'Diarsipkan',
      dataIndex: 'deleted_at',
      key: 'date',
      width: 140,
      sorter: true,
      sortOrder: sortBy === 'date_desc' ? 'descend' : sortBy === 'date_asc' ? 'ascend' : null,
      render: (v: string | null) =>
        v ? dayjs(v).format('DD MMM YYYY') : '-',
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 120,
      render: (_, row) =>
        canWrite ? (
          <Popconfirm
            title="Pulihkan kelas ini?"
            description="Kelas kembali ke daftar aktif."
            onConfirm={() => handleRestore(row)}
            okText="Ya, Pulihkan"
            cancelText="Batal"
          >
            <Button size="small" icon={<UndoOutlined />}>
              Pulihkan
            </Button>
          </Popconfirm>
        ) : (
          <Tag>Read-only</Tag>
        ),
    },
  ]

  return (
    <Card>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 14,
          paddingBottom: 14,
          borderBottom: `1px dashed ${token.colorBorderSecondary}`,
        }}
      >
        <Input
          placeholder="Cari kelas terarsip…"
          prefix={<SearchOutlined />}
          allowClear
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            resetPage()
          }}
          style={{ flex: '1 1 240px', minWidth: 220 }}
        />
        <Space wrap>
          {archivedQuery.isFetching && <RedoOutlined spin style={{ color: token.colorTextTertiary }} />}
        </Space>
      </div>

      <FilterChips chips={filterChips} />

      <Table<ClassRow>
        rowKey="id"
        columns={columns}
        dataSource={paginatedRows}
        loading={active && archivedQuery.isPending}
        onChange={handleTableChange}
        showSorterTooltip={false}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                archived.length > 0
                  ? 'Tidak ada kelas yang cocok dengan pencarian'
                  : 'Belum ada kelas terarsip — arsipkan dari tab Kelas Aktif'
              }
            />
          ),
        }}
        pagination={pg.pagination}
        scroll={{ x: true }}
      />
    </Card>
  )
}
