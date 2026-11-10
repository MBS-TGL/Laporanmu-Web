import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, Collapse, Drawer, Segmented, Tag, Typography } from 'antd'
import {
  ArrowRightOutlined,
  AuditOutlined,
  CarOutlined,
  CheckCircleOutlined,
  CheckSquareOutlined,
  CloseCircleOutlined,
  EditOutlined,
  FileDoneOutlined,
  FileProtectOutlined,
  MedicineBoxOutlined,
  MenuOutlined,
  MobileOutlined,
  NotificationOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { CATEGORY_COLORS } from '../announcements/types'
import { usePublicAnnouncements } from '../announcements/hooks'
import { IconBox } from '../../shared/components/IconBox'
import { useSession } from '../../shared/hooks/useProfile'
import { Reveal } from './Reveal'
import { useCountUp, useInView, useScrollSpy } from './hooks'

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

const STEPS = [
  {
    icon: <SettingOutlined />,
    title: 'Sekolah menyiapkan data',
    desc: 'Admin mengatur aturan poin, kelas, asrama, dan akun staf sekali di awal.',
  },
  {
    icon: <EditOutlined />,
    title: 'Guru mencatat kejadian',
    desc: 'Pelanggaran dan prestasi dicatat dari dashboard dalam hitungan detik.',
  },
  {
    icon: <ThunderboltOutlined />,
    title: 'Sistem mengolah otomatis',
    desc: 'Poin terakumulasi; raport bulanan dan rekap kehadiran tersusun sendiri.',
  },
  {
    icon: <MobileOutlined />,
    title: 'Wali memantau real-time',
    desc: 'Orang tua cek perkembangan anak dari HP kapan saja — tanpa perlu akun.',
  },
]

const FAQ_ITEMS = [
  {
    key: '1',
    label: 'Apakah wali santri perlu membuat akun?',
    children:
      'Tidak perlu. Wali cukup membuka halaman Cek Wali Santri lalu memasukkan kode registrasi dan PIN rahasia santri — tanpa registrasi maupun login.',
  },
  {
    key: '2',
    label: 'Bagaimana jika lupa PIN santri?',
    children:
      'PIN hanya diketahui oleh wali dan pihak sekolah. Bila lupa, hubungi musyrif atau pengasuhan melalui kontak resmi sekolah untuk mengatur ulang PIN.',
  },
  {
    key: '3',
    label: 'Apakah data perilaku santri aman?',
    children:
      'Aman. Data hanya bisa dibuka dengan kombinasi kode registrasi + PIN pribadi, server membatasi percobaan gagal secara otomatis, dan setiap perubahan data tercatat pada audit log sekolah.',
  },
  {
    key: '4',
    label: 'Siapa yang boleh menginput poin perilaku?',
    children:
      'Hanya staf resmi yang memiliki akun — guru, pengurus, dan administrator. Setiap pencatatan terekam siapa pelakunya, sehingga tidak ada input yang tidak dapat dilacak.',
  },
  {
    key: '5',
    label: 'Apakah bisa dibuka dari HP?',
    children:
      'Bisa. Semua halaman — termasuk portal wali dan verifikasi rapor — dirancang responsif untuk ponsel, tablet, maupun komputer.',
  },
  {
    key: '6',
    label: 'Bagaimana cara memastikan rapor yang diterima asli?',
    children:
      'Setiap rapor bulanan bisa diverifikasi publik melalui halaman Verifikasi Rapor. Cukup tempel ID santri yang tertera pada QR/dokumen rapor, dan sistem mencocokkannya dengan arsip resmi sekolah.',
  },
]

// Predikat nilai bulanan — salinan ringan agar landing tetap mandiri
function predicate(score: number | null): string {
  if (score === null) return '—'
  if (score >= 90) return 'A'
  if (score >= 85) return 'B+'
  if (score >= 80) return 'B'
  if (score >= 75) return 'C+'
  return 'C'
}

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

// --- Mock demo interaktif (data ilustrasi, meniru tampilan portal wali) ---

function MockStatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ flex: 1, background: '#f8fafc', borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ fontSize: 11, color: '#64748b' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  )
}

