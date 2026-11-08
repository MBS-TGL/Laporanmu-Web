import { useState } from 'react'
import { Alert, App, Button, Input, Select, Tooltip, Typography } from 'antd'
import { ClearOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { useClassesBrief, useResetPoints, useStudentStats } from '../hooks'
import { useClassSizes } from '../../classes/hooks'

const { Text } = Typography

interface ResetModalProps {
  open: boolean
  onClose: () => void
  /** kelas yang sedang difilter di halaman (nilai awal) */
  defaultClassId?: string
}

/** Reset seluruh poin siswa (awal semester) — per kelas atau semua kelas */
export function ResetModal({ open, onClose, defaultClassId }: ResetModalProps) {
  const { message } = App.useApp()
  const classesQuery = useClassesBrief()
  const resetMutation = useResetPoints()
  const statsQuery = useStudentStats()
  const sizesQuery = useClassSizes()
  const [classId, setClassId] = useState<string | null>(defaultClassId ?? null)
  const [confirmation, setConfirmation] = useState('')

  const ready = confirmation.trim().toUpperCase() === 'RESET'

  // Blast radius — jumlah siswa yang terkena sesuai cakupan, terlihat
  // SEBELUM konfirmasi (bukan baru setelah reset selesai)
  const affectedCount = classId
    ? (sizesQuery.data ?? []).find((s) => s.class_id === classId)?.total
    : statsQuery.data?.total
  const scopeLabel = classId
    ? ((classesQuery.data ?? []).find((c) => c.id === classId)?.name ?? 'kelas terpilih')
    : 'Semua kelas'

  // reset form setiap kali modal dibuka (pola penyesuaian state saat render)
  const [prevOpen, setPrevOpen] = useState(false)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setClassId(defaultClassId ?? null)
      setConfirmation('')
    }
  }

  const handleReset = () => {
    resetMutation.mutate(classId, {
      onSuccess: (count) => {
        message.success(`Poin ${count} siswa berhasil direset`)
        onClose()
      },
      onError: (err: Error) => message.error(err.message || 'Gagal mereset poin'),
    })
  }

  return (
    <AppModal
      open={open}
      onCancel={onClose}
      width={480}
      icon={<ClearOutlined />}
      title="Reset Poin"
      subtitle="Bersihkan semua poin untuk semester baru"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose}>Batal</Button>
          <Tooltip title={ready ? '' : 'Ketik RESET untuk mengaktifkan tombol'}>
            <span style={{ display: 'inline-flex' }}>
              <Button
                danger
                type="primary"
                disabled={!ready}
                loading={resetMutation.isPending}
                onClick={handleReset}
              >
                Reset Poin
              </Button>
            </span>
          </Tooltip>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Alert
          type="warning"
          showIcon
          message="Tindakan ini tidak dapat dibatalkan"
          description={
            affectedCount !== undefined ? (
              <span>
                Poin <Text strong>{affectedCount} siswa</Text> pada <Text strong>{scopeLabel}</Text> akan
                diubah menjadi 0. Riwayat laporan perilaku tidak ikut dihapus.
              </span>
            ) : (
              'Semua poin siswa pada cakupan yang dipilih akan diubah menjadi 0. Riwayat laporan perilaku tidak ikut dihapus.'
            )
          }
        />

        <div>
          <Text strong style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>
            Cakupan
          </Text>
          <Select
            style={{ width: '100%' }}
            value={classId}
            onChange={setClassId}
            placeholder="Pilih cakupan reset"
            loading={classesQuery.isPending}
            options={[
              { value: null, label: 'Semua kelas' },
              ...(classesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </div>

        <div>
          <Text strong style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>
            Konfirmasi
          </Text>
          <Input
            placeholder="Ketik RESET untuk mengonfirmasi"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </div>
      </div>
    </AppModal>
  )
}
