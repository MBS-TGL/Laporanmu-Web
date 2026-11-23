import { useState } from 'react'
import { Tabs } from 'antd'
import { PageHeader } from '../../shared/components/PageHeader'
import { TabActionsContext } from '../../shared/components/ActionsSlot'
import { ShellItem, ShellStagger } from '../../shared/components/ShellMotion'
import { useUrlTab } from '../../shared/hooks/useUrlTab'
import { DataTab } from './components/DataTab'
import { useTeachers } from './hooks'
import { LoadPage } from './LoadPage'
import { ArchivePage } from './ArchivePage'

// ─── Shell: satu halaman Guru bertab (pola ?tab= — SKILLS.md §Skill 2) ──────
const TEACHER_TAB_ITEMS = [
  { key: 'data', label: 'Data Guru' },
  { key: 'workload', label: 'Beban Mengajar' },
  { key: 'archive', label: 'Arsip' },
]

/** Judul & subtitle per tab — dirender shell di ATAS tab bar (pola AttendancePage). */
const TEACHER_TAB_META: Record<string, { title: string; subtitle: (total?: number) => string }> = {
  data: {
    title: 'Guru',
    subtitle: (total) => `Kelola ${total ?? '…'} guru, musyrif, dan tenaga kependidikan`,
  },
  workload: {
    title: 'Beban Mengajar',
    subtitle: () => 'Sebaran jam mengajar dan cakupan mapel',
  },
  archive: {
    title: 'Arsip Guru',
    subtitle: () => 'Pulihkan guru yang sudah diarsipkan',
  },
}

/** Halaman Guru: data, workload, dan archive dalam satu route (?tab=). */
export function TeachersPage() {
  const { tab, setTab } = useUrlTab('data', {
    legacy: { beban: 'workload', arsip: 'archive' },
  })
  // Cache dibagi dengan useTeachers di tab data — tanpa fetch ganda
  const teachersQuery = useTeachers({ page: 1, pageSize: 1000 })
  const meta = TEACHER_TAB_META[tab] ?? TEACHER_TAB_META.data
  // Host aksi di ujung kanan tab bar — diisi tiap tab via useTabActions (ActionsSlot)
  const [actionsHost, setActionsHost] = useState<HTMLDivElement | null>(null)

  return (
    <TabActionsContext.Provider value={actionsHost}>
      <ShellStagger>
        <ShellItem>
          <PageHeader
            title={meta.title}
            subtitle={meta.subtitle(teachersQuery.data?.total)}
            extra={<div ref={setActionsHost} style={{ display: 'flex', alignItems: 'center' }} />}
          />
        </ShellItem>
        <ShellItem>
          <Tabs
            activeKey={tab}
            onChange={setTab}
            items={TEACHER_TAB_ITEMS.map((t) => ({
              ...t,
              children:
                t.key === 'workload' ? (
                  <LoadPage active={tab === 'workload'} />
                ) : t.key === 'archive' ? (
                  <ArchivePage />
                ) : (
                  <DataTab active={tab === 'data'} onNavigateTab={setTab} />
                ),
            }))}
          />
        </ShellItem>
      </ShellStagger>
    </TabActionsContext.Provider>
  )
}
