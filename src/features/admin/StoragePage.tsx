import { useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Popconfirm,
  Row,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  theme,
  type TableColumnsType,
} from 'antd'
import {
  CloudServerOutlined,
  DeleteOutlined,
  FileOutlined,
  InboxOutlined,
  ReloadOutlined,
  ScanOutlined,
  SearchOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { StatChip } from '../../shared/components/StatChip'
import { useTabActions } from '../../shared/components/ActionsSlot'
import { useDebounce } from '../../shared/hooks/useDebounce'
import { logAudit } from '../../shared/utils/auditLogger'
import {
  useBuckets,
  useDeleteStorageFiles,
  useLargestFiles,
  useMoveStorageFiles,
  useOrphanScan,
} from './hooks'
import type { StorageFileInfo } from './types'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (['mp4', 'webm', 'mov'].includes(ext)) return <VideoCameraOutlined style={{ color: '#0ea5e9' }} />
  return <FileOutlined style={{ color: '#4f46e5' }} />
}

export function StoragePage({ active }: { active: boolean }) {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const bucketsQuery = useBuckets()
  const largestQuery = useLargestFiles()
  const orphanScan = useOrphanScan()
  const deleteMutation = useDeleteStorageFiles()
  const moveMutation = useMoveStorageFiles()
  const [deletingKey, setDeletingKey] = useState<string | null>(null)
  const [moving, setMoving] = useState(false)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)

  const buckets = bucketsQuery.data ?? []
  const largest = useMemo(() => largestQuery.data ?? [], [largestQuery.data])
  const orphans = orphanScan.data ?? []

  const filteredLargest = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase()
    if (!term) return largest
    return largest.filter((f) => f.name.toLowerCase().includes(term) || f.bucket.toLowerCase().includes(term))
  }, [largest, debouncedSearch])

  const handleDelete = async (files: StorageFileInfo[]) => {
    const byBucket = new Map<string, string[]>()
    for (const f of files) byBucket.set(f.bucket, [...(byBucket.get(f.bucket) ?? []), f.name])
    try {
      for (const [bucket, names] of byBucket) {
        await deleteMutation.mutateAsync({ bucket, names })
      }
      void logAudit({
        action: 'DELETE',
        source: 'SYSTEM',
        tableName: 'storage.objects',
        newData: { aksi: files.length > 1 ? 'pembersihan_orphan' : 'hapus_file', jumlah: files.length },
      })
      message.success(files.length > 1 ? `${files.length} file dihapus` : 'File dihapus')
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Gagal menghapus file')
    }
  }

  // Pindah ke folder _trash/ — reversible (P3 restore) dan tidak
  // menghilangkan data, jadi jadi aksi utama untuk orphan
  const handleMoveToTrash = async (files: StorageFileInfo[]) => {
    const byBucket = new Map<string, string[]>()
    for (const f of files) byBucket.set(f.bucket, [...(byBucket.get(f.bucket) ?? []), f.name])
    setMoving(true)
    try {
      for (const [bucket, names] of byBucket) {
        await moveMutation.mutateAsync({ bucket, names })
      }
      void logAudit({
        action: 'DELETE',
        source: 'SYSTEM',
        tableName: 'storage.objects',
        newData: { aksi: 'pindah_ke_trash', jumlah: files.length },
      })
      message.success(`${files.length} file dipindahkan ke folder _trash`)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Gagal memindahkan file')
    } finally {
      setMoving(false)
    }
  }

  // Kolom terbesar & orphan identik (keduanya bisa dihapus) — satu definisi memoized
  const fileColumns = useMemo<TableColumnsType<StorageFileInfo>>(
    () => [
      {
        title: 'File',
        key: 'name',
        render: (_, f) => (
          <Space size={8}>
            {fileIcon(f.name)}
            <div>
              <div style={{ fontWeight: 500, wordBreak: 'break-all' }}>{f.name}</div>
              <code style={{ fontSize: 11, color: token.colorTextTertiary }}>{f.bucket}</code>
            </div>
          </Space>
        ),
      },
      {
        title: 'Ukuran',
        dataIndex: 'size',
        key: 'size',
        width: 110,
        sorter: (a, b) => a.size - b.size,
        render: (v: number) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatSize(v)}</span>,
      },
      {
        title: 'Diunggah',
        dataIndex: 'updatedAt',
        key: 'updatedAt',
        width: 150,
        responsive: ['lg'],
        render: (v: string | null) => (v ? dayjs(v).format('DD MMM YYYY') : '—'),
      },
      {
        title: 'Aksi',
        key: 'actions',
        width: 90,
        render: (_: unknown, f: StorageFileInfo) => (
          <Popconfirm
            title="Hapus file ini?"
            description="File dihapus permanen dari storage."
            okText="Hapus"
            okButtonProps={{ danger: true }}
            cancelText="Batal"
            onConfirm={() => {
              setDeletingKey(`${f.bucket}/${f.name}`)
              void handleDelete([f]).finally(() => setDeletingKey(null))
            }}
          >
            <Tooltip title="Hapus file">
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                loading={deletingKey === `${f.bucket}/${f.name}`}
              />
            </Tooltip>
          </Popconfirm>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, deletingKey],
  )

  // Aksi tab diportal ke kanan judul shell — hasil dirender di JSX
  const actions = useTabActions(
    active,
    <Tooltip title="Muat ulang bucket & file">
      <Button
        icon={<ReloadOutlined spin={bucketsQuery.isFetching || largestQuery.isFetching} />}
        aria-label="Muat ulang bucket & file"
        onClick={() => {
          void bucketsQuery.refetch()
          void largestQuery.refetch()
        }}
      />
    </Tooltip>,
  )

  return (
    <div>
      {actions}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <StatChip
          icon={<CloudServerOutlined />}
          label="Bucket"
          value={buckets.length}
          color="indigo"
          loading={bucketsQuery.isPending}
        />
        <StatChip
          icon={<FileOutlined />}
          label="File Terbesar"
          value={largest[0] ? formatSize(largest[0].size) : '–'}
          color="sky"
          loading={largestQuery.isPending}
        />
        {orphanScan.isFetched && (
          <StatChip
            icon={<ScanOutlined />}
            label="File Orphan"
            value={orphans.length}
            color={orphans.length > 0 ? 'rose' : 'emerald'}
            loading={orphanScan.isFetching}
          />
        )}
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {bucketsQuery.isError ? (
          <Col span={24}>
            <Alert
              type="error"
              showIcon
              message="Gagal memuat bucket"
              description="Daftar bucket storage tidak bisa diambil dari server."
              action={
                <Button size="small" icon={<ReloadOutlined />} onClick={() => void bucketsQuery.refetch()}>
                  Coba lagi
                </Button>
              }
            />
          </Col>
        ) : bucketsQuery.isPending ? (
          <Col span={24}>
            <Card loading style={{ minHeight: 120 }} />
          </Col>
        ) : buckets.length === 0 ? (
          <Col span={24}>
            <Alert
              type="info"
              showIcon
              icon={<CloudServerOutlined />}
              message="Tidak ada bucket yang bisa dibaca"
              description="Aplikasi saat ini minim pemakaian storage (foto tersimpan terkompresi di database). Bucket yang dibuat nantinya akan tampil di sini. Jika bucket sudah ada tapi tidak muncul, periksa kebijakan storage Supabase."
            />
          </Col>
        ) : (
          buckets.map((bucket) => (
            <Col xs={24} sm={12} xl={8} key={bucket.name}>
              <Card size="small">
                <Space size={12}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      background: `${token.colorPrimary}1A`,
                      color: token.colorPrimary,
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 17,
                    }}
                  >
                    <CloudServerOutlined />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700 }}>{bucket.name}</div>
                    <Space size={6} style={{ marginTop: 2 }}>
                      <Tag color={bucket.public ? 'green' : 'orange'} style={{ borderRadius: 999 }}>
                        {bucket.public ? 'Publik' : 'Privat'}
                      </Tag>
                      {bucket.created_at && (
                        <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>
                          {dayjs(bucket.created_at).format('DD MMM YYYY')}
                        </Typography.Text>
                      )}
                    </Space>
                  </div>
                </Space>
              </Card>
            </Col>
          ))
        )}
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card
            title="File Berukuran Besar"
            size="small"
            extra={
              <Input
                size="small"
                placeholder="Cari file / bucket…"
                prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
                allowClear
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: 200 }}
              />
            }
          >
            {largestQuery.isError ? (
              <Alert
                type="error"
                showIcon
                style={{ marginBottom: 12 }}
                message="Gagal memuat daftar file"
                action={
                  <Button size="small" icon={<ReloadOutlined />} onClick={() => void largestQuery.refetch()}>
                    Coba lagi
                  </Button>
                }
              />
            ) : null}
            <Table<StorageFileInfo>
              rowKey={(f) => `${f.bucket}/${f.name}`}
              size="small"
              columns={fileColumns}
              dataSource={filteredLargest}
              loading={largestQuery.isPending}
              scroll={{ x: 'max-content' }}
              pagination={false}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={largest.length > 0 ? 'Tidak ada file yang cocok' : 'Tidak ada file di bucket'}
                  />
                ),
              }}
            />
          </Card>
        </Col>

        <Col span={24}>
          <Card
            title="Pembersih File Orphan"
            size="small"
            extra={
              <Button
                size="small"
                type="primary"
                ghost
                icon={<ScanOutlined />}
                loading={orphanScan.isFetching}
                onClick={() => void orphanScan.refetch()}
              >
                Pindai Sekarang
              </Button>
            }
          >
            <Typography.Paragraph type="secondary" style={{ fontSize: 12.5 }}>
              Memindai seluruh folder tiap bucket (maks 3 level) dan mencocokkannya dengan URL yang
              dirujuk kolom <code style={{ margin: '0 4px' }}>profiles.avatar_url</code>,
              <code style={{ margin: '0 4px' }}>students/teachers.photo_url</code>, lampiran tugas
              pembinaan, dan logo sekolah. File di folder <code>_trash</code> diabaikan.
            </Typography.Paragraph>
            <Table<StorageFileInfo>
              rowKey={(f) => `${f.bucket}/${f.name}`}
              size="small"
              columns={fileColumns}
              dataSource={orphans}
              loading={orphanScan.isFetching}
              scroll={{ x: 'max-content' }}
              pagination={orphans.length > 10 ? { pageSize: 10, showSizeChanger: false } : false}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      orphanScan.isFetched
                        ? 'Tidak ada file orphan — storage bersih'
                        : 'Belum dipindai — klik "Pindai Sekarang"'
                    }
                  />
                ),
              }}
              footer={
                orphans.length > 0
                  ? () => (
                      <Space style={{ justifyContent: 'space-between', width: '100%' }} wrap>
                        <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
                          Total {orphans.length} file · {formatSize(orphans.reduce((sum, f) => sum + f.size, 0))}
                        </Typography.Text>
                        <Space wrap>
                          <Button
                            type="primary"
                            icon={<InboxOutlined />}
                            loading={moving}
                            onClick={() => void handleMoveToTrash(orphans)}
                          >
                            Pindahkan ke Sampah
                          </Button>
                          <Popconfirm
                            title="Hapus permanen semua file orphan?"
                            description={`${orphans.length} file akan dihapus permanen. Saran: pindahkan ke sampah dulu agar bisa dipulihkan.`}
                            okText="Hapus Permanen"
                            okButtonProps={{ danger: true }}
                            cancelText="Batal"
                            onConfirm={() => void handleDelete(orphans)}
                          >
                            <Button danger icon={<DeleteOutlined />} loading={deleteMutation.isPending}>
                              Hapus Permanen
                            </Button>
                          </Popconfirm>
                        </Space>
                      </Space>
                    )
                  : undefined
              }
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
