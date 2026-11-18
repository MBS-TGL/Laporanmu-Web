import { useMemo, useState } from 'react'
import {
  Button,
  Card,
  Empty,
  Input,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  theme,
  type TableColumnsType,
} from 'antd'
import {
  BookOutlined,
  DownloadOutlined,
  EditOutlined,
  SearchOutlined,
  TeamOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import Papa from 'papaparse'
import { StatChip } from '../../shared/components/StatChip'
import { useTabActions } from '../../shared/components/ActionsSlot'
import { usePermissions } from '../../shared/hooks/useProfile'
import { useTablePagination } from '../../shared/hooks/useTablePagination'
import { useAcademicYearsBrief } from '../classes/hooks'
import { useClassSubjectsByYear } from '../classes/hooks'
import { useTeachers } from './hooks'
import { AssignModal } from './components/AssignModal'
import type { Teacher } from './types'

interface TeacherLoadRow {
  teacherId: string
  teacherName: string
  subjectName: string | null
  assignments: {
    classId: string
    className: string
    subjectId: string
    subjectName: string
    weeklyHours: number
  }[]
  totalHours: number
  classCount: number
}

interface ClassCoverageRow {
  classId: string
  className: string
  grade: string | null
  subjects: {
    subjectId: string
    subjectName: string
    teacherName: string | null
    weeklyHours: number
  }[]
  missingTeacherCount: number
  totalHours: number
}

export function LoadPage({ active }: { active: boolean }) {
  const { token } = theme.useToken()
  const { canWrite } = usePermissions()

  const yearsQuery = useAcademicYearsBrief()
  const activeYear = useMemo(
    () => yearsQuery.data?.find((y) => y.is_active) ?? yearsQuery.data?.[0],
    [yearsQuery.data],
  )
  const [selectedYearId, setSelectedYearId] = useState<string | undefined>()
  const effectiveYearId = selectedYearId ?? activeYear?.id

  const [viewMode, setViewMode] = useState<'teacher' | 'class'>('teacher')
  const [search, setSearch] = useState('')
  const [assignTeacher, setAssignTeacher] = useState<Teacher | null>(null)

  const csQuery = useClassSubjectsByYear(effectiveYearId)
  const classSubjects = csQuery.data ?? []

  const teachersQuery = useTeachers({ page: 1, pageSize: 1000 })
  const allTeachers = teachersQuery.data?.data ?? []

  // Agregasi Per Guru
  const teacherRows: TeacherLoadRow[] = useMemo(() => {
    const map = new Map<string, TeacherLoadRow>()

    // Init semua guru aktif
    for (const t of allTeachers) {
      if (t.status !== 'active') continue
      map.set(t.id, {
        teacherId: t.id,
        teacherName: t.name,
        subjectName: t.subject,
        assignments: [],
        totalHours: 0,
        classCount: 0,
      })
    }

    // Isi dari class_subjects
    for (const cs of classSubjects) {
      if (!cs.teacher_id) continue
      const entry = map.get(cs.teacher_id)
      if (entry) {
        const hours = cs.subjects?.weekly_hours ?? 0
        entry.assignments.push({
          classId: cs.class_id,
          className: cs.classes?.name ?? '—',
          subjectId: cs.subject_id,
          subjectName: cs.subjects?.name ?? '—',
          weeklyHours: hours,
        })
        entry.totalHours += hours
        entry.classCount += 1
      }
    }

    return [...map.values()].sort((a, b) => b.totalHours - a.totalHours || a.teacherName.localeCompare(b.teacherName, 'id'))
  }, [allTeachers, classSubjects])

  // Agregasi Per Kelas
  const classRows: ClassCoverageRow[] = useMemo(() => {
    const map = new Map<string, ClassCoverageRow>()

    for (const cs of classSubjects) {
      const clsName = cs.classes?.name ?? '—'
      const entry = map.get(cs.class_id) ?? {
        classId: cs.class_id,
        className: clsName,
        grade: cs.classes?.grade ?? null,
        subjects: [],
        missingTeacherCount: 0,
        totalHours: 0,
      }

      const hours = cs.subjects?.weekly_hours ?? 0
      entry.subjects.push({
        subjectId: cs.subject_id,
        subjectName: cs.subjects?.name ?? '—',
        teacherName: cs.teachers?.name ?? null,
        weeklyHours: hours,
      })
      entry.totalHours += hours
      if (!cs.teacher_id) entry.missingTeacherCount += 1

      map.set(cs.class_id, entry)
    }

    return [...map.values()].sort((a, b) => a.className.localeCompare(b.className, 'id'))
  }, [classSubjects])

  const filteredTeacherRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return teacherRows
    return teacherRows.filter(
      (r) =>
        r.teacherName.toLowerCase().includes(q) ||
        (r.subjectName && r.subjectName.toLowerCase().includes(q)) ||
        r.assignments.some((a) => a.subjectName.toLowerCase().includes(q) || a.className.toLowerCase().includes(q)),
    )
  }, [teacherRows, search])

  const filteredClassRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return classRows
    return classRows.filter(
      (r) =>
        r.className.toLowerCase().includes(q) ||
        r.subjects.some((s) => s.subjectName.toLowerCase().includes(q) || (s.teacherName && s.teacherName.toLowerCase().includes(q))),
    )
  }, [classRows, search])

  const pgTeacher = useTablePagination(filteredTeacherRows.length, { label: 'guru', defaultPageSize: 20 })
  const pgClass = useTablePagination(filteredClassRows.length, { label: 'kelas', defaultPageSize: 20 })

  const stats = useMemo(() => {
    const teachingCount = teacherRows.filter((r) => r.totalHours > 0).length
    const idleCount = teacherRows.filter((r) => r.totalHours === 0).length
    const totalSchoolHours = teacherRows.reduce((s, r) => s + r.totalHours, 0)
    const missingTeachersTotal = classRows.reduce((s, r) => s + r.missingTeacherCount, 0)
    return { teachingCount, idleCount, totalSchoolHours, missingTeachersTotal }
  }, [teacherRows, classRows])

  const handleExportCsv = () => {
    if (viewMode === 'teacher') {
      const header = ['Nama Guru', 'Mapel Utama', 'Total JP/Minggu', 'Jumlah Kelas', 'Daftar Kelas & Mapel']
      const data = filteredTeacherRows.map((r) => [
        r.teacherName,
        r.subjectName ?? '-',
        r.totalHours,
        r.classCount,
        r.assignments.map((a) => `${a.subjectName} (${a.className})`).join('; '),
      ])
      const csv = Papa.unparse({ fields: header, data })
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `beban-mengajar-guru-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } else {
      const header = ['Kelas', 'Tingkat', 'Total JP', 'Mapel Belum Ada Guru', 'Rincian Mapel']
      const data = filteredClassRows.map((r) => [
        r.className,
        r.grade ?? '-',
        r.totalHours,
        r.missingTeacherCount,
        r.subjects.map((s) => `${s.subjectName}: ${s.teacherName ?? 'BELUM ADA GURU'}`).join('; '),
      ])
      const csv = Papa.unparse({ fields: header, data })
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cakupan-mapel-kelas-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const teacherColumns: TableColumnsType<TeacherLoadRow> = [
    {
      title: 'Guru',
      key: 'teacher',
      render: (_, r) => (
        <div>
          <span style={{ fontWeight: 600 }}>{r.teacherName}</span>
          {r.subjectName && (
            <div style={{ fontSize: 11.5, color: token.colorTextTertiary }}>
              Mapel: {r.subjectName}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Beban Mengajar',
      key: 'assignments',
      render: (_, r) =>
        r.assignments.length === 0 ? (
          <span style={{ color: token.colorTextTertiary }}>Belum ada jam mengajar</span>
        ) : (
          <Space wrap size={4}>
            {r.assignments.map((a, i) => (
              <Tag key={i}>
                <b>{a.subjectName}</b> — {a.className} ({a.weeklyHours} JP)
              </Tag>
            ))}
          </Space>
        ),
    },
    {
      title: 'Kelas',
      dataIndex: 'classCount',
      key: 'classes',
      width: 90,
      align: 'center',
      render: (v: number) => v || '—',
    },
    {
      title: 'Total JP',
      dataIndex: 'totalHours',
      key: 'hours',
      width: 100,
      align: 'center',
      render: (v: number) => (
        <span style={{ fontWeight: 700, fontSize: 13 }}>
          {v > 0 ? `${v} JP` : <span style={{ color: token.colorTextTertiary }}>0 JP</span>}
        </span>
      ),
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 90,
      align: 'right',
      render: (_, r) => {
        const teacherObj = allTeachers.find((t) => t.id === r.teacherId)
        return (
          canWrite && (
            <Tooltip title="Atur Beban Mengajar">
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => setAssignTeacher(teacherObj ?? null)}
              >
                Atur
              </Button>
            </Tooltip>
          )
        )
      },
    },
  ]

  const classColumns: TableColumnsType<ClassCoverageRow> = [
    {
      title: 'Kelas',
      key: 'class',
      width: 160,
      render: (_, r) => (
        <div>
          <span style={{ fontWeight: 600 }}>{r.className}</span>
          {r.grade && <Tag style={{ marginLeft: 6, fontSize: 11 }}>Tingkat {r.grade}</Tag>}
          <div style={{ fontSize: 11.5, color: token.colorTextTertiary }}>
            {r.totalHours} JP/minggu
          </div>
        </div>
      ),
    },
    {
      title: 'Mapel & Guru Pengampu',
      key: 'subjects',
      render: (_, r) => (
        <Space wrap size={6}>
          {r.subjects.map((s, i) => (
            <Tag key={i} color={s.teacherName ? undefined : 'warning'}>
              <b>{s.subjectName}</b>: {s.teacherName ?? 'Belum ada guru'}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: 'Status Guru',
      key: 'status',
      width: 150,
      align: 'center',
      render: (_, r) =>
        r.missingTeacherCount === 0 ? (
          <Tag color="success">Lengkap</Tag>
        ) : (
          <Tag color="warning" icon={<WarningOutlined />}>
            {r.missingTeacherCount} belum ada guru
          </Tag>
        ),
    },
  ]

  // Aksi halaman di ujung kanan tab bar (judul & subtitle dirender shell TeachersPage)
  const tabActions = useTabActions(
    active,
    <Space wrap>
      <Select
        style={{ width: 170 }}
        value={effectiveYearId}
        onChange={setSelectedYearId}
        loading={yearsQuery.isPending}
        options={(yearsQuery.data ?? []).map((y) => ({
          value: y.id,
          label: `${y.name}${y.is_active ? ' (Aktif)' : ''}`,
        }))}
      />
      <Tooltip title="Ekspor beban mengajar (CSV)">
        <Button icon={<DownloadOutlined />} onClick={handleExportCsv} />
      </Tooltip>
    </Space>,
  )

  return (
    <div>
      {/* Judul & subtitle dirender shell TeachersPage (di atas tab bar); aksi halaman di ujung kanan tab bar */}
      {tabActions}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <StatChip
          icon={<TeamOutlined />}
          label="Guru Mengajar"
          value={stats.teachingCount}
          color="indigo"
          loading={teachersQuery.isPending || csQuery.isPending}
        />
        <StatChip
          icon={<BookOutlined />}
          label="Total JP Sekolah"
          value={`${stats.totalSchoolHours} JP`}
          color="emerald"
          loading={csQuery.isPending}
        />
        <StatChip
          icon={<TeamOutlined />}
          label="Guru Tanpa Jam"
          value={stats.idleCount}
          color={stats.idleCount > 0 ? 'amber' : 'slate'}
          loading={teachersQuery.isPending || csQuery.isPending}
        />
        <StatChip
          icon={<WarningOutlined />}
          label="Mapel Belum Ada Guru"
          value={stats.missingTeachersTotal}
          color={stats.missingTeachersTotal > 0 ? 'rose' : 'slate'}
          loading={csQuery.isPending}
        />
      </div>

      <Card>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 14,
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <Segmented
            value={viewMode}
            onChange={(v) => setViewMode(v as 'teacher' | 'class')}
            options={[
              { label: 'Beban Per Guru', value: 'teacher', icon: <TeamOutlined /> },
              { label: 'Cakupan Per Kelas', value: 'class', icon: <BookOutlined /> },
            ]}
          />
          <Input
            placeholder={
              viewMode === 'teacher'
                ? 'Cari nama guru, mapel, atau kelas…'
                : 'Cari nama kelas atau mapel…'
            }
            prefix={<SearchOutlined />}
            allowClear
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 280 }}
          />
        </div>

        {viewMode === 'teacher' ? (
          <Table<TeacherLoadRow>
            rowKey="teacherId"
            size="middle"
            columns={teacherColumns}
            dataSource={filteredTeacherRows}
            loading={teachersQuery.isPending || csQuery.isPending}
            pagination={pgTeacher.pagination}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="Tidak ada data beban mengajar"
                />
              ),
            }}
            scroll={{ x: true }}
          />
        ) : (
          <Table<ClassCoverageRow>
            rowKey="classId"
            size="middle"
            columns={classColumns}
            dataSource={filteredClassRows}
            loading={csQuery.isPending}
            pagination={pgClass.pagination}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="Tidak ada kelas pada tahun ajaran ini"
                />
              ),
            }}
            scroll={{ x: true }}
          />
        )}
      </Card>

      <AssignModal
        open={!!assignTeacher}
        teacher={assignTeacher}
        academicYear={yearsQuery.data?.find((y) => y.id === effectiveYearId) ?? null}
        onClose={() => setAssignTeacher(null)}
      />
    </div>
  )
}
