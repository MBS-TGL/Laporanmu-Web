import { useState } from 'react'
import { App, Button, Card, Input, Segmented, Select, Tooltip } from 'antd'
import { EnterOutlined, ExportOutlined, ScanOutlined } from '@ant-design/icons'
import { useDebounce } from '../../../shared/hooks/useDebounce'
import { useStudentsSearch } from '../../behavior/hooks'
import { fetchStudentByGateCode } from '../api'
import { useGateRecord } from '../hooks'
import type { GateDirection } from '../types'

const DIRECTION_SEGMENT = [
  { label: 'Masuk', value: 'entry', icon: <EnterOutlined /> },
  { label: 'Keluar', value: 'exit', icon: <ExportOutlined /> },
]

interface EntryCardProps {
  /** Arah aktif — dibagikan dengan modal scan agar mode konsisten */
  direction: GateDirection
  onDirectionChange: (d: GateDirection) => void
  onOpenScan: () => void
}

/**
 * Entry cepat pos gerbang: keyboard-first.
 * Ketik kode registrasi / NISN lalu Enter → langsung tercatat
 * dengan arah sesuai Segmented (guard duplikat di useGateRecord).
 */
export function EntryCard({ direction, onDirectionChange, onOpenScan }: EntryCardProps) {
  const { message } = App.useApp()

  const [code, setCode] = useState('')
  const [studentId, setStudentId] = useState<string>()
  const [studentSearch, setStudentSearch] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const debouncedStudentSearch = useDebounce(studentSearch)
  const studentsQuery = useStudentsSearch(debouncedStudentSearch)
  const record = useGateRecord()

  const selectedStudent = (studentsQuery.data ?? []).find((s) => s.id === studentId)

  const finish = (ok: boolean) => {
    if (ok) {
      setCode('')
      setStudentId(undefined)
      setStudentSearch('')
      setNote('')
    }
  }

  const recordStudent = async (
    student: { id: string; name: string; registration_code: string },
  ) => {
    setSubmitting(true)
    try {
      const ok = await record(
        {
          id: student.id,
          name: student.name,
          registration_code: student.registration_code,
          nisn: null,
          class_name: null,
        },
        direction,
        note || undefined,
      )
      finish(ok)
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Gagal mencatat log gerbang')
    } finally {
      setSubmitting(false)
    }
  }

  // Alur keyboard: Enter pada input kode → resolve → catat
  const handleCodeEnter = async () => {
    const raw = code.trim()
    if (!raw) {
      message.warning('Ketik kode registrasi atau NISN terlebih dahulu')
      return
    }
    setSubmitting(true)
    try {
      const student = await fetchStudentByGateCode(raw)
      if (!student) {
        message.error(`Kode "${raw}" tidak dikenali`)
        return
      }
      const ok = await record(student, direction, note || undefined)
      finish(ok)
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Gagal mencatat log gerbang')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSelectRecord = async () => {
    if (!studentId) {
      message.warning('Pilih siswa terlebih dahulu')
      return
    }
    await recordStudent({
      id: studentId,
      name: selectedStudent?.name ?? 'siswa',
      registration_code: selectedStudent?.registration_code ?? '',
    })
  }

  return (
    <Card style={{ marginBottom: 16 }} styles={{ body: { padding: '10px 14px' } }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Segmented
          options={DIRECTION_SEGMENT}
          value={direction}
          onChange={(v) => onDirectionChange(v as GateDirection)}
        />
        <Input
          placeholder="Ketik kode registrasi / NISN lalu Enter"
          allowClear
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onPressEnter={() => void handleCodeEnter()}
          style={{ flex: 1.4, minWidth: 200 }}
        />
        <Select
          showSearch
          placeholder="Atau cari nama siswa"
          filterOption={false}
          style={{ flex: 1.2, minWidth: 190 }}
          value={studentId}
          onSearch={setStudentSearch}
          onChange={setStudentId}
          loading={studentsQuery.isPending}
          allowClear
          options={(studentsQuery.data ?? []).map((s) => ({
            value: s.id,
            label: `${s.name} (${s.registration_code})`,
          }))}
        />
        <Input
          placeholder="Catatan (opsional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          style={{ flex: 1, minWidth: 140 }}
        />
        <Button
          type="primary"
          loading={submitting}
          onClick={() => void handleSelectRecord()}
        >
          Catat {direction === 'exit' ? 'Keluar' : 'Masuk'}
        </Button>
        <Tooltip title="Scan Kamera">
          <Button icon={<ScanOutlined />} onClick={onOpenScan} />
        </Tooltip>
      </div>
    </Card>
  )
}
