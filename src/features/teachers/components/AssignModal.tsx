import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { App, Checkbox, Empty, Select, Tag, theme } from 'antd'
import { BookOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { ModalNotice } from '../../../shared/components/ModalNotice'
import { supabase } from '../../../lib/supabase'
import { useAcademicYearsBrief } from '../../classes/hooks'
import {
  useClassSubjectsByYear,
  useSaveTeacherAssignments,
} from '../../classes/hooks'
import { useSubjectsBrief } from '../../subjects/hooks'
import type { Teacher } from '../types'

interface AssignModalProps {
  open: boolean
  teacher: Teacher | null
  /** Tahun ajaran aktif dari drawer — opsional; dihitung sendiri jika tak ada */
  academicYear?: { id: string; name: string } | null
  onClose: () => void
}

interface ClassBrief {
  id: string
  name: string
  grade: string | null
  major: string | null
}

/**
 * Bulk assign mapel dari sisi guru: pilih mapel → centang kelas-kelas
 * yang diampu → simpan (semua tersimpan di class_subjects per kelas).
 * Kelas yang sudah dipegang guru lain tetap bisa diambil alih (warning).
 */
export function AssignModal({
  open,
  teacher,
  academicYear,
  onClose,
}: AssignModalProps) {
  const { message } = App.useApp()
  const { token } = theme.useToken()

  const yearsQuery = useAcademicYearsBrief()
  const activeYear =
    academicYear ??
    yearsQuery.data?.find((y) => y.is_active) ??
    yearsQuery.data?.[0] ??
    undefined

  const subjectsQuery = useSubjectsBrief()
  const byYearQuery = useClassSubjectsByYear(activeYear?.id)
  const saveMutation = useSaveTeacherAssignments()

  const classesQuery = useQuery({
    queryKey: ['classes', 'brief', activeYear?.id],
    enabled: open && !!activeYear,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name, grade, major')
        .eq('academic_year_id', activeYear!.id)
        .is('deleted_at', null)
        .order('name')
      if (error) throw error
      return (data ?? []) as ClassBrief[]
    },
  })

  const [subjectId, setSubjectId] = useState<string | undefined>()
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [openKey, setOpenKey] = useState('')
  const [dbKey, setDbKey] = useState('')

  // Reset saat modal dibuka (adjust state saat render, bukan effect)
  const currentOpenKey = `${open}:${teacher?.id ?? ''}`
  if (currentOpenKey !== openKey) {
    setOpenKey(currentOpenKey)
    setSubjectId(undefined)
    setChecked(new Set())
  }

  // Auto-saran mapel dari field subject guru (best effort, pencocokan nama)
  if (open && teacher && !subjectId && subjectsQuery.data?.length) {
    const match = subjectsQuery.data.find((s) => s.name === teacher.subject)
    if (match) setSubjectId(match.id)
  }

  // Sinkronkan checkbox dengan keadaan DB untuk mapel terpilih
  const dbRows =
    subjectId && teacher
      ? (byYearQuery.data ?? []).filter(
          (cs) => cs.subject_id === subjectId && cs.teacher_id === teacher.id,
        )
      : []
  const currentDbKey = `${subjectId ?? ''}:${teacher?.id ?? ''}:${dbRows.map((r) => r.class_id).join(',')}`
  if (currentDbKey !== dbKey) {
    setDbKey(currentDbKey)
    setChecked(new Set(dbRows.map((r) => r.class_id)))
  }

  // teacher_id per kelas untuk mapel terpilih (guru lain = warning)
  const occupiedBy = useMemo(() => {
    const map = new Map<string, { teacherId: string; teacherName: string }>()
    if (!subjectId) return map
    for (const cs of byYearQuery.data ?? []) {
      if (cs.subject_id === subjectId && cs.teacher_id) {
        map.set(cs.class_id, {
          teacherId: cs.teacher_id,
          teacherName: cs.teachers?.name ?? 'Guru lain',
        })
      }
    }
    return map
  }, [subjectId, byYearQuery.data])

  const groupedClasses = useMemo(() => {
    const map = new Map<string, ClassBrief[]>()
    for (const c of classesQuery.data ?? []) {
      const g = c.grade ?? 'Tanpa tingkat'
      if (!map.has(g)) map.set(g, [])
      map.get(g)!.push(c)
    }
    return [...map.entries()].sort(
      (a, b) => Number(a[0]) - Number(b[0]) || a[0].localeCompare(b[0], 'id'),
    )
  }, [classesQuery.data])

  // Daftar perubahan yang akan dikirim (diff terhadap keadaan DB)
  const pendingChanges = useMemo(() => {
    if (!subjectId || !teacher) return []
    const rows: { class_id: string; subject_id: string; assigned: boolean }[] = []
    for (const cls of classesQuery.data ?? []) {
      const owner = occupiedBy.get(cls.id)
      const isMine = owner?.teacherId === teacher.id
      const want = checked.has(cls.id)
      if (want && !isMine) rows.push({ class_id: cls.id, subject_id: subjectId, assigned: true })
      else if (!want && isMine)
        rows.push({ class_id: cls.id, subject_id: subjectId, assigned: false })
    }
    return rows
  }, [subjectId, teacher, classesQuery.data, occupiedBy, checked])

  const overwriteCount = pendingChanges.filter((c) => c.assigned && occupiedBy.has(c.class_id))
    .length

  const handleSave = () => {
    if (!teacher || !activeYear || pendingChanges.length === 0) return
    saveMutation.mutate(
      { teacherId: teacher.id, academicYearId: activeYear.id, rows: pendingChanges },
      {
        onSuccess: () => {
          message.success('Beban mengajar berhasil disimpan')
          onClose()
        },
        onError: (err: Error) =>
          message.error(err.message || 'Gagal menyimpan beban mengajar'),
      },
    )
  }

  const toggleClass = (classId: string, next: boolean) => {
    setChecked((prev) => {
      const set = new Set(prev)
      if (next) set.add(classId)
      else set.delete(classId)
      return set
    })
  }

  const selectedSubject = subjectsQuery.data?.find((s) => s.id === subjectId)

  return (
    <AppModal
      open={open}
      onCancel={onClose}
      title={teacher ? `Atur Beban Mengajar (${teacher.name})` : ''}
      subtitle="Pilih mapel, lalu centang kelas yang diampu"
      icon={<BookOutlined />}
      width={560}
      okText={`Simpan${pendingChanges.length > 0 ? ` (${pendingChanges.length} perubahan)` : ''}`}
      okButtonProps={{ disabled: pendingChanges.length === 0, loading: saveMutation.isPending }}
      onOk={handleSave}
      cancelText="Batal"
      destroyOnHidden
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 4 }}>
        <div style={{ fontSize: 12.5, color: token.colorTextTertiary }}>
          Tahun ajaran <b>{activeYear?.name ?? '-'}</b>. Data tersimpan di mapel masing-masing
          kelas, bisa juga diatur dari sisi kelas.
        </div>

        <Select
          showSearch
          optionFilterProp="label"
          placeholder="Pilih mata pelajaran"
          style={{ width: '100%' }}
          value={subjectId}
          onChange={setSubjectId}
          loading={subjectsQuery.isPending}
          options={(subjectsQuery.data ?? []).map((s) => ({
            value: s.id,
            label: `${s.name}${s.code ? ` (${s.code})` : ''}`,
          }))}
          notFoundContent={
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada mapel" />
          }
        />

        {overwriteCount > 0 && (
          <ModalNotice
            tone="warning"
            title={`${overwriteCount} kelas saat ini dipegang guru lain, akan diambil alih saat disimpan.`}
          />
        )}

        {!subjectId ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Pilih mapel dulu untuk melihat daftar kelas"
            style={{ paddingBlock: 24 }}
          />
        ) : classesQuery.isPending || byYearQuery.isPending ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Memuat…" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {groupedClasses.map(([grade, classes]) => (
              <div
                key={grade}
                style={{
                  border: `1px solid ${token.colorBorderSecondary}`,
                  borderRadius: 10,
                  padding: '10px 12px',
                }}
              >
                <div
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: token.colorTextSecondary,
                    marginBottom: 6,
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                  }}
                >
                  Tingkat {grade} ({classes.length})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 0' }}>
                  {classes.map((cls) => {
                    const owner = occupiedBy.get(cls.id)
                    const isMine = owner?.teacherId === teacher?.id
                    return (
                      <div key={cls.id} style={{ width: '50%', minWidth: 220 }}>
                        <Checkbox
                          checked={checked.has(cls.id)}
                          onChange={(e) => toggleClass(cls.id, e.target.checked)}
                        >
                          <span style={{ fontWeight: 500 }}>{cls.name}</span>
                          {cls.major && (
                            <span style={{ fontSize: 11, color: token.colorTextTertiary }}>
                              {' '}
                              · {cls.major}
                            </span>
                          )}
                          {owner && !isMine && (
                            <Tag color="warning" style={{ marginLeft: 6, fontSize: 10 }}>
                              {owner.teacherName}
                            </Tag>
                          )}
                        </Checkbox>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
            {groupedClasses.length === 0 && (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Belum ada kelas pada tahun ajaran ini"
              />
            )}
          </div>
        )}

        {subjectId && checked.size > 0 && (
          <div style={{ fontSize: 12.5, color: token.colorTextSecondary }}>
            {teacher?.name} mengajar <b>{selectedSubject?.name}</b> di{' '}
            <b>{checked.size} kelas</b>.
          </div>
        )}
      </div>
    </AppModal>
  )
}
