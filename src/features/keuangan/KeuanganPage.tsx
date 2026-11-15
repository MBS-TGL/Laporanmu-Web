import { useState } from 'react'
import { Tabs } from 'antd'
import { PageHeader } from '../../shared/components/PageHeader'
import { ShellStagger, ShellItem } from '../../shared/components/ShellMotion'
import { TabActionsContext } from '../../shared/components/ActionsSlot'
import { useUrlTab } from '../../shared/hooks/useUrlTab'
import { ObligationsTab } from './tabs/ObligationsTab'
import { PaymentsTab } from './tabs/PaymentsTab'
import { TunggakanTab } from './tabs/TunggakanTab'

const TAB_META: Record<string, { subtitle: string }> = {
  kewajiban: { subtitle: 'Komponen biaya dan kewajiban per santri' },
  pembayaran: { subtitle: 'Riwayat pembayaran SPP yang tercatat' },
  tunggakan: { subtitle: 'Kewajiban belum lunas per kelas dan santri' },
}

/** Halaman Keuangan SPP — 1 route bertab `?tab=`. */
export function KeuanganPage() {
  const { tab, setTab } = useUrlTab('kewajiban')
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
              { key: 'kewajiban', label: 'Kewajiban', children: <ObligationsTab active={tab === 'kewajiban'} /> },
              { key: 'pembayaran', label: 'Pembayaran', children: <PaymentsTab active={tab === 'pembayaran'} /> },
              { key: 'tunggakan', label: 'Tunggakan', children: <TunggakanTab active={tab === 'tunggakan'} /> },
            ]}
          />
        </ShellItem>
      </TabActionsContext.Provider>
    </ShellStagger>
  )
}
