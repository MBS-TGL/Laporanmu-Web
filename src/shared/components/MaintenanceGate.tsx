import { Spin } from 'antd'
import { AnimatePresence, motion } from 'motion/react'
import { useLocation, useOutlet } from 'react-router-dom'
import { useFlag } from '../hooks/useFeatureFlags'
import { useProfile } from '../hooks/useProfile'
import { useMaintenanceMessage } from '../hooks/useAppSettings'
import { routeEnter, routeExit } from '../motion'
import { MaintenanceNotice } from './MaintenanceNotice'

// Pintu maintenance: saat flag system.maintenance aktif, semua role
// kecuali developer dilayar penuh pesan pemeliharaan. Fail-open —
// kalau query flag gagal, aplikasi tetap terbuka.
// Sekaligus titik transisi route dashboard: AnimatePresence mode="wait"
// + key pathname (?tab= tidak ikut — search tidak mengganti key).
export function MaintenanceGate() {
  const maintenance = useFlag('system.maintenance', false)
  const { role, isLoading } = useProfile()
  const { message, until } = useMaintenanceMessage()
  const outlet = useOutlet()
  const location = useLocation()

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (maintenance && role !== 'developer') {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '60vh', padding: 24 }}>
        <MaintenanceNotice title="Sistem Sedang dalam Pemeliharaan" message={message} until={until} />
      </div>
    )
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0, transition: routeEnter }}
        exit={{ opacity: 0, y: -4, transition: routeExit }}
      >
        {outlet}
      </motion.div>
    </AnimatePresence>
  )
}
