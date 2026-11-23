import { useState } from 'react'
import { Tabs } from 'antd'
import { PageHeader } from '../../shared/components/PageHeader'
import { ShellStagger, ShellItem } from '../../shared/components/ShellMotion'
import { TabActionsContext } from '../../shared/components/ActionsSlot'
import { useUrlTab } from '../../shared/hooks/useUrlTab'
import { BankTab } from './tabs/BankTab'
import { ExamsTab } from './tabs/ExamsTab'

const TAB_META: Record<string, { subtitle: string }> = {
  bank: { subtitle: 'Bank soal per kelas dan mata pelajaran' },
  exams: { subtitle: 'Sesi ujian, pemantauan, dan rekap nilai' },
}

/**
 * Halaman CBT (bank soal + sesi ujian) — 1 route bertab `?tab=`.
 * Ujian santri tanpa akun ada di route publik `/cbt/:token`.
 */
export function CbtPage() {
  const { tab, setTab } = useUrlTab('bank', { legacy: { ujian: 'exams' } })
  const [actionsHost, setActionsHost] = useState<HTMLDivElement | null>(null)

  return (
    <ShellStagger>
      <TabActionsContext.Provider value={actionsHost}>
        <ShellItem>
          <PageHeader
            title="CBT"
            subtitle={TAB_META[tab]?.subtitle ?? TAB_META.bank.subtitle}
            extra={<div ref={setActionsHost} style={{ display: 'flex', alignItems: 'center' }} />}
          />
        </ShellItem>
        <ShellItem>
          <Tabs
            activeKey={tab}
            onChange={setTab}
            items={[
              { key: 'bank', label: 'Bank Soal', children: <BankTab active={tab === 'bank'} /> },
              { key: 'exams', label: 'Sesi Ujian', children: <ExamsTab active={tab === 'exams'} /> },
            ]}
          />
        </ShellItem>
      </TabActionsContext.Provider>
    </ShellStagger>
  )
}
