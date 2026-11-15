import { useMemo, useState } from 'react'
import { App, Button, Input, Popconfirm, Segmented, Space, Table, Tag, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  DeleteOutlined,
  EditOutlined,
  ExportOutlined,
  PlusOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import { ShellItem } from '../../../shared/components/ShellMotion'
import { StatChip } from '../../../shared/components/StatChip'
import { useTabActions } from '../../../shared/components/ActionsSlot'
import { useDebounce } from '../../../shared/hooks/useDebounce'
import { usePermissions } from '../../../shared/hooks/useProfile'
import { useAcademicYearsBrief } from '../../classes/hooks'
import {
  useCreateSppComponent,
  useDeleteSppComponent,
  useDeleteSppObligation,
  useSppComponents,
  useSppWithPayments,
  useUpdateSppComponent,
} from '../hooks'
import { formatRupiah, obligationStatus, periodLabel, type ObligationStatus as Status } from '../sppUtil'
import { FREQUENCY_LABEL, type ComponentFormValues, type SppComponent, type SppObligation } from '../types'
import { ComponentModal } from '../components/ComponentModal'
import { GenerateObligationsModal } from '../components/GenerateObligationsModal'
import { KeuanganExportModal } from '../components/KeuanganExportModal'

export const SPP_STATUS_META: Record<Status, { label: string; color: string }> = {
  lunas: { label: 'Lunas', color: 'green' },
  kurang: { label: 'Kurang', color: 'orange' },
  belum: { label: 'Belum Bayar', color: 'red' },
}

export function SppStatusTag({ status }: { status: Status }) {
  const meta = SPP_STATUS_META[status]
  return <Tag color={meta.color}>{meta.label}</Tag>
}

/** Tab Kewajiban: master komponen biaya + daftar kewajiban per santri. */
export function ObligationsTab({ active }: { active: boolean }) {
  const { message } = App.useApp()
  const { canWrite } = usePermissions()
  const componentsQuery = useSppComponents()
  const { obligations, loading, isError, refetch } = useSppWithPayments()
  const createComponent = useCreateSppComponent()
  const updateComponent = useUpdateSppComponent()
  const deleteComponent = useDeleteSppComponent()
  const deleteObligation = useDeleteSppObligation()

  const [componentModal, setComponentModal] = useState<{ open: boolean; initial: SppComponent | null }>({
    open: false,
    initial: null,
  })
  const [generateOpen, setGenerateOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<Status | 'semua'>('semua')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search)

  const rows = useMemo(() => {
    let list = obligations
    if (debouncedSearch) {
      const s = debouncedSearch.toLowerCase()
      list = list.filter(
        (o) => o.student?.name?.toLowerCase().includes(s) || o.student?.registration_code?.toLowerCase().includes(s),
      )
    }
    if (statusFilter !== 'semua') {
      list = list.filter((o) => obligationStatus({ amount: o.amount, paid: o.paid ?? 0 }) === statusFilter)
    }
    return list
  }, [obligations, debouncedSearch, statusFilter])

  const summary = useMemo(() => {
    const total = obligations.reduce((s, o) => s + o.amount, 0)
    const paid = obligations.reduce((s, o) => s + Math.min(o.paid ?? 0, o.amount), 0)
    return { total, paid, outstanding: total - paid }
  }, [obligations])

  const yearsQuery = useAcademicYearsBrief()
  const activeYear = useMemo(
    () => yearsQuery.data?.find((y) => y.is_active) ?? yearsQuery.data?.[0],
    [yearsQuery.data],
  )

  const handleSaveComponent = async (values: ComponentFormValues, id?: string) => {
    try {
      if (id) {
        await updateComponent.mutateAsync({ id, values })
      } else {
        if (!activeYear) throw new Error('Tahun ajaran aktif tidak ditemukan')
        await createComponent.mutateAsync({ values, academicYearId: activeYear.id })
      }
      message.success(id ? 'Komponen diperbarui' : 'Komponen ditambahkan')
      setComponentModal({ open: false, initial: null })
    } catch (err) {
      message.error((err as Error).message)
    }
  }

  const componentColumns: ColumnsType<SppComponent> = [
    { title: 'Komponen', dataIndex: 'name' },
    {
      title: 'Nominal',
      width: 140,
      align: 'right',
      render: (_, c) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatRupiah(c.amount)}</span>,
    },
    { title: 'Frekuensi', width: 120, render: (_, c) => FREQUENCY_LABEL[c.frequency] },
    { title: 'Tingkat', width: 90, render: (_, c) => (c.grade ? `Kelas ${c.grade}` : 'Semua') },
  ]

  if (canWrite) {
    componentColumns.push({
      title: '',
      key: 'aksi',
      width: 100,
      render: (_, c) => (
        <Space size={0}>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            title="Ubah komponen"
            onClick={() => setComponentModal({ open: true, initial: c })}
          />
          <Popconfirm
            title="Arsipkan komponen ini?"
            description="Kewajiban yang sudah dibuat tetap tersimpan."
            okText="Ya, Arsipkan"
            cancelText="Batal"
            okButtonProps={{ loading: deleteComponent.isPending }}
            onConfirm={async () => {
              try {
                await deleteComponent.mutateAsync(c.id)
                message.success('Komponen diarsipkan')
              } catch (err) {
                message.error((err as Error).message)
              }
            }}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} title="Arsipkan komponen" />
          </Popconfirm>
        </Space>
      ),
    })
  }

  const obligationColumns: ColumnsType<SppObligation> = [
    { title: 'Santri', render: (_, o) => o.student?.name ?? '-' },
    { title: 'Kelas', width: 140, render: (_, o) => o.student?.class?.name ?? '-' },
    { title: 'Komponen', width: 160, render: (_, o) => o.component?.name ?? '-' },
    { title: 'Periode', width: 110, render: (_, o) => periodLabel(o.period ?? '') },
    {
      title: 'Nominal',
      width: 130,
      align: 'right',
      render: (_, o) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatRupiah(o.amount)}</span>,
    },
    {
      title: 'Terbayar',
      width: 130,
      align: 'right',
      render: (_, o) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatRupiah(Math.min(o.paid ?? 0, o.amount))}</span>,
    },
    {
      title: 'Sisa',
      width: 130,
      align: 'right',
      render: (_, o) => (
        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
          {formatRupiah(o.amount - Math.min(o.paid ?? 0, o.amount))}
        </span>
      ),
    },
    {
      title: 'Status',
      width: 110,
      render: (_, o) => <SppStatusTag status={obligationStatus({ amount: o.amount, paid: o.paid ?? 0 })} />,
    },
  ]

  if (canWrite) {
    obligationColumns.push({
      title: '',
      key: 'aksi',
      width: 70,
      render: (_, o) => (
        <Popconfirm
          title="Hapus kewajiban ini?"
          description="Riwayat pembayaran kewajiban ini ikut terhapus."
          okText="Ya, Hapus"
          cancelText="Batal"
          okButtonProps={{ loading: deleteObligation.isPending }}
          onConfirm={async () => {
            try {
              await deleteObligation.mutateAsync(o.id)
              message.success('Kewajiban dihapus')
            } catch (err) {
              message.error((err as Error).message)
            }
          }}
        >
          <Button type="text" size="small" danger icon={<DeleteOutlined />} title="Hapus kewajiban" />
        </Popconfirm>
      ),
    })
  }

  const node = (
    <Space size={8} wrap>
      <Tooltip title="Muat ulang">
        <Button icon={<ReloadOutlined />} onClick={refetch} />
      </Tooltip>
      <Tooltip title="Ekspor kewajiban">
        <Button icon={<ExportOutlined />} onClick={() => setExportOpen(true)} />
      </Tooltip>
      <Tooltip title="Buat kewajiban massal dari komponen">
        <span>
          <Button icon={<ThunderboltOutlined />} onClick={() => setGenerateOpen(true)} disabled={!canWrite}>
            Buat Kewajiban
          </Button>
        </span>
      </Tooltip>
      <Tooltip title="Tambah komponen biaya">
        <span>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setComponentModal({ open: true, initial: null })}
            disabled={!canWrite}
          >
            Tambah Komponen
          </Button>
        </span>
      </Tooltip>
    </Space>
  )
  const actions = useTabActions(active, node)

  return (
    <ShellItem>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <StatChip icon={<WalletOutlined />} label="Total Kewajiban" value={formatRupiah(summary.total)} loading={loading} />
        <StatChip icon={<ExportOutlined />} label="Terbayar" value={formatRupiah(summary.paid)} color="emerald" />
        <StatChip icon={<EditOutlined />} label="Tunggakan" value={formatRupiah(summary.outstanding)} color="rose" />
      </div>

      <Typography.Title level={5} style={{ marginBottom: 8 }}>
        Komponen Biaya
      </Typography.Title>
      <Table<SppComponent>
        rowKey="id"
        size="small"
        loading={componentsQuery.isPending}
        columns={componentColumns}
        dataSource={componentsQuery.data ?? []}
        pagination={false}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: 'Belum ada komponen. Tambah komponen lalu buat kewajiban massal.' }}
        style={{ marginBottom: 24 }}
      />

      <Typography.Title level={5} style={{ marginBottom: 8 }}>
        Kewajiban Santri
      </Typography.Title>
      <Space size={12} wrap style={{ marginBottom: 12 }}>
        <Segmented
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as Status | 'semua')}
          options={[
            { value: 'semua', label: 'Semua' },
            { value: 'belum', label: SPP_STATUS_META.belum.label },
            { value: 'kurang', label: SPP_STATUS_META.kurang.label },
            { value: 'lunas', label: SPP_STATUS_META.lunas.label },
          ]}
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
        columns={obligationColumns}
        dataSource={rows}
        pagination={{ pageSize: 15, showSizeChanger: false, showTotal: (t) => `${t} kewajiban` }}
        scroll={{ x: 'max-content' }}
        locale={
          isError
            ? { emptyText: 'Gagal memuat kewajiban — coba muat ulang.' }
            : { emptyText: 'Belum ada kewajiban. Gunakan "Buat Kewajiban" dari komponen biaya.' }
        }
      />

      <ComponentModal
        open={componentModal.open}
        initial={componentModal.initial}
        onClose={() => setComponentModal({ open: false, initial: null })}
        onSave={handleSaveComponent}
      />
      <GenerateObligationsModal open={generateOpen} onClose={() => setGenerateOpen(false)} />
      <KeuanganExportModal<SppObligation>
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Export Kewajiban SPP"
        filename="kewajiban-spp"
        auditTable="spp_obligations"
        rows={rows}
        columns={[
          { header: 'Santri', value: (o) => o.student?.name ?? '' },
          { header: 'Kelas', value: (o) => o.student?.class?.name ?? '' },
          { header: 'Komponen', value: (o) => o.component?.name ?? '' },
          { header: 'Periode', value: (o) => periodLabel(o.period ?? '') },
          { header: 'Nominal', value: (o) => o.amount },
          { header: 'Terbayar', value: (o) => o.paid ?? 0 },
          { header: 'Status', value: (o) => SPP_STATUS_META[obligationStatus({ amount: o.amount, paid: o.paid ?? 0 })].label },
        ]}
      />
      {actions}
    </ShellItem>
  )
}
