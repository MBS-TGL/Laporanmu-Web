import { Tabs } from 'antd'
import { useUrlTab } from '../../shared/hooks/useUrlTab'
import { ShellItem, ShellStagger } from '../../shared/components/ShellMotion'
import { RulesPage } from './RulesPage'
import { ReportsPage } from './ReportsPage'
import { SuspensionPage } from '../suspension/SuspensionPage'

const DISIPLIN_TAB_ITEMS = [
  { key: 'catatan', label: 'Catatan Poin' },
  { key: 'aturan', label: 'Aturan Poin' },
  { key: 'skorsing', label: 'Skorsing' },
]

/**
 * Halaman Poin & Disiplin — satu route untuk domain disiplin (pola ?tab=,
 * lihat SKILLS.md §Skill 2): catatan poin, aturan poin, dan skorsing.
 * Detail skorsing dibuka sebagai drawer dari tab Skorsing.
 */
export function DisiplinPage() {
  const { tab, setTab } = useUrlTab('catatan')

  return (
    <ShellStagger>
      <ShellItem>
        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={DISIPLIN_TAB_ITEMS.map((t) => ({
            ...t,
            children:
              t.key === 'aturan' ? <RulesPage /> : t.key === 'skorsing' ? <SuspensionPage /> : <ReportsPage />,
          }))}
        />
      </ShellItem>
    </ShellStagger>
  )
}
