import { useState } from 'react'
import { App, Button, Card, Input, Select, Space, Spin } from 'antd'
import { EnterOutlined, ExportOutlined } from '@ant-design/icons'
import { useDebounce } from '../../../shared/hooks/useDebounce'
import { useStudentsSearch } from '../../behavior/hooks'
import { useCreateGateLog } from '../hooks'

export function EntryCard() {
  const { message } = App.useApp()
  const [studentId, setStudentId] = useState<string>()
  const [studentSearch, setStudentSearch] = useState('')
  const [note, setNote] = useState('')
  const debouncedStudentSearch = useDebounce(studentSearch)

  const studentsQuery = useStudentsSearch(debouncedStudentSearch)
  const createMutation = useCreateGateLog()

  const record = (direction: 'keluar' | 'masuk') => {
    if (!studentId) {
      message.warning('Pilih siswa terlebih dahulu')
      return
    }
    createMutation.mutate(
      { studentId, direction, note: note || undefined },
      {
        onSuccess: (log) => {
          message.success(
            `Berhasil dicatat: ${log.student?.name ?? 'siswa'} ${direction === 'keluar' ? 'keluar' : 'masuk'}`,
          )
          setStudentId(undefined)
          setStudentSearch('')
          setNote('')
        },
        onError: (err: Error) => message.error(err.message || 'Gagal mencatat log gerbang'),
      },
    )
  }

  return (
    <Card title="Catat Gerbang" style={{ marginBottom: 16 }}>
      <Space wrap size="middle">
        <Select
          showSearch
          placeholder="Cari nama atau kode registrasi siswa"
          filterOption={false}
          style={{ width: 300 }}
          value={studentId}
          onSearch={setStudentSearch}
          onChange={setStudentId}
          loading={studentsQuery.isPending}
          notFoundContent={studentsQuery.isPending ? <Spin size="small" /> : 'Tidak ditemukan'}
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
          style={{ width: 240 }}
        />
        <Button
          danger
          icon={<ExportOutlined />}
          loading={createMutation.isPending}
          onClick={() => record('keluar')}
        >
          Catat Keluar
        </Button>
        <Button
          type="primary"
          icon={<EnterOutlined />}
          loading={createMutation.isPending}
          onClick={() => record('masuk')}
        >
          Catat Masuk
        </Button>
      </Space>
    </Card>
  )
}
