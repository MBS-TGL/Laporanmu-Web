import { useMemo, useState } from 'react'
import { App, Alert, Button, Input, Popconfirm, Segmented, Space, Table, Tag, Tooltip, Typography, theme } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  KeyOutlined,
  CopyOutlined,
  PlusOutlined,
  ReloadOutlined,
  StopOutlined,
} from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { useTabActions } from '../../../shared/components/ActionsSlot'
import { ActionBar } from '../../../shared/components/ActionBar'
import { FilterChips, type FilterChip } from '../../../shared/components/FilterChips'
import { StatChip } from '../../../shared/components/StatChip'
import { ShortcutsModal } from '../../../shared/components/ShortcutsModal'
import { useShortcuts, type ShortcutItem } from '../../../shared/hooks/useShortcuts'
import { useDebounce } from '../../../shared/hooks/useDebounce'
import { usePermissions } from '../../../shared/hooks/useProfile'
import { useTablePagination } from '../../../shared/hooks/useTablePagination'
import { softDeleteMany } from '../../../shared/api/crud'
import { useQueryClient } from '@tanstack/react-query'
import { logAudit } from '../../../shared/utils/auditLogger'
import {
  useActivateInstrumentToken,
  useCreateInstrument,
  useDeleteInstrument,
  useInstruments,
  useRevokeInstrumentToken,
  useUpdateInstrumentQuestions,
} from '../hooks'
import { generateInstrumentToken } from '../api'
import { INSTRUMENT_KIND_LABEL, type Instrument, type InstrumentKind } from '../types'
import { InstrumentModal } from '../components/InstrumentModal'
import { QuestionsEditorModal } from '../components/QuestionsEditorModal'

const KIND_OPTIONS = [
  { label: 'Semua', value: 'all' },
  { label: 'AKPD', value: 'akpd' },
  { label: 'Sosiometri', value: 'sosiometri' },
  { label: 'MBTI', value: 'mbti' },
  { label: 'EDOM', value: 'edom' },
] as unknown as Array<{ label: string; value: string }>

const isPublished = (i: Instrument) =>
  i.is_published && Boolean(i.token_expires_at) && new Date(i.token_expires_at!) > new Date()

