import { useState } from 'react'
import { Grid } from 'antd'
import { motion } from 'motion/react'
import {
  BellOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  BookOutlined,
  StarOutlined,
  WalletOutlined,
  LogoutOutlined,
} from '@ant-design/icons'
import {
  App,
  Button,
  Spin,
  Tooltip,
  Typography,
} from 'antd'
import dayjs from 'dayjs'
import { useQuery } from '@tanstack/react-query'
import {
  rpcPortalData,
  rpcPortalDeletePush,
  rpcPortalLogout,
  rpcPortalPushConfig,
  rpcPortalSavePush,
  summarizeDays,
  type PortalSession,
} from './api'
import { pageShellItemTransition, pageShellItemVariants, pageShellVariants } from '../../shared/motion'
import { PortalHeader } from './components/PortalHeader'
import { SectionCard } from './components/SectionCard'
import { ScheduleTimeline } from './components/ScheduleTimeline'
import { AttendancePanel } from './components/AttendancePanel'
import { GradesPanel } from './components/GradesPanel'
import { SppPanel } from './components/SppPanel'
import { PointsPanel } from './components/PointsPanel'
import { TahfidzPanel } from './components/TahfidzPanel'
import { WorshipPanel } from './components/WorshipPanel'

const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const DAYS_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normalized)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i += 1) {
    bytes[i] = raw.charCodeAt(i)
  }
  return bytes
}

/** Sapaan sesuai jam perangkat. */
function greetingForHour(hour: number): string {
  if (hour >= 4 && hour < 11) return 'Selamat pagi'
  if (hour >= 11 && hour < 15) return 'Selamat siang'
  if (hour >= 15 && hour < 18) return 'Selamat sore'
  return 'Selamat malam'
}

/**
 * Portal Santri dashboard: hero ringkasan + timeline jadwal + kalender
 * kehadiran + nilai + SPP + poin + tahfidz. Desktop = 2 kolom (utama + rail),
 * mobile = satu kolom dengan urutan prioritas.
 */
