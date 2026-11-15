import { useEffect, useState } from 'react'
import { Input } from 'antd'
import { FileTextOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import type { GridStudent } from '../../../shared/components/AttendanceGrid'

interface NoteModalProps {
  noteTarget: GridStudent | null
  /** Catatan gabungan (tersimpan + draf) yang jadi nilai awal. */
  initialNote: string
  onCancel: () => void
  onSave: (text: string) => void
}

/** Modal catatan per santri — ikut tombol Simpan Perubahan (masuk draf). */
export function NoteModal({ noteTarget, initialNote, onCancel, onSave }: NoteModalProps) {
  const [value, setValue] = useState('')

  // Seed ulang tiap kali target berubah (bukan tiap ketikan)
  useEffect(() => {
    if (noteTarget) setValue(initialNote)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteTarget])

  return (
    <AppModal
      open={noteTarget !== null}
      onCancel={onCancel}
      onOk={() => onSave(value)}
      title={noteTarget ? `Catatan (${noteTarget.name})` : 'Catatan'}
      subtitle="Catatan tersimpan per bulan & sesi, ikut tombol Simpan Perubahan"
      icon={<FileTextOutlined />}
      okText="Tambahkan ke Draf"
    >
      <Input.TextArea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Contoh: sering izin karena jadwal dokter, koordinasikan dengan wali."
        autoSize={{ minRows: 3, maxRows: 8 }}
        maxLength={500}
        showCount
      />
    </AppModal>
  )
}
