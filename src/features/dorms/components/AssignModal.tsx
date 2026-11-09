import { useEffect, useMemo } from 'react'
import { Alert, Form, Select } from 'antd'
import { SwapOutlined, TeamOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { useDormRooms, usePlacementOptions } from '../hooks'
import type { DormRoom, Placement } from '../types'

export interface AssignModalProps {
  open: boolean
  /** Santri yang sudah dipilih sebelumnya (bulk dari tabel / pindah dari drawer) */
  initialStudentIds?: string[]
  /** Kamar tujuan tetap (tombol "Isi Santri" di drawer kamar) */
  fixedDormId?: string
  submitting?: boolean
  onCancel: () => void
  /** dormId null = kosongkan dari asrama */
  onSubmit: (studentIds: string[], dormId: string | null) => void
}

interface AssignFormValues {
  studentIds: string[]
  /** '' = kosongkan dari asrama */
  dormId: string
}

const GENDER_OF_ROOM: Record<string, 'L' | 'P'> = { male: 'L', female: 'P' }

/** Gender santri cocok dengan kamar? campur = bebas, santri tanpa gender = bebas */
function genderMatches(room: DormRoom, student: Placement): boolean {
  if (room.gender === null || room.gender === 'mixed') return true
  if (!student.gender) return true
  // Santri yang sudah berada di kamar ini tidak dinilai ulang (tidak berubah okupansi)
  if (student.dorm_id === room.id) return true
  return student.gender === GENDER_OF_ROOM[room.gender]
}

export function AssignModal({
  open,
  initialStudentIds,
  fixedDormId,
  submitting = false,
  onCancel,
  onSubmit,
}: AssignModalProps) {
  const [form] = Form.useForm<AssignFormValues>()
  const roomsQuery = useDormRooms()
  const studentsQuery = usePlacementOptions()

  const rooms = useMemo(() => roomsQuery.data ?? [], [roomsQuery.data])
  const students = useMemo(() => studentsQuery.data ?? [], [studentsQuery.data])

  const studentById = useMemo(
    () => new Map(students.map((s) => [s.id, s])),
    [students],
  )
  const roomById = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms])

  useEffect(() => {
    if (!open) return
    // Pindah satu santri: preset kamar asalnya supaya tinggal ganti tujuan
    const single = initialStudentIds?.length === 1 ? studentById.get(initialStudentIds[0]) : null
    form.setFieldsValue({
      studentIds: initialStudentIds ?? [],
      dormId: fixedDormId ?? single?.dorm_id ?? '',
    })
  }, [open, initialStudentIds, fixedDormId, form, studentById])

  const watchedIds = Form.useWatch('studentIds', form)
  const selectedIds = useMemo(() => watchedIds ?? [], [watchedIds])
  const dormId = Form.useWatch('dormId', form) ?? ''

  const selectedStudents = useMemo(
    () => selectedIds.map((id) => studentById.get(id)).filter((s): s is Placement => !!s),
    [selectedIds, studentById],
  )

  const targetRoom = dormId ? roomById.get(dormId) ?? null : null

  const remaining = targetRoom ? Math.max(0, targetRoom.capacity - targetRoom.occupied) : 0
  const newOccupants = selectedStudents.filter((s) => s.dorm_id !== dormId).length
  const overCapacity = !!targetRoom && newOccupants > remaining
  const genderMismatch = !!targetRoom && selectedStudents.some((s) => !genderMatches(targetRoom, s))

  const studentOptions = useMemo(
    () =>
      students.map((s) => ({
        value: s.id,
        label: `${s.name}${s.classes?.name ? ` · ${s.classes.name}` : ''}${
          s.gender ? ` · ${s.gender}` : ''
        }${s.dorms?.name ? ` · ${s.dorms.name}` : ''}`,
      })),
    [students],
  )

  const roomOptions = useMemo(() => {
    const opts = rooms.map((room) => {
      const remainingRoom = Math.max(0, room.capacity - room.occupied)
      const hasSelectedInside = selectedStudents.some((s) => s.dorm_id === room.id)
      const full = room.occupied >= room.capacity && !hasSelectedInside
      const mismatch = !selectedStudents.every((s) => genderMatches(room, s))
      return {
        value: room.id,
        label: `${room.name} — ${room.occupied}/${room.capacity}${
          remainingRoom > 0 ? ` (sisa ${remainingRoom})` : ' (penuh)'
        }`,
        disabled: full || mismatch,
      }
    })
    if (!fixedDormId) {
      opts.unshift({ value: '', label: '— Kosongkan dari asrama —', disabled: false })
    }
    return opts
  }, [rooms, selectedStudents, fixedDormId])

  const summary = useMemo(() => {
    if (selectedIds.length === 0) return 'Pilih santri terlebih dahulu'
    if (dormId === '') return `${selectedIds.length} santri akan dikosongkan dari asrama`
    const room = roomById.get(dormId)
    if (!room) return ' '
    return `${selectedIds.length} santri → ${room.name} (sisa kapasitas ${Math.max(
      0,
      room.capacity - room.occupied,
    )})`
  }, [selectedIds, dormId, roomById])

  const blocked = selectedIds.length === 0 || dormId === undefined || overCapacity || genderMismatch

  const handleFinish = (values: AssignFormValues) => {
    onSubmit(values.studentIds, values.dormId === '' ? null : values.dormId)
  }

  return (
    <AppModal
      title="Penempatan Santri"
      subtitle="Tempatkan santri ke kamar — kamar penuh dan gender yang tidak sesuai otomatis dinonaktifkan"
      icon={<TeamOutlined />}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      okText="Simpan Penempatan"
      okButtonProps={{ disabled: blocked }}
      confirmLoading={submitting}
      width={560}
      destroyOnHidden
    >
      <Form<AssignFormValues>
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        disabled={submitting}
      >
        <Form.Item
          name="studentIds"
          label="Santri"
          rules={[{ required: true, message: 'Pilih minimal satu santri' }]}
        >
          <Select
            mode="multiple"
            showSearch
            allowClear
            optionFilterProp="label"
            placeholder="Cari nama santri…"
            options={studentOptions}
            loading={studentsQuery.isLoading}
            maxTagCount="responsive"
          />
        </Form.Item>

        <Form.Item name="dormId" label="Kamar Tujuan" required>
          <Select
            showSearch
            optionFilterProp="label"
            options={roomOptions}
            loading={roomsQuery.isLoading}
            disabled={!!fixedDormId}
            placeholder="Pilih kamar…"
          />
        </Form.Item>
      </Form>

      {overCapacity && (
        <Alert
          type="error"
          showIcon
          message="Kapasitas tidak cukup"
          description={`${newOccupants} santri baru akan masuk, sisa kapasitas ${remaining}. Kurangi pilihan atau pilih kamar lain.`}
          style={{ marginTop: 4 }}
        />
      )}
      {genderMismatch && !overCapacity && (
        <Alert
          type="error"
          showIcon
          message="Gender tidak sesuai"
          description="Ada santri yang gendernya berbeda dengan ketentuan kamar tujuan."
          style={{ marginTop: 4 }}
        />
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginTop: 12,
          fontSize: 12.5,
          color: '#64748b',
        }}
      >
        <SwapOutlined style={{ color: '#94a3b8' }} />
        {summary}
      </div>
    </AppModal>
  )
}
