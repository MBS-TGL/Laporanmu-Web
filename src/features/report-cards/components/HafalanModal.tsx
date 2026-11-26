import { useState } from 'react'
import { Input, Typography } from 'antd'
import { AppModal } from '../../../shared/components/AppModal'
import { ModalFooter } from '../../../shared/components/ModalFooter'
import type { ReportCardStudent } from '../types'

interface HafalanModalProps {
  open: boolean
  student: ReportCardStudent | null
  initialValue?: string
  onClose: () => void
  onSave: (studentId: string, value: string) => void
}

/** Catatan hafalan di luar Juz 30-26 (mis. "Juz 30–25, 1–5") untuk ujian lisan. */
export function HafalanModal({ open, student, initialValue, onClose, onSave }: HafalanModalProps) {
  const [value, setValue] = useState('')
  // Pulihkan isi saat modal dibuka (pola adjust-state-during-render, bukan effect).
  const [syncedOpen, setSyncedOpen] = useState(false)
  if (open !== syncedOpen) {
    setSyncedOpen(open)
    if (open) setValue(initialValue ?? '')
  }

  const handleSave = () => {
    if (!student) return
    onSave(student.id, value.trim())
    onClose()
  }

  return (
    <AppModal
      open={open}
      title="Hafalan di Luar Juz 30–26"
      subtitle={student?.name ?? ''}
      size="md"
      onCancel={onClose}
      destroyOnHidden
      footer={
        <ModalFooter onCancel={onClose} onOk={handleSave} okText="Simpan ke Draf" />
      }
    >
      <Typography.Paragraph type="secondary" style={{ fontSize: 12.5, marginTop: 0 }}>
        Rentang hafalan lain yang belum tercakup baris Juz 30–26. Kosongkan bila tidak ada.
      </Typography.Paragraph>
      <Input.TextArea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        rows={3}
        maxLength={200}
        placeholder="mis. Juz 30–25, 1–5"
        aria-label="Hafalan di luar Juz 30-26"
      />
    </AppModal>
  )
}
