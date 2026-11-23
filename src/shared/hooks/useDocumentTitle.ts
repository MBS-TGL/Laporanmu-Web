import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { DASHBOARD_ITEM, NAV_GROUPS } from '../constants/navItems'

const NAV_ITEMS = [DASHBOARD_ITEM, ...NAV_GROUPS.flatMap((group) => group.items)]

const PUBLIC_TITLES: { path: string; title: string }[] = [
  { path: '/', title: 'Beranda' },
  { path: '/check', title: 'Cek Wali Santri' },
  { path: '/verify', title: 'Verifikasi Rapor' },
  { path: '/portal', title: 'Portal Santri' },
  { path: '/exam', title: 'Ujian CBT' },
  { path: '/survey', title: 'Angket Evaluasi' },
  { path: '/suspension', title: 'Surat Penggantungan' },
]

/**
 * Judul tab browser mengikuti halaman aktif.
 * Prioritas: item sidebar dengan prefix terpanjang, lalu peta halaman publik.
 */
export function useDocumentTitle() {
  const { pathname } = useLocation()

  useEffect(() => {
    const navMatch = NAV_ITEMS.filter(
      (item) => pathname === item.to || pathname.startsWith(`${item.to}/`),
    ).sort((a, b) => b.to.length - a.to.length)[0]

    const publicMatch = PUBLIC_TITLES.filter(
      (entry) =>
        pathname === entry.path ||
        (entry.path !== '/' && pathname.startsWith(`${entry.path}/`)),
    ).sort((a, b) => b.path.length - a.path.length)[0]

    const label = navMatch?.label ?? (pathname === '/' ? null : publicMatch?.title)
    document.title = label ? `${label} · Laporanmu` : 'Laporanmu'
  }, [pathname])
}
