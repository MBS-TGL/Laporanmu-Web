import { Alert, Avatar, Button, Empty, Skeleton, Space, Tag, Tooltip, theme } from 'antd'
import { CheckCircleOutlined, DisconnectOutlined, LinkOutlined, ReloadOutlined } from '@ant-design/icons'
import type { TeacherLinkBrief } from '../api'

// Panel "Guru Belum Punya Akun Terhubung" — antrian kerja utama halaman
// Pengguna. Dirancang sebagai kartu samping (di samping tabel akun di xl):
// tinggi dibatasi + scroll agar tidak mendorong konten lain jauh ke bawah.
export function UnlinkedCard({
  teachers,
  loading,
  isError,
  onRetry,
  canManage,
  onLink,
}: {
  teachers: TeacherLinkBrief[]
  loading: boolean
  isError: boolean
  onRetry: () => void
  canManage: boolean
  onLink: (teacher: TeacherLinkBrief) => void
}) {
  const { token } = theme.useToken()

  return (
    <div
      style={{
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 12,
        background: token.colorBgContainer,
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 560,
      }}
    >
      {/* Kepala panel: judul + jumlah, alasan bisnisnya */}
      <div style={{ padding: '14px 16px 10px', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
        <Space size={8} align="center">
          <DisconnectOutlined style={{ color: token.colorTextTertiary }} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>Guru Belum Punya Akun</span>
          {teachers.length > 0 && (
            <Tag color="orange" style={{ borderRadius: 999, marginInlineEnd: 0 }}>
              {teachers.length}
            </Tag>
          )}
        </Space>
        <div style={{ fontSize: 12.5, color: token.colorTextSecondary, marginTop: 4 }}>
          Guru aktif pada <code style={{ fontSize: 11 }}>teachers</code> yang belum punya akun pengguna
        </div>
      </div>

      {/* Isi: scroll saat daftar panjang */}
      <div style={{ overflowY: 'auto', flex: 1, padding: '6px 0' }}>
        {isError ? (
          <Alert
            type="error"
            showIcon
            style={{ margin: '12px 16px' }}
            message="Gagal memuat data guru"
            action={
              <Button size="small" icon={<ReloadOutlined />} onClick={onRetry}>
                Coba lagi
              </Button>
            }
          />
        ) : loading ? (
          <div style={{ padding: '10px 16px' }}>
            <Skeleton avatar active paragraph={{ rows: 1 }} />
            <Skeleton avatar active paragraph={{ rows: 1 }} />
            <Skeleton avatar active paragraph={{ rows: 1 }} />
          </div>
        ) : teachers.length === 0 ? (
          <div style={{ padding: '28px 16px', textAlign: 'center' }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <Space size={6}>
                  <CheckCircleOutlined style={{ color: '#10b981' }} />
                  <span style={{ fontSize: 13 }}>Semua guru sudah terhubung ke akun</span>
                </Space>
              }
            />
          </div>
        ) : (
          teachers.map((t, idx) => (
            <div
              key={t.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 16px',
                borderTop: idx === 0 ? 'none' : `1px solid ${token.colorBorderSecondary}`,
              }}
            >
              <Avatar style={{ background: 'rgba(79,70,229,0.1)', color: '#4f46e5', fontWeight: 700, flexShrink: 0 }}>
                {(t.name || '?').charAt(0).toUpperCase()}
              </Avatar>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.name}
                </div>
                <div style={{ fontSize: 12, color: token.colorTextSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {[t.nbm, t.email].filter(Boolean).join(' · ') || 'Tanpa NBM & email'}
                </div>
              </div>
              {canManage && (
                <Tooltip title="Buat akun baru atau pilih akun existing">
                  <Button size="small" icon={<LinkOutlined />} onClick={() => onLink(t)} style={{ flexShrink: 0 }}>
                    Hubungkan
                  </Button>
                </Tooltip>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
