import type { RefObject } from 'react'
import { Card, DatePicker, Input, Segmented, Select } from 'antd'
import type { Dayjs } from 'dayjs'
import type { InputRef } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { FilterChips, type FilterChip } from '../../../shared/components/FilterChips'
import type { PermitStatus } from '../types'

const STATUS_OPTIONS = [
  { label: 'Semua', value: '' },
  { label: 'Diterbitkan', value: 'issued' },
  { label: 'Berangkat', value: 'departed' },
  { label: 'Terlambat', value: 'overdue' },
  { label: 'Kembali', value: 'returned' },
  { label: 'Dibatalkan', value: 'cancelled' },
]

interface Props {
  search: string
  onSearch: (v: string) => void
  searchInputRef: RefObject<InputRef | null>
  dateRange: [Dayjs, Dayjs] | null
  onDateRange: (v: [Dayjs, Dayjs] | null) => void
  classId: string | undefined
  onClassId: (v: string | undefined) => void
  statusFilter: PermitStatus | ''
  onStatusChange: (v: PermitStatus | '') => void
  classes: { id: string; name: string }[]
  classesLoading: boolean
  chips: FilterChip[]
}

/**
 * Baris filter satu baris: pencarian melar mengisi lebar, tanggal/kelas/status
 * lebar alami; layar sempit → scroll horizontal pada kartu ini saja.
 */
export function FilterBar({
  search,
  onSearch,
  searchInputRef,
  dateRange,
  onDateRange,
  classId,
  onClassId,
  statusFilter,
  onStatusChange,
  classes,
  classesLoading,
  chips,
}: Props) {
  return (
    <Card style={{ marginBottom: 12 }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'nowrap',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          overflowX: 'auto',
          paddingBottom: 2,
        }}
      >
        <Input
          ref={searchInputRef}
          allowClear
          prefix={<SearchOutlined style={{ color: '#bbb' }} />}
          placeholder="Cari nama, kode, tujuan…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          style={{ flex: '1 1 200px', minWidth: 180 }}
        />
        <div style={{ flex: '0 0 auto' }}>
          <DatePicker.RangePicker
            value={dateRange}
            onChange={(v) => onDateRange(v as [Dayjs, Dayjs] | null)}
            format="DD MMM YY"
            allowEmpty={[false, true]}
            style={{ width: 230 }}
          />
        </div>
        <Select
          allowClear
          placeholder="Semua kelas"
          value={classId}
          onChange={onClassId}
          options={classes.map((c) => ({ value: c.id, label: c.name }))}
          style={{ flex: '0 0 auto', minWidth: 140, maxWidth: 200 }}
          loading={classesLoading}
        />
        <div style={{ flex: '0 0 auto' }}>
          <Segmented
            value={statusFilter}
            onChange={(v) => onStatusChange(v as PermitStatus | '')}
            options={STATUS_OPTIONS}
          />
        </div>
      </div>
      <FilterChips chips={chips} marginTop={12} />
    </Card>
  )
}
