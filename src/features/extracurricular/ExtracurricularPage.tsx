import { useState } from 'react'
import { Tabs } from 'antd'
import { TabActionsContext } from '../../shared/components/ActionsSlot'
import { PageHeader } from '../../shared/components/PageHeader'
import { useUrlTab } from '../../shared/hooks/useUrlTab'
import { ActivityTab } from './tabs/ActivityTab'
import { AttendanceTab } from './tabs/AttendanceTab'

const TAB_META: Record<string, { title: string; subtitle: string }> = {
  kegiatan: {
    title: 'Ekstrakurikuler',
    subtitle: 'Kegiatan ekstrakurikuler, pembina, dan anggota santri',
  },
  presensi: {
    title: 'Presensi Ekstrakurikuler',
    subtitle:
      'Klik sel untuk ganti status · tahan & geser untuk isi banyak · klik nomor tanggal untuk isi kolom',
  },
}

/** Halaman Ekstrakurikuler: kegiatan & presensi bulanan dalam satu route (?tab=). */
export function ExtracurricularPage() {
  const { tab, setTab } = useUrlTab('activity')
  const meta = TAB_META[tab] ?? TAB_META.kegiatan
  // Host aksi di kanan judul halaman — diisi tiap tab via useTabActions (pola HalaqahPage)
  const [actionsHost, setActionsHost] = useState<HTMLDivElement | null>(null)

  return (
    <TabActionsContext.Provider value={actionsHost}>
      <PageHeader
        title={meta.title}
        subtitle={meta.subtitle}
        extra={<div ref={setActionsHost} style={{ display: 'flex', alignItems: 'center' }} />}
      />
      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          { key: 'activity', label: 'Kegiatan', children: <ActivityTab active={tab === 'activity'} /> },
          { key: 'attendance', label: 'Presensi', children: <AttendanceTab active={tab === 'attendance'} /> },
        ]}
      />
    </TabActionsContext.Provider>
  )
}
