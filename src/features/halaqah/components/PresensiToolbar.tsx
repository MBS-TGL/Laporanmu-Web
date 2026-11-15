import {
  Button,
  Card,
  Dropdown,
  Input,
  InputNumber,
  Popover,
  Segmented,
  Select,
  Space,
  Tooltip,
  type InputRef,
} from 'antd'
import {
  CalendarOutlined,
  CopyOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  LeftOutlined,
  RightOutlined,
  SearchOutlined,
  SettingOutlined,
  StopOutlined,
  ThunderboltOutlined,
  UndoOutlined,
} from '@ant-design/icons'
import { App as AntApp } from 'antd'
import { MONTH_NAMES, STATUS_META, STATUS_ORDER } from '../../attendance/constants'
import type { AttendanceStatus } from '../../attendance/types'
import { THRESHOLD_KEY, type PresensiThreshold } from '../presensiStats'
import type { HalaqahGroup, HalaqahSession } from '../types'

interface PresensiToolbarProps {
  groups: HalaqahGroup[]
  activeGroupId: string | undefined
  changeGroup: (id?: string) => void
  month: number
  year: number
  goMonth: (delta: number) => void
  session: HalaqahSession
  changeSession: (s: HalaqahSession) => void
  searchRef: React.RefObject<InputRef | null>
  search: string
  setSearch: (v: string) => void
  hideWeekend: boolean
  toggleWeekend: () => void
  undoDepth: number
  undo: () => void
  canWrite: boolean
  fillAllWeekdays: (status: AttendanceStatus) => void
  clearAll: () => void
  copyLastMonth: () => void
  scrollToToday: () => void
  isCurrentPeriod: boolean
  threshold: PresensiThreshold
  setThreshold: React.Dispatch<React.SetStateAction<PresensiThreshold>>
}

