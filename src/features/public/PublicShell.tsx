import { useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Button, Drawer } from 'antd'
import { MenuOutlined } from '@ant-design/icons'
import { motion } from 'motion/react'
import { shellTransition, shellVariants } from '../../shared/motion'
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle'

const GRADIENTS = {
  indigo: 'linear-gradient(160deg, #eef2ff 0%, #f8fafc 40%, #f8fafc 100%)',
  green: 'linear-gradient(160deg, #ecfdf5 0%, #f8fafc 40%, #f8fafc 100%)',
} as const

const NAV_LINKS = [
  { label: 'Beranda', to: '/' },
  { label: 'Cek Wali Santri', to: '/check' },
  { label: 'Verifikasi Rapor', to: '/verify' },
]

interface PublicShellProps {
  tint?: keyof typeof GRADIENTS
  footerLabel: string
  hideFooterLinks?: boolean
  children: ReactNode
}

/**
 * Shell halaman publik: topbar blur + konten ter-center vertikal + footer tipis.
 * Halaman portal memakai ini supaya konsisten dengan landing page.
 * Konten utama entrance fade-up sekali saat mount (bukan saat state berubah).
 */
export function PublicShell({ tint = 'indigo', footerLabel, hideFooterLinks = false, children }: PublicShellProps) {
  useDocumentTitle()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div
      className="public-print-root"
      style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: GRADIENTS[tint] }}
    >
      <header className="land-nav no-print">
        <div
          style={{
            maxWidth: 880,
            margin: '0 auto',
            padding: '10px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            width: '100%',
          }}
        >
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center' }}>
            <img src="/logo-laporanmu.png" alt="Laporanmu" style={{ height: 30, width: 'auto' }} />
          </Link>
          <nav
            className="land-nav-links"
            style={{ marginLeft: 'auto', display: 'flex', gap: 18, alignItems: 'center' }}
          >
            {NAV_LINKS.filter((l) => l.to !== pathname).map((l) => (
              <Link key={l.to} to={l.to} style={{ color: '#475569', fontSize: 13, fontWeight: 500 }}>
                {l.label}
              </Link>
            ))}
          </nav>
          {pathname !== '/login' && (
            <Link to="/login">
              <Button size="small" style={{ fontWeight: 600 }}>
                Masuk
              </Button>
            </Link>
          )}
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
        size="min(280px, 84vw)"
        title="Menu"
      >
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {NAV_LINKS.filter((l) => l.to !== pathname).map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setMenuOpen(false)}
              style={{ padding: '12px 4px', color: '#334155', fontWeight: 500 }}
            >
              {l.label}
            </Link>
          ))}
          {pathname !== '/login' && (
            <Link
              to="/login"
              onClick={() => setMenuOpen(false)}
              style={{ padding: '12px 4px', color: '#4f46e5', fontWeight: 600 }}
            >
              Masuk
            </Link>
          )}
        </nav>
      </Drawer>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <motion.div
          variants={shellVariants}
          initial="initial"
          animate="animate"
          transition={shellTransition}
          style={{ width: '100%', maxWidth: 880, margin: '0 auto', padding: '36px 20px 48px' }}
        >
          {children}
        </motion.div>
      </main>

      <footer
        className="no-print"
        style={{ borderTop: '1px solid #e8edf3', background: 'rgba(255,255,255,0.65)' }}
      >
        <div
          style={{
            maxWidth: 880,
            margin: '0 auto',
            padding: '16px 20px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px 24px',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              color: '#64748b',
              fontSize: 12.5,
            }}
          >
            <img src="/logo-icon.png" alt="" width={18} height={18} />
            Laporanmu · {footerLabel}
          </span>
          {!hideFooterLinks && (
            <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              {NAV_LINKS.filter((l) => l.to !== pathname).map((l) => (
                <Link key={l.to} to={l.to} style={{ color: '#64748b', fontSize: 12.5 }}>
                  {l.label}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </footer>
    </div>
  )
}
