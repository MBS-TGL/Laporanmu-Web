import { useState } from 'react'
import { Tabs } from 'antd'
import { useUrlTab } from '../../shared/hooks/useUrlTab'
import { ShellItem, ShellStagger } from '../../shared/components/ShellMotion'
import { PageHeader } from '../../shared/components/PageHeader'
import { TabActionsContext } from '../../shared/components/ActionsSlot'
import { RulesPage } from './RulesPage'
import { ReportsPage } from './ReportsPage'
import { SuspensionPage } from '../suspension/SuspensionPage'

const DISIPLIN_TAB_ITEMS = [
  { key: 'notes', label: 'Catatan' },
  { key: 'rules', label: 'Aturan' },
  { key: 'suspension', label: 'Skorsing' },
]

const TAB_SUBTITLE: Record<string, string> = {
  notes: 'Riwayat pelanggaran dan prestasi santri',
  rules: 'Daftar pelanggaran, prestasi, dan bobot poin',
  suspension: 'Skorsing dan pembinaan bersama wali',
}

/**
 * Halaman Poin & Disiplin — satu route untuk domain disiplin (pola ?tab=,
 * lihat SKILLS.md §Skill 2): catatan, aturan, dan skorsing.
 * Detail skorsing dibuka sebagai drawer dari tab Skorsing.
 */
export function DisiplinPage() {
  const { tab, setTab } = useUrlTab('notes', {
    legacy: { catatan: 'notes', aturan: 'rules', skorsing: 'suspension' },
  })
  const [actionsHost, setActionsHost] = useState<HTMLDivElement | null>(null)

  return (
    <TabActionsContext.Provider value={actionsHost}>
      <ShellStagger>
        <ShellItem>
          <PageHeader
            title="Poin & Disiplin"
            subtitle={TAB_SUBTITLE[tab] ?? TAB_SUBTITLE.notes}
            extra={<div ref={setActionsHost} style={{ display: 'flex', alignItems: 'center', gap: 8 }} />}
          />
        </ShellItem>
        <ShellItem>
          <Tabs
            activeKey={tab}
            onChange={setTab}
            items={DISIPLIN_TAB_ITEMS.map((t) => ({
              ...t,
              children:
                t.key === 'rules' ? (
                  <RulesPage active={tab === 'rules'} />
                ) : t.key === 'suspension' ? (
                  <SuspensionPage active={tab === 'suspension'} />
                ) : (
                  <ReportsPage active={tab === 'notes'} />
                ),
            }))}
          />
        </ShellItem>
      </ShellStagger>
    </TabActionsContext.Provider>
  )
}
