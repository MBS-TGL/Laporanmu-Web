import { useEffect, useState } from 'react'
import { App, Button, Popconfirm, Space, Typography } from 'antd'
import { CopyOutlined, DownloadOutlined, DeleteOutlined, FileImageOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { StatusTag } from '../../../shared/components/StatusTag'
import { downloadMediaFile, getMediaFileUrl, type MediaFile } from '../media'

const { Text, Paragraph } = Typography

interface PreviewModalProps {
  file: MediaFile | null
  isPublicBucket: boolean
  referenced: boolean
  /** Gate RBAC media:delete — false menyembunyikan aksi hapus. */
  canDelete?: boolean
  onClose: () => void
  onDelete: (file: MediaFile) => void
  deleting?: boolean
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/** Preview satu file media: gambar inline, metadata, copy link, unduh, hapus. */
export function PreviewModal({ file, isPublicBucket, referenced, canDelete = true, onClose, onDelete, deleting }: PreviewModalProps) {
  const { message } = App.useApp()
  const [url, setUrl] = useState<string | null>(null)
  const [urlError, setUrlError] = useState(false)

  // Signed URL dibuat tiap kali file berubah — modal privat tak memakai URL basi
  useEffect(() => {
    setUrl(null)
    setUrlError(false)
    if (!file) return
    let cancelled = false
    getMediaFileUrl(file.bucket, file.path, isPublicBucket)
      .then((u) => {
        if (!cancelled) setUrl(u)
      })
      .catch(() => {
        if (!cancelled) setUrlError(true)
      })
    return () => {
      cancelled = true
    }
  }, [file, isPublicBucket])

  if (!file) return null

  const copyLink = async () => {
    try {
      const link = url ?? (await getMediaFileUrl(file.bucket, file.path, isPublicBucket))
      await navigator.clipboard.writeText(link)
      message.success('Link disalin ke clipboard')
    } catch {
      message.error('Gagal menyalin link')
    }
  }

  return (
    <AppModal
      open={!!file}
      title={file.name}
      subtitle={`${formatSize(file.size)} · ${file.mimetype || 'tidak diketahui'}`}
      icon={<FileImageOutlined />}
      onCancel={onClose}
      footer={null}
      width={720}
    >
      <div style={{ display: 'flex', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.03)', borderRadius: 12, padding: 16, minHeight: 220 }}>
        {file.isImage && url ? (
          <img
            src={url}
            alt={file.name}
            style={{ maxWidth: '100%', maxHeight: 420, objectFit: 'contain', borderRadius: 8 }}
          />
        ) : urlError ? (
          <Text type="danger">Gagal memuat pratinjau (akses bucket ditolak)</Text>
        ) : (
          <FileImageOutlined style={{ fontSize: 64, color: 'rgba(15, 23, 42, 0.25)', alignSelf: 'center' }} />
        )}
      </div>

      <Paragraph style={{ marginTop: 12, marginBottom: 0 }} copyable={{ text: file.path }}>
        <Text type="secondary" style={{ fontSize: 12.5 }}>Path: {file.bucket}/{file.path}</Text>
      </Paragraph>

      <Space wrap style={{ marginTop: 12, width: '100%', justifyContent: 'space-between' }}>
        <StatusTag color={referenced ? 'success' : 'default'}>
          {referenced ? 'Terpakai oleh data' : 'Tidak terpakai'}
        </StatusTag>
        <Space wrap>
          <Button icon={<CopyOutlined />} onClick={copyLink}>
            Salin Link
          </Button>
          <Button
            icon={<DownloadOutlined />}
            onClick={async () => {
              try {
                await downloadMediaFile(file.bucket, file.path, file.name, isPublicBucket)
              } catch {
                message.error('Gagal mengunduh file')
              }
            }}
          >
            Unduh
          </Button>
          {canDelete && (
            <Popconfirm
              title="Hapus file ini?"
              description={referenced ? 'File masih dirujuk data, link akan mati.' : 'File dihapus permanen dari storage.'}
              okText="Hapus"
              okButtonProps={{ danger: true }}
              cancelText="Batal"
              onConfirm={() => onDelete(file)}
            >
              <Button danger icon={<DeleteOutlined />} loading={deleting}>
                Hapus
              </Button>
            </Popconfirm>
          )}
        </Space>
      </Space>
    </AppModal>
  )
}