/** Tab Kelola: daftar angket, penerbitan token, sunting pertanyaan. */
export function ManageTab({ active }: { active: boolean }) {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const { canWrite } = usePermissions()
  const qc = useQueryClient()
  const instrumentsQuery = useInstruments()
  const activateToken = useActivateInstrumentToken()
  const revokeToken = useRevokeInstrumentToken()
  const deleteInstrument = useDeleteInstrument()
  const createInstrument = useCreateInstrument()
  const updateQuestions = useUpdateInstrumentQuestions()

  const [createOpen, setCreateOpen] = useState(false)
  const [questionsEdit, setQuestionsEdit] = useState<Instrument | null>(null)
  const [tokenModal, setTokenModal] = useState<{ display: string; expiresAt: string } | null>(null)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [kindFilter, setKindFilter] = useState<'all' | InstrumentKind>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'terbit' | 'draft'>('all')
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([])
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const handleActivate = async (instrument: Instrument) => {
    try {
      const tk = await generateInstrumentToken()
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      await activateToken.mutateAsync({
        instrumentId: instrument.id,
        tokenHash: tk.hash,
        tokenPrefix: tk.prefix,
        tokenExpiresAt: expiresAt,
      })
      setTokenModal({ display: tk.display, expiresAt: new Date(expiresAt).toLocaleString('id-ID') })
    } catch (err) {
      message.error((err as Error).message)
    }
  }

  const copyToken = async () => {
    if (!tokenModal) return
    await navigator.clipboard.writeText(tokenModal.display)
    message.success('Token disalin')
  }

  const rows = useMemo(() => instrumentsQuery.data ?? [], [instrumentsQuery.data])
  const filtered = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase()
    return rows.filter((i) => {
      if (kindFilter !== 'all' && i.kind !== kindFilter) return false
      if (statusFilter === 'terbit' && !isPublished(i)) return false
      if (statusFilter === 'draft' && isPublished(i)) return false
      if (term && !i.title.toLowerCase().includes(term)) return false
      return true
    })
  }, [rows, debouncedSearch, kindFilter, statusFilter])

  const pg = useTablePagination(filtered.length, { label: 'angket', defaultPageSize: 10, showSizeChanger: false })

  const stats = useMemo(
    () => ({
      total: rows.length,
      terbit: rows.filter((i) => isPublished(i)).length,
      draft: rows.filter((i) => !isPublished(i)).length,
    }),
    [rows],
  )

  const chips: FilterChip[] = [
    ...(debouncedSearch.trim() ? [{ key: 'search', label: `Cari: ${debouncedSearch.trim()}`, onClear: () => setSearch('') }] : []),
    ...(kindFilter !== 'all' ? [{ key: 'kind', label: `Jenis: ${INSTRUMENT_KIND_LABEL[kindFilter]}`, onClear: () => setKindFilter('all') }] : []),
    ...(statusFilter !== 'all' ? [{ key: 'status', label: `Status: ${statusFilter === 'terbit' ? 'Terbit' : 'Draft'}`, onClear: () => setStatusFilter('all') }] : []),
  ]

  const bulkArchive = async () => {
    if (selectedKeys.length === 0) return
    setBulkDeleting(true)
    try {
      await softDeleteMany('instruments', selectedKeys as string[])
      void logAudit({
        action: 'DELETE',
        source: 'OPERATIONAL',
        tableName: 'instruments',
        recordId: `bulk-${selectedKeys.length}`,
        newData: { count: selectedKeys.length },
      })
      void qc.invalidateQueries({ queryKey: ['instruments'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      message.success(`${selectedKeys.length} angket diarsipkan`)
      setSelectedKeys([])
    } catch (err) {
      message.error((err as Error).message || 'Gagal mengarsipkan angket')
    } finally {
      setBulkDeleting(false)
    }
  }

  const columns: ColumnsType<Instrument> = [
    {
      title: 'Judul',
      dataIndex: 'title',
      key: 'title',
      sorter: (a, b) => a.title.localeCompare(b.title, 'id'),
      render: (_, i) => (
        <div>
          <Typography.Text strong>{i.title}</Typography.Text>
          {i.description && (
            <Typography.Paragraph type="secondary" style={{ fontSize: 11.5, margin: 0 }} ellipsis={{ rows: 1 }}>
              {i.description}
            </Typography.Paragraph>
          )}
        </div>
      ),
    },
    {
      title: 'Jenis',
      dataIndex: 'kind',
      key: 'kind',
      width: 120,
      sorter: (a, b) => a.kind.localeCompare(b.kind),
      render: (_, i) => <Tag color="geekblue">{INSTRUMENT_KIND_LABEL[i.kind]}</Tag>,
    },
    { title: 'Kelas', key: 'kelas', width: 150, render: (_, i) => i.class?.name ?? '-' },
    {
      title: 'Status',
      key: 'status',
      width: 120,
      filters: [
        { text: 'Terbit', value: 'terbit' },
        { text: 'Draft', value: 'draft' },
      ],
      onFilter: (v, i) => (v === 'terbit') === isPublished(i),
      render: (_, i) =>
        isPublished(i) ? (
          <Tag color="green">Terbit</Tag>
        ) : (
          <Tag>Draft</Tag>
        ),
    },
    {
      title: 'Token berlaku',
      key: 'token',
      width: 130,
      render: (_, i) => (i.token_expires_at ? new Date(i.token_expires_at).toLocaleDateString('id-ID') : '—'),
    },
    {
      title: 'Pertanyaan',
      dataIndex: 'questions',
      key: 'questions',
      width: 110,
      align: 'right' as const,
      sorter: (a, b) => a.questions.length - b.questions.length,
      render: (_, i) => i.questions.length,
    },
  ]

  if (canWrite) {
    columns.push({
      title: '',
      key: 'aksi',
      width: 170,
      render: (_, i) => (
        <Space size={0}>
          {isPublished(i) ? (
            <Popconfirm
              title="Cabut token angket?"
              okText="Ya, Cabut"
              cancelText="Batal"
              okButtonProps={{ loading: revokeToken.isPending }}
              onConfirm={async () => {
                try {
                  await revokeToken.mutateAsync(i.id)
                  message.success('Token dicabut')
                } catch (err) {
                  message.error((err as Error).message)
                }
              }}
            >
              <Button type="text" size="small" icon={<StopOutlined />} title="Cabut token" />
            </Popconfirm>
          ) : (
            <Tooltip title="Terbitkan & aktifkan token">
              <Button type="text" size="small" icon={<KeyOutlined />} onClick={() => void handleActivate(i)} />
            </Tooltip>
          )}
          <Tooltip title="Sunting pertanyaan">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => setQuestionsEdit(i)} />
          </Tooltip>
          <Popconfirm
            title="Arsipkan angket ini?"
            okText="Ya, Arsipkan"
            cancelText="Batal"
            okButtonProps={{ loading: deleteInstrument.isPending }}
            onConfirm={async () => {
              try {
                await deleteInstrument.mutateAsync(i.id)
                message.success('Angket diarsipkan')
              } catch (err) {
                message.error((err as Error).message)
              }
            }}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} title="Arsipkan angket" />
          </Popconfirm>
        </Space>
      ),
    })
  }

  const shortcutItems = useMemo<ShortcutItem[]>(
    () => [
      {
        keys: ['R'],
        label: 'Segarkan daftar angket',
        group: 'Aksi',
        icon: <ReloadOutlined />,
        run: () => void instrumentsQuery.refetch(),
      },
      {
        keys: ['C'],
        label: 'Buat angket baru',
        group: 'Aksi',
        icon: <PlusOutlined />,
        run: () => canWrite && setCreateOpen(true),
      },
    ],
    [instrumentsQuery, canWrite],
  )
  const shortcuts = useShortcuts({ items: shortcutItems })

  const node = (
    <Space size={8} wrap>
      <Input.Search
        placeholder="Cari judul angket…"
        allowClear
        value={search}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
        style={{ width: 220 }}
        aria-label="Cari angket"
      />
      <Segmented
        value={kindFilter}
        onChange={(v) => setKindFilter(v as 'all' | InstrumentKind)}
        options={KIND_OPTIONS}
      />
      <Segmented
        value={statusFilter}
        onChange={(v) => setStatusFilter(v as 'all' | 'terbit' | 'draft')}
        options={[
          { label: 'Semua', value: 'all' },
          { label: 'Terbit', value: 'terbit' },
          { label: 'Draft', value: 'draft' },
        ]}
      />
      <Tooltip title="Segarkan (R)">
        <Button icon={<ReloadOutlined spin={instrumentsQuery.isFetching} />} onClick={() => void instrumentsQuery.refetch()} aria-label="Segarkan angket" />
      </Tooltip>
      <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)} disabled={!canWrite}>
        Buat Angket
      </Button>
    </Space>
  )
  const actions = useTabActions(active, node)

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <StatChip
          icon={<EditOutlined />}
          label="Total Angket"
          value={stats.total}
          color="indigo"
          loading={instrumentsQuery.isPending}
          onClick={() => {
            setStatusFilter('all')
            setKindFilter('all')
          }}
        />
        <StatChip
          icon={<CheckCircleOutlined />}
          label="Terbit"
          value={stats.terbit}
          color="emerald"
          loading={instrumentsQuery.isPending}
          onClick={() => setStatusFilter('terbit')}
          hideIfZero={false}
        />
        <StatChip
          icon={<KeyOutlined />}
          label="Draft"
          value={stats.draft}
          color="sky"
          loading={instrumentsQuery.isPending}
          onClick={() => setStatusFilter('draft')}
          hideIfZero={false}
        />
      </div>

      {actions}
      {chips.length > 0 && <FilterChips chips={chips} />}

      {instrumentsQuery.isError ? (
        <Alert
          type="error"
          showIcon
          message="Gagal memuat angket"
          description="Pastikan migration 0049_evaluasi.sql sudah diterapkan di Supabase."
          style={{ marginBottom: 12 }}
        />
      ) : null}

      <Table<Instrument>
        rowKey="id"
        size="middle"
        loading={instrumentsQuery.isPending}
        columns={columns}
        dataSource={filtered}
        rowSelection={canWrite ? { selectedRowKeys: selectedKeys, onChange: setSelectedKeys } : undefined}
        pagination={pg.pagination}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: 'Belum ada angket. Buat dari template AKPD/Sosiometri/MBTI/EDOM.' }}
      />

      <ActionBar
        count={selectedKeys.length}
        onClear={() => setSelectedKeys([])}
        actions={[
          {
            key: 'archive',
            label: 'Arsipkan',
            icon: <DeleteOutlined />,
            variant: 'danger',
            loading: bulkDeleting,
            confirm: {
              title: `Arsipkan ${selectedKeys.length} angket terpilih?`,
              description: 'Angket terarsipkan tidak tampil di daftar; token aktif ikut tidak berlaku.',
              okText: 'Ya, Arsipkan',
            },
            onClick: () => void bulkArchive(),
          },
        ]}
      />

      <InstrumentModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={async (values) => {
          try {
            await createInstrument.mutateAsync({ values, createdBy: null })
            message.success('Angket dibuat')
            setCreateOpen(false)
          } catch (err) {
            message.error((err as Error).message)
          }
        }}
      />
      <QuestionsEditorModal
        open={questionsEdit !== null}
        instrument={questionsEdit}
        onClose={() => setQuestionsEdit(null)}
        onSave={async (questions) => {
          if (!questionsEdit) return
          try {
            await updateQuestions.mutateAsync({ id: questionsEdit.id, questions })
            message.success('Pertanyaan diperbarui')
            setQuestionsEdit(null)
          } catch (err) {
            message.error((err as Error).message)
          }
        }}
      />
      <AppModal
        open={tokenModal !== null}
        onCancel={() => setTokenModal(null)}
        footer={null}
        title="Token Angket Aktif"
        subtitle="Tampilkan sekali ini — token lengkap tidak disimpan"
        icon={<KeyOutlined />}
        width={480}
      >
        {tokenModal && (
          <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
            <Typography.Text type="secondary" style={{ fontSize: 12.5, display: 'block', marginBottom: 8 }}>
              Santri buka halaman <b>/survey</b>, masukkan token ini, lalu NIS atau kode registrasi.
            </Typography.Text>
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: '0.08em',
                fontVariantNumeric: 'tabular-nums',
                background: token.colorFillQuaternary,
                borderRadius: 12,
                padding: '14px 16px',
                marginBottom: 12,
              }}
            >
              {tokenModal.display}
            </div>
            <Space size={8}>
              <Button icon={<CopyOutlined />} onClick={() => void copyToken()}>
                Salin Token
              </Button>
              <Button type="primary" onClick={() => setTokenModal(null)}>
                Selesai
              </Button>
            </Space>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 10 }}>
              Berlaku sampai {tokenModal.expiresAt}
            </Typography.Text>
          </div>
        )}
      </AppModal>
      <ShortcutsModal open={shortcuts.isOpen} onClose={shortcuts.close} sections={shortcuts.sections} />
    </div>
  )
}
