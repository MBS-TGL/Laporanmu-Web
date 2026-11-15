import { useState } from 'react'
import { Tabs } from 'antd'
import { PageHeader } from '../../shared/components/PageHeader'
import { ShellStagger, ShellItem } from '../../shared/components/ShellMotion'
import { TabActionsContext } from '../../shared/components/ActionsSlot'
import { useUrlTab } from '../../shared/hooks/useUrlTab'
import { ObligationsTab } from './tabs/ObligationsTab'
import { PaymentsTab } from './tabs/PaymentsTab'
import { ArrearsTab } from './tabs/ArrearsTab'

const TAB_META: Record<string, { subtitle: string }> = {
  kewajiban: { subtitle: 'Komponen biaya dan kewajiban per santri' },
  pembayaran: { subtitle: 'Riwayat pembayaran SPP yang tercatat' },
  tunggakan: { subtitle: 'Kewajiban belum lunas per kelas dan santri' },
}

/** Halaman Keuangan SPP — 1 route bertab `?tab=`. */
export function FinancePage() {
  const { tab, setTab } = useUrlTab('obligations')
  const [actionsHost, setActionsHost] = useState<HTMLDivElement | null>(null)

  return (
    <ShellStagger>
      <TabActionsContext.Provider value={actionsHost}>
        <ShellItem>
          <PageHeader
            title="Keuangan SPP"
            subtitle={TAB_META[tab]?.subtitle ?? TAB_META.kewajiban.subtitle}
            extra={<div ref={setActionsHost} style={{ display: 'flex', alignItems: 'center' }} />}
          />
        </ShellItem>
        <ShellItem>
          <Tabs
            activeKey={tab}
            onChange={setTab}
            items={[
              { key: 'obligations', label: 'Kewajiban', children: <ObligationsTab active={tab === 'obligations'} /> },
              { key: 'payments', label: 'Pembayaran', children: <PaymentsTab active={tab === 'payments'} /> },
              { key: 'arrears', label: 'Tunggakan', children: <ArrearsTab active={tab === 'arrears'} /> },
            ]}
          />
        </ShellItem>
      </TabActionsContext.Provider>
    </ShellStagger>
  )
}
