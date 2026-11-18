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

const DOC_TAB_KEYS = ['rapor', 'khs', 'transcript', 'buku-induk', 'yudisium', 'dimensions'] as const

const DOC_TAB_META: Record<string, { title: string; subtitle: string }> = {
  rapor: {
    title: 'Raport Kurmer',
    subtitle: 'Nilai semester per mapel + KKM + predikat, deskripsi otomatis & polesan AI, cetak berkop',
  },
  khs: {
    title: 'Kartu Hasil Studi',
    subtitle: 'Rekap satu santri satu semester, cetak berkop',
  },
  transcript: {
    title: 'Transkrip Nilai',
    subtitle: 'Gabungan nilai semester per mapel lintas tahun ajaran, cetak berkop',
  },
  'buku-induk': {
    title: 'Buku Induk',
    subtitle: 'Biodata santri per kelas: cetak dan unduh Excel',
  },
  yudisium: {
    title: 'Yudisium Kelulusan',
    subtitle: 'Cek syarat kelulusan (nilai, tahfidz, SPP, poin) → keputusan → dokumen',
  },
  dimensions: {
    title: 'Dimensi Kokurikuler',
    subtitle: 'Daftar dimensi penilaian kokurikuler untuk rapor',
  },
}

/** Pusat Dokumen (P4): rapor, KHS, transkrip, buku induk, yudisium, dan dimensi kokurikuler —
 *  satu route bertab (?tab=) sesuai playbook. */
export function DocumentsPage() {
  const { tab, setTab } = useUrlTab('rapor', { keys: DOC_TAB_KEYS })
  const meta = DOC_TAB_META[tab] ?? DOC_TAB_META.rapor
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
            items={DOC_TAB_KEYS.map((key) => ({
              key,
              label: DOC_TAB_META[key].title,
              children:
                key === 'rapor' ? (
                  <RaporTab />
                ) : key === 'khs' ? (
                  <KhsTab />
                ) : key === 'transcript' ? (
                  <TranscriptTab />
                ) : key === 'buku-induk' ? (
                  <BukuIndukTab />
                ) : key === 'dimensions' ? (
                  <DimensionsTab active={tab === 'dimensions'} />
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
