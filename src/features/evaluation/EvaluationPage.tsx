import { useState } from 'react'
import { Tabs } from 'antd'
import { PageHeader } from '../../shared/components/PageHeader'
import { ShellStagger, ShellItem } from '../../shared/components/ShellMotion'
import { TabActionsContext } from '../../shared/components/ActionsSlot'
import { useUrlTab } from '../../shared/hooks/useUrlTab'
import { ManageTab } from './tabs/ManageTab'
import { ResultsTab } from './tabs/ResultsTab'

const TAB_META: Record<string, { subtitle: string }> = {
  manage: { subtitle: 'Buat angket, terbitkan token, dan kelola pertanyaan' },
  results: { subtitle: 'Analisis dimensi, MBTI, dan sosiogram' },
}

/** Halaman Pusat Evaluasi — 1 route bertab `?tab=`. */
export function EvaluationPage() {
  const { tab, setTab } = useUrlTab('manage', { keys: ['manage', 'results'] })
  const [actionsHost, setActionsHost] = useState<HTMLDivElement | null>(null)

  return (
    <ShellStagger>
      <TabActionsContext.Provider value={actionsHost}>
        <ShellItem>
          <PageHeader
            title="Evaluasi"
            subtitle={TAB_META[tab]?.subtitle ?? TAB_META.manage.subtitle}
            extra={<div ref={setActionsHost} style={{ display: 'flex', alignItems: 'center' }} />}
          />
        </ShellItem>
        <ShellItem>
          <Tabs
            activeKey={tab}
            onChange={setTab}
            items={[
              { key: 'manage', label: 'Kelola Angket', children: <ManageTab active={tab === 'manage'} /> },
              { key: 'results', label: 'Hasil', children: <ResultsTab active={tab === 'results'} /> },
            ]}
          />
        </ShellItem>
      </TabActionsContext.Provider>
    </ShellStagger>
  )
}