/** Toolbar presensi: pemilih halaqah, navigasi bulan & sesi, filter, undo, aksi massal, dan pengaturan alert. */
export function PresensiToolbar(props: PresensiToolbarProps) {
  const {
    groups,
    activeGroupId,
    changeGroup,
    month,
    year,
    goMonth,
    session,
    changeSession,
    searchRef,
    search,
    setSearch,
    hideWeekend,
    toggleWeekend,
    undoDepth,
    undo,
    canWrite,
    fillAllWeekdays,
    clearAll,
    copyLastMonth,
    scrollToToday,
    isCurrentPeriod,
    threshold,
    setThreshold,
  } = props

  return (
    <Card style={{ marginBottom: 16 }} styles={{ body: { padding: '12px 16px' } }}>
      {/*
        Dipaksa 1 baris (flex nowrap): kontrol elastis (select & pencarian) yang
        menyusut saat ruang kurang — bukan turun baris. Pada layar ekstrem sempit
        container di-scroll terkurung (overflow-x auto) agar tidak bocor ke halaman.
      */}
      <div style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'center', gap: 8, overflowX: 'auto' }}>
        <Select
          placeholder="Pilih halaqah"
          style={{ flex: '0 1 260px', minWidth: 130, maxWidth: 320 }}
          value={activeGroupId}
          onChange={(v) => changeGroup(v)}
          options={groups.map((g) => ({
            value: g.id,
            label: `${g.name}${g.teachers?.name ? ` (${g.teachers.name})` : ''}`,
          }))}
        />
        <Space.Compact style={{ flexShrink: 0 }}>
          <Tooltip title="Bulan sebelumnya ([)">
            <Button icon={<LeftOutlined />} onClick={() => goMonth(-1)} />
          </Tooltip>
          <Button style={{ pointerEvents: 'none', fontWeight: 600 }}>
            {MONTH_NAMES[month - 1]} {year}
          </Button>
          <Tooltip title="Bulan berikutnya (])">
            <Button icon={<RightOutlined />} onClick={() => goMonth(1)} />
          </Tooltip>
        </Space.Compact>
        <Segmented
          value={session}
          onChange={(v) => changeSession(v as HalaqahSession)}
          style={{ flexShrink: 0 }}
          options={[
            { value: 'mengaji', label: 'Mengaji Wafa' },
            { value: 'tahfidz', label: 'Tahfidz' },
          ]}
        />
        <Input
          ref={searchRef}
          placeholder="Cari nama / kode santri"
          prefix={<SearchOutlined />}
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: '1 1 170px', minWidth: 100 }}
        />
        <Tooltip title={hideWeekend ? 'Tampilkan akhir pekan (W)' : 'Sembunyikan akhir pekan (W)'}>
          <Button
            icon={hideWeekend ? <EyeOutlined /> : <EyeInvisibleOutlined />}
            onClick={toggleWeekend}
            type={hideWeekend ? 'primary' : 'default'}
            ghost={hideWeekend}
            style={{ flexShrink: 0 }}
          />
        </Tooltip>
        <Tooltip title="Batalkan perubahan terakhir (Ctrl+Z)">
          <Button
            icon={<UndoOutlined />}
            onClick={undo}
            disabled={undoDepth === 0 || !canWrite}
            style={{ flexShrink: 0 }}
          />
        </Tooltip>
        {canWrite && (
          <Dropdown
            menu={{
              items: [
                ...STATUS_ORDER.map((st) => ({
                  key: st,
                  icon: <span style={{ color: STATUS_META[st].color, fontWeight: 700 }}>{st}</span>,
                  label: `Semua hari kerja → ${STATUS_META[st].label}`,
                  onClick: () => fillAllWeekdays(st),
                })),
                { type: 'divider' as const },
                {
                  key: 'clear',
                  icon: <StopOutlined />,
                  label: 'Kosongkan grid & catatan',
                  danger: true,
                  onClick: clearAll,
                },
              ],
            }}
          >
            <Button icon={<ThunderboltOutlined />} style={{ flexShrink: 0 }}>
              Aksi Massal
            </Button>
          </Dropdown>
        )}
        {canWrite && (
          <Tooltip title="Salin presensi bulan lalu (sel kosong saja)">
            <Button icon={<CopyOutlined />} onClick={copyLastMonth} style={{ flexShrink: 0 }} />
          </Tooltip>
        )}
        <Tooltip title="Gulir ke hari ini">
          <Button
            icon={<CalendarOutlined />}
            onClick={scrollToToday}
            disabled={!isCurrentPeriod}
            style={{ flexShrink: 0 }}
          />
        </Tooltip>
        <ThresholdSettings threshold={threshold} setThreshold={setThreshold} />
      </div>
    </Card>
  )
}

/** Popover pengaturan ambang batas alert alpa & kehadiran (tersimpan di localStorage). */
function ThresholdSettings({
  threshold,
  setThreshold,
}: {
  threshold: PresensiThreshold
  setThreshold: React.Dispatch<React.SetStateAction<PresensiThreshold>>
}) {
  const { message } = AntApp.useApp()

  return (
    <Popover
      trigger="click"
      placement="bottomRight"
      content={
        <div style={{ width: 240 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Ambang batas alert</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 12, flex: 1 }}>Alpa ≥</span>
            <InputNumber
              min={1}
              max={10}
              value={threshold.alpa}
              onChange={(v) => setThreshold((t) => ({ ...t, alpa: v ?? t.alpa }))}
              style={{ width: 64 }}
            />
            <span style={{ fontSize: 12 }}>hari</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 12, flex: 1 }}>Hadir &lt;</span>
            <InputNumber
              min={30}
              max={90}
              step={5}
              value={threshold.hadirPct}
              onChange={(v) => setThreshold((t) => ({ ...t, hadirPct: v ?? t.hadirPct }))}
              style={{ width: 64 }}
            />
            <span style={{ fontSize: 12 }}>%</span>
          </div>
          <Button
            type="primary"
            size="small"
            block
            onClick={() => {
              try {
                localStorage.setItem(THRESHOLD_KEY, JSON.stringify(threshold))
              } catch {
                /* quota */
              }
              message.success('Ambang batas alert disimpan')
            }}
          >
            Simpan
          </Button>
        </div>
      }
    >
      <Tooltip title="Pengaturan alert alpa & kehadiran">
        <Button icon={<SettingOutlined />} style={{ flexShrink: 0 }} />
      </Tooltip>
    </Popover>
  )
}
