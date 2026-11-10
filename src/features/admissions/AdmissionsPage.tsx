import { useMemo, useRef, useState } from 'react'
import {
  App,
  Button,
  Card,
  Dropdown,
  Empty,
  Input,
  Popconfirm,
  Segmented,
  Space,
  Table,
  Tag,
  Tooltip,
  type InputRef,
  type TableColumnsType,
} from 'antd'
import {
  ArrowRightOutlined,
  CheckCircleOutlined,
  CloseOutlined,
  DeleteOutlined,
  DislikeOutlined,
  EditOutlined,
  FileDoneOutlined,
  MoreOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
  SelectOutlined,
  SyncOutlined,
  UndoOutlined,
  UserAddOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { PageHeader } from '../../shared/components/PageHeader'
import { ShortcutsModal } from '../../shared/components/ShortcutsModal'
import { StatChip } from '../../shared/components/StatChip'
import { StatusTag } from '../../shared/components/StatusTag'
import { useDebounce } from '../../shared/hooks/useDebounce'
import { useShortcuts, type ShortcutItem } from '../../shared/hooks/useShortcuts'
import { usePermissions } from '../../shared/hooks/useProfile'
import {
  nextRegistrationNumber,
  useAdmissions,
  useCreateAdmission,
  useDeleteAdmission,
  useSetAdmissionStage,
  useUpdateAdmission,
} from './hooks'
import { AdmissionForm } from './components/AdmissionForm'
import type { Admission, AdmissionFormValues, AdmissionStage } from './types'

const STAGE_META: Record<AdmissionStage, { label: string; color: string }> = {
  registered: { label: 'Pendaftar Baru', color: 'sky' },
  selection: { label: 'Seleksi', color: 'amber' },
  accepted: { label: 'Diterima', color: 'emerald' },
  rejected: { label: 'Ditolak', color: 'rose' },
  enrolled: { label: 'Daftar Ulang', color: 'purple' },
}

// Alur maju per tahap (rejected adalah tahap terminal)
const NEXT_STAGE: Partial<Record<AdmissionStage, AdmissionStage>> = {
  registered: 'selection',
  selection: 'accepted',
  accepted: 'enrolled',
}

export function AdmissionsPage() {
  const { message } = App.useApp()
  const { canWrite, canDelete } = usePermissions()

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [stageFilter, setStageFilter] = useState<AdmissionStage | ''>('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Admission | null>(null)
  const searchRef = useRef<InputRef>(null)

  const admissionsQuery = useAdmissions()
  const createMutation = useCreateAdmission()
  const updateMutation = useUpdateAdmission()
  const stageMutation = useSetAdmissionStage()
  const deleteMutation = useDeleteAdmission()
  const allAdmissions = admissionsQuery.data ?? []
  const isRefreshing = admissionsQuery.isFetching

  const rows = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return allAdmissions.filter((a) => {
      if (
        q &&
        !`${a.full_name} ${a.registration_number} ${a.origin_school ?? ''} ${a.parent_name ?? ''} ${a.parent_phone ?? ''}`
          .toLowerCase()
          .includes(q)
      )
        return false
      if (stageFilter && a.stage !== stageFilter) return false
      return true
    })
  }, [allAdmissions, debouncedSearch, stageFilter])

  const paginatedRows = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [rows, page, pageSize],
  )

  const resetFilters = () => {
    setSearch('')
    setStageFilter('')
    setPage(1)
  }

  const hasActiveFilters = Boolean(debouncedSearch || stageFilter)

  const stats = useMemo(() => {
    const byStage = (stage: AdmissionStage) => allAdmissions.filter((a) => a.stage === stage).length
    return {
      total: allAdmissions.length,
      registered: byStage('registered'),
      selection: byStage('selection'),
      accepted: byStage('accepted'),
      enrolled: byStage('enrolled'),
      rejected: byStage('rejected'),
    }
  }, [allAdmissions])

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (admission: Admission) => {
    setEditing(admission)
    setFormOpen(true)
  }

  const handleSubmit = (values: AdmissionFormValues) => {
    const onError = (err: Error) => message.error(err.message || 'Gagal menyimpan pendaftar')
    if (editing) {
      updateMutation.mutate(
        { id: editing.id, values },
        {
          onSuccess: () => {
            message.success('Data pendaftar diperbarui')
            setFormOpen(false)
          },
          onError,
        },
      )
    } else {
      // Nomor registrasi dibuat server-side count dulu, lalu simpan
      void nextRegistrationNumber()
        .then((regNumber) =>
          createMutation.mutateAsync({ values, regNumber }).then(() => {
            message.success('Pendaftar ditambahkan')
            setFormOpen(false)
          }),
        )
        .catch((err: Error) => message.error(err.message || 'Gagal menyimpan pendaftar'))
    }
  }

  const handleStage = (admission: Admission, stage: AdmissionStage) => {
    stageMutation.mutate(
      { id: admission.id, stage },
      {
        onSuccess: () => message.success(`${admission.full_name} → ${STAGE_META[stage].label}`),
        onError: (err: Error) => message.error(err.message || 'Gagal mengubah tahap'),
      },
    )
  }

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => message.success('Pendaftar dihapus'),
      onError: (err: Error) => message.error(err.message || 'Gagal menghapus pendaftar'),
    })
  }

  const shortcutItems = useMemo<ShortcutItem[]>(
    () => [
      {
        keys: ['N'],
        label: 'Tambah pendaftar',
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

  const stageMenu = (admission: Admission) => ({
    items: [
      ...(NEXT_STAGE[admission.stage]
        ? [
            {
              key: 'next',
              icon: <ArrowRightOutlined />,
              label: `Proses Selanjutnya → ${STAGE_META[NEXT_STAGE[admission.stage] as AdmissionStage].label}`,
              onClick: () => handleStage(admission, NEXT_STAGE[admission.stage] as AdmissionStage),
            },
          ]
        : []),
      ...(admission.stage !== 'rejected' && admission.stage !== 'enrolled'
        ? [
            {
              key: 'reject',
              icon: <DislikeOutlined />,
              label: 'Tandai Ditolak',
              danger: true,
              onClick: () => handleStage(admission, 'rejected'),
            },
          ]
        : []),
      ...(admission.stage === 'rejected'
        ? [
            {
              key: 'reopen',
              icon: <UndoOutlined />,
              label: 'Kembalikan ke Seleksi',
              onClick: () => handleStage(admission, 'selection'),
            },
          ]
        : []),
    ],
  })

  const columns: TableColumnsType<Admission> = [
    {
      title: 'Calon Santri',
      dataIndex: 'full_name',
      key: 'full_name',
      render: (_, row) => (
        <div>
          <span style={{ fontWeight: 600 }}>{row.full_name}</span>
          <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>
            {row.registration_number}
            {row.origin_school ? ` · ${row.origin_school}` : ''}
          </div>
        </div>
      ),
    },
    {
      title: 'Tingkat',
      dataIndex: 'target_grade',
      key: 'target_grade',
      width: 90,
      render: (v: string | null) => (v ? <Tag>{v}</Tag> : '-'),
      responsive: ['md'],
    },
    {
      title: 'Wali',
      key: 'parent',
      width: 190,
      render: (_, row) =>
        row.parent_name ? (
          <div>
            <span>{row.parent_name}</span>
            {row.parent_phone && (
              <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>{row.parent_phone}</div>
            )}
          </div>
        ) : (
          '-'
        ),
      responsive: ['md'],
    },
    {
      title: 'Tahap',
      dataIndex: 'stage',
      key: 'stage',
      width: 140,
      render: (v: AdmissionStage) => (
        <StatusTag color={STAGE_META[v].color}>{STAGE_META[v].label}</StatusTag>
      ),
    },
    {
      title: 'Daftar',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (v: string) => dayjs(v).format('DD MMM YYYY'),
      responsive: ['lg'],
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 140,
      render: (_, row) =>
        canWrite || canDelete ? (
          <Space size="small">
            {canWrite && (
              <>
                <Tooltip title="Edit">
                  <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(row)} />
                </Tooltip>
                <Dropdown menu={stageMenu(row)} trigger={['click']} placement="bottomRight">
                  <Button type="text" icon={<MoreOutlined />} />
                </Dropdown>
              </>
            )}
            {canDelete && (
              <Popconfirm
                title="Hapus pendaftar ini?"
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
        title="PPDB"
        subtitle="Penerimaan santri baru — dari pendaftaran sampai daftar ulang"
        extra={
          <Space wrap>
            <Tooltip title="Muat ulang (R)">
              <Button icon={<SyncOutlined spin={isRefreshing} />} onClick={() => void admissionsQuery.refetch()} />
            </Tooltip>
            <Tooltip title="Palet shortcut (?)">
              <Button icon={<QuestionCircleOutlined />} onClick={shortcuts.open} />
            </Tooltip>
            {canWrite && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Tambah Pendaftar
              </Button>
            )}
          </Space>
        }
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <StatChip
          icon={<UserAddOutlined />}
          label="Total Pendaftar"
          value={stats.total}
          color="indigo"
          loading={admissionsQuery.isPending}
          active={stageFilter === ''}
          onClick={() => {
            setStageFilter('')
            setPage(1)
          }}
        />
        <StatChip
          icon={<PlusOutlined />}
          label="Baru"
          value={stats.registered}
          color="sky"
          loading={admissionsQuery.isPending}
          active={stageFilter === 'registered'}
          onClick={() => {
            setStageFilter(stageFilter === 'registered' ? '' : 'registered')
            setPage(1)
          }}
        />
        <StatChip
          icon={<SelectOutlined />}
          label="Seleksi"
          value={stats.selection}
          color="amber"
          loading={admissionsQuery.isPending}
          active={stageFilter === 'selection'}
          onClick={() => {
            setStageFilter(stageFilter === 'selection' ? '' : 'selection')
            setPage(1)
          }}
        />
        <StatChip
          icon={<CheckCircleOutlined />}
          label="Diterima"
          value={stats.accepted}
          color="emerald"
          loading={admissionsQuery.isPending}
          active={stageFilter === 'accepted'}
          onClick={() => {
            setStageFilter(stageFilter === 'accepted' ? '' : 'accepted')
            setPage(1)
          }}
        />
        <StatChip
          icon={<FileDoneOutlined />}
          label="Daftar Ulang"
          value={stats.enrolled}
          color="purple"
          loading={admissionsQuery.isPending}
          active={stageFilter === 'enrolled'}
          onClick={() => {
            setStageFilter(stageFilter === 'enrolled' ? '' : 'enrolled')
            setPage(1)
          }}
        />
        <StatChip
          icon={<CloseOutlined />}
          label="Ditolak"
          value={stats.rejected}
          color="rose"
          loading={admissionsQuery.isPending}
          active={stageFilter === 'rejected'}
          onClick={() => {
            setStageFilter(stageFilter === 'rejected' ? '' : 'rejected')
            setPage(1)
          }}
        />
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <Segmented
            value={stageFilter || 'all'}
            onChange={(v) => {
              setStageFilter(v === 'all' ? '' : (v as AdmissionStage))
              setPage(1)
            }}
            options={[
              { label: 'Semua', value: 'all' },
              ...Object.entries(STAGE_META).map(([value, meta]) => ({ label: meta.label, value })),
            ]}
          />
          <Input
            ref={searchRef}
            placeholder="Cari nama, no. registrasi, asal sekolah, atau wali"
            prefix={<SearchOutlined />}
            allowClear
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            style={{ flex: '1 1 240px', minWidth: 220 }}
          />
          {hasActiveFilters && (
            <Button icon={<UndoOutlined />} onClick={resetFilters}>
              Reset
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <Table<Admission>
          rowKey="id"
          columns={columns}
          dataSource={paginatedRows}
          loading={admissionsQuery.isPending}
          rowClassName={(row) => (row.stage === 'rejected' ? 'student-row-risk' : '')}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  hasActiveFilters
                    ? 'Tidak ada pendaftar yang cocok dengan filter'
                    : 'Belum ada pendaftar PPDB'
                }
              />
            ),
          }}
          pagination={{
            current: page,
            pageSize,
            total: rows.length,
            showSizeChanger: true,
            showTotal: (t) => `Total ${t} pendaftar`,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
          scroll={{ x: true }}
        />
      </Card>

      <AdmissionForm
        open={formOpen}
        admission={editing}
        submitting={createMutation.isPending || updateMutation.isPending}
        onCancel={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />

      <ShortcutsModal open={shortcuts.isOpen} onClose={shortcuts.close} sections={shortcuts.sections} />
    </div>
  )
}
