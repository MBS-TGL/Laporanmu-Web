import { useState } from 'react'
import { useUrlTab } from '../../shared/hooks/useUrlTab'
import { ShellItem, ShellStagger } from '../../shared/components/ShellMotion'
import { PageHeader } from '../../shared/components/PageHeader'
import { TabActionsContext } from '../../shared/components/ActionsSlot'
import { Tabs } from 'antd'
import { RaporTab } from './tabs/RaporTab'
import { BukuIndukTab, KhsTab, TranscriptTab } from './tabs/DocTabs'
import { YudisiumTab } from './tabs/YudisiumTab'
import { DimensionsTab } from './tabs/DimensionsTab'
import { CocurricularTab } from './tabs/CocurricularTab'

const DOC_TAB_KEYS = ['report-card', 'khs', 'transcript', 'register', 'clearance', 'cocurricular', 'dimensions'] as const

const DOC_TAB_META: Record<string, { title: string; subtitle: string }> = {
  'report-card': {
    title: 'Rapor Kurikulum Merdeka',
    subtitle: 'Nilai semester per mata pelajaran, predikat, dan cetak berkop',
  },
  khs: {
    title: 'KHS',
    subtitle: 'Rekap nilai satu santri per semester',
  },
  transcript: {
    title: 'Transkrip',
    subtitle: 'Nilai lintas tahun ajaran',
  },
  register: {
    title: 'Buku Induk',
    subtitle: 'Biodata santri per kelas',
  },
  clearance: {
    title: 'Yudisium',
    subtitle: 'Pemeriksaan syarat kelulusan',
  },
  dimensions: {
    title: 'Dimensi Kokurikuler',
    subtitle: 'Dimensi penilaian kokurikuler',
  },
  cocurricular: {
    title: 'Nilai Kokurikuler',
    subtitle: 'Predikat dan deskripsi kokurikuler per santri',
  },
}

/** Pusat Dokumen (P4): rapor, KHS, transkrip, buku induk, yudisium, dan dimensi kokurikuler —
 *  satu route bertab (?tab=) sesuai playbook. */
export function DocumentsPage() {
  const { tab, setTab } = useUrlTab('report-card', {
    keys: DOC_TAB_KEYS,
    legacy: { rapor: 'report-card', 'buku-induk': 'register', yudisium: 'clearance' },
  })
  const meta = DOC_TAB_META[tab] ?? DOC_TAB_META['report-card']
  const [actionsHost, setActionsHost] = useState<HTMLDivElement | null>(null)

  return (
    <TabActionsContext.Provider value={actionsHost}>
      <ShellStagger>
        <ShellItem>
          <PageHeader
            title="Dokumen Akademik"
            subtitle={meta.subtitle}
            extra={<div ref={setActionsHost} style={{ display: 'flex', alignItems: 'center' }} />}
          />
        </ShellItem>
        <ShellItem>
          <Tabs
            activeKey={tab}
            onChange={setTab}
            items={DOC_TAB_KEYS.map((key) => ({
              key,
              label: DOC_TAB_META[key].title,
              children:
                key === 'report-card' ? (
                  <RaporTab />
                ) : key === 'khs' ? (
                  <KhsTab />
                ) : key === 'transcript' ? (
                  <TranscriptTab />
                ) : key === 'register' ? (
                  <BukuIndukTab />
                ) : key === 'dimensions' ? (
                  <DimensionsTab active={tab === 'dimensions'} />
                ) : key === 'cocurricular' ? (
                  <CocurricularTab active={tab === 'cocurricular'} />
                ) : (
                  <YudisiumTab />
                ),
            }))}
          />
        </ShellItem>
      </ShellStagger>
    </TabActionsContext.Provider>
  )
}
