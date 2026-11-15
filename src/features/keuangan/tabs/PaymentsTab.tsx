import { useMemo, useState } from 'react'
import { App, Button, Popconfirm, Space, Table, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DeleteOutlined, ExportOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { ShellItem } from '../../../shared/components/ShellMotion'
import { StatChip } from '../../../shared/components/StatChip'
import { useTabActions } from '../../../shared/components/ActionsSlot'
import { usePermissions } from '../../../shared/hooks/useProfile'
import { useDeleteSppPayment, useSppWithPayments } from '../hooks'
import { formatRupiah, periodLabel } from '../sppUtil'
import { METHOD_LABEL, type SppPayment } from '../types'
import { PaymentModal } from '../components/PaymentModal'
import { KeuanganExportModal } from '../components/KeuanganExportModal'

/** Tab Pembayaran: riwayat pembayaran SPP + input kas masuk. */
export function PaymentsTab({ active }: { active: boolean }) {
  const { message } = App.useApp()
  const { canWrite, canDelete } = usePermissions()
  const { payments, loading, isError, refetch } = useSppWithPayments()
  const deletePayment = useDeleteSppPayment()

  const [modalOpen, setModalOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)

  const total = useMemo(() => payments.reduce((s, p) => s + p.amount, 0), [payments])

  const columns: ColumnsType<SppPayment> = [
    { title: 'Tanggal', width: 110, render: (_, p) => p.paid_at },
    {
      title: 'Santri',
      render: (_, p) => p.obligation?.student?.name ?? '-',
    },
    { title: 'Kelas', width: 140, render: (_, p) => p.obligation?.student?.class?.name ?? '-' },
    {
      title: 'Komponen',
      width: 150,
      render: (_, p) =>
        p.obligation?.component?.name ?? '-',
    },
    { title: 'Periode', width: 100, render: (_, p) => periodLabel(p.obligation?.period ?? '') },
    {
      title: 'Nominal',
      width: 130,
      align: 'right',
      render: (_, p) => <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{formatRupiah(p.amount)}</span>,
    },
    { title: 'Metode', width: 100, render: (_, p) => METHOD_LABEL[p.method] ?? p.method },
    { title: 'Petugas', width: 130, render: (_, p) => p.creator?.name ?? '-' },
    { title: 'Catatan', render: (_, p) => p.note ?? '—' },
  ]

  if (canDelete) {
    columns.push({
      title: '',
      key: 'aksi',
      width: 70,
      render: (_, p) => (
        <Popconfirm
          title="Hapus catatan pembayaran ini?"
          description="Tunggakan santri akan bertambah kembali."
          okText="Ya, Hapus"
          cancelText="Batal"
          okButtonProps={{ loading: deletePayment.isPending }}
          onConfirm={async () => {
            try {
              await deletePayment.mutateAsync(p.id)
              message.success('Catatan pembayaran dihapus')
            } catch (err) {
              message.error((err as Error).message)
            }
          }}
        >
          <Button type="text" size="small" danger icon={<DeleteOutlined />} title="Hapus pembayaran" />
        </Popconfirm>
      ),
    })
  }

  const node = (
    <Space size={8} wrap>
      <Tooltip title="Muat ulang">
        <Button icon={<ReloadOutlined />} onClick={refetch} />
      </Tooltip>
      <Tooltip title="Ekspor pembayaran">
        <Button icon={<ExportOutlined />} onClick={() => setExportOpen(true)} />
      </Tooltip>
      <Tooltip title="Catat pembayaran SPP">
        <span>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)} disabled={!canWrite}>
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
        <StatChip icon={<ExportOutlined />} label="Total Pemasukan" value={formatRupiah(total)} loading={loading} />
        <StatChip icon={<PlusOutlined />} label="Transaksi" value={payments.length} color="sky" />
      </div>

      <Table<SppPayment>
        rowKey="id"
        size="middle"
        loading={loading}
        columns={columns}
        dataSource={payments}
        pagination={{ pageSize: 15, showSizeChanger: false, showTotal: (t) => `${t} pembayaran` }}
        scroll={{ x: 'max-content' }}
        locale={
          isError
            ? { emptyText: 'Gagal memuat pembayaran — coba muat ulang.' }
            : { emptyText: 'Belum ada pembayaran tercatat. Gunakan "Catat Pembayaran".' }
        }
      />

      <PaymentModal open={modalOpen} onClose={() => setModalOpen(false)} />
      <KeuanganExportModal<SppPayment>
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Export Pembayaran SPP"
        filename="pembayaran-spp"
        auditTable="spp_payments"
        rows={payments}
        columns={[
          { header: 'Tanggal', value: (p) => p.paid_at },
          { header: 'Santri', value: (p) => p.obligation?.student?.name ?? '' },
          { header: 'Kelas', value: (p) => p.obligation?.student?.class?.name ?? '' },
          { header: 'Komponen', value: (p) => p.obligation?.component?.name ?? '' },
          { header: 'Periode', value: (p) => periodLabel(p.obligation?.period ?? '') },
          { header: 'Nominal', value: (p) => p.amount },
          { header: 'Metode', value: (p) => METHOD_LABEL[p.method] ?? p.method },
          { header: 'Petugas', value: (p) => p.creator?.name ?? '' },
        ]}
      />
      {actions}
    </ShellItem>
  )
}
