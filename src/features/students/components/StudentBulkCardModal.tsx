import { useMemo, useState } from 'react'
import { App, Button, Radio, Select, Typography } from 'antd'
import { IdcardOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import type { Student } from '../types'

const { Text } = Typography

interface ClassOption {
  id: string
  name: string
}

interface StudentBulkCardModalProps {
  open: boolean
  onClose: () => void
  /** seluruh siswa aktif di database (sudah termuat di halaman) */
  allStudents: Student[]
  /** hasil filter + pencarian saat ini di halaman */
  filteredRows: Student[]
  classes: ClassOption[]
  /** daftar siswa final → membuka preview & cetak kartu */
  onSubmit: (students: Student[]) => void
}

type Scope = 'filter' | 'active' | 'class'

/** Pemilih cakupan cetak kartu massal: filter aktif, semua siswa aktif, atau per kelas */
export function StudentBulkCardModal({
  open,
  onClose,
  allStudents,
  filteredRows,
  classes,
  onSubmit,
}: StudentBulkCardModalProps) {
  const { message } = App.useApp()
  const [scope, setScope] = useState<Scope>('filter')
  const [classId, setClassId] = useState<string>()

  const classCount = useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of allStudents) {
      if (!s.class_id) continue
      counts.set(s.class_id, (counts.get(s.class_id) ?? 0) + 1)
    }
    return counts
  }, [allStudents])

  const list = useMemo(() => {
    if (scope === 'filter') return filteredRows
    if (scope === 'active') return allStudents.filter((s) => s.status === 'aktif')
    if (!classId) return []
    return allStudents.filter((s) => s.class_id === classId)
  }, [scope, filteredRows, allStudents, classId])

  const missingPin = list.filter((s) => !s.pin).length

  const scopeLabel = (value: Scope, label: string) => {
    const count =
      value === 'filter'
        ? filteredRows.length
        : value === 'active'
          ? allStudents.filter((s) => s.status === 'aktif').length
          : null
    return (
      <span>
        {label}
        {count !== null ? <Text type="secondary"> — {count} siswa</Text> : null}
      </span>
    )
  }

  return (
    <AppModal
      open={open}
      onCancel={onClose}
      width={480}
      title="Cetak Kartu Massal"
      subtitle="Pilih cakupan siswa, lalu tinjau kartu sebelum dicetak"
      icon={<IdcardOutlined />}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {list.length > 0 ? `${list.length} kartu siap ditinjau` : 'Belum ada siswa pada cakupan ini'}
          </Text>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={onClose}>Batal</Button>
            <Button
              type="primary"
              disabled={list.length === 0}
              onClick={() => {
                onSubmit(list)
                message.info(`${list.length} kartu ditampilkan — periksa lalu klik Cetak`)
              }}
            >
              Tampilkan {list.length} Kartu
            </Button>
          </div>
        </div>
      }
    >
      <Radio.Group
        value={scope}
        onChange={(e) => setScope(e.target.value as Scope)}
        style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        <Radio value="filter">{scopeLabel('filter', 'Sesuai filter saat ini')}</Radio>
        <Radio value="active">{scopeLabel('active', 'Semua siswa aktif')}</Radio>
        <Radio value="class">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {scopeLabel('class', 'Per kelas')}
            <Select
              size="small"
              placeholder="Pilih kelas"
              style={{ minWidth: 200 }}
              value={classId}
              onChange={setClassId}
              showSearch
              optionFilterProp="label"
              options={classes.map((c) => ({
                value: c.id,
                label: `${c.name} (${classCount.get(c.id) ?? 0})`,
              }))}
            />
          </span>
        </Radio>
      </Radio.Group>

      {list.length > 0 && missingPin > 0 && (
        <Text type="warning" style={{ display: 'block', marginTop: 14, fontSize: 12.5 }}>
          {missingPin} dari {list.length} siswa belum memiliki PIN — atur lewat form siswa sebelum kartu dibagikan.
        </Text>
      )}
    </AppModal>
  )
}
