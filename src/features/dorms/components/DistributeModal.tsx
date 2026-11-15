import { useMemo, useState } from 'react'
import { Alert, App, Empty, Radio, Table, Tag, Typography, type TableColumnsType } from 'antd'
import { DeploymentUnitOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { useDistributeStudents, useDormRooms, usePlacementOptions } from '../hooks'
import { distributeStudents } from '../dormDistribute'

interface DistributeModalProps {
  open: boolean
  onClose: () => void
}

/**
 * Distribusi otomatis: santri yang belum ditempatkan dimasukkan ke kamar aktif
 * yang masih bersisa slot, menghormati gender (lihat dormDistribute.ts).
 * Preview dihitung ulang setiap modal terbuka — data live diambil saat itu.
 */
/** Lingkup santri yang didistribusikan — default hanya kelas Boarding */
type DistributeScope = 'boarding' | 'all'

const isBoardingClass = (className: string | null | undefined) =>
  (className ?? '').toLowerCase().includes('boarding')

export function DistributeModal({ open, onClose }: DistributeModalProps) {
  const { message } = App.useApp()
  const [scope, setScope] = useState<DistributeScope>('boarding')
  const roomsQuery = useDormRooms()
  const studentsQuery = usePlacementOptions()
  const distributeMutation = useDistributeStudents()

  const unplacedAll = useMemo(
    () => (studentsQuery.data ?? []).filter((s) => !s.dorm_id),
    [studentsQuery.data],
  )
  // Skema DB tidak punya kolom tipe kelas — kelas Boarding dikenali dari
  // nama kelas yang mengandung "boarding" (konvensi penamaan sekolah)
  const unplaced = useMemo(
    () =>
      scope === 'all'
        ? unplacedAll
        : unplacedAll.filter((s) => isBoardingClass(s.classes?.name)),
    [unplacedAll, scope],
  )
  const result = useMemo(
    () => distributeStudents(roomsQuery.data ?? [], unplaced),
    [roomsQuery.data, unplaced],
  )

  const totalIncoming = result.preview.reduce((sum, r) => sum + r.incoming, 0)

  const columns: TableColumnsType<(typeof result.preview)[number]> = [
    {
      title: 'Kamar',
      dataIndex: 'roomName',
      key: 'roomName',
      render: (v: string) => <Typography.Text strong>{v}</Typography.Text>,
    },
    {
      title: 'Sebelum',
      dataIndex: 'occupiedBefore',
      key: 'occupiedBefore',
      width: 110,
      align: 'center',
      render: (v: number, row) => `${v}/${row.capacity}`,
    },
    {
      title: 'Masuk',
      dataIndex: 'incoming',
      key: 'incoming',
      width: 90,
      align: 'center',
      render: (v: number) => <Tag color="green">+{v}</Tag>,
    },
    {
      title: 'Setelah',
      dataIndex: 'occupiedAfter',
      key: 'occupiedAfter',
      width: 110,
      align: 'center',
      render: (v: number, row) => {
        const full = v >= row.capacity
        return (
          <Typography.Text strong type={full ? 'warning' : undefined}>
            {v}/{row.capacity}
            {full && ' · penuh'}
          </Typography.Text>
        )
      },
    },
  ]

  const handleApply = () => {
    distributeMutation.mutate(
      { assignments: result.assignments },
      {
        onSuccess: (moved) => {
          onClose()
          message.success(`${moved} santri berhasil didistribusikan ke kamar`)
        },
        onError: (err: Error) => message.error(err.message || 'Gagal menerapkan distribusi'),
      },
    )
  }

  const mutationError = distributeMutation.error as Error | null

  return (
    <AppModal
      title="Distribusi Otomatis"
      subtitle="Bagi santri kelas Boarding yang belum ditempatkan ke kamar bersisa, gender dijaga otomatis"
      icon={<DeploymentUnitOutlined />}
      open={open}
      onCancel={onClose}
      onOk={handleApply}
      okText={`Terapkan (${totalIncoming} santri)`}
      okButtonProps={{ disabled: result.assignments.length === 0 }}
      confirmLoading={distributeMutation.isPending}
      width={640}
      destroyOnHidden
      maskClosable={false}
    >
      {studentsQuery.isPending || roomsQuery.isPending ? (
        <Empty description="Memuat data…" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 24 }} />
      ) : unplacedAll.length === 0 ? (
        <Empty
          description="Semua santri sudah ditempatkan, tidak ada yang perlu didistribusikan"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ padding: 24 }}
        />
      ) : unplaced.length === 0 ? (
        <Empty
          description={`Tidak ada santri kelas Boarding yang belum ditempatkan (${unplacedAll.length} santri belum ditempatkan di luar lingkup ini)`}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ padding: 24 }}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Radio.Group
              size="small"
              optionType="button"
              buttonStyle="solid"
              value={scope}
              onChange={(e) => setScope(e.target.value as DistributeScope)}
              options={[
                { value: 'boarding', label: 'Kelas Boarding saja' },
                { value: 'all', label: 'Semua santri' },
              ]}
            />
            <Typography.Text>
              <b>{unplaced.length}</b> santri belum ditempatkan → diusulkan masuk ke{' '}
              <b>{result.preview.length}</b> kamar ({totalIncoming} santri terdistribusi).
            </Typography.Text>
          </div>

          {result.unplaced.length > 0 && (
            <Alert
              type="warning"
              showIcon
              message={`${result.unplaced.length} santri tidak kebagian slot`}
              description={`Kapasitas kamar yang tersedia tidak cukup: ${result.unplaced
                .slice(0, 8)
                .map((s) => s.name)
                .join(', ')}${result.unplaced.length > 8 ? '…' : ''}`}
            />
          )}

          <Table
            rowKey="roomId"
            size="small"
            columns={columns}
            dataSource={result.preview}
            pagination={{ pageSize: 8, showSizeChanger: false, hideOnSinglePage: true }}
            scroll={{ y: 320 }}
          />

          {mutationError && (
            <Alert type="error" showIcon message={mutationError.message || 'Gagal menerapkan distribusi'} />
          )}
        </div>
      )}
    </AppModal>
  )
}
