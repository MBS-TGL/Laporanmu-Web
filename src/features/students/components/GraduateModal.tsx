import { useMemo, useState } from 'react'
import { App, Alert, InputNumber, Space, Tag, Typography } from 'antd'
import { SafetyCertificateOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { AppModal } from '../../../shared/components/AppModal'
import { useGraduateStudentsBulk } from '../hooks'
import type { Student } from '../types'

interface GraduateModalProps {
  open: boolean
  onClose: () => void
  /** Siswa terpilih yang akan diluluskan */
  students: Student[]
  /** Dipanggil setelah sukses — halaman membersihkan seleksi */
  onGraduated: () => void
}

export function GraduateModal({ open, onClose, students, onGraduated }: GraduateModalProps) {
  const { message } = App.useApp()
  const [graduationYear, setGraduationYear] = useState<number | null>(dayjs().year())
  const graduateMutation = useGraduateStudentsBulk()

  // Ringkas kelas asal — "9C (12), 9A (3)"
  const originSummary = useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of students) {
      const name = s.classes?.name ?? 'Tanpa kelas'
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
    return [...counts.entries()].map(([name, count]) => ({ name, count }))
  }, [students])

  const alreadyGraduated = students.filter((s) => s.status === 'graduated').length

  const handleSubmit = () => {
    if (!graduationYear || students.length === 0) return
    graduateMutation.mutate(
      { ids: students.map((s) => s.id), graduationYear },
      {
        onSuccess: () => {
          message.success(`${students.length} siswa diluluskan pada tahun ${graduationYear}`)
          onGraduated()
          onClose()
        },
        onError: (err: Error) => message.error(err.message || 'Gagal meluluskan siswa'),
      },
    )
  }

  return (
    <AppModal
      open={open}
      onCancel={onClose}
      width={520}
      title="Luluskan Siswa"
      subtitle={`${students.length} siswa terpilih — status akan menjadi Lulus`}
      icon={<SafetyCertificateOutlined />}
      okText={`Luluskan (${students.length})`}
      okButtonProps={{ disabled: !graduationYear, loading: graduateMutation.isPending }}
      onOk={handleSubmit}
    >
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        <div>
          <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
            Tahun lulus
          </Typography.Text>
          <InputNumber
            style={{ width: 160 }}
            min={1980}
            max={2200}
            value={graduationYear}
            onChange={(v) => setGraduationYear(v)}
            formatter={(v) => (v ? String(v).replace(/\D/g, '') : '')}
            parser={(v) => (v ? Number(v.replace(/\D/g, '')) : 0)}
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

        <Alert
          type="warning"
          showIcon
          icon={<SafetyCertificateOutlined />}
          message="Kelas & asrama siswa akan dikosongkan"
          description="Siswa pindah ke daftar Alumni dengan kelas terakhir tercatat. Riwayat poin, raport, dan log gerbang tetap tersimpan. Arsip asrama/kelas otomatis bersih."
          style={{ borderRadius: 10 }}
        />

        {alreadyGraduated > 0 && (
          <Alert
            type="info"
            showIcon
            message={`${alreadyGraduated} siswa sudah berstatus Lulus — tahun & tanggal kelulusannya akan diperbarui.`}
            style={{ borderRadius: 10 }}
          />
        )}
      </Space>
    </AppModal>
  )
}