export function PortalDashboard({ session, onLogout }: { session: PortalSession; onLogout: () => void }) {
  const { message } = App.useApp()
  const screens = Grid.useBreakpoint()
  const isDesktop = Boolean(screens.lg)

  const dataQuery = useQuery({
    queryKey: ['portal-data', session.token],
    queryFn: () => rpcPortalData(session.token),
    staleTime: 2 * 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
  })
  const pushQuery = useQuery({
    queryKey: ['portal-push-config', session.token],
    // Satu fetch gabungan: VAPID publik + keadaan subscription service worker
    queryFn: async () => {
      const cfg = await rpcPortalPushConfig(session.token)
      const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null
      const sub = reg ? await reg.pushManager.getSubscription() : null
      return {
        vapid: cfg.vapid_public,
        swAvailable: Boolean(reg),
        subscribed: Boolean(sub),
      }
    },
    staleTime: Infinity,
    retry: false,
  })
  const [pushBusy, setPushBusy] = useState(false)
  const pushReady = Boolean(pushQuery.data?.vapid) && Boolean(pushQuery.data?.swAvailable)
  const pushEnabled = pushReady && Boolean(pushQuery.data?.subscribed)

  const doLogout = async () => {
    try {
      await rpcPortalLogout(session.token)
    } catch {
      // Sesi tetap diakhiri di perangkat ini walau RPC gagal
    }
    onLogout()
  }

  const enablePush = async () => {
    const vapid = pushQuery.data?.vapid
    if (!vapid || pushBusy) return
    setPushBusy(true)
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') {
        message.info('Izin notifikasi tidak diberikan di browser ini')
        return
      }
      const reg = await navigator.serviceWorker.getRegistration()
      if (!reg) {
        message.info('Notifikasi belum tersedia di perangkat ini')
        return
      }
      let sub = await reg.pushManager.getSubscription()
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapid),
        })
      }
      await rpcPortalSavePush(session.token, sub.toJSON())
      message.success('Notifikasi diaktifkan')
      window.location.reload()
    } catch (err) {
      message.error((err as Error).message || 'Gagal mengaktifkan notifikasi')
    } finally {
      setPushBusy(false)
    }
  }

  const disablePush = async () => {
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await rpcPortalDeletePush(session.token, sub.endpoint)
        await sub.unsubscribe()
      }
      message.success('Notifikasi dimatikan')
      window.location.reload()
    } catch (err) {
      message.error((err as Error).message || 'Gagal mematikan notifikasi')
    }
  }

  if (dataQuery.isPending) {
    return (
      <div style={{ textAlign: 'center', padding: 64 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (dataQuery.isError) {
    // Sesi kedaluwarsa / token invalid → kartu error + tombol masuk kembali
    return (
      <div
        style={{
          maxWidth: 480,
          margin: '0 auto',
          textAlign: 'center',
          background: '#fff',
          borderRadius: 16,
          padding: '28px 24px',
          border: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        <Typography.Title level={4} style={{ marginTop: 0 }}>
          Sesi Berakhir
        </Typography.Title>
        <Typography.Text type="secondary">{(dataQuery.error as Error).message}</Typography.Text>
        <div style={{ marginTop: 18 }}>
          <Button type="primary" onClick={onLogout}>
            Masuk Kembali
          </Button>
        </div>
      </div>
    )
  }

  const data = dataQuery.data
  const sppOutstanding = data.spp.total_due - data.spp.total_paid

  // Persen kehadiran bulan berjalan (fallback: bulan terakhir yang ada datanya)
  const now = dayjs()
  const monthRow =
    data.attendance.find((r) => r.year === now.year() && r.month === now.month() + 1) ?? data.attendance[0]
  let attendancePct: number | null = null
  if (monthRow) {
    const s = summarizeDays(monthRow.days)
    const total = s.H + s.S + s.I + s.A + s.P
    if (total > 0) attendancePct = Math.round((s.H / total) * 100)
  }

  const pushButton = pushQuery.data && pushReady ? (
    <Tooltip title={pushEnabled ? 'Matikan notifikasi' : 'Aktifkan notifikasi pengumuman'}>
      <Button
        icon={<BellOutlined />}
        loading={pushBusy}
        onClick={() => (pushEnabled ? void disablePush() : void enablePush())}
      >
        {pushEnabled ? 'Notifikasi Aktif' : 'Aktifkan Notifikasi'}
      </Button>
    </Tooltip>
  ) : null

  const actions = (
    <>
      {pushButton}
      <Button danger icon={<LogoutOutlined />} onClick={() => void doLogout()} aria-label="Keluar portal">
        Keluar
      </Button>
    </>
  )

  const scheduleSection = (
    <SectionCard title="Jadwal Hari Ini" icon={<CalendarOutlined />}>
      <ScheduleTimeline items={data.schedule} />
    </SectionCard>
  )
  const attendanceSection = (
    <SectionCard title="Kehadiran" icon={<CheckCircleOutlined />}>
      <AttendancePanel rows={data.attendance} />
    </SectionCard>
  )
  const gradesSection = (
    <SectionCard title="Nilai Terbaru" icon={<BookOutlined />}>
      <GradesPanel grades={data.grades} isDesktop={isDesktop} />
    </SectionCard>
  )
  const sppSection = (
    <SectionCard title="SPP & Tagihan" icon={<WalletOutlined />}>
      <SppPanel items={data.spp.items} totalDue={data.spp.total_due} totalPaid={data.spp.total_paid} />
    </SectionCard>
  )
  const pointsSection = (
    <SectionCard title="Poin & Catatan Perilaku" icon={<StarOutlined />}>
      <PointsPanel total={data.points.total} recent={data.points.recent} />
    </SectionCard>
  )
  const tahfidzSection = (
    <SectionCard title="Setoran Tahfidz" icon={<BookOutlined />}>
      <TahfidzPanel items={data.tahfidz} />
    </SectionCard>
  )
  const worshipSection = (
    <SectionCard title="Kemahiran Ibadah" icon={<StarOutlined />}>
      <WorshipPanel studentId={data.student.id} />
    </SectionCard>
  )

  return (
    <motion.div variants={pageShellVariants} initial="initial" animate="animate" style={{ display: 'grid', gap: 14 }}>
      <motion.div variants={pageShellItemVariants} transition={pageShellItemTransition}>
        <PortalHeader
          name={data.student.name}
          className={data.student.class_name}
          dateLabel={`${DAYS_ID[now.day()]}, ${now.date()} ${MONTHS_ID[now.month()]} ${now.year()}`}
          greeting={greetingForHour(now.hour())}
          summary={{ attendancePct, points: data.student.total_points, sppOutstanding }}
          actions={actions}
          isDesktop={isDesktop}
        />
      </motion.div>

      {isDesktop ? (
        // Desktop: kolom utama (jadwal + nilai) dan rail ringkasan (kehadiran, SPP, poin, tahfidz)
        <motion.div variants={pageShellItemVariants} transition={pageShellItemTransition}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 14, alignItems: 'start' }}>
            <div style={{ display: 'grid', gap: 14 }}>
              {scheduleSection}
              {gradesSection}
            </div>
            <div style={{ display: 'grid', gap: 14 }}>
              {attendanceSection}
              {worshipSection}
              {sppSection}
              {pointsSection}
              {tahfidzSection}
            </div>
          </div>
        </motion.div>
      ) : (
        // Mobile: satu kolom, urutan prioritas santri/wali
        <>
          <motion.div variants={pageShellItemVariants} transition={pageShellItemTransition}>{scheduleSection}</motion.div>
          <motion.div variants={pageShellItemVariants} transition={pageShellItemTransition}>{attendanceSection}</motion.div>
          <motion.div variants={pageShellItemVariants} transition={pageShellItemTransition}>{worshipSection}</motion.div>
          <motion.div variants={pageShellItemVariants} transition={pageShellItemTransition}>{gradesSection}</motion.div>
          <motion.div variants={pageShellItemVariants} transition={pageShellItemTransition}>{sppSection}</motion.div>
          <motion.div variants={pageShellItemVariants} transition={pageShellItemTransition}>{pointsSection}</motion.div>
          <motion.div variants={pageShellItemVariants} transition={pageShellItemTransition}>{tahfidzSection}</motion.div>
        </>
      )}
    </motion.div>
  )
}
