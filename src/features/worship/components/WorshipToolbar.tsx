import {
  Button,
  Card,
  DatePicker,
  Input,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Tooltip,
} from 'antd'
import {
  CheckOutlined,
  SearchOutlined,
  SendOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import type { Dayjs } from 'dayjs'
import type { WorshipCategory } from '../types'

interface WorshipToolbarProps {
  category: WorshipCategory
  classId: string | undefined
  setClassId: (id: string | undefined) => void
  classes: Array<{ id: string; name: string }>
  mode: 'mastery' | 'scores'
  setMode: (m: 'mastery' | 'scores') => void
  month: Dayjs
  setMonth: (m: Dayjs) => void
  search: string
  setSearch: (v: string) => void
  canWrite: boolean
  hasScores: boolean
  className: string
  allPresetsExist: boolean
  loadingPresets: boolean
  syncingMonthly: boolean
  onLoadPresets: () => void
  onSyncMonthly: () => void
}

/**
 * Toolbar kontrol halaman Ibadah: pemilih kelas, mode kemahiran/nilai,
 * pencarian santri, navigasi bulan, muat preset, dan sinkronisasi rapor.
 * Mengikuti pola Card toolbar di PresensiToolbar Halaqah.
 */
export function WorshipToolbar({
  classId,
  setClassId,
  classes,
  mode,
  setMode,
  month,
  setMonth,
  search,
  setSearch,
  canWrite,
  hasScores,
  className,
  allPresetsExist,
  loadingPresets,
  syncingMonthly,
  onLoadPresets,
  onSyncMonthly,
}: WorshipToolbarProps) {
  return (
    <Card style={{ marginBottom: 14 }} styles={{ body: { padding: '10px 14px' } }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        {/* Kontrol Utama: Pilih Kelas + Mode Tampilan + Bulan */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, flex: 1, minWidth: 280 }}>
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Pilih kelas santri..."
            style={{ width: 200 }}
            value={classId}
            options={classes.map((c) => ({ value: c.id, label: c.name }))}
            onChange={setClassId}
            aria-label="Pilih kelas"
          />

          <Segmented
            value={mode}
            onChange={(v) => setMode(v as 'mastery' | 'scores')}
            options={[
              { value: 'mastery', label: 'Kemahiran' },
              { value: 'scores', label: 'Nilai Bulanan' },
            ]}
          />

          {mode === 'scores' && (
            <DatePicker
              picker="month"
              value={month}
              onChange={(v) => v && setMonth(v)}
              allowClear={false}
              aria-label="Pilih bulan nilai"
              style={{ width: 135 }}
            />
          )}

          <Input
            placeholder="Cari santri..."
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            allowClear
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 170 }}
          />
        </div>

        {/* Aksi Tambahan: Muat Preset & Sinkronisasi Rapor */}
        <Space size={6} style={{ flexShrink: 0 }}>
          {mode === 'scores' && (
            <Tooltip title="Kirim rata-rata nilai ibadah bulan ini ke Rapor Bulanan santri">
              <Popconfirm
                title="Sinkronkan Nilai ke Rapor Bulanan?"
                description={`Rata-rata nilai ibadah bulan ${month.format('MMMM YYYY')} kelas ${className || 'ini'} akan dimasukkan ke rapor bulanan santri.`}
                okText="Ya, Sinkronkan"
                cancelText="Batal"
                onConfirm={onSyncMonthly}
              >
                <Button
                  icon={<SendOutlined />}
                  loading={syncingMonthly}
                  disabled={!canWrite || !classId || !hasScores}
                >
                  Sinkron ke Rapor
                </Button>
              </Popconfirm>
            </Tooltip>
          )}

          <Tooltip
            title={
              allPresetsExist
                ? 'Semua butir preset sudah dimuat'
                : 'Muat butir bawaan standar pembinaan asrama'
            }
          >
            <Button
              icon={allPresetsExist ? <CheckOutlined /> : <ThunderboltOutlined />}
              loading={loadingPresets}
              disabled={!canWrite || allPresetsExist}
              onClick={onLoadPresets}
            >
              {allPresetsExist ? 'Preset Lengkap' : 'Muat Preset'}
            </Button>
          </Tooltip>
        </Space>
      </div>
    </Card>
  )
}
