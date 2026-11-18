import { useState } from 'react'
import { Tabs } from 'antd'
import { PageHeader } from '../../shared/components/PageHeader'
import { TabActionsContext } from '../../shared/components/ActionsSlot'
import { ShellItem, ShellStagger } from '../../shared/components/ShellMotion'
import { useUrlTab } from '../../shared/hooks/useUrlTab'
import { DataTab } from './tabs/DataTab'
import { CurriculumTab } from './tabs/CurriculumTab'

const SUBJECT_TAB_KEYS = ['data', 'curriculum'] as const

const SUBJECT_TAB_ITEMS = [
  { key: 'data', label: 'Data Mapel' },
  { key: 'curriculum', label: 'CP/TP' },
]

const SUBJECT_TAB_META: Record<string, { title: string; subtitle: string }> = {
  data: {
    title: 'Mata Pelajaran',
    subtitle: 'Kelola daftar mapel, kelompok, dan beban jam per minggu',
  },
  curriculum: {
    title: 'CP/TP Kurikulum',
    subtitle: 'Kelola capaian dan tujuan pembelajaran per mata pelajaran',
  },
}

/** Halaman Mata Pelajaran: data mapel dan CP/TP dalam satu route bertab (?tab=). */
export function SubjectsPage() {
  const { tab, setTab } = useUrlTab('data', { keys: SUBJECT_TAB_KEYS })
  const meta = SUBJECT_TAB_META[tab] ?? SUBJECT_TAB_META.data
  const [actionsHost, setActionsHost] = useState<HTMLDivElement | null>(null)

  return (
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
            items={SUBJECT_TAB_ITEMS.map((t) => ({
              ...t,
              children:
                t.key === 'curriculum' ? (
                  <CurriculumTab active={tab === 'curriculum'} />
                ) : (
                  <DataTab active={tab === 'data'} />
                ),
            }))}
          />
        </ShellItem>
      </ShellStagger>
    </TabActionsContext.Provider>
  )
}
