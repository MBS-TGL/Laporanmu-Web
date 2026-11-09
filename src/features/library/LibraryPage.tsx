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
  Tabs,
  Tag,
  Tooltip,
  type InputRef,
  type TableColumnsType,
} from 'antd'
import {
  BookOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  ExportOutlined,
  ImportOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
  SyncOutlined,
  UndoOutlined,
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
  useBooks,
  useCreateBook,
  useCreateLoan,
  useDeleteBook,
  useDeleteLoan,
  useLoans,
  useReturnLoan,
  useUpdateBook,
} from './hooks'
import { BookForm } from './components/BookForm'
import { LoanModal } from './components/LoanModal'
import type { Book, BookFormValues, BookLoan, LoanFormValues, LoanView } from './types'

function loanStatus(loan: BookLoan): 'active' | 'overdue' | 'returned' {
  if (loan.returned_at) return 'returned'
  if (loan.due_date && loan.due_date < dayjs().format('YYYY-MM-DD')) return 'overdue'
  return 'active'
}

const STATUS_META = {
  active: { label: 'Dipinjam', color: 'blue' as const },
  overdue: { label: 'Terlambat', color: 'red' as const },
  returned: { label: 'Kembali', color: 'green' as const },
}

export function LibraryPage() {
  const { message } = App.useApp()
  const { canWrite, canDelete } = usePermissions()

  // ---- Buku ----
  const [bookSearch, setBookSearch] = useState('')
  const debouncedBookSearch = useDebounce(bookSearch, 300)
  const [category, setCategory] = useState<string | undefined>(undefined)
  const [bookPage, setBookPage] = useState(1)
  const [bookPageSize, setBookPageSize] = useState(10)

  // ---- Peminjaman ----
  const [loanSearch, setLoanSearch] = useState('')
  const debouncedLoanSearch = useDebounce(loanSearch, 300)
  const [loanView, setLoanView] = useState<LoanView>('active')
  const [loanPage, setLoanPage] = useState(1)
  const [loanPageSize, setLoanPageSize] = useState(10)

  const [tab, setTab] = useState('books')
  const [bookFormOpen, setBookFormOpen] = useState(false)
  const [editingBook, setEditingBook] = useState<Book | null>(null)
  const [loanOpen, setLoanOpen] = useState(false)
  const searchRef = useRef<InputRef>(null)

  const booksQuery = useBooks()
  const loansQuery = useLoans()
  const createBookMutation = useCreateBook()
  const updateBookMutation = useUpdateBook()
  const deleteBookMutation = useDeleteBook()
  const createLoanMutation = useCreateLoan()
  const returnLoanMutation = useReturnLoan()
  const deleteLoanMutation = useDeleteLoan()

  const allBooks = booksQuery.data ?? []
  const allLoans = loansQuery.data ?? []
  const isRefreshing = booksQuery.isFetching || loansQuery.isFetching

  const activeCountByBook = useMemo(() => {
    const map = new Map<string, number>()
    for (const loan of allLoans) {
      if (!loan.returned_at) map.set(loan.book_id, (map.get(loan.book_id) ?? 0) + 1)
    }
    return map
  }, [allLoans])

  const availableOf = (book: Book) => book.copies - (activeCountByBook.get(book.id) ?? 0)

  const stats = useMemo(
    () => ({
      titles: allBooks.length,
      copies: allBooks.reduce((s, b) => s + b.copies, 0),
      active: allLoans.filter((l) => loanStatus(l) === 'active').length,
      overdue: allLoans.filter((l) => loanStatus(l) === 'overdue').length,
    }),
    [allBooks, allLoans],
  )

  // ------------------------------------------------------------
  // Aksi
  // ------------------------------------------------------------

  const openCreateBook = () => {
    setEditingBook(null)
    setBookFormOpen(true)
  }

  const handleBookSubmit = (values: BookFormValues) => {
    const onError = (err: Error) => message.error(err.message || 'Gagal menyimpan buku')
    if (editingBook) {
      updateBookMutation.mutate(
        { id: editingBook.id, values },
        {
          onSuccess: () => {
            message.success('Buku diperbarui')
            setBookFormOpen(false)
          },
          onError,
        },
      )
    } else {
      createBookMutation.mutate(values, {
        onSuccess: () => {
          message.success('Buku ditambahkan')
          setBookFormOpen(false)
        },
        onError,
      })
    }
  }

  const handleDeleteBook = (id: string) => {
    deleteBookMutation.mutate(id, {
      onSuccess: () => message.success('Buku dihapus'),
      onError: (err: Error) => message.error(err.message || 'Gagal menghapus buku'),
    })
  }

  const handleLoanSubmit = (values: LoanFormValues) => {
    createLoanMutation.mutate(values, {
      onSuccess: () => {
        message.success('Peminjaman dicatat')
        setLoanOpen(false)
        setLoanView('active')
      },
      onError: (err: Error) => message.error(err.message || 'Gagal mencatat peminjaman'),
    })
  }

  const handleReturn = (loan: BookLoan) => {
    returnLoanMutation.mutate(loan.id, {
      onSuccess: () => message.success('Buku ditandai sudah kembali'),
      onError: (err: Error) => message.error(err.message || 'Gagal menandai pengembalian'),
    })
  }

  const handleDeleteLoan = (id: string) => {
    deleteLoanMutation.mutate(id, {
      onSuccess: () => message.success('Catatan peminjaman dihapus'),
      onError: (err: Error) => message.error(err.message || 'Gagal menghapus catatan'),
    })
  }

  const resetFilters = () => {
    setBookSearch('')
    setCategory(undefined)
    setLoanSearch('')
    setLoanView('active')
    setBookPage(1)
    setLoanPage(1)
  }

  // ------------------------------------------------------------
  // Shortcut
  // ------------------------------------------------------------

  const shortcutItems = useMemo<ShortcutItem[]>(
    () => [
      {
        keys: ['N'],
        label: tab === 'books' ? 'Tambah buku' : 'Pinjamkan buku',
        group: 'Aksi',
        icon: <PlusOutlined />,
        run: () => (tab === 'books' ? openCreateBook() : setLoanOpen(true)),
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
      },
    ],
    [canWrite, tab],
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
    isBlocked: bookFormOpen || loanOpen,
  })

  // ------------------------------------------------------------
  // Kolom tabel
  // ------------------------------------------------------------

  const bookRows = useMemo(() => {
    const q = debouncedBookSearch.trim().toLowerCase()
    return allBooks.filter((b) => {
      if (
        q &&
        !`${b.title} ${b.code ?? ''} ${b.author ?? ''} ${b.category ?? ''} ${b.shelf ?? ''}`
          .toLowerCase()
          .includes(q)
      )
        return false
      if (category && b.category !== category) return false
      return true
    })
  }, [allBooks, debouncedBookSearch, category])

  const paginatedBooks = useMemo(
    () => bookRows.slice((bookPage - 1) * bookPageSize, bookPage * bookPageSize),
    [bookRows, bookPage, bookPageSize],
  )

  const loanRows = useMemo(() => {
    const q = debouncedLoanSearch.trim().toLowerCase()
    return allLoans.filter((l) => {
      if (
        q &&
        !`${l.students?.name ?? ''} ${l.books?.title ?? ''} ${l.books?.code ?? ''}`
          .toLowerCase()
          .includes(q)
      )
        return false
      if (loanView === 'active' && loanStatus(l) !== 'active') return false
      if (loanView === 'overdue' && loanStatus(l) !== 'overdue') return false
      if (loanView === 'returned' && !l.returned_at) return false
      return true
    })
  }, [allLoans, debouncedLoanSearch, loanView])

  const paginatedLoans = useMemo(
    () => loanRows.slice((loanPage - 1) * loanPageSize, loanPage * loanPageSize),
    [loanRows, loanPage, loanPageSize],
  )

  const categoryOptions = useMemo(() => {
    const set = new Set<string>()
    for (const b of allBooks) if (b.category) set.add(b.category)
    return [...set].sort().map((c) => ({ value: c, label: c }))
  }, [allBooks])

  const bookColumns: TableColumnsType<Book> = [
    {
      title: 'Buku',
      dataIndex: 'title',
      key: 'title',
      render: (_, row) => (
        <div>
          <span style={{ fontWeight: 500 }}>{row.title}</span>
          {row.code && <Tag style={{ marginLeft: 8, borderRadius: 6, fontSize: 11 }}>{row.code}</Tag>}
          <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>
            {[row.author, row.publisher, row.year].filter(Boolean).join(' · ')}
          </div>
        </div>
      ),
    },
    {
      title: 'Kategori',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (v: string | null) => (v ? <Tag>{v}</Tag> : '-'),
      responsive: ['md'],
    },
    {
      title: 'Rak',
      dataIndex: 'shelf',
      key: 'shelf',
      width: 90,
      render: (v: string | null) => v ?? '-',
      responsive: ['lg'],
    },
    {
      title: 'Tersedia',
      key: 'available',
      width: 110,
      align: 'center',
      render: (_, row) => {
        const available = availableOf(row)
        return (
          <span
            style={{
              fontWeight: 600,
              color: available <= 0 ? '#f43f5e' : available < row.copies ? '#f59e0b' : '#10b981',
            }}
          >
            {available} / {row.copies}
          </span>
        )
      },
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
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => {
                    setEditingBook(row)
                    setBookFormOpen(true)
                  }}
                />
              </Tooltip>
            )}
            {canDelete && (
              <Popconfirm
                title="Hapus buku ini?"
                description="Riwayat peminjaman lama tetap tersimpan."
                onConfirm={() => handleDeleteBook(row.id)}
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

  const loanColumns: TableColumnsType<BookLoan> = [
    {
      title: 'Buku',
      key: 'book',
      render: (_, row) => (
        <div>
          <span style={{ fontWeight: 500 }}>{row.books?.title ?? '-'}</span>
          <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>{row.books?.code}</div>
        </div>
      ),
    },
    {
      title: 'Peminjam',
      key: 'student',
      render: (_, row) => (
        <div>
          <span style={{ fontWeight: 500 }}>{row.students?.name ?? '-'}</span>
          <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>
            {row.students?.registration_code}
            {row.students?.classes?.name ? ` · ${row.students.classes.name}` : ''}
          </div>
        </div>
      ),
    },
    {
      title: 'Dipinjam',
      dataIndex: 'borrowed_at',
      key: 'borrowed_at',
      width: 120,
      render: (v: string) => dayjs(v).format('DD MMM YYYY'),
      responsive: ['md'],
    },
    {
      title: 'Batas',
      dataIndex: 'due_date',
      key: 'due_date',
      width: 120,
      render: (v: string | null) => (v ? dayjs(v).format('DD MMM YYYY') : '-'),
      responsive: ['md'],
    },
    {
      title: 'Status',
      key: 'status',
      width: 120,
      render: (_, row) => {
        const status = loanStatus(row)
        const meta = STATUS_META[status]
        return <StatusTag color={meta.color}>{meta.label}</StatusTag>
      },
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 110,
      render: (_, row) => {
        const status = loanStatus(row)
        return (
          <Space size="small">
            {canWrite && status !== 'returned' && (
              <Tooltip title="Tandai sudah kembali">
                <Button
                  type="text"
                  icon={<CheckCircleOutlined style={{ color: '#10b981' }} />}
                  loading={returnLoanMutation.isPending && returnLoanMutation.variables === row.id}
                  onClick={() => handleReturn(row)}
                />
              </Tooltip>
            )}
            {canDelete && (
              <Popconfirm
                title="Hapus catatan peminjaman ini?"
                onConfirm={() => handleDeleteLoan(row.id)}
                okText="Hapus"
                cancelText="Batal"
              >
                <Tooltip title="Hapus">
                  <Button type="text" danger icon={<DeleteOutlined />} />
                </Tooltip>
              </Popconfirm>
            )}
          </Space>
        )
      },
    },
  ]

  return (
    <div>
      <PageHeader
        title="Perpustakaan"
        subtitle="Katalog buku dan peminjaman oleh santri"
        extra={
          <Space wrap>
            <Tooltip title="Muat ulang (R)">
              <Button
                icon={<SyncOutlined spin={isRefreshing} />}
                onClick={() => {
                  void booksQuery.refetch()
                  void loansQuery.refetch()
                }}
              />
            </Tooltip>
            <Tooltip title="Palet shortcut (?)">
              <Button icon={<QuestionCircleOutlined />} onClick={shortcuts.open} />
            </Tooltip>
            {canWrite && tab === 'books' && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreateBook}>
                Tambah Buku
              </Button>
            )}
            {canWrite && tab === 'loans' && (
              <Button type="primary" icon={<ExportOutlined />} onClick={() => setLoanOpen(true)}>
                Pinjamkan Buku
              </Button>
            )}
          </Space>
        }
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <StatChip
          icon={<BookOutlined />}
          label="Judul Buku"
          value={stats.titles}
          color="indigo"
          loading={booksQuery.isPending}
        />
        <StatChip
          icon={<BookOutlined />}
          label="Total Eksemplar"
          value={stats.copies}
          color="sky"
          loading={booksQuery.isPending}
        />
        <StatChip
          icon={<ExportOutlined />}
          label="Sedang Dipinjam"
          value={stats.active}
          color="amber"
          loading={loansQuery.isPending}
        />
        <StatChip
          icon={<ImportOutlined />}
          label="Terlambat"
          value={stats.overdue}
          color="rose"
          loading={loansQuery.isPending}
        />
      </div>

      <Card>
        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={[
            {
              key: 'books',
              label: 'Buku',
              children: (
                <>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 14 }}>
                    <Input
                      ref={searchRef}
                      placeholder="Cari judul, kode, penulis, atau rak"
                      prefix={<SearchOutlined />}
                      allowClear
                      value={bookSearch}
                      onChange={(e) => {
                        setBookSearch(e.target.value)
                        setBookPage(1)
                      }}
                      style={{ flex: '1 1 240px', minWidth: 220 }}
                    />
                    <Select
                      placeholder="Kategori"
                      allowClear
                      options={categoryOptions}
                      value={category}
                      onChange={(v) => {
                        setCategory(v)
                        setBookPage(1)
                      }}
                      style={{ minWidth: 140 }}
                    />
                    {(bookSearch || category) && (
                      <Button icon={<UndoOutlined />} onClick={() => { setBookSearch(''); setCategory(undefined) }}>
                        Reset
                      </Button>
                    )}
                  </div>
                  <Table<Book>
                    rowKey="id"
                    columns={bookColumns}
                    dataSource={paginatedBooks}
                    loading={booksQuery.isPending}
                    locale={{
                      emptyText: (
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description={bookSearch || category ? 'Tidak ada buku yang cocok dengan filter' : 'Belum ada buku'}
                        />
                      ),
                    }}
                    pagination={{
                      current: bookPage,
                      pageSize: bookPageSize,
                      total: bookRows.length,
                      showSizeChanger: true,
                      showTotal: (t) => `Total ${t} judul`,
                      onChange: (p, ps) => {
                        setBookPage(p)
                        setBookPageSize(ps)
                      },
                    }}
                    scroll={{ x: true }}
                  />
                </>
              ),
            },
            {
              key: 'loans',
              label: 'Peminjaman',
              children: (
                <>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 14 }}>
                    <Segmented
                      value={loanView}
                      onChange={(v) => {
                        setLoanView(v as LoanView)
                        setLoanPage(1)
                      }}
                      options={[
                        { label: 'Dipinjam', value: 'active' },
                        { label: 'Terlambat', value: 'overdue' },
                        { label: 'Kembali', value: 'returned' },
                        { label: 'Semua', value: '' },
                      ]}
                    />
                    <Input
                      placeholder="Cari peminjam atau buku"
                      prefix={<SearchOutlined />}
                      allowClear
                      value={loanSearch}
                      onChange={(e) => {
                        setLoanSearch(e.target.value)
                        setLoanPage(1)
                      }}
                      style={{ flex: '1 1 220px', minWidth: 200 }}
                    />
                  </div>
                  <Table<BookLoan>
                    rowKey="id"
                    columns={loanColumns}
                    dataSource={paginatedLoans}
                    loading={loansQuery.isPending}
                    rowClassName={(row) => (loanStatus(row) === 'overdue' ? 'student-row-risk' : '')}
                    locale={{
                      emptyText: (
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description={loanSearch ? 'Tidak ada peminjaman yang cocok' : 'Belum ada peminjaman'}
                        />
                      ),
                    }}
                    pagination={{
                      current: loanPage,
                      pageSize: loanPageSize,
                      total: loanRows.length,
                      showSizeChanger: true,
                      showTotal: (t) => `Total ${t} catatan`,
                      onChange: (p, ps) => {
                        setLoanPage(p)
                        setLoanPageSize(ps)
                      },
                    }}
                    scroll={{ x: true }}
                  />
                </>
              ),
            },
          ]}
        />
      </Card>

      <BookForm
        open={bookFormOpen}
        book={editingBook}
        submitting={createBookMutation.isPending || updateBookMutation.isPending}
        onCancel={() => setBookFormOpen(false)}
        onSubmit={handleBookSubmit}
      />

      <LoanModal
        open={loanOpen}
        submitting={createLoanMutation.isPending}
        onCancel={() => setLoanOpen(false)}
        onSubmit={handleLoanSubmit}
      />

      <ShortcutsModal open={shortcuts.isOpen} onClose={shortcuts.close} sections={shortcuts.sections} />
    </div>
  )
}
