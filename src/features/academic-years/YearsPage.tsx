import { useState } from 'react'
import { Tabs } from 'antd'
import { useUrlTab } from '../../shared/hooks/useUrlTab'
import { PageHeader } from '../../shared/components/PageHeader'
import { ShellItem, ShellStagger } from '../../shared/components/ShellMotion'
import { TabActionsContext } from '../../shared/components/ActionsSlot'
import { YearsTab } from './tabs/YearsTab'
import { SlotsTab } from './tabs/SlotsTab'
import { RoomsTab } from './tabs/RoomsTab'

/** Judul & subtitle per tab — dirender shell di ATAS tab bar (pola AttendancePage). */
const YEARS_TAB_META: Record<string, { title: string; subtitle: string }> = {
  years: {
    title: 'Tahun Akademik',
    subtitle: 'Periode semester dan kalender akademik',
  },
  slots: {
    title: 'Slot Jam',
    subtitle: 'Slot jam pelajaran per tahun ajaran — dipakai form Jadwal KBM',
  },
  rooms: {
    title: 'Ruang KBM',
    subtitle: 'Master ruangan untuk jadwal mengajar dan deteksi bentrok',
  },
}

const TAB_ITEMS = [
  { key: 'years', label: 'Tahun & Semester' },
  { key: 'slots', label: 'Slot Jam' },
  { key: 'rooms', label: 'Ruang KBM' },
]

/** Halaman Tahun Akademik: periode / slot jam / ruang KBM dalam satu route (?tab=). */
export function YearsPage() {
  const { tab, setTab } = useUrlTab('years')
  const meta = YEARS_TAB_META[tab] ?? YEARS_TAB_META.years
  const [actionsHost, setActionsHost] = useState<HTMLDivElement | null>(null)

  return (
    <div>
      <TabActionsContext.Provider value={actionsHost}>
        <ShellStagger>
          <ShellItem>
            <PageHeader
              title={meta.title}
              subtitle={meta.subtitle}
              extra={<div ref={setActionsHost} style={{ display: 'flex', alignItems: 'center' }} />}
            />
          </ShellItem>
          <ShellItem>
            <Tabs
              activeKey={tab}
              onChange={setTab}
            items={TAB_ITEMS.map((t) => ({
              ...t,
              children:
                t.key === 'slots' ? (
                  <SlotsTab active={tab === 'slots'} />
                ) : t.key === 'rooms' ? (
                  <RoomsTab active={tab === 'rooms'} />
                ) : (
                  <YearsTab active={tab === 'years'} />
                ),
            }))}
          />
          </ShellItem>
        </ShellStagger>
      </TabActionsContext.Provider>
    </div>
  )
}
