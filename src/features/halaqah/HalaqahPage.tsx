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
  presensi: {
    title: 'Presensi Halaqah',
    subtitle:
      'Klik sel untuk ganti status · tahan & geser untuk isi banyak · klik nomor tanggal untuk isi kolom · klik kanan hapus sel',
  },
  setoran: {
    title: 'Setoran Hafalan',
    subtitle: 'Catatan setoran hafalan santri — ziyadah dan murojaah',
  },
  kelompok: {
    title: 'Kelompok Halaqah',
    subtitle: 'Kelompok halaqah, musyrif, dan anggota santri',
  },
}

/** Halaman Halaqah: presensi bulanan, setoran hafalan, & kelompok bimbingan dalam satu route (?tab=). */
export function HalaqahPage() {
  const { tab, setTab } = useUrlTab('presensi')
  const { profile } = useProfile()
  const { can } = useRbac()
  // Tab Setoran menggantikan halaman Tahfidz lama — gate flag modul + perm baca
  const setoranEnabled = useFlag('module.tahfidz', true) && can('tahfidz:read')
  const meta = TAB_META[tab] ?? TAB_META.presensi
  // Host aksi di kanan judul halaman (PageHeader) — diisi tiap tab via useTabActions (ActionsSlot)
  const [actionsHost, setActionsHost] = useState<HTMLDivElement | null>(null)

  // Deep link ke tab yang tidak tersedia → kembali ke tab default (pola tab machines di AttendancePage)
  useEffect(() => {
    if (tab === 'setoran' && !setoranEnabled) setTab('presensi')
  }, [tab, setoranEnabled, setTab])

  const items = [
    { key: 'presensi', label: 'Presensi', children: <PresensiTab active={tab === 'presensi'} /> },
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
