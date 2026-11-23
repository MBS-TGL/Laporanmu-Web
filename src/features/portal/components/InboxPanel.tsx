import { useState } from 'react'
import { Badge, Button, Empty, List, Typography, theme } from 'antd'
import { ArrowRightOutlined, CheckOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { rpcPortalMarkNotificationRead, rpcPortalNotifications, type PortalNotification } from '../api'

const KIND_LABEL: Record<PortalNotification['kind'], string> = {
  announcement: 'Pengumuman',
  spp: 'Tagihan',
  report: 'Rapor',
  general: 'Informasi',
}

/** Hanya path internal; payload push tidak boleh mengarahkan ke luar aplikasi. */
function safeHref(url: string | null): string | null {
  if (!url) return null
  if (!url.startsWith('/') || url.startsWith('//')) return null
  return url
}

/**
 * Kotak masuk notifikasi santri. Sumbernya tabel portal_notifications yang
 * diisi Edge Function push-send, jadi daftar tetap ada walau notifikasi OS
 * ditolak atau perangkat sedang offline.
 */
export function InboxPanel({ token }: { token: string }) {
  const { token: t } = theme.useToken()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [busyId, setBusyId] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['portal-notifications', token],
    queryFn: () => rpcPortalNotifications(token),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
  })

  const markRead = async (item: PortalNotification) => {
    if (item.read_at || busyId) return
    setBusyId(item.id)
    try {
      await rpcPortalMarkNotificationRead(token, item.id)
      await qc.invalidateQueries({ queryKey: ['portal-notifications', token] })
    } catch {
      // Gagal menandai tidak boleh menghalangi navigasi
    } finally {
      setBusyId(null)
    }
  }

  if (query.isPending) {
    return (
      <Typography.Text type="secondary" style={{ fontSize: 13 }}>
        Memuat notifikasi...
      </Typography.Text>
    )
  }

  if (query.isError) {
    return (
      <div style={{ display: 'grid', gap: 8 }}>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          Notifikasi gagal dimuat.
        </Typography.Text>
        <Button size="small" onClick={() => void query.refetch()}>
          Coba lagi
        </Button>
      </div>
    )
  }

  const items = query.data?.items ?? []

  if (items.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            Belum ada notifikasi
          </Typography.Text>
        }
      />
    )
  }

  return (
    <List
      size="small"
      dataSource={items}
      style={{ marginTop: -8 }}
      renderItem={(item) => {
        const href = safeHref(item.url)
        return (
          <List.Item
            style={{ padding: '8px 0', alignItems: 'flex-start' }}
            actions={
              href
                ? [
                    <Button
                      key="open"
                      type="link"
                      size="small"
                      loading={busyId === item.id}
                      onClick={() => {
                        void markRead(item)
                        navigate(href)
                      }}
                    >
                      Buka <ArrowRightOutlined />
                    </Button>,
                  ]
                : undefined
            }
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {item.read_at ? (
                  <CheckOutlined style={{ color: t.colorTextTertiary, fontSize: 12 }} aria-label="Sudah dibaca" />
                ) : (
                  <Badge color={t.colorPrimary} aria-label="Belum dibaca" />
                )}
                <Typography.Text strong={!item.read_at} style={{ fontSize: 13 }}>
                  {item.title}
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                  {KIND_LABEL[item.kind]}
                </Typography.Text>
              </div>
              {item.body && (
                <Typography.Paragraph
                  type="secondary"
                  style={{ fontSize: 12, margin: '2px 0 0' }}
                  ellipsis={{ rows: 2 }}
                >
                  {item.body}
                </Typography.Paragraph>
              )}
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                {dayjs(item.created_at).format('DD MMM YYYY HH:mm')}
              </Typography.Text>
            </div>
          </List.Item>
        )
      }}
    />
  )
}