function MockRow({ label, point, bg, tagColor }: { label: string; point: string; bg: string; tagColor: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
        padding: '9px 12px',
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
  )
}

function DemoPoin() {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <MockStatBox label="Total Poin" value="+7" color="#16a34a" />
        <MockStatBox label="Pelanggaran" value="2" color="#0f172a" />
        <MockStatBox label="Prestasi" value="2" color="#16a34a" />
      </div>
      <MockRow label="Terlambat kembali ke asrama" point="−5" bg="#fff1f0" tagColor="red" />
      <MockRow label="Melempar sampah sembarangan" point="−3" bg="#fff1f0" tagColor="red" />
      <MockRow label="Membantu teman mengulang pelajaran" point="+5" bg="#f0fdf4" tagColor="green" />
      <MockRow label="Hafalan terbaik pekan ini" point="+10" bg="#f0fdf4" tagColor="green" />
    </div>
  )
}

function DemoRaport() {
  const aspects = [
    { label: 'Akhlak', score: 88 },
    { label: 'Ibadah', score: 92 },
    { label: 'Kebersihan', score: 85 },
    { label: "Al-Qur'an", score: 90 },
    { label: 'Bahasa', score: 78 },
  ]
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography.Text strong>November 2026</Typography.Text>
        <Tag color="green">Terbaru</Tag>
      </div>
      {aspects.map((a) => (
        <div key={a.label} style={{ display: 'grid', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
            <Typography.Text>{a.label}</Typography.Text>
            <span>
              <b style={{ fontVariantNumeric: 'tabular-nums' }}>{a.score}</b>{' '}
              <span style={{ color: '#64748b', fontSize: 11.5 }}>· {predicate(a.score)}</span>
            </span>
          </div>
          <div style={{ height: 7, borderRadius: 99, background: '#f1f5f9', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${a.score}%`,
                borderRadius: 99,
                background: a.score >= 85 ? '#10b981' : a.score >= 80 ? '#f59e0b' : '#f97316',
              }}
            />
          </div>
        </div>
      ))}
      <Typography.Paragraph type="secondary" italic style={{ fontSize: 12, margin: '6px 0 0' }}>
        “Alhamdulillah, hafalan meningkat. Perlu peningkatan kedisiplinan waktu tidur.”
      </Typography.Paragraph>
    </div>
  )
}

function DemoSkorsing() {
  const items = [
    { label: 'Tahajud & sholat subuh berjamaah', done: true },
    { label: 'Mengerjakan tugas sekolah harian', done: true },
    { label: 'Membantu pekerjaan orang tua', done: true },
    { label: 'Tahfiz 5 halaman', done: false },
  ]
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
          padding: '10px 12px',
          borderRadius: 10,
          background: '#fff1f0',
          border: '1px solid #fecaca',
        }}
      >
        <Typography.Text strong style={{ fontSize: 13 }}>
          Skorsing SMP · 10–14 Nov 2026
        </Typography.Text>
        <Tag color="red" style={{ marginInlineEnd: 0 }}>
          Aktif
        </Tag>
      </div>
      {items.map((it) => (
        <div
          key={it.label}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '9px 12px',
            borderRadius: 8,
            background: it.done ? '#f0fdf4' : '#fffbeb',
          }}
        >
          {it.done ? (
            <CheckCircleOutlined style={{ color: '#16a34a' }} />
          ) : (
            <CloseCircleOutlined style={{ color: '#f59e0b' }} />
          )}
          <Typography.Text style={{ fontSize: 12.5 }}>{it.label}</Typography.Text>
          <Typography.Text
            type="secondary"
            style={{ fontSize: 11, marginLeft: 'auto' }}
          >
            {it.done ? 'Dilaporkan wali' : 'Menunggu laporan'}
          </Typography.Text>
        </div>
      ))}
    </div>
  )
}

const DEMO_TABS = [
  { label: 'Poin & Prestasi', value: 'poin' },
  { label: 'Raport Bulanan', value: 'raport' },
  { label: 'Skorsing', value: 'skorsing' },
]

function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string
  title: string
  subtitle: string
}) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 36 }}>
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

// Strip statistik dengan angka count-up saat masuk viewport
function StatsStrip() {
  const { ref, inView } = useInView<HTMLDivElement>(0.4)
  const modul = useCountUp(8, inView)
  const aspek = useCountUp(5, inView)
  const jam = useCountUp(24, inView)
  const audit = useCountUp(100, inView)

  const items = [
    { value: String(modul), suffix: '', label: 'Modul terpadu' },
    { value: String(aspek), suffix: '', label: 'Aspek penilaian raport' },
    { value: String(jam), suffix: '/7', label: 'Akses portal wali' },
    { value: String(audit), suffix: '%', label: 'Perubahan terekam audit' },
  ]

  return (
    <div
      ref={ref}
      style={{
        borderTop: '1px solid #e8edf3',
        borderBottom: '1px solid #e8edf3',
        background: '#fff',
        padding: '30px 24px',
      }}
    >
      <div
        style={{
          maxWidth: 960,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: 24,
        }}
      >
        {items.map((it) => (
          <div key={it.label} style={{ textAlign: 'center' }}>
            <div
              style={{
                fontSize: 36,
                fontWeight: 800,
                color: '#4f46e5',
                letterSpacing: '-0.03em',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1.1,
              }}
            >
              {it.value}
              <span style={{ fontSize: 22 }}>{it.suffix}</span>
            </div>
            <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>{it.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function LandingPage() {
  const sessionQuery = useSession()
  const isLoggedIn = !!sessionQuery.data?.user
  const { data: announcements = [] } = usePublicAnnouncements(3)
  const [menuOpen, setMenuOpen] = useState(false)
  const [demoTab, setDemoTab] = useState<'poin' | 'raport' | 'skorsing'>('poin')

  const spyIds = ['fitur', 'alur', 'demo', 'portal', 'faq']
  const activeSection = useScrollSpy(spyIds)

  useEffect(() => {
    document.title = 'Laporanmu — Sistem Manajemen Perilaku Santri'
  }, [])

  // Structured data untuk mesin pencari
  useEffect(() => {
    const el = document.createElement('script')
    el.type = 'application/ld+json'
    el.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Laporanmu',
      alternateName: 'Laporanmu — Sistem Manajemen Perilaku Santri',
      url: window.location.origin + '/',
      inLanguage: 'id',
      description:
        'Sistem manajemen perilaku santri untuk madrasah dan pesantren: poin perilaku, raport bulanan, kehadiran, dan portal wali santri.',
    })
    document.head.appendChild(el)
    return () => {
      el.remove()
    }
  }, [])

  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const loginHref = isLoggedIn ? '/dashboard' : '/login'
  const loginLabel = isLoggedIn ? 'Buka Dashboard' : 'Masuk ke Aplikasi'

  const navItems = [
    { id: 'fitur', label: 'Fitur' },
    { id: 'alur', label: 'Cara Kerja' },
    { id: 'demo', label: 'Demo' },
    { id: 'faq', label: 'FAQ' },
  ]

  const menuContent = (
    <div style={{ display: 'grid', gap: 4, paddingTop: 4 }}>
      {navItems.map((n) => (
        <a
          key={n.id}
          href={`#${n.id}`}
          onClick={(e) => {
            e.preventDefault()
            setMenuOpen(false)
            scrollTo(n.id)
          }}
          style={{ padding: '11px 4px', color: '#334155', fontSize: 14.5, fontWeight: 500 }}
        >
          {n.label}
        </a>
      ))}
      <a
        href="#portal"
        onClick={(e) => {
          e.preventDefault()
          setMenuOpen(false)
          scrollTo('portal')
        }}
        style={{ padding: '11px 4px', color: '#334155', fontSize: 14.5, fontWeight: 500 }}
      >
        Portal Wali
      </a>
      <Link to={loginHref} onClick={() => setMenuOpen(false)} style={{ marginTop: 10 }}>
        <Button type="primary" block size="large">
          {loginLabel}
        </Button>
      </Link>
    </div>
  )

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
            style={{ marginLeft: 'auto', display: 'flex', gap: 24, alignItems: 'center' }}
          >
            {navItems.map((n) => (
              <a
                key={n.id}
                href={`#${n.id}`}
                onClick={(e) => {
                  e.preventDefault()
                  scrollTo(n.id)
                }}
                className={`land-nav-a${activeSection === n.id ? ' land-nav-a-active' : ''}`}
              >
                {n.label}
              </a>
            ))}
          </nav>
          <Link to={loginHref}>
            <Button type="primary" style={{ marginLeft: isLoggedIn ? 'auto' : 0 }}>
              {isLoggedIn ? 'Buka Dashboard' : 'Masuk'}
            </Button>
          </Link>
          <Button
            className="land-menu-btn"
            icon={<MenuOutlined />}
            onClick={() => setMenuOpen(true)}
            aria-label="Buka menu"
          />
        </div>
      </header>

      <Drawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        placement="right"
        width={280}
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <img src="/logo-icon.png" alt="" width={22} height={22} /> Laporanmu
          </span>
        }
      >
        {menuContent}
      </Drawer>

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

      <StatsStrip />

      {/* Fitur */}
      <section id="fitur" style={{ padding: '64px 24px', scrollMarginTop: 76, background: '#f8fafc' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <Reveal>
            <SectionHeader
              eyebrow="FITUR"
              title="Semua kebutuhan pembinaan dalam satu tempat"
              subtitle="Dari pencatatan poin harian sampai laporan bulanan — tanpa berpindah-pindah aplikasi."
            />
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 4) * 70}>
                <Card
                  className="land-card-hover"
                  style={{ borderRadius: 14, border: '1px solid #eef2f7', height: '100%' }}
                >
                  <IconBox icon={f.icon} />
                  <Typography.Text strong style={{ display: 'block', marginTop: 14, fontSize: 15 }}>
                    {f.title}
                  </Typography.Text>
                  <Typography.Paragraph
                    type="secondary"
                    style={{ marginTop: 6, marginBottom: 0, fontSize: 13, lineHeight: 1.6 }}
                  >
                    {f.desc}
                  </Typography.Paragraph>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Cara kerja */}
      <section id="alur" style={{ padding: '64px 24px', scrollMarginTop: 76 }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <Reveal>
            <SectionHeader
              eyebrow="CARA KERJA"
              title="Empat langkah, dari pencatatan sampai laporan"
              subtitle="Alur sederhana yang bisa langsung dijalankan oleh sekolah tanpa pelatihan khusus."
            />
          </Reveal>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 16,
              maxWidth: 980,
              margin: '0 auto',
            }}
          >
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 90}>
                <div
                  style={{
                    textAlign: 'center',
                    padding: '24px 16px',
                    borderRadius: 16,
                    border: '1px solid #eef2f7',
                    background: '#fff',
                    height: '100%',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 999,
                      background: '#eef2ff',
                      color: '#4f46e5',
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 18,
                      margin: '0 auto',
                    }}
                  >
                    {s.icon}
                  </div>
                  <div
                    style={{
                      marginTop: 12,
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#94a3b8',
                      letterSpacing: '0.08em',
                    }}
                  >
                    LANGKAH {i + 1}
                  </div>
                  <Typography.Text strong style={{ display: 'block', marginTop: 4, fontSize: 14.5 }}>
                    {s.title}
                  </Typography.Text>
                  <Typography.Paragraph
                    type="secondary"
                    style={{ marginTop: 6, marginBottom: 0, fontSize: 12.5, lineHeight: 1.6 }}
                  >
                    {s.desc}
                  </Typography.Paragraph>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Demo interaktif */}
      <section id="demo" style={{ padding: '64px 24px', scrollMarginTop: 76, background: '#f8fafc' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <Reveal>
            <SectionHeader
              eyebrow="LIHAT SENDIRI"
              title="Coba lihat tampilan portal wali"
              subtitle="Pindahkan pilihan di bawah untuk melihat contoh tampilan yang diterima orang tua — data ilustrasi."
            />
          </Reveal>
          <Reveal delay={80}>
            <div style={{ maxWidth: 640, margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                <Segmented
                  options={DEMO_TABS}
                  value={demoTab}
                  onChange={(v) => setDemoTab(v as typeof demoTab)}
                  size="large"
                />
              </div>
              <Card style={{ borderRadius: 16, border: '1px solid #eef2f7', minHeight: 320 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <img src="/logo-icon.png" alt="" width={20} height={20} />
                  <Typography.Text strong style={{ fontSize: 12.5, color: '#64748b' }}>
                    Portal Wali Santri — contoh tampilan
                  </Typography.Text>
                </div>
                {demoTab === 'poin' && <DemoPoin />}
                {demoTab === 'raport' && <DemoRaport />}
                {demoTab === 'skorsing' && <DemoSkorsing />}
              </Card>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Portal Wali */}
      <section id="portal" style={{ padding: '64px 24px', scrollMarginTop: 76 }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <Reveal>
            <SectionHeader
              eyebrow="PORTAL WALI SANTRI"
              title="Akses cepat untuk orang tua"
              subtitle="Putra/putri Anda di asrama? Pantau pembinaannya langsung dari perangkat Anda — tanpa perlu akun."
            />
          </Reveal>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 20,
              maxWidth: 860,
              margin: '0 auto',
            }}
          >
            <Reveal>
              <Card className="land-card-hover" style={{ borderRadius: 16, border: '1px solid #eef2f7', height: '100%' }}>
                <IconBox icon={<UserOutlined />} size={46} />
                <Typography.Title level={4} style={{ marginTop: 16, marginBottom: 6, letterSpacing: '-0.02em' }}>
                  Cek Wali Santri
                </Typography.Title>
                <Typography.Paragraph type="secondary" style={{ fontSize: 13.5, lineHeight: 1.65 }}>
                  Masukkan kode registrasi dan PIN rahasia santri untuk memantau poin perilaku,
                  catatan pelanggaran/prestasi, raport bulanan, kehadiran, hingga status skorsing —
                  kapan saja.
                </Typography.Paragraph>
                <Link to="/check" style={{ fontWeight: 600, fontSize: 13.5 }}>
                  Buka Cek Wali Santri <ArrowRightOutlined />
                </Link>
              </Card>
            </Reveal>
            <Reveal delay={90}>
              <Card className="land-card-hover" style={{ borderRadius: 16, border: '1px solid #eef2f7', height: '100%' }}>
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
            </Reveal>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ padding: '64px 24px', scrollMarginTop: 76, background: '#f8fafc' }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          <Reveal>
            <SectionHeader
              eyebrow="TANYA JAWAB"
              title="Pertanyaan yang sering diajukan"
              subtitle="Belum menemukan jawaban? Hubungi pihak sekolah melalui kontak resmi."
            />
          </Reveal>
          <Reveal delay={80}>
            <Collapse
              items={FAQ_ITEMS}
              ghost
              expandIconPosition="end"
              style={{ background: '#fff', borderRadius: 16, padding: '4px 20px', border: '1px solid #eef2f7' }}
              defaultActiveKey={['1']}
            />
          </Reveal>
        </div>
      </section>

      {/* Pengumuman publik */}
      {announcements.length > 0 && (
        <section style={{ padding: '64px 24px' }}>
          <div style={{ maxWidth: 860, margin: '0 auto' }}>
            <Reveal>
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
            </Reveal>
          </div>
        </section>
      )}

      {/* CTA band */}
      <section style={{ padding: announcements.length > 0 ? '8px 24px 72px' : '8px 24px 72px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <Reveal>
            <div
              className="land-cta-band"
              style={{
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
          </Reveal>
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
