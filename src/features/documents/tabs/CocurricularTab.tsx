import { useMemo, useState } from 'react'
import { App, Button, Card, Empty, Input, Select, Space, Table, Tag, Typography, type TableColumnsType } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import { usePermissions } from '../../../shared/hooks/useProfile'
import { useTablePagination } from '../../../shared/hooks/useTablePagination'
import { useActiveAcademicYear, useCocurricularDims, useCocurricularScores, useSaveCocurricularScores } from '../hooks'
import { useReportCardClasses, useReportCardStudents } from '../../report-cards/hooks'
import {
  COCURRICULAR_PREDICATES,
  type CocurricularPredicate,
  type CocurricularScoreInput,
} from '../api'

type Semester = 'Odd' | 'Even'

/** Grid santri x dimensi untuk memasukkan predikat kokurikuler. */
export function CocurricularTab({ active }: { active: boolean }) {
  const { message } = App.useApp()
  const { canWrite } = usePermissions()

  const [classId, setClassId] = useState<string | undefined>()
  const [semester, setSemester] = useState<Semester>('Odd')
  /** Kunci `${studentId}:${dimId}` → predikat & deskripsi lokal */
  const [drafts, setDrafts] = useState<Map<string, { predicate: CocurricularPredicate; description: string }>>(new Map())

  const activeYear = useActiveAcademicYear()
  const ayId = activeYear.data?.id

  const classesQuery = useReportCardClasses()
  const studentsQuery = useReportCardStudents(classId)
  const dimsQuery = useCocurricularDims()
  const scoresQuery = useCocurricularScores(classId, ayId, semester)
  const saveMutation = useSaveCocurricularScores()

  const dims = useMemo(() => dimsQuery.data ?? [], [dimsQuery.data])
  const students = useMemo(() => studentsQuery.data ?? [], [studentsQuery.data])

  const savedByCell = useMemo(() => {
    const map = new Map<string, { predicate: CocurricularPredicate; description: string | null }>()
    for (const row of scoresQuery.data ?? []) {
      map.set(`${row.student_id}:${row.dim_id}`, { predicate: row.predicate as CocurricularPredicate, description: row.description })
    }
    return map
  }, [scoresQuery.data])

  const cellValue = (studentId: string, dimId: string) => {
    const draft = drafts.get(`${studentId}:${dimId}`)
    if (draft) return draft
    const saved = savedByCell.get(`${studentId}:${dimId}`)
    if (saved) return { predicate: saved.predicate, description: saved.description ?? '' }
    return null
  }

  const setCell = (studentId: string, dimId: string, patch: Partial<{ predicate: CocurricularPredicate; description: string }>) => {
    const key = `${studentId}:${dimId}`
    const current = cellValue(studentId, dimId) ?? { predicate: 'Baik' as CocurricularPredicate, description: '' }
    setDrafts((prev) => new Map(prev).set(key, { ...current, ...patch }))
  }

  const dirtyCount = drafts.size

  const handleSave = () => {
    if (!ayId) {
      message.warning('Tahun ajaran aktif belum ditentukan')
      return
    }
    const rows: CocurricularScoreInput[] = []
    for (const [key, value] of drafts) {
      const [studentId, dimId] = key.split(':')
      rows.push({
        student_id: studentId,
        dim_id: dimId,
        academic_year_id: ayId,
        semester,
        predicate: value.predicate,
        description: value.description.trim() || null,
      })
    }
    saveMutation.mutate(rows, {
      onSuccess: () => {
        message.success(`${rows.length} nilai kokurikuler tersimpan`)
        setDrafts(new Map())
      },
      onError: (err: Error) => message.error(err.message || 'Gagal menyimpan nilai kokurikuler'),
    })
  }

  const columns: TableColumnsType<{ id: string; name: string; registration_code?: string }> = [
    {
      title: 'Santri',
      key: 'name',
      fixed: 'left',
      width: 200,
      render: (_, s) => (
        <div>
          <div style={{ fontWeight: 600 }}>{s.name}</div>
          {s.registration_code && (
            <div style={{ fontSize: 11.5, color: '#888' }}>{s.registration_code}</div>
          )}
        </div>
      ),
    },
    ...dims.map((dim) => ({
      title: dim.name,
      key: dim.id,
      width: 190,
      render: (_: unknown, s: { id: string; name: string }) => {
        const value = cellValue(s.id, dim.id)
        return (
          <div style={{ display: 'grid', gap: 4 }}>
            <Select
              size="small"
              placeholder="Pilih predikat"
              value={value?.predicate}
              options={COCURRICULAR_PREDICATES.map((p) => ({ value: p, label: p }))}
              disabled={!canWrite || !active}
              onChange={(p) => setCell(s.id, dim.id, { predicate: p })}
              aria-label={`Predikat ${dim.name} untuk ${s.name}`}
            />
            <Input
              size="small"
              placeholder="Deskripsi (opsional)"
              value={value?.description ?? ''}
              disabled={!canWrite || !active}
              onChange={(e) => setCell(s.id, dim.id, { description: e.target.value })}
              aria-label={`Deskripsi ${dim.name} untuk ${s.name}`}
            />
          </div>
        )
      },
    })),
  ]

  const pg = useTablePagination(students.length, { label: 'santri', defaultPageSize: 15 })

  if (activeYear.isPending) {
    return <Typography.Text type="secondary">Memuat tahun ajaran…</Typography.Text>
  }
  if (!ayId) {
    return <Empty description="Belum ada tahun ajaran aktif. Aktifkan satu di menu Tahun Akademik." />
  }
  if (dims.length === 0) {
    return <Empty description="Belum ada dimensi kokurikuler. Tambahkan di tab Dimensi Kokurikuler." />
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Card styles={{ body: { padding: '12px 16px' } }}>
        <Space wrap size={10} align="center">
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Pilih kelas"
            style={{ minWidth: 180 }}
            value={classId}
            options={(classesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            onChange={(v) => {
              setClassId(v)
              setDrafts(new Map())
            }}
            aria-label="Pilih kelas"
          />
          <Select
            style={{ width: 120 }}
            value={semester}
            options={[{ value: 'Odd', label: 'Semester Ganjil' }, { value: 'Even', label: 'Semester Genap' }]}
            onChange={(v) => {
              setSemester(v as Semester)
              setDrafts(new Map())
            }}
            aria-label="Pilih semester"
          />
          <Tag color={dirtyCount > 0 ? 'orange' : 'default'}>{dirtyCount} perubahan belum disimpan</Tag>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            disabled={!canWrite || dirtyCount === 0}
            loading={saveMutation.isPending}
          >
            Simpan
          </Button>
        </Space>
        <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
          Pilih kelas lalu isi predikat tiap dimensi. Nilai tersimpan per semester dan tahun ajaran aktif.
        </Typography.Text>
      </Card>

      {!classId ? (
        <Empty description="Pilih kelas untuk mulai mengisi nilai kokurikuler" />
      ) : studentsQuery.isError ? (
        <Card>
          <Typography.Text type="secondary">Gagal memuat santri kelas ini.</Typography.Text>
          <div style={{ marginTop: 8 }}>
            <Button size="small" onClick={() => void studentsQuery.refetch()}>
              Coba lagi
            </Button>
          </div>
        </Card>
      ) : (
        <Table
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={students}
          loading={studentsQuery.isPending}
          pagination={pg.pagination}
          scroll={{ x: 'max-content' }}
          locale={{
            emptyText: <Empty description="Tidak ada santri aktif di kelas ini" />,
          }}
        />
      )}
    </div>
  )
}
