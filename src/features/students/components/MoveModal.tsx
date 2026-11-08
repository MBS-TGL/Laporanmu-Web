import { useMemo, useState } from 'react'
import { App, Alert, Select, Space, Tag, Typography } from 'antd'
import { RiseOutlined, SwapOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { useBulkMoveClassStudents, type ClassBrief } from '../hooks'
import type { Student } from '../types'

/** Level kelas dari nama — "8A" → 8, "Iqra 2" → 2, "Al-Ulum" → null */
function classLevel(name: string | undefined): number | null {
  if (!name) return null
  const match = /\d+/.exec(name)
  return match ? Number(match[0]) : null
}

interface MoveModalProps {
  open: boolean
  onClose: () => void
  /** Siswa terpilih yang akan dipindahkan */
  students: Student[]
  classes: ClassBrief[]
  /** Dipanggil setelah sukses — halaman membersihkan seleksi */
  onMoved: () => void
}

export function MoveModal({ open, onClose, students, classes, onMoved }: MoveModalProps) {
  const { message } = App.useApp()
  const [targetClassId, setTargetClassId] = useState<string>()
  const moveMutation = useBulkMoveClassStudents()

  const target = classes.find((c) => c.id === targetClassId)

  // Ringkas kelas asal — "7A (3), 8B (2)"
  const originSummary = useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of students) {
      const name = s.classes?.name ?? 'Tanpa kelas'
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
    return [...counts.entries()].map(([name, count]) => ({ name, count }))
  }, [students])

  const levelComparison = useMemo(() => {
    if (!target) return null
    const targetLevel = classLevel(target.name)
    if (targetLevel === null) return null
    let down = 0
    let same = 0
    let comparable = 0
    for (const s of students) {
      const origin = classLevel(s.classes?.name)
      if (origin === null) continue
      comparable += 1
      if (origin > targetLevel) down += 1
      else if (origin === targetLevel) same += 1
    }
    return { targetLevel, down, same, comparable }
  }, [target, students])

  const handleSubmit = () => {
    if (!targetClassId || students.length === 0) return
    moveMutation.mutate(
      { ids: students.map((s) => s.id), classId: targetClassId },
      {
        onSuccess: () => {
          message.success(`${students.length} siswa dipindahkan ke ${target?.name ?? 'kelas tujuan'}`)
          onMoved()
          onClose()
        },
        onError: (err: Error) => message.error(err.message || 'Gagal memindahkan siswa'),
      },
    )
  }

  return (
    <AppModal
      open={open}
      onCancel={onClose}
      width={520}
      title="Pindah Kelas Massal"
      subtitle={`${students.length} siswa terpilih — pindahkan ke satu kelas tujuan`}
      icon={<SwapOutlined />}
      okText="Pindahkan"
      okButtonProps={{ disabled: !targetClassId, loading: moveMutation.isPending }}
      onOk={handleSubmit}
    >
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        <div>
          <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
            Kelas tujuan
          </Typography.Text>
          <Select
            showSearch
            placeholder="Pilih kelas tujuan"
            style={{ width: '100%' }}
            value={targetClassId}
            onChange={setTargetClassId}
            optionFilterProp="label"
            options={classes.map((c) => ({ value: c.id, label: c.name }))}
          />
        </div>

        <div>
          <Typography.Text strong style={{ display: 'block', marginBottom: 6 }}>
            Kelas asal
          </Typography.Text>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {originSummary.map((o) => (
              <Tag key={o.name} style={{ borderRadius: 6 }}>
                {o.name} <span style={{ fontWeight: 700 }}>×{o.count}</span>
              </Tag>
            ))}
          </div>
        </div>

        {levelComparison && (
          <Alert
            type={levelComparison.down > 0 ? 'warning' : 'info'}
            showIcon
            icon={levelComparison.down > 0 ? <SwapOutlined /> : <RiseOutlined />}
            message={
              levelComparison.down > 0
                ? `${levelComparison.down} siswa akan turun level kelas`
                : levelComparison.same === levelComparison.comparable
                  ? `Semua siswa tinggal di level ${levelComparison.targetLevel}`
                  : `Naik ke level ${levelComparison.targetLevel}`
            }
            description={
              levelComparison.down > 0
                ? 'Pastikan kelas tujuan sudah benar — perpindahan turun level biasanya tidak disengaja.'
                : levelComparison.same === levelComparison.comparable
                  ? 'Perpindahan tetap berlaku (mis. pergantian rombel).'
                  : 'Perpindahan antar-level biasanya dilakukan saat kenaikan kelas.'
            }
            style={{ borderRadius: 10 }}
          />
        )}
      </Space>
    </AppModal>
  )
}
