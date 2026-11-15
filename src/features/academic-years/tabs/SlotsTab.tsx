import { useMemo, useState } from 'react'
import { App, Button, Popconfirm, Card, Empty, Select, Space, Table, Tag, Tooltip, theme, type TableColumnsType } from 'antd'
import {
  ClockCircleOutlined,
  CoffeeOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons'
import { StatChip } from '../../../shared/components/StatChip'
import { useTabActions } from '../../../shared/components/ActionsSlot'
import { ShortcutsModal } from '../../../shared/components/ShortcutsModal'
import { useShortcuts, type ShortcutItem } from '../../../shared/hooks/useShortcuts'
import { usePermissions } from '../../../shared/hooks/useProfile'
import {
  useAcademicYears,
  useCreateDefaultTimeSlots,
  useCreateTimeSlot,
  useDeleteTimeSlot,
  useTimeSlots,
  useUpdateTimeSlot,
} from '../hooks'
import { SlotForm } from '../components/SlotForm'
import type { TimeSlot, SlotFormValues } from '../types'

function durationMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return eh * 60 + em - (sh * 60 + sm)
}

/** Tab "Slot Jam" — kelola slot jam KBM per tahun ajaran (tabel time_slots). */
export function SlotsTab({ active }: { active: boolean }) {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const { canWrite, canDelete } = usePermissions()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<TimeSlot | null>(null)

  // Pemilih tahun akademik — default: periode aktif
  const yearsQuery = useAcademicYears({ page: 1, pageSize: 1000 })
  const years = useMemo(() => yearsQuery.data?.data ?? [], [yearsQuery.data])
  const activeYear = useMemo(() => years.find((y) => y.is_active) ?? years[0], [years])
  const [yearId, setYearId] = useState<string | undefined>()
  const selectedYearId = yearId ?? activeYear?.id
  const selectedYear = years.find((y) => y.id === selectedYearId)

  const slotsQuery = useTimeSlots(selectedYearId)
  const slots = useMemo(() => slotsQuery.data ?? [], [slotsQuery.data])

  const createMutation = useCreateTimeSlot(selectedYearId ?? '')
  const updateMutation = useUpdateTimeSlot()
  const deleteMutation = useDeleteTimeSlot()
  const presetMutation = useCreateDefaultTimeSlots(selectedYearId ?? '')

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (slot: TimeSlot) => {
    setEditing(slot)
    setFormOpen(true)
  }

  const handleSubmit = (values: SlotFormValues) => {
    const onError = (err: Error) => message.error(err.message || 'Gagal menyimpan slot jam')
    if (editing) {
      updateMutation.mutate(
        { id: editing.id, values },
        {
          onSuccess: () => {
            message.success('Slot jam diperbarui')
            setFormOpen(false)
          },
          onError,
        },
      )
    } else {
      createMutation.mutate(values, {
        onSuccess: () => {
          message.success('Slot jam ditambahkan')
          setFormOpen(false)
        },
        onError,
      })
    }
  }

  const handleDelete = (slot: TimeSlot) => {
    deleteMutation
      .mutateAsync(slot.id)
      .then(() => message.success('Slot jam dihapus'))
      .catch((err: Error) => message.error(err.message || 'Gagal menghapus'))
  }

  const handlePreset = () => {
    presetMutation.mutate(undefined, {
      onSuccess: (count) => message.success(`${count} slot standar dibuat`),
      onError: (err: Error) => message.error(err.message || 'Gagal membuat slot standar'),
    })
  }

  const isBlocked = formOpen || !active

  const shortcutItems: ShortcutItem[] = [
    {
      keys: ['N'],
      label: 'Tambah slot',
      group: 'Aksi',
      icon: <PlusOutlined />,
      when: canWrite && Boolean(selectedYearId),
      run: openCreate,
    },
    {
      keys: ['R'],
      label: 'Muat ulang data',
      group: 'Tampilan',
      icon: <ReloadOutlined />,
      run: () => void slotsQuery.refetch(),
    },
    {
      keys: ['?'],
      label: 'Toggle palet shortcut',
      group: 'Tampilan',
      icon: <ThunderboltOutlined />,
      run: () => shortcuts.toggle(),
    },
  ]

  const shortcuts = useShortcuts({ items: shortcutItems, isBlocked })

  const kbCount = slots.filter((s) => !s.is_break).length
  const breakCount = slots.length - kbCount

  const columns: TableColumnsType<TimeSlot> = [
    {
      title: 'Urutan',
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 90,
      render: (v: number) => <span style={{ fontWeight: 600 }}>{v}</span>,
    },
    {
      title: 'Nama Slot',
      dataIndex: 'name',
      key: 'name',
      render: (_, row: TimeSlot) => (
        <Space size={6}>
          <span style={{ fontWeight: 600 }}>{row.name}</span>
          {row.is_break && (
            <Tag color="orange" icon={<CoffeeOutlined />} style={{ borderRadius: 6 }}>
              Non-KBM
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Mulai',
      dataIndex: 'start_time',
      key: 'start_time',
      width: 100,
      responsive: ['sm'] as const,
    },
    {
      title: 'Selesai',
      dataIndex: 'end_time',
      key: 'end_time',
      width: 100,
      responsive: ['sm'] as const,
    },
    {
      title: 'Durasi',
      key: 'duration',
      width: 110,
      responsive: ['md'] as const,
      render: (_, row: TimeSlot) => `${durationMinutes(row.start_time, row.end_time)} menit`,
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 110,
      render: (_, row: TimeSlot) =>
        canWrite || canDelete ? (
          <Space size={0}>
            {canWrite && (
              <Tooltip title="Edit">
                <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(row)} />
              </Tooltip>
            )}
            {canDelete && (
              <Popconfirm
                title={`Hapus "${row.name}"?`}
                description="Slot akan ditandai terhapus (soft delete). Jadwal yang memakai slot ini tidak berubah."
                okText="Ya, Hapus"
                okButtonProps={{ danger: true, loading: deleteMutation.isPending }}
                cancelText="Batal"
                onConfirm={() => handleDelete(row)}
              >
                <Button type="text" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            )}
          </Space>
        ) : (
          <span style={{ color: token.colorTextQuaternary }}>—</span>
        ),
    },
  ]

  const tabActions = useTabActions(
    active,
    <Space wrap>
      <Select
        placeholder="Tahun akademik"
        style={{ minWidth: 190 }}
        value={selectedYearId}
        onChange={setYearId}
        loading={yearsQuery.isPending}
        options={years.map((y) => ({ value: y.id, label: y.name }))}
      />
      {canWrite && slots.length === 0 && selectedYearId && (
        <Popconfirm
          title="Buat slot standar?"
          description="Sholat Dhuha sampai Sholat Ashar, 7 jam KBM (07.00–15.30). Bisa diubah setelahnya."
          okText="Buat"
          cancelText="Batal"
          onConfirm={handlePreset}
        >
          <Button icon={<ThunderboltOutlined />} loading={presetMutation.isPending}>
            Buat Preset
          </Button>
        </Popconfirm>
      )}
      <Tooltip title="Muat ulang (R)">
        <Button icon={<ReloadOutlined spin={slotsQuery.isFetching} />} onClick={() => void slotsQuery.refetch()} />
      </Tooltip>
      <Tooltip title="Shortcut keyboard (?)">
        <Button icon={<QuestionCircleOutlined />} onClick={shortcuts.open} />
      </Tooltip>
      {canWrite && selectedYearId && (
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Tambah Slot
        </Button>
      )}
    </Space>,
  )

  return (
    <div>
      {/* Aksi tab di ujung kanan tab bar — portal via ActionsSlot */}
      {tabActions}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <StatChip
          icon={<ClockCircleOutlined />}
          label="Total Slot"
          value={slots.length}
          color="indigo"
          loading={slotsQuery.isPending}
        />
        <StatChip
          icon={<ClockCircleOutlined />}
          label="Jam KBM"
          value={kbCount}
          color="emerald"
          loading={slotsQuery.isPending}
        />
        <StatChip
          icon={<CoffeeOutlined />}
          label="Non-KBM"
          value={breakCount}
          color="amber"
          loading={slotsQuery.isPending}
        />
      </div>

      <Card>
        <Table<TimeSlot>
          rowKey="id"
          columns={columns}
          dataSource={slots}
          loading={slotsQuery.isPending}
          pagination={false}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  selectedYearId
                    ? 'Belum ada slot jam untuk periode ini — buat preset atau tambahkan manual'
                    : 'Pilih tahun akademik terlebih dulu'
                }
              />
            ),
          }}
          scroll={{ x: true }}
        />
      </Card>

      <SlotForm
        open={formOpen}
        academicYearName={selectedYear?.name}
        slot={editing}
        submitting={createMutation.isPending || updateMutation.isPending}
        onCancel={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />

      <ShortcutsModal open={shortcuts.isOpen} onClose={shortcuts.close} sections={shortcuts.sections} />
    </div>
  )
}
