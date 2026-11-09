import { useMemo, useRef, useState } from 'react'
import {
  App,
  Avatar,
  Button,
  Card,
  Empty,
  Input,
  Modal,
  Popconfirm,
  Segmented,
  Space,
  Table,
  Tag,
  Tooltip,
  theme,
  type InputRef,
  type TableColumnsType,
} from 'antd'
import {
  FallOutlined,
  FormOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  RiseOutlined,
  SearchOutlined,
  StopOutlined,
  SyncOutlined,
  UndoOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { PageHeader } from '../../shared/components/PageHeader'
import { ShortcutsModal } from '../../shared/components/ShortcutsModal'
import { StatChip } from '../../shared/components/StatChip'
import { StudentSelect } from '../../shared/components/StudentSelect'
import { useDebounce } from '../../shared/hooks/useDebounce'
import { useShortcuts, type ShortcutItem } from '../../shared/hooks/useShortcuts'
import { usePermissions } from '../../shared/hooks/useProfile'
import { formatRupiah } from './api'
import {
  useApplyTxn,
  useCreateAccount,
  useSavingsAccounts,
  useSetAccountStatus,
} from './hooks'
import { TxnModal } from './components/TxnModal'
import { AccountDrawer } from './components/AccountDrawer'
import type { SavingsAccount, SavingsTxnKind } from './types'

export function SavingsPage() {
  const { message, modal } = App.useApp()
  const { token } = theme.useToken()
  const { canWrite } = usePermissions()

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'closed'>('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [openAccountOpen, setOpenAccountOpen] = useState(false)
  const [newStudentId, setNewStudentId] = useState<string | undefined>()
  const [txnTarget, setTxnTarget] = useState<{ account: SavingsAccount; kind: SavingsTxnKind } | null>(null)
  const [ledgerAccount, setLedgerAccount] = useState<SavingsAccount | null>(null)
  const searchRef = useRef<InputRef>(null)

  const accountsQuery = useSavingsAccounts()
  const createAccountMutation = useCreateAccount()
  const statusMutation = useSetAccountStatus()
  const txnMutation = useApplyTxn()
  const allAccounts = accountsQuery.data ?? []
  const isRefreshing = accountsQuery.isFetching

  const rows = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return allAccounts.filter((a) => {
      if (
        q &&
        !`${a.students?.name ?? ''} ${a.students?.registration_code ?? ''} ${a.students?.classes?.name ?? ''}`
          .toLowerCase()
          .includes(q)
      )
        return false
      if (statusFilter && a.status !== statusFilter) return false
      return true
    })
  }, [allAccounts, debouncedSearch, statusFilter])

  const paginatedRows = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [rows, page, pageSize],
  )

  const resetFilters = () => {
    setSearch('')
    setStatusFilter('')
    setPage(1)
  }

  const hasActiveFilters = Boolean(debouncedSearch || statusFilter)

  const stats = useMemo(
    () => ({
      balance: allAccounts.filter((a) => a.status === 'active').reduce((s, a) => s + a.balance, 0),
      active: allAccounts.filter((a) => a.status === 'active').length,
      closed: allAccounts.filter((a) => a.status === 'closed').length,
    }),
    [allAccounts],
  )

  // ------------------------------------------------------------
  // Aksi rekening
  // ------------------------------------------------------------

  const handleOpenAccount = () => {
    if (!newStudentId) return
    createAccountMutation.mutate(
      { student_id: newStudentId },
      {
        onSuccess: () => {
          message.success('Rekening tabungan dibuka')
          setOpenAccountOpen(false)
          setNewStudentId(undefined)
        },
        onError: (err: Error) => message.error(err.message || 'Gagal membuka rekening'),
      },
    )
  }

  const handleCloseAccount = (account: SavingsAccount) => {
    modal.confirm({
      title: `Tutup rekening ${account.students?.name ?? ''}?`,
      content:
        account.balance > 0
          ? `Saldo masih ${formatRupiah(account.balance)} — tarik dulu sebelum menutup rekening.`
          : 'Rekening ditandai ditutup; riwayat transaksi tetap tersimpan.',
      okText: 'Tutup Rekening',
      okButtonProps: { danger: true },
      cancelText: 'Batal',
      onOk: () =>
        statusMutation
          .mutateAsync({ id: account.id, status: 'closed' })
          .then(() => message.success('Rekening ditutup'))
          .catch((err: Error) => message.error(err.message || 'Gagal menutup rekening')),
    })
  }

  const handleTxnSubmit = (values: { amount: number; note?: string; occurred_at: string }) => {
    if (!txnTarget) return
    txnMutation.mutate(
      { accountId: txnTarget.account.id, values: { ...values, kind: txnTarget.kind } },
      {
        onSuccess: (updated) => {
          message.success(
            txnTarget.kind === 'deposit' ? 'Setoran berhasil dicatat' : 'Penarikan berhasil dicatat',
          )
          setTxnTarget(null)
          // Perbarui baris rekening di drawer bila sedang terbuka
          setLedgerAccount((current) => (current?.id === updated.id ? updated : current))
        },
        onError: (err: Error) => message.error(err.message || 'Gagal mencatat transaksi'),
      },
    )
  }

  const shortcutItems = useMemo<ShortcutItem[]>(
    () => [
      {
        keys: ['N'],
        label: 'Buka rekening baru',
        group: 'Aksi',
        icon: <PlusOutlined />,
        run: () => setOpenAccountOpen(true),
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
    isBlocked: openAccountOpen || txnTarget !== null || ledgerAccount !== null,
  })

  const columns: TableColumnsType<SavingsAccount> = [
    {
      title: 'Santri',
      key: 'student',
      render: (_, row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar size={32} style={{ background: token.colorPrimaryBg, color: token.colorPrimary, fontWeight: 700, flexShrink: 0 }}>
            {(row.students?.name ?? '?').charAt(0).toUpperCase()}
          </Avatar>
          <div style={{ minWidth: 0 }}>
            <Button
              type="link"
              style={{ padding: 0, height: 'auto', fontWeight: 600 }}
              onClick={() => setLedgerAccount(row)}
            >
              {row.students?.name ?? '-'}
            </Button>
            <div style={{ fontSize: 12, color: token.colorTextTertiary }}>
              {row.students?.registration_code}
              {row.students?.classes?.name ? ` · ${row.students.classes.name}` : ''}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Saldo',
      dataIndex: 'balance',
      key: 'balance',
      width: 140,
      render: (v: number) => (
        <span style={{ fontWeight: 700, color: token.colorSuccess, fontVariantNumeric: 'tabular-nums' }}>
          {formatRupiah(v)}
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (v: string) =>
        v === 'active' ? (
          <Tag color="green">Aktif</Tag>
        ) : (
          <Tag color="default">Ditutup</Tag>
        ),
    },
    {
      title: 'Dibuka',
      dataIndex: 'opened_at',
      key: 'opened_at',
      width: 120,
      render: (v: string) => dayjs(v).format('DD MMM YYYY'),
      responsive: ['md'],
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 200,
      render: (_, row) => (
        <Space size={0}>
          <Tooltip title="Buku tabungan">
            <Button type="text" icon={<WalletOutlined />} onClick={() => setLedgerAccount(row)} />
          </Tooltip>
          {canWrite && row.status === 'active' && (
            <>
              <Tooltip title="Setor">
                <Button
                  type="text"
                  icon={<RiseOutlined style={{ color: token.colorSuccess }} />}
                  onClick={() => setTxnTarget({ account: row, kind: 'deposit' })}
                />
              </Tooltip>
              <Tooltip title="Tarik">
                <Button
                  type="text"
                  icon={<FallOutlined style={{ color: token.colorError }} />}
                  disabled={row.balance <= 0}
                  onClick={() => setTxnTarget({ account: row, kind: 'withdrawal' })}
                />
              </Tooltip>
              <Popconfirm
                title="Tutup rekening ini?"
                description="Riwayat transaksi tetap tersimpan."
                onConfirm={() => handleCloseAccount(row)}
                okText="Tutup"
                cancelText="Batal"
              >
                <Tooltip title="Tutup rekening">
                  <Button type="text" danger icon={<StopOutlined />} />
                </Tooltip>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Tabungan Santri"
        subtitle="Rekening tabungan, setor-tarik, dan buku tabungan santri"
        extra={
          <Space wrap>
            <Tooltip title="Muat ulang (R)">
              <Button icon={<SyncOutlined spin={isRefreshing} />} onClick={() => void accountsQuery.refetch()} />
            </Tooltip>
            <Tooltip title="Palet shortcut (?)">
              <Button icon={<QuestionCircleOutlined />} onClick={shortcuts.open} />
            </Tooltip>
            {canWrite && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpenAccountOpen(true)}>
                Buka Rekening
              </Button>
            )}
          </Space>
        }
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <StatChip
          icon={<WalletOutlined />}
          label="Total Saldo"
          value={formatRupiah(stats.balance)}
          color="emerald"
          loading={accountsQuery.isPending}
          active={statusFilter === ''}
          onClick={() => {
            setStatusFilter('')
            setPage(1)
          }}
        />
        <StatChip
          icon={<WalletOutlined />}
          label="Rekening Aktif"
          value={stats.active}
          color="indigo"
          loading={accountsQuery.isPending}
          active={statusFilter === 'active'}
          onClick={() => {
            setStatusFilter(statusFilter === 'active' ? '' : 'active')
            setPage(1)
          }}
        />
        <StatChip
          icon={<StopOutlined />}
          label="Ditutup"
          value={stats.closed}
          color="rose"
          loading={accountsQuery.isPending}
          active={statusFilter === 'closed'}
          onClick={() => {
            setStatusFilter(statusFilter === 'closed' ? '' : 'closed')
            setPage(1)
          }}
        />
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <Segmented
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v as '' | 'active' | 'closed')
              setPage(1)
            }}
            options={[
              { label: 'Semua', value: '' },
              { label: 'Aktif', value: 'active' },
              { label: 'Ditutup', value: 'closed' },
            ]}
          />
          <Input
            ref={searchRef}
            placeholder="Cari nama, kode, atau kelas santri"
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
        <Table<SavingsAccount>
          rowKey="id"
          columns={columns}
          dataSource={paginatedRows}
          loading={accountsQuery.isPending}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  hasActiveFilters
                    ? 'Tidak ada rekening yang cocok dengan filter'
                    : 'Belum ada rekening tabungan — buka lewat tombol "Buka Rekening"'
                }
              />
            ),
          }}
          pagination={{
            current: page,
            pageSize,
            total: rows.length,
            showSizeChanger: true,
            showTotal: (t) => `Total ${t} rekening`,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
          scroll={{ x: true }}
        />
      </Card>

      {/* Buka rekening baru */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FormOutlined style={{ color: token.colorPrimary }} />
            <span>Buka Rekening Tabungan</span>
          </div>
        }
        open={openAccountOpen}
        onOk={handleOpenAccount}
        confirmLoading={createAccountMutation.isPending}
        onCancel={() => {
          setOpenAccountOpen(false)
          setNewStudentId(undefined)
        }}
        okText="Buka Rekening"
        cancelText="Batal"
        destroyOnHidden
      >
        <div style={{ marginBottom: 16, color: token.colorTextTertiary, fontSize: 13 }}>
          Satu santri hanya boleh punya satu rekening aktif.
        </div>
        <div style={{ marginBottom: 8, fontWeight: 500 }}>Santri</div>
        <StudentSelect value={newStudentId} onChange={(v) => setNewStudentId(v)} />
      </Modal>

      <TxnModal
        open={txnTarget !== null}
        kind={txnTarget?.kind ?? 'deposit'}
        studentName={txnTarget?.account.students?.name}
        submitting={txnMutation.isPending}
        onCancel={() => setTxnTarget(null)}
        onSubmit={handleTxnSubmit}
      />

      <AccountDrawer
        open={ledgerAccount !== null}
        account={ledgerAccount}
        onClose={() => setLedgerAccount(null)}
        onDeposit={(account) => setTxnTarget({ account, kind: 'deposit' })}
        onWithdraw={(account) => setTxnTarget({ account, kind: 'withdrawal' })}
      />

      <ShortcutsModal open={shortcuts.isOpen} onClose={shortcuts.close} sections={shortcuts.sections} />
    </div>
  )
}
