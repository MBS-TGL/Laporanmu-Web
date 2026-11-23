import { useState } from 'react'
import { Tabs } from 'antd'
import { TabActionsContext } from '../../shared/components/ActionsSlot'
import { PageHeader } from '../../shared/components/PageHeader'
import { useUrlTab } from '../../shared/hooks/useUrlTab'
import { ActivityTab } from './tabs/ActivityTab'
import { AttendanceTab } from './tabs/AttendanceTab'

const TAB_META: Record<string, { title: string; subtitle: string }> = {
  activity: {
    title: 'Ekstrakurikuler',
    subtitle: 'Kegiatan, pembina, dan anggota',
  },
  attendance: {
    title: 'Ekstrakurikuler',
    subtitle: 'Kehadiran santri per kegiatan',
  },
}

/** Halaman Ekstrakurikuler: kegiatan & presensi bulanan dalam satu route (?tab=). */
export function ExtracurricularPage() {
  const { tab, setTab } = useUrlTab('activity', { legacy: { kegiatan: 'activity', presensi: 'attendance' } })
  const meta = TAB_META[tab] ?? TAB_META.activity
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
          { key: 'attendance', label: 'Absensi', children: <AttendanceTab active={tab === 'attendance'} /> },
        ]}
      />
    </TabActionsContext.Provider>
  )
}
