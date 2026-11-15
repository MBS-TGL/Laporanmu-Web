import { useMemo, useState } from 'react'
import { Button, Input, Segmented, Select, Space, Table, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ExportOutlined, MoneyCollectOutlined, ReloadOutlined, TeamOutlined } from '@ant-design/icons'
import { ShellItem } from '../../../shared/components/ShellMotion'
import { StatChip } from '../../../shared/components/StatChip'
import { useTabActions } from '../../../shared/components/ActionsSlot'
import { useDebounce } from '../../../shared/hooks/useDebounce'
import { useSppWithPayments } from '../hooks'
import { formatRupiah, obligationStatus, outstandingOf, periodLabel } from '../sppUtil'
import type { SppObligation } from '../types'
import { PaymentModal } from '../components/PaymentModal'
import { ExportModal } from '../components/ExportModal'
import { SppStatusTag } from './ObligationsTab'

/** Tab Tunggakan: kewajiban ber-status belum bayar/kurang, bisa difilter kelas. */
export function ArrearsTab({ active }: { active: boolean }) {
  const { obligations, loading, isError, refetch } = useSppWithPayments()

  const [statusFilter, setStatusFilter] = useState<'belum' | 'kurang'>('belum')
  const [classFilter, setClassFilter] = useState<string | undefined>()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search)
  const [payModal, setPayModal] = useState<{ open: boolean; studentId?: string; studentName?: string }>({ open: false })
  const [exportOpen, setExportOpen] = useState(false)

  const classOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const o of obligations) {
      const c = o.student?.class
      if (c?.id && c.name && !map.has(c.id)) map.set(c.id, c.name)
    }
    return [...map.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
  }, [obligations])

  const outstanding = useMemo(
    () =>
      obligations.filter((o) => {
        const st = obligationStatus({ amount: o.amount, paid: o.paid ?? 0 })
        return st === statusFilter
      }),
    [obligations, statusFilter],
  )

  const rows = useMemo(() => {
    let list = outstanding
    if (classFilter) list = list.filter((o) => o.student?.class?.id === classFilter)
    if (debouncedSearch) {
      const s = debouncedSearch.toLowerCase()
      list = list.filter(
        (o) => o.student?.name?.toLowerCase().includes(s) || o.student?.registration_code?.toLowerCase().includes(s),
      )
    }
    return list.sort((a, b) => (b.amount - (b.paid ?? 0)) - (a.amount - (a.paid ?? 0)))
  }, [outstanding, classFilter, debouncedSearch])

  const perStudent = useMemo(() => {
    const map = new Map<string, { name: string; className: string; total: number; count: number }>()
    for (const o of outstanding) {
      const s = o.student
      if (!s) continue
      const key = s.id
      const cur = map.get(key) ?? { name: s.name, className: s.class?.name ?? '-', total: 0, count: 0 }
      cur.total += outstandingOf({ amount: o.amount, paid: o.paid ?? 0 })
      cur.count += 1
      map.set(key, cur)
    }
    return [...map.values()].sort((a, b) => b.total - a.total)
  }, [outstanding])

  const totalOutstanding = useMemo(() => outstanding.reduce((s, o) => s + outstandingOf({ amount: o.amount, paid: o.paid ?? 0 }), 0), [outstanding])

  const columns: ColumnsType<SppObligation> = [
    { title: 'Santri', render: (_, o) => o.student?.name ?? '-' },
    { title: 'Kelas', width: 140, render: (_, o) => o.student?.class?.name ?? '-' },
    { title: 'Komponen', width: 160, render: (_, o) => o.component?.name ?? '-' },
    { title: 'Periode', width: 110, render: (_, o) => periodLabel(o.period ?? '') },
    {
      title: 'Sisa',
      width: 140,
      align: 'right',
      render: (_, o) => (
        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
          {formatRupiah(outstandingOf({ amount: o.amount, paid: o.paid ?? 0 }))}
        </span>
      ),
    },
    {
      title: 'Status',
      width: 110,
      render: (_, o) => <SppStatusTag status={obligationStatus({ amount: o.amount, paid: o.paid ?? 0 })} />,
    },
    {
      title: '',
      key: 'aksi',
      width: 90,
      render: (_, o) => (
        <Button
          type="link"
          size="small"
          icon={<MoneyCollectOutlined />}
          onClick={() => setPayModal({ open: true, studentId: o.student_id, studentName: o.student?.name })}
        >
          Bayar
        </Button>
      ),
    },
  ]

  const node = (
    <Space size={8} wrap>
      <Tooltip title="Muat ulang">
        <Button icon={<ReloadOutlined />} onClick={refetch} />
      </Tooltip>
      <Tooltip title="Ekspor tunggakan">
        <Button icon={<ExportOutlined />} onClick={() => setExportOpen(true)} />
      </Tooltip>
      <Tooltip title="Catat pembayaran">
        <span>
          <Button type="primary" icon={<MoneyCollectOutlined />} onClick={() => setPayModal({ open: true })}>
            Catat Pembayaran
          </Button>
        </span>
      </Tooltip>
    </Space>
  )
  const actions = useTabActions(active, node)

  return (
    <ShellItem>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <StatChip icon={<MoneyCollectOutlined />} label={`Tunggakan (${statusFilter === 'belum' ? 'Belum Bayar' : 'Kurang'})`} value={formatRupiah(totalOutstanding)} loading={loading} />
        <StatChip icon={<TeamOutlined />} label="Santri Menunggak" value={perStudent.length} color="amber" hideIfZero />
      </div>

      <Space size={12} wrap style={{ marginBottom: 12 }}>
        <Segmented
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as 'belum' | 'kurang')}
          options={[
            { value: 'belum', label: 'Belum Bayar' },
            { value: 'kurang', label: 'Bayar Kurang' },
          ]}
        />
        <Select
          showSearch
          allowClear
          placeholder="Filter kelas"
          style={{ minWidth: 180 }}
          value={classFilter}
          onChange={setClassFilter}
          options={classOptions}
          filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
        />
        <Input.Search
          allowClear
          placeholder="Cari santri / kode"
          style={{ width: 240 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Space>

      <Table<SppObligation>
        rowKey="id"
        size="middle"
        loading={loading}
        columns={columns}
        dataSource={rows}
        pagination={{ pageSize: 15, showSizeChanger: false, showTotal: (t) => `${t} kewajiban` }}
        scroll={{ x: 'max-content' }}
        locale={
          isError
            ? { emptyText: 'Gagal memuat — coba muat ulang.' }
            : { emptyText: 'Tidak ada tunggakan pada filter ini.' }
        }
      />

      <PaymentModal
        open={payModal.open}
        onClose={() => setPayModal({ open: false })}
        presetStudentId={payModal.studentId}
        presetStudentName={payModal.studentName}
      />
      <ExportModal<SppObligation>
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Export Tunggakan SPP"
        filename="tunggakan-spp"
        auditTable="spp_obligations"
        rows={rows}
        columns={[
          { header: 'Santri', value: (o) => o.student?.name ?? '' },
          { header: 'Kelas', value: (o) => o.student?.class?.name ?? '' },
          { header: 'Komponen', value: (o) => o.component?.name ?? '' },
          { header: 'Periode', value: (o) => periodLabel(o.period ?? '') },
          { header: 'Sisa', value: (o) => outstandingOf({ amount: o.amount, paid: o.paid ?? 0 }) },
        ]}
      />
      {actions}
    </ShellItem>
  )
}
