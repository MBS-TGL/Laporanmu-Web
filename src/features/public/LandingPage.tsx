import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, Tag, Typography } from 'antd'
import {
  ArrowRightOutlined,
  AuditOutlined,
  CarOutlined,
  CheckSquareOutlined,
  FileDoneOutlined,
  FileProtectOutlined,
  MedicineBoxOutlined,
  NotificationOutlined,
  SafetyCertificateOutlined,
  TrophyOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { fetchPublicAnnouncements, type PublicAnnouncement } from '../announcements/api'
import { CATEGORY_COLORS } from '../announcements/types'
import { IconBox } from '../../shared/components/IconBox'
import { useSession } from '../../shared/hooks/useProfile'

const FEATURES = [
  {
    icon: <FileProtectOutlined />,
    title: 'Poin Perilaku',
    desc: 'Pelanggaran dan prestasi santri tercatat otomatis dengan poin yang konsisten.',
  },
  {
    icon: <FileDoneOutlined />,
    title: 'Raport Bulanan',
    desc: 'Input, cetak, dan arsipkan raport bulanan asrama tanpa repot.',
  },
  {
    icon: <AuditOutlined />,
    title: 'Skorsing & Pembinaan',
    desc: 'Checklist pembinaan harian di rumah diisi wali, dipantau pembina.',
  },
  {
    icon: <CheckSquareOutlined />,
    title: 'Kehadiran',
    desc: 'Absensi harian santri terekam rapi untuk ditinjau kapan saja.',
  },
  {
    icon: <MedicineBoxOutlined />,
    title: 'Kesehatan & BK',
    desc: 'Kunjungan kesehatan dan konseling tersusun sebagai riwayat lengkap.',
  },
  {
    icon: <CarOutlined />,
    title: 'Izin Pulang',
    desc: 'Surat izin pulang digital lengkap dengan QR verifikasi.',
  },
  {
    icon: <NotificationOutlined />,
    title: 'Pengumuman',
    desc: 'Informasi penting tersampaikan ke wali santri lewat portal publik.',
  },
  {
    icon: <SafetyCertificateOutlined />,
    title: 'Verifikasi Rapor',
    desc: 'Keaslian dokumen rapor bisa diperiksa siapa pun lewat ID santri.',
  },
]

// Mockup kecil ala aplikasi untuk visual hero — dekoratif, tanpa data nyata
function HeroPreview() {
  return (
    <div style={{ position: 'relative' }}>
      {/* kartu di belakang untuk kesan kedalaman */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: '16px -12px -12px 16px',
          borderRadius: 20,
          background: 'linear-gradient(160deg, #eef2ff, #e0e7ff)',
          transform: 'rotate(2.5deg)',
        }}
      />
      <Card
        style={{
          position: 'relative',
          borderRadius: 18,
          boxShadow: '0 24px 60px rgba(79, 70, 229, 0.16)',
          border: '1px solid #eef2f7',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <img src="/logo-icon.png" alt="" width={22} height={22} />
          <Typography.Text strong style={{ fontSize: 13 }}>
            Portal Wali Santri
          </Typography.Text>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {(
            [
              ['Total Poin', '−5', '#dc2626'],
              ['Pelanggaran', '3', '#0f172a'],
              ['Prestasi', '2', '#16a34a'],
            ] as const
          ).map(([label, value, color]) => (
            <div
              key={label}
              style={{ flex: 1, background: '#f8fafc', borderRadius: 10, padding: '10px 12px' }}
            >
              <div style={{ fontSize: 11, color: '#64748b' }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
                {value}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          {(
            [
              ['Terlambat kembali ke asrama', '−5', '#fff1f0', 'red'],
              ['Hafalan terbaik pekan ini', '+10', '#f0fdf4', 'green'],
            ] as const
          ).map(([label, point, bg, tagColor]) => (
            <div
              key={label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 8,
                background: bg,
              }}
            >
              <Typography.Text strong style={{ fontSize: 12.5 }}>
                {label}
              </Typography.Text>
              <Tag color={tagColor} style={{ marginInlineEnd: 0 }}>
                {point}
              </Tag>
            </div>
          ))}
        </div>
      </Card>

      <div className="land-chip land-float" style={{ position: 'absolute', top: -18, right: -14 }}>
        <Card size="small" style={{ borderRadius: 12, boxShadow: '0 10px 30px rgba(15,23,42,0.12)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5 }}>
            <TrophyOutlined style={{ color: '#10b981' }} />
            <b>+5 Prestasi</b>
          </span>
        </Card>
      </div>
      <div
        className="land-chip land-float"
        style={{ position: 'absolute', bottom: -20, left: -16, animationDelay: '1.4s' }}
      >
        <Card size="small" style={{ borderRadius: 12, boxShadow: '0 10px 30px rgba(15,23,42,0.12)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5 }}>
            <FileDoneOutlined style={{ color: '#4f46e5' }} />
            <b>Raport Tersedia</b>
          </span>
        </Card>
      </div>
    </div>
  )
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
  center = true,
}: {
  eyebrow: string
  title: string
  subtitle: string
  center?: boolean
}) {
  return (
    <div style={{ textAlign: center ? 'center' : 'left', marginBottom: 32 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.08em',
          color: '#4f46e5',
          marginBottom: 8,
        }}
      >
        {eyebrow}
      </div>
      <Typography.Title level={2} style={{ margin: 0, letterSpacing: '-0.03em', fontSize: 30 }}>
        {title}
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0, fontSize: 15 }}>
        {subtitle}
      </Typography.Paragraph>
    </div>
  )
}

export function LandingPage() {
  const sessionQuery = useSession()
  const isLoggedIn = !!sessionQuery.data?.user
  const [announcements, setAnnouncements] = useState<PublicAnnouncement[]>([])

  useEffect(() => {
    document.title = 'Laporanmu — Sistem Manajemen Perilaku Santri'
  }, [])

  // Pengumuman publik — gagal fetch diabaikan (bukan data kritis)
  useEffect(() => {
    let cancelled = false
    fetchPublicAnnouncements()
      .then((rows) => {
        if (!cancelled) setAnnouncements(rows.slice(0, 3))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const loginHref = isLoggedIn ? '/dashboard' : '/login'
  const loginLabel = isLoggedIn ? 'Buka Dashboard' : 'Masuk ke Aplikasi'

  return (
    <div style={{ minHeight: '100vh', background: '#fff' }}>
      {/* Navbar */}
      <header className="land-nav">
        <div
          style={{
            maxWidth: 1120,
            margin: '0 auto',
            padding: '12px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 20,
          }}
        >
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center' }}>
            <img src="/logo-laporanmu.png" alt="Laporanmu" style={{ height: 34, width: 'auto' }} />
          </Link>
          <nav
            className="land-nav-links"
            style={{ marginLeft: 'auto', display: 'flex', gap: 22, alignItems: 'center' }}
          >
            <a
              href="#fitur"
              onClick={(e) => {
                e.preventDefault()
                scrollTo('fitur')
              }}
              style={{ color: '#475569', fontSize: 13.5, fontWeight: 500 }}
            >
              Fitur
            </a>
            <a
              href="#portal"
              onClick={(e) => {
                e.preventDefault()
                scrollTo('portal')
              }}
              style={{ color: '#475569', fontSize: 13.5, fontWeight: 500 }}
            >
              Portal Wali
            </a>
          </nav>
          <Link to={loginHref}>
            <Button type="primary" style={{ marginLeft: isLoggedIn ? 'auto' : 0 }}>
              {isLoggedIn ? 'Buka Dashboard' : 'Masuk'}
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section
        style={{
          padding: '72px 24px 84px',
          backgroundImage:
            'radial-gradient(620px 320px at 10% -4%, rgba(199,210,254,0.55), transparent 70%), radial-gradient(560px 300px at 92% 55%, rgba(167,243,208,0.45), transparent 70%)',
        }}
      >
        <div
          style={{
            maxWidth: 1120,
            margin: '0 auto',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 48,
            position: 'relative',
          }}
        >
          <div className="land-fade-up" style={{ flex: '1 1 380px' }}>
            <span
              style={{
                display: 'inline-block',
                padding: '5px 14px',
                borderRadius: 999,
                background: '#eef2ff',
                color: '#4f46e5',
                fontSize: 12.5,
                fontWeight: 600,
                marginBottom: 18,
              }}
            >
              Sistem Manajemen Perilaku Santri
            </span>
            <Typography.Title
              level={1}
              style={{ margin: 0, fontSize: 'clamp(30px, 4.4vw, 46px)', letterSpacing: '-0.03em', lineHeight: 1.15 }}
            >
              Pembinaan santri yang tercatat,{' '}
              <span style={{ color: '#4f46e5' }}>terpantau</span>, dan transparan.
            </Typography.Title>
            <Typography.Paragraph
              type="secondary"
              style={{ marginTop: 16, fontSize: 16, maxWidth: 520, lineHeight: 1.65 }}
            >
              Laporanmu membantu madrasah dan pesantren mencatat poin perilaku, raport bulanan,
              kesehatan, hingga izin pulang — semuanya terhubung dengan wali santri dalam satu
              aplikasi.
            </Typography.Paragraph>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 28 }}>
              <Link to={loginHref}>
                <Button type="primary" size="large">
                  {loginLabel}
                </Button>
              </Link>
              <Link to="/check">
                <Button size="large" icon={<ArrowRightOutlined />}>
                  Cek Wali Santri
                </Button>
              </Link>
            </div>
          </div>
          <div className="land-fade-up" style={{ flex: '1 1 320px', animationDelay: '0.15s' }}>
            <HeroPreview />
          </div>
        </div>
      </section>

      {/* Fitur */}
      <section id="fitur" style={{ padding: '56px 24px', scrollMarginTop: 76, background: '#f8fafc' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <SectionHeader
            eyebrow="FITUR"
            title="Semua kebutuhan pembinaan dalam satu tempat"
            subtitle="Dari pencatatan poin harian sampai laporan bulanan — tanpa berpindah-pindah aplikasi."
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            {FEATURES.map((f) => (
              <Card key={f.title} className="land-card-hover" style={{ borderRadius: 14, border: '1px solid #eef2f7' }}>
                <IconBox icon={f.icon} />
                <Typography.Text strong style={{ display: 'block', marginTop: 14, fontSize: 15 }}>
                  {f.title}
                </Typography.Text>
                <Typography.Paragraph type="secondary" style={{ marginTop: 6, marginBottom: 0, fontSize: 13, lineHeight: 1.6 }}>
                  {f.desc}
                </Typography.Paragraph>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Portal Wali */}
      <section id="portal" style={{ padding: '64px 24px', scrollMarginTop: 76 }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <SectionHeader
            eyebrow="PORTAL WALI SANTRI"
            title="Akses cepat untuk orang tua"
            subtitle="Putra/putri Anda di asrama? Pantau pembinaannya langsung dari perangkat Anda — tanpa perlu akun."
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, maxWidth: 860, margin: '0 auto' }}>
            <Card className="land-card-hover" style={{ borderRadius: 16, border: '1px solid #eef2f7' }}>
              <IconBox icon={<UserOutlined />} size={46} />
              <Typography.Title level={4} style={{ marginTop: 16, marginBottom: 6, letterSpacing: '-0.02em' }}>
                Cek Wali Santri
              </Typography.Title>
              <Typography.Paragraph type="secondary" style={{ fontSize: 13.5, lineHeight: 1.65 }}>
                Masukkan kode registrasi dan PIN rahasia santri untuk memantau poin perilaku,
                catatan pelanggaran/prestasi, dan raport bulanan — kapan saja.
              </Typography.Paragraph>
              <Link to="/check" style={{ fontWeight: 600, fontSize: 13.5 }}>
                Buka Cek Wali Santri <ArrowRightOutlined />
              </Link>
            </Card>
            <Card className="land-card-hover" style={{ borderRadius: 16, border: '1px solid #eef2f7' }}>
              <IconBox icon={<SafetyCertificateOutlined />} size={46} />
              <Typography.Title level={4} style={{ marginTop: 16, marginBottom: 6, letterSpacing: '-0.02em' }}>
                Verifikasi Rapor
              </Typography.Title>
              <Typography.Paragraph type="secondary" style={{ fontSize: 13.5, lineHeight: 1.65 }}>
                Menerima rapor bulanan dari sekolah? Periksa keasliannya lewat ID santri yang
                tertera pada dokumen atau QR code rapor.
              </Typography.Paragraph>
              <Link to="/verify" style={{ fontWeight: 600, fontSize: 13.5 }}>
                Verifikasi Rapor <ArrowRightOutlined />
              </Link>
            </Card>
          </div>
        </div>
      </section>

      {/* Pengumuman publik */}
      {announcements.length > 0 && (
        <section style={{ padding: '0 24px 64px' }}>
          <div style={{ maxWidth: 860, margin: '0 auto' }}>
            <Card style={{ borderRadius: 16, border: '1px solid #eef2f7' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <NotificationOutlined style={{ color: '#4f46e5' }} />
                <Typography.Text strong style={{ fontSize: 14.5 }}>
                  Pengumuman Terbaru
                </Typography.Text>
              </div>
              <div style={{ display: 'grid', gap: 16 }}>
                {announcements.map((a) => (
                  <div key={a.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Typography.Text strong style={{ fontSize: 13.5 }}>
                        {a.title}
                      </Typography.Text>
                      <Tag color={CATEGORY_COLORS[a.category as keyof typeof CATEGORY_COLORS] ?? 'default'}>
                        {a.category}
                      </Tag>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {new Date(a.published_at).toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </Typography.Text>
                    </div>
                    <Typography.Paragraph
                      style={{ whiteSpace: 'pre-line', fontSize: 13, marginBottom: 0, marginTop: 4 }}
                    >
                      {a.body}
                    </Typography.Paragraph>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </section>
      )}

      {/* CTA band */}
      <section style={{ padding: '8px 24px 72px' }}>
        <div
          className="land-cta-band land-fade-up"
          style={{
            maxWidth: 1120,
            margin: '0 auto',
            borderRadius: 20,
            padding: '48px 32px',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <Typography.Title level={2} style={{ color: '#fff', margin: 0, letterSpacing: '-0.03em' }}>
            Siap mentransformasikan pembinaan di sekolah Anda?
          </Typography.Title>
          <Typography.Paragraph style={{ color: 'rgba(255,255,255,0.85)', marginTop: 10, fontSize: 15 }}>
            Mulai kelola poin perilaku, raport, dan komunikasi wali santri hari ini.
          </Typography.Paragraph>
          <Link to={loginHref}>
            <Button
              size="large"
              icon={<ArrowRightOutlined />}
              style={{ marginTop: 10, background: '#fff', color: '#4f46e5', fontWeight: 600, border: 'none' }}
            >
              {isLoggedIn ? 'Buka Dashboard' : 'Masuk Sekarang'}
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #e8edf3', background: '#fff', padding: '44px 24px 26px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '20px 48px',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}
          >
            <div style={{ maxWidth: 340 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <img src="/logo-icon.png" alt="" width={26} height={26} />
                <span style={{ color: '#0f172a', fontWeight: 700, fontSize: 15.5 }}>Laporanmu</span>
              </div>
              <Typography.Paragraph type="secondary" style={{ fontSize: 13, marginTop: 10, lineHeight: 1.65 }}>
                Sistem manajemen perilaku santri yang transparan untuk madrasah dan pesantren.
              </Typography.Paragraph>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 48px', paddingTop: 4 }}>
              <div>
                <div style={{ color: '#334155', fontWeight: 600, fontSize: 12, letterSpacing: '0.06em', marginBottom: 10 }}>
                  PORTAL WALI
                </div>
                <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
                  <Link to="/check" style={{ color: '#64748b' }}>
                    Cek Wali Santri
                  </Link>
                  <Link to="/verify" style={{ color: '#64748b' }}>
                    Verifikasi Rapor
                  </Link>
                </div>
              </div>
              <div>
                <div style={{ color: '#334155', fontWeight: 600, fontSize: 12, letterSpacing: '0.06em', marginBottom: 10 }}>
                  SEKOLAH
                </div>
                <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
                  <Link to="/login" style={{ color: '#64748b' }}>
                    Masuk Staf
                  </Link>
                  <Link to="/" style={{ color: '#64748b' }}>
                    Beranda
                  </Link>
                </div>
              </div>
            </div>
          </div>
          <div
            style={{
              borderTop: '1px solid #eef2f7',
              marginTop: 30,
              paddingTop: 16,
              color: '#94a3b8',
              fontSize: 12,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              justifyContent: 'space-between',
            }}
          >
            <span>© {new Date().getFullYear()} Laporanmu</span>
            <span>Semua hak dilindungi</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
