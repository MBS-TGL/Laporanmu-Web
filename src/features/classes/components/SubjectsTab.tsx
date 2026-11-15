import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  App,
  Button,
  Empty,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  theme,
  type TableColumnsType,
} from 'antd'
import {
  DeleteOutlined,
  SaveOutlined,
} from '@ant-design/icons'
import { usePermissions } from '../../../shared/hooks/useProfile'
import { useSubjectsBrief } from '../../subjects/hooks'
import { useTeachersBriefForClasses } from '../hooks'
import { useClassSubjects, useSaveClassSubjects } from '../hooks'
import type { ClassRow, ClassSubjectRow } from '../types'

interface SubjectsTabProps {
  cls: ClassRow
}

interface EditRow {
  key: string // subject_id as key
  subject_id: string
  subject_name: string
  subject_code: string | null
  subject_kkm: number | null
  weekly_hours: number
  teacher_id: string | null
  kkm_override: number | null
  isNew?: boolean
}

export function SubjectsTab({ cls }: SubjectsTabProps) {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const { canWrite } = usePermissions()

  const academicYearId = cls.academic_year_id ?? undefined
  const classSubjectsQuery = useClassSubjects(cls.id, academicYearId)
  const saveMutation = useSaveClassSubjects()
  const subjectsQuery = useSubjectsBrief()
  const teachersQuery = useTeachersBriefForClasses()

  const [editRows, setEditRows] = useState<EditRow[]>([])
  const [dirty, setDirty] = useState(false)

  // Build edit rows from fetched data
  useEffect(() => {
    if (!classSubjectsQuery.data) return
    const rows: EditRow[] = classSubjectsQuery.data.map((cs) => ({
      key: cs.subject_id,
      subject_id: cs.subject_id,
      subject_name: cs.subjects?.name ?? '—',
      subject_code: cs.subjects?.code ?? null,
      subject_kkm: cs.subjects?.kkm ?? null,
      weekly_hours: cs.subjects?.weekly_hours ?? 0,
      teacher_id: cs.teacher_id,
      kkm_override: cs.kkm_override,
    }))
    setEditRows(rows)
    setDirty(false)
  }, [classSubjectsQuery.data])

  const assignedSubjectIds = useMemo(
    () => new Set(editRows.map((r) => r.subject_id)),
    [editRows],
  )

  const availableSubjects = useMemo(
    () => (subjectsQuery.data ?? []).filter((s) => !assignedSubjectIds.has(s.id)),
    [subjectsQuery.data, assignedSubjectIds],
  )

  const teacherOptions = useMemo(
    () =>
      (teachersQuery.data ?? []).map((t) => ({
        value: t.id,
        label: t.name,
      })),
    [teachersQuery.data],
  )

  const handleAddSubject = useCallback(
    (subjectId: string) => {
      const subject = (subjectsQuery.data ?? []).find((s) => s.id === subjectId)
      if (!subject) return
      setEditRows((prev) => [
        ...prev,
        {
          key: subject.id,
          subject_id: subject.id,
          subject_name: subject.name,
          subject_code: subject.code,
          subject_kkm: null,
          weekly_hours: subject.weekly_hours,
          teacher_id: null,
          kkm_override: null,
          isNew: true,
        },
      ])
      setDirty(true)
    },
    [subjectsQuery.data],
  )

  const handleRemove = useCallback((subjectId: string) => {
    setEditRows((prev) => prev.filter((r) => r.subject_id !== subjectId))
    setDirty(true)
  }, [])

  const handleTeacherChange = useCallback((subjectId: string, teacherId: string | null) => {
    setEditRows((prev) =>
      prev.map((r) => (r.subject_id === subjectId ? { ...r, teacher_id: teacherId } : r)),
    )
    setDirty(true)
  }, [])

  const handleKkmChange = useCallback((subjectId: string, kkm: number | null) => {
    setEditRows((prev) =>
      prev.map((r) => (r.subject_id === subjectId ? { ...r, kkm_override: kkm } : r)),
    )
    setDirty(true)
  }, [])

  const handleSave = () => {
    if (!academicYearId) {
      message.warning('Kelas ini belum memiliki tahun akademik')
      return
    }
    const rows: ClassSubjectRow[] = editRows.map((r) => ({
      subject_id: r.subject_id,
      teacher_id: r.teacher_id,
      kkm_override: r.kkm_override,
    }))
    saveMutation.mutate(
      { classId: cls.id, academicYearId, rows },
      {
        onSuccess: () => {
          message.success('Mapel kelas berhasil disimpan')
          setDirty(false)
        },
        onError: (err: Error) =>
          message.error(err.message || 'Gagal menyimpan mapel kelas'),
      },
    )
  }

  const columns: TableColumnsType<EditRow> = [
    {
      title: 'Mata Pelajaran',
      key: 'subject',
      render: (_, row) => (
        <div>
          <span style={{ fontWeight: 500 }}>{row.subject_name}</span>
          {row.subject_code && (
            <Tag style={{ marginLeft: 6, borderRadius: 6, fontSize: 11 }}>
              {row.subject_code}
            </Tag>
          )}
          {row.isNew && (
            <Tag color="green" style={{ marginLeft: 4, fontSize: 10 }}>
              Baru
            </Tag>
          )}
          <div style={{ fontSize: 11.5, color: token.colorTextTertiary }}>
            {row.weekly_hours} JP/minggu
          </div>
        </div>
      ),
    },
    {
      title: 'Guru Pengampu',
      key: 'teacher',
      width: 200,
      render: (_, row) =>
        canWrite ? (
          <Select
            size="small"
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Pilih guru"
            style={{ width: '100%' }}
            options={teacherOptions}
            value={row.teacher_id ?? undefined}
            onChange={(v) => handleTeacherChange(row.subject_id, v ?? null)}
            loading={teachersQuery.isPending}
          />
        ) : (
          <span>
            {teacherOptions.find((t) => t.value === row.teacher_id)?.label ?? (
              <span style={{ color: token.colorTextTertiary }}>Belum ditentukan</span>
            )}
          </span>
        ),
    },
    {
      title: 'KKM',
      key: 'kkm',
      width: 80,
      align: 'center',
      render: (_, row) =>
        canWrite ? (
          <InputNumber
            size="small"
            min={0}
            max={100}
            precision={0}
            placeholder={String(row.subject_kkm ?? 50)}
            value={row.kkm_override}
            onChange={(v) => handleKkmChange(row.subject_id, v)}
            style={{ width: '100%' }}
          />
        ) : (
          <span>{row.kkm_override ?? row.subject_kkm ?? 50}</span>
        ),
    },
    ...(canWrite
      ? [
          {
            title: '',
            key: 'actions',
            width: 40,
            render: (_: unknown, row: EditRow) => (
              <Popconfirm
                title="Hapus mapel dari kelas ini?"
                onConfirm={() => handleRemove(row.subject_id)}
                okText="Hapus"
                cancelText="Batal"
              >
                <Tooltip title="Hapus">
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                </Tooltip>
              </Popconfirm>
            ),
          } as TableColumnsType<EditRow>[number],
        ]
      : []),
  ]

  if (!academicYearId) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="Kelas ini belum memiliki tahun akademik — atur di form Edit Kelas"
      />
    )
  }

  return (
    <div>
      {canWrite && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="+ Tambah mapel"
            style={{ flex: '1 1 200px', minWidth: 180 }}
            value={undefined}
            onChange={handleAddSubject}
            loading={subjectsQuery.isPending}
            options={availableSubjects.map((s) => ({
              value: s.id,
              label: `${s.name}${s.code ? ` (${s.code})` : ''}`,
            }))}
            notFoundContent={
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Semua mapel sudah ditambahkan"
              />
            }
          />
          {dirty && (
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saveMutation.isPending}
              onClick={handleSave}
            >
              Simpan
            </Button>
          )}
        </div>
      )}

      <Table<EditRow>
        rowKey="key"
        size="small"
        columns={columns}
        dataSource={editRows}
        loading={classSubjectsQuery.isPending}
        pagination={false}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Belum ada mapel di kelas ini"
            >
              {canWrite && (
                <Space direction="vertical" size={4}>
                  <span style={{ fontSize: 12, color: token.colorTextTertiary }}>
                    Tambahkan mapel dari dropdown di atas
                  </span>
                </Space>
              )}
            </Empty>
          ),
        }}
      />

      {editRows.length > 0 && (
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            color: token.colorTextTertiary,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>
            {editRows.length} mapel · {editRows.reduce((s, r) => s + r.weekly_hours, 0)} JP/minggu
          </span>
          <span>
            {editRows.filter((r) => !r.teacher_id).length > 0 && (
              <Tag color="warning">
                {editRows.filter((r) => !r.teacher_id).length} mapel belum ada guru
              </Tag>
            )}
          </span>
        </div>
      )}
    </div>
  )
}
