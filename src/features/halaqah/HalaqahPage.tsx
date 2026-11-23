import { useEffect, useState } from 'react'
import { Tabs } from 'antd'
import { PageHeader } from '../../shared/components/PageHeader'
import { TabActionsContext } from '../../shared/components/ActionsSlot'
import { useFlag } from '../../shared/hooks/useFeatureFlags'
import { useUrlTab } from '../../shared/hooks/useUrlTab'
import { useProfile } from '../../shared/hooks/useProfile'
import { useRbac } from '../../shared/rbac/useRbac'
import { KelompokTab } from './tabs/KelompokTab'
import { PresensiTab } from './tabs/PresensiTab'
import { SetoranTab } from './tabs/SetoranTab'

const TAB_META: Record<string, { title: string; subtitle: string }> = {
  attendance: {
    title: 'Halaqah',
    subtitle: 'Kehadiran santri per kelompok',
  },
  setoran: {
    title: 'Halaqah',
    subtitle: 'Setoran hafalan ziyadah dan murojaah',
  },
  kelompok: {
    title: 'Halaqah',
    subtitle: 'Kelompok, musyrif, dan anggota',
  },
}

/** Halaman Halaqah: attendance bulanan, setoran hafalan, & kelompok bimbingan dalam satu route (?tab=). */
export function HalaqahPage() {
  const { tab, setTab } = useUrlTab('attendance', {
    legacy: { presensi: 'attendance' },
  })
  const { profile } = useProfile()
  const { can } = useRbac()
  // Tab Setoran menggantikan halaman Tahfidz lama — gate flag modul + perm baca
  const setoranEnabled = useFlag('module.tahfidz', true) && can('tahfidz:read')
  const meta = TAB_META[tab] ?? TAB_META.attendance
  // Host aksi di kanan judul halaman (PageHeader) — diisi tiap tab via useTabActions (ActionsSlot)
  const [actionsHost, setActionsHost] = useState<HTMLDivElement | null>(null)

  // Deep link ke tab yang tidak tersedia → kembali ke tab default (pola tab machines di AttendancePage)
  useEffect(() => {
    if (tab === 'setoran' && !setoranEnabled) setTab('attendance')
  }, [tab, setoranEnabled, setTab])

  const items = [
    { key: 'attendance', label: 'Absensi', children: <PresensiTab active={tab === 'attendance'} /> },
    ...(profile && setoranEnabled
      ? [{ key: 'setoran', label: 'Setoran', children: <SetoranTab active={tab === 'setoran'} /> }]
      : []),
    { key: 'kelompok', label: 'Kelompok', children: <KelompokTab active={tab === 'kelompok'} /> },
  ]

  return (
    <TabActionsContext.Provider value={actionsHost}>
      <PageHeader
        title={meta.title}
        subtitle={meta.subtitle}
        extra={<div ref={setActionsHost} style={{ display: 'flex', alignItems: 'center' }} />}
      />
      <Tabs activeKey={tab} onChange={setTab} items={items} />
    </TabActionsContext.Provider>
  )
}
