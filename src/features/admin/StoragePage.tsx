import { useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Empty,
  Popconfirm,
  Row,
  Space,
  Table,
  Tag,
  Typography,
  type TableColumnsType,
} from 'antd'
import {
  CloudServerOutlined,
  DeleteOutlined,
  FileOutlined,
  ReloadOutlined,
  ScanOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { PageHeader } from '../../shared/components/PageHeader'
import { logAudit } from '../../shared/utils/auditLogger'
import { useBuckets, useDeleteStorageFiles, useLargestFiles, useOrphanScan } from './hooks'
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

export function StoragePage() {
  const { message } = App.useApp()
  const bucketsQuery = useBuckets()
  const largestQuery = useLargestFiles()
  const orphanScan = useOrphanScan()
  const deleteMutation = useDeleteStorageFiles()
  const [deletingKey, setDeletingKey] = useState<string | null>(null)

  const buckets = bucketsQuery.data ?? []
  const largest = largestQuery.data ?? []
  const orphans = orphanScan.data ?? []

  const deleteColumns: TableColumnsType<StorageFileInfo> = [
    {
      title: 'File',
      key: 'name',
      render: (_, f) => (
        <Space size={8}>
          {fileIcon(f.name)}
          <div>
            <div style={{ fontWeight: 500, wordBreak: 'break-all' }}>{f.name}</div>
            <code style={{ fontSize: 11, color: '#64748b' }}>{f.bucket}</code>
          </div>
        </Space>
      ),
    },
    {
      title: 'Ukuran',
      dataIndex: 'size',
      key: 'size',
      width: 110,
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
      width: 110,
      render: (_, f) => (
        <Popconfirm
          title="Hapus file ini?"
          description="File dihapus permanen dari storage."
          okText="Hapus"
          okButtonProps={{ danger: true }}
          cancelText="Batal"
          onConfirm={async () => {
            setDeletingKey(`${f.bucket}/${f.name}`)
            try {
              await deleteMutation.mutateAsync({ bucket: f.bucket, names: [f.name] })
              void logAudit({
                action: 'DELETE',
                source: 'SYSTEM',
                tableName: 'storage.objects',
                newData: { bucket: f.bucket, file: f.name, size: f.size },
              })
              message.success('File dihapus')
            } catch (err) {
              message.error(err instanceof Error ? err.message : 'Gagal menghapus file')
            } finally {
              setDeletingKey(null)
            }
          }}
        >
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            loading={deletingKey === `${f.bucket}/${f.name}`}
          />
        </Popconfirm>
      ),
    },
  ]

  const orphanTable = (
    <Table<StorageFileInfo>
      rowKey={(f) => `${f.bucket}/${f.name}`}
      size="small"
      columns={deleteColumns}
      dataSource={orphans}
      pagination={orphans.length > 10 ? { pageSize: 10, showSizeChanger: false } : false}
      locale={{
        emptyText: <Empty description="Tidak ada file orphan — storage bersih" />,
      }}
      footer={
        orphans.length > 0
          ? () => (
              <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
                  Total {orphans.length} file ·{' '}
                  {formatSize(orphans.reduce((sum, f) => sum + f.size, 0))}
                </Typography.Text>
                <Popconfirm
                  title="Hapus semua file orphan?"
                  description={`${orphans.length} file akan dihapus permanen. Pastikan tidak ada yang masih dirujuk.`}
                  okText="Hapus Semua"
                  okButtonProps={{ danger: true }}
                  cancelText="Batal"
                  onConfirm={async () => {
                    const byBucket = new Map<string, string[]>()
                    for (const f of orphans) {
                      byBucket.set(f.bucket, [...(byBucket.get(f.bucket) ?? []), f.name])
                    }
                    try {
                      for (const [bucket, names] of byBucket) {
                        await deleteMutation.mutateAsync({ bucket, names })
                      }
                      void logAudit({
                        action: 'DELETE',
                        source: 'SYSTEM',
                        tableName: 'storage.objects',
                        newData: { aksi: 'pembersihan_orphan', jumlah: orphans.length },
                      })
                      message.success(`${orphans.length} file orphan dihapus`)
                    } catch (err) {
                      message.error(err instanceof Error ? err.message : 'Gagal membersihkan file')
                    }
                  }}
                >
                  <Button danger icon={<DeleteOutlined />} loading={deleteMutation.isPending}>
                    Hapus Semua Orphan
                  </Button>
                </Popconfirm>
              </Space>
            )
          : undefined
      }
    />
  )

  return (
    <div>
      <PageHeader
        title="Manajemen Penyimpanan"
        subtitle="Bucket storage, file terbesar, dan pembersihan file yatim (orphan)"
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {bucketsQuery.isLoading ? (
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
              description="Aplikasi saat ini minim pemakaian storage (foto tersimpan terkompresi di database). Bucket yang dibuat nantinya (mis. Fase 0 PRD) akan tampil di sini. Jika bucket sudah ada tapi tidak muncul, periksa kebijakan storage Supabase."
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
                      background: '#eef2ff',
                      color: '#4f46e5',
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
                      <Tag color={bucket.public ? 'green' : 'orange'}>{bucket.public ? 'Publik' : 'Privat'}</Tag>
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
              <Button
                size="small"
                icon={<ReloadOutlined />}
                loading={largestQuery.isFetching}
                onClick={() => void largestQuery.refetch()}
              >
                Segarkan
              </Button>
            }
          >
            <Table<StorageFileInfo>
              rowKey={(f) => `${f.bucket}/${f.name}`}
              size="small"
              columns={deleteColumns}
              dataSource={largest}
              loading={largestQuery.isLoading}
              pagination={false}
              locale={{
                emptyText: <Empty description="Tidak ada file di bucket" />,
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
              Memindai file root-level di setiap bucket dan mencocokkannya dengan URL yang dirujuk kolom
              <code style={{ margin: '0 4px' }}>profiles.avatar_url</code>,
              <code style={{ margin: '0 4px' }}>students.photo_url</code>, dan
              <code style={{ margin: '0 4px' }}>teachers.photo_url</code>.
              {orphanScan.isFetched && ' Pemindaian hanya menjangkau file di tingkat akar (root).'}
            </Typography.Paragraph>
            {orphanTable}
          </Card>
        </Col>
      </Row>
    </div>
  )
}
