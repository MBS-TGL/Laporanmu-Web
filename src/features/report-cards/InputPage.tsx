import { useMemo, useState } from 'react'
import {
  Alert,
  App,
  Badge,
  Button,
  Card,
  Empty,
  InputNumber,
  Popconfirm,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  type TableColumnsType,
} from 'antd'
import {
  CopyOutlined,
  DeleteOutlined,
  EyeOutlined,
  PrinterOutlined,
  SaveOutlined,
} from '@ant-design/icons'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../shared/components/PageHeader'
import { StatusTag } from '../../shared/components/StatusTag'
import { usePermissions } from '../../shared/hooks/useProfile'
import { SetupBar } from './components/SetupBar'
import { ExtrasDrawer } from './components/ExtrasDrawer'
import {
  MONTH_NAMES,
  SEMESTER_MAX_SCORE,
  BULANAN_MAX_SCORE,
  calcAverage,
  getCriteria,
  isComplete,
  REPORT_CARD_TYPE_LABEL,
} from './constants'
import {
  useBehaviorForMonth,
  useMonthlyRows,
  useReportCardClasses,
  useReportCardStudents,
  useResetMonthlyPeriod,
  useResetSemesterPeriod,
  useSaveMonthly,
  useSaveSemester,
  useSemesterRows,
} from './hooks'
import type {
  MonthlyDraft,
  MonthlyReportPayload,
  ReportCardStudent,
  ReportCardType,
  SemesterDraft,
  SemesterReportPayload,
  SemesterType,
} from './types'

const MONTHLY_KEYS = [
  'character_score',
  'worship_score',
  'cleanliness_score',
  'quran_score',
  'language_score',
] as const

const omitKeys = <T,>(obj: Record<string, T>, keys: string[]): Record<string, T> => {
  const next = { ...obj }
  for (const k of keys) delete next[k]
  return next
}

export function InputPage() {
  const { message } = App.useApp()
  const { classId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const { canWrite, canDelete } = usePermissions()

  const typeRaw = searchParams.get('type') as ReportCardType | null
  const type: ReportCardType = typeRaw && typeRaw in REPORT_CARD_TYPE_LABEL ? typeRaw : 'monthly'
  const month = Number(searchParams.get('month')) || new Date().getMonth() + 1
  const year = Number(searchParams.get('year')) || new Date().getFullYear()
  const semester = (searchParams.get('semester') === '2' ? 2 : 1) as 1 | 2
  const ay = searchParams.get('ay') ?? ''
  const musyrif = searchParams.get('musyrif') ?? ''

  const classesQuery = useReportCardClasses()
  const classRow = (classesQuery.data ?? []).find((c) => c.id === classId)
  const grade = classRow?.grade ?? null

  const studentsQuery = useReportCardStudents(classId || undefined)
  const students = useMemo(() => studentsQuery.data ?? [], [studentsQuery.data])
  const studentIds = useMemo(() => students.map((s) => s.id), [students])

  const isMonthly = type === 'monthly'
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year

  const monthlyQuery = useMonthlyRows(studentIds, month, year)
  const prevMonthlyQuery = useMonthlyRows(studentIds, prevMonth, prevYear)
  const semesterQuery = useSemesterRows(studentIds, type as SemesterType, semester, ay || undefined)

  const monthStart = `${year}-${String(month).padStart(2, '0')}-01T00:00:00Z`
  // hari terakhir bulan berjalan (31 → Nov 30, Feb 28/29, dst.)
  const lastDayOfMonth = new Date(year, month, 0).getDate()
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}T23:59:59Z`
  const behaviorQuery = useBehaviorForMonth(isMonthly ? studentIds : [], monthStart, monthEnd)

  const [drafts, setDrafts] = useState<Record<string, MonthlyDraft>>({})
  const [semesterDrafts, setSemesterDrafts] = useState<Record<string, SemesterDraft>>({})
  const [extrasStudent, setExtrasStudent] = useState<ReportCardStudent | null>(null)

  const saveMonthly = useSaveMonthly()
  const saveSemester = useSaveSemester()
  const resetMonthly = useResetMonthlyPeriod()
  const resetSemester = useResetSemesterPeriod()

  const savedMonthlyById = useMemo(
    () => new Map((monthlyQuery.data ?? []).map((r) => [r.student_id, r])),
    [monthlyQuery.data],
  )
  const savedSemesterById = useMemo(
    () => new Map((semesterQuery.data ?? []).map((r) => [r.student_id, r])),
    [semesterQuery.data],
  )
  const behaviorByStudent = useMemo(() => {
    const map = new Map<string, { negative: number; positive: number; items: string[] }>()
    for (const item of behaviorQuery.data ?? []) {
      const entry = map.get(item.student_id) ?? { negative: 0, positive: 0, items: [] }
      if (item.points < 0) {
        entry.negative += 1
        entry.items.push(`${item.rule_name ?? 'Pelanggaran'} (${item.points})`)
      } else {
        entry.positive += 1
        entry.items.push(`${item.rule_name ?? 'Prestasi'} (+${item.points})`)
      }
      map.set(item.student_id, entry)
    }
    return map
  }, [behaviorQuery.data])

  const criteria = getCriteria(type, grade)
  const maxScore = isMonthly ? BULANAN_MAX_SCORE : SEMESTER_MAX_SCORE

  const getSavedScore = (studentId: string, key: string): number | null => {
    if (isMonthly) {
      const row = savedMonthlyById.get(studentId)
      if (!row) return null
      return (row as unknown as Record<string, number | null>)[key] ?? null
    }
    return savedSemesterById.get(studentId)?.scores?.[key] ?? null
  }

  const effectiveScores = (studentId: string): Record<string, number | null> => {
    const out: Record<string, number | null> = {}
    for (const c of criteria) {
      if (isMonthly) {
        const draft = drafts[studentId]
        out[c.key] =
          draft && c.key in draft
            ? ((draft as unknown as Record<string, number | null>)[c.key] ?? null)
            : getSavedScore(studentId, c.key)
      } else {
        const draft = semesterDrafts[studentId]
        out[c.key] =
          draft && c.key in draft.scores
            ? draft.scores[c.key] ?? null
            : getSavedScore(studentId, c.key)
      }
    }
    return out
  }

  const completeCount = students.filter((s) => isComplete(type, effectiveScores(s.id), grade)).length

  const patchDraft = (studentId: string, patch: Partial<MonthlyDraft>) => {
    setDrafts((prev) => ({
      ...prev,
      [studentId]: { ...(prev[studentId] ?? {}), ...patch },
    }))
  }

  const patchSemesterDraft = (studentId: string, patch: Partial<SemesterDraft>) => {
    setSemesterDrafts((prev) => {
      const prevDraft = prev[studentId] ?? {}
      const { scores: prevScores, ...prevRest } = prevDraft
      const { scores: patchScores, ...patchRest } = patch
      return {
        ...prev,
        [studentId]: {
          ...prevRest,
          ...patchRest,
          scores: { ...prevScores, ...(patchScores ?? {}) },
        },
      }
    })
  }

  const handleCopyPrevMonth = () => {
    const prevRows = prevMonthlyQuery.data ?? []
    if (prevRows.length === 0) {
      message.info(`Tidak ada data ${MONTH_NAMES[prevMonth - 1]} ${prevYear} untuk disalin`)
      return
    }
    let copied = 0
    setDrafts((prev) => {
      const next = { ...prev }
      for (const row of prevRows) {
        const hasCurrent = (() => {
          const d = next[row.student_id]
          const saved = savedMonthlyById.get(row.student_id)
          return (
            !!d && MONTHLY_KEYS.some((k) => typeof d[k] === 'number') ||
            MONTHLY_KEYS.some((k) => typeof (saved as unknown as Record<string, number | null>)?.[k] === 'number')
          )
        })()
        if (hasCurrent) continue
        next[row.student_id] = {
          ...next[row.student_id],
          character_score: row.character_score,
          worship_score: row.worship_score,
          cleanliness_score: row.cleanliness_score,
          quran_score: row.quran_score,
          language_score: row.language_score,
        }
        copied += 1
      }
      return next
    })
    message.success(`Nilai ${MONTH_NAMES[prevMonth - 1]} disalin ke ${copied} siswa (hanya yang belum terisi)`)
  }

  const handleSaveAll = async () => {
    // cegah klik ganda selama proses simpan
    if (saveMonthly.isPending || saveSemester.isPending) return

    if (isMonthly) {
      const payloads: MonthlyReportPayload[] = []
      const skippedIds: string[] = []

      for (const student of students) {
        const draft = drafts[student.id]
        if (!draft || Object.keys(draft).length === 0) continue
        const saved = savedMonthlyById.get(student.id)
        const merged = {
          character_score: saved?.character_score ?? null,
          worship_score: saved?.worship_score ?? null,
          cleanliness_score: saved?.cleanliness_score ?? null,
          quran_score: saved?.quran_score ?? null,
          language_score: saved?.language_score ?? null,
          weight_kg: saved?.weight_kg ?? null,
          height_cm: saved?.height_cm ?? null,
          ziyadah: saved?.ziyadah ?? null,
          murojaah: saved?.murojaah ?? null,
          total_hafalan: saved?.total_hafalan ?? null,
          sholat: saved?.sholat ?? null,
          sick_days: saved?.sick_days ?? 0,
          excused_days: saved?.excused_days ?? 0,
          absent_days: saved?.absent_days ?? 0,
          early_leave_days: saved?.early_leave_days ?? 0,
          notes: saved?.notes ?? null,
          violations: saved?.violations ?? null,
          achievements: saved?.achievements ?? null,
          ...draft,
        }
        // data pendukung (fisik, kehadiran) juga dihitung sebagai isi
        const hasAny =
          MONTHLY_KEYS.some((k) => typeof merged[k] === 'number') ||
          Boolean(
            merged.notes ||
              merged.ziyadah ||
              merged.murojaah ||
              merged.total_hafalan ||
              merged.weight_kg ||
              merged.height_cm ||
              merged.sholat ||
              merged.sick_days ||
              merged.excused_days ||
              merged.absent_days ||
              merged.early_leave_days,
          )
        // lewati hanya jika belum ada baris tersimpan DAN memang kosong.
        // Jika baris sudah ada, tetap disimpan agar pengosongan nilai ikut tersimpan.
        if (!saved && !hasAny) {
          skippedIds.push(student.id)
          continue
        }
        payloads.push({
          student_id: student.id,
          month: month,
          year: year,
          musyrif_name: musyrif || classRow?.homeroom_teacher?.name || null,
          ...merged,
          updated_by: null,
        })
      }

      if (payloads.length === 0) {
        // bersihkan draf kosong agar badge "belum disimpan" tidak menggantung
        if (skippedIds.length) setDrafts((prev) => omitKeys(prev, skippedIds))
        message.info('Tidak ada perubahan untuk disimpan')
        return
      }

      const incomplete = payloads.filter(
        (p) => !MONTHLY_KEYS.every((k) => typeof p[k] === 'number'),
      ).length
      if (incomplete > 0) {
        message.warning(
          `${incomplete} siswa belum lengkap — data yang terisi saja yang tersimpan.`,
          4,
        )
      }

      try {
        const { data: userData } = await supabase.auth.getUser()
        await saveMonthly.mutateAsync(
          payloads.map((p) => ({ ...p, updated_by: userData.user?.id ?? null })),
        )
        message.success(`${payloads.length} raport tersimpan`)
        // hapus hanya draf yang benar-benar tersimpan (ketikan baru tidak ikut hilang)
        const doneIds = [...payloads.map((p) => p.student_id), ...skippedIds]
        setDrafts((prev) => omitKeys(prev, doneIds))
      } catch (err) {
        message.error((err as Error).message || 'Gagal menyimpan')
      }
    } else {
      // Semester
      if (!ay) {
        message.warning('Pilih tahun ajaran terlebih dahulu')
        return
      }
      const payloads: SemesterReportPayload[] = []
      const skippedIds: string[] = []

      for (const student of students) {
        const draft = semesterDrafts[student.id]
        if (!draft) continue
        const saved = savedSemesterById.get(student.id)
        const scores = { ...(saved?.scores ?? {}), ...draft.scores }
        const extras = {
          weight_kg: draft.weight_kg ?? saved?.extras?.weight_kg ?? null,
          height_cm: draft.height_cm ?? saved?.extras?.height_cm ?? null,
          sholat: draft.sholat ?? saved?.extras?.sholat ?? null,
          sick_days: draft.sick_days ?? saved?.extras?.sick_days ?? 0,
          excused_days: draft.excused_days ?? saved?.extras?.excused_days ?? 0,
          absent_days: draft.absent_days ?? saved?.extras?.absent_days ?? 0,
          early_leave_days: draft.early_leave_days ?? saved?.extras?.early_leave_days ?? 0,
          notes: draft.notes ?? saved?.extras?.notes ?? null,
        }
        const hasAny =
          Object.values(scores).some((v) => typeof v === 'number') ||
          Boolean(
            extras.notes ||
              extras.weight_kg ||
              extras.height_cm ||
              extras.sholat ||
              extras.sick_days ||
              extras.excused_days ||
              extras.absent_days ||
              extras.early_leave_days,
          )
        if (!saved && !hasAny) {
          skippedIds.push(student.id)
          continue
        }
        payloads.push({
          student_id: student.id,
          report_type: type as SemesterType,
          semester,
          academic_year_id: ay,
          scores,
          extras,
          musyrif_name: musyrif || classRow?.homeroom_teacher?.name || null,
          updated_by: null,
        })
      }

      if (payloads.length === 0) {
        if (skippedIds.length) setSemesterDrafts((prev) => omitKeys(prev, skippedIds))
        message.info('Tidak ada perubahan untuk disimpan')
        return
      }

      try {
        const { data: userData } = await supabase.auth.getUser()
        await saveSemester.mutateAsync(
          payloads.map((p) => ({ ...p, updated_by: userData.user?.id ?? null })),
        )
        message.success(`${payloads.length} raport tersimpan`)
        const doneIds = [...payloads.map((p) => p.student_id), ...skippedIds]
        setSemesterDrafts((prev) => omitKeys(prev, doneIds))
      } catch (err) {
        message.error((err as Error).message || 'Gagal menyimpan')
      }
    }
  }

  const handleResetRow = (studentId: string) => {
    if (isMonthly) {
      resetMonthly.mutate(
        { studentIds: [studentId], month: month, year: year },
        {
          onSuccess: () => {
            message.success('Data siswa ini dihapus untuk periode ini')
            setDrafts((prev) => {
              const next = { ...prev }
              delete next[studentId]
              return next
            })
          },
          onError: (err: Error) => message.error(err.message || 'Gagal menghapus'),
        },
      )
    } else {
      resetSemester.mutate(
        { studentIds: [studentId], reportType: type as SemesterType, semester, academicYearId: ay },
        {
          onSuccess: () => {
            message.success('Data siswa ini dihapus untuk periode ini')
            setSemesterDrafts((prev) => {
              const next = { ...prev }
              delete next[studentId]
              return next
            })
          },
          onError: (err: Error) => message.error(err.message || 'Gagal menghapus'),
        },
      )
    }
  }

  const columns: TableColumnsType<ReportCardStudent> = [
    {
      title: 'Santri',
      key: 'name',
      fixed: 'left',
      width: 200,
      render: (_, row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.name}</div>
          <span style={{ fontSize: 12, color: '#888' }}>{row.registration_code}</span>
        </div>
      ),
    },
    ...criteria.map((c) => ({
      title: (
        <Tooltip title={`Skala 0–${maxScore}`}>
          {c.label}
        </Tooltip>
      ),
      key: c.key,
      width: 96,
      render: (_: unknown, row: ReportCardStudent) => {
        const value = effectiveScores(row.id)[c.key]
        return (
          <InputNumber
            size="small"
            style={{ width: 76 }}
            min={0}
            max={maxScore}
            value={value ?? undefined}
            disabled={!canWrite}
            onChange={(v) =>
              isMonthly
                ? patchDraft(row.id, { [c.key]: v ?? null } as Partial<MonthlyDraft>)
                : patchSemesterDraft(row.id, {
                    scores: { ...semesterDrafts[row.id]?.scores, [c.key]: v ?? null },
                  })
            }
          />
        )
      },
    })),
    {
      title: 'Rata-rata',
      key: 'avg',
      width: 88,
      responsive: ['md'],
      render: (_, row) => {
        const avg = calcAverage(type, effectiveScores(row.id), grade)
        return <Typography.Text strong>{avg ?? '—'}</Typography.Text>
      },
    },
    {
      title: 'Status',
      key: 'status',
      width: 110,
      render: (_, row) =>
        isComplete(type, effectiveScores(row.id), grade) ? (
          <StatusTag color="green">Lengkap</StatusTag>
        ) : (
          <StatusTag color="default">Kosong</StatusTag>
        ),
    },
    ...(isMonthly
      ? [
          {
            title: 'Poin Bulan Ini',
            key: 'behavior',
            width: 110,
            responsive: ['lg' as const],
            render: (_: unknown, row: ReportCardStudent) => {
              const info = behaviorByStudent.get(row.id)
              if (!info || (info.negative === 0 && info.positive === 0)) {
                return <span style={{ color: '#bbb' }}>—</span>
              }
              const badge = (
                <Space size={4}>
                  {info.negative > 0 && (
                    <Badge count={info.negative} color="#ef4444" title="Pelanggaran" />
                  )}
                  {info.positive > 0 && (
                    <Badge count={info.positive} color="#10b981" title="Prestasi" />
                  )}
                </Space>
              )
              return info.items.length > 0 ? (
                <Tooltip title={<div>{info.items.map((t, i) => <div key={i}>{t}</div>)}</div>}>
                  {badge}
                </Tooltip>
              ) : (
                badge
              )
            },
          },
        ]
      : []),
    {
      title: 'Aksi',
      key: 'actions',
      fixed: 'right',
      width: 110,
      render: (_, row) => (
        <Space size="small">
          <Tooltip title="Data pendukung (fisik, kehadiran, catatan)">
            <Button
              type="text"
              icon={<EyeOutlined />}
              disabled={!canWrite}
              onClick={() => setExtrasStudent(row)}
            />
          </Tooltip>
          {canDelete && (
            <Popconfirm
              title="Hapus data raport siswa ini?"
              description="Baris raport periode ini akan dihapus permanen."
              onConfirm={() => handleResetRow(row.id)}
              okText="Hapus"
              cancelText="Batal"
            >
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  const previewSp = new URLSearchParams(searchParams)
  const previewPath = `/report-cards/preview/${classId}?${previewSp.toString()}`

  return (
    <div>
      <PageHeader
        title={`Input ${REPORT_CARD_TYPE_LABEL[type]}`}
        subtitle={classRow ? `Kelas ${classRow.name}` : '...'}
        extra={
          <Space wrap>
            <Link to={previewPath}>
              <Button icon={<PrinterOutlined />}>Preview & Cetak</Button>
            </Link>
            {isMonthly && (
              <Button icon={<CopyOutlined />} onClick={handleCopyPrevMonth} disabled={!canWrite}>
                Salin dari {MONTH_NAMES[prevMonth - 1]}
              </Button>
            )}
            {canWrite && (
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={saveMonthly.isPending || saveSemester.isPending}
                onClick={handleSaveAll}
              >
                Simpan Semua
              </Button>
            )}
          </Space>
        }
      />

      <SetupBar classId={classId} homeroomTeacherName={classRow?.homeroom_teacher?.name ?? null} />

      {!isMonthly && !ay && (
        <Alert
          type="info"
          showIcon
          message="Pilih tahun ajaran pada bar di atas untuk mulai mengisi raport semester."
          style={{ marginBottom: 16 }}
        />
      )}

      <Card>
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
            Lengkap {completeCount}/{students.length} santri · skala 0–{maxScore}
            {drafts && Object.keys(drafts).length > 0 && isMonthly && (
              <Tag color="processing" style={{ marginLeft: 8 }}>
                {Object.keys(drafts).length} draf belum disimpan
              </Tag>
            )}
            {semesterDrafts && Object.keys(semesterDrafts).length > 0 && !isMonthly && (
              <Tag color="processing" style={{ marginLeft: 8 }}>
                {Object.keys(semesterDrafts).length} draf belum disimpan
              </Tag>
            )}
          </Typography.Text>
        </div>
        <Table<ReportCardStudent>
          rowKey="id"
          columns={columns}
          dataSource={students}
          loading={
            studentsQuery.isLoading ||
            (isMonthly ? monthlyQuery.isLoading : semesterQuery.isLoading)
          }
          locale={{
            emptyText: (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Kelas ini belum punya siswa" />
            ),
          }}
          pagination={{ pageSize: 20, showSizeChanger: false, showTotal: (t) => `Total ${t} santri` }}
          scroll={{ x: true }}
        />
      </Card>

      <ExtrasDrawer
        open={!!extrasStudent}
        student={extrasStudent}
        type={type}
        monthlyInitial={extrasStudent ? drafts[extrasStudent.id] ?? undefined : undefined}
        semesterInitial={extrasStudent ? semesterDrafts[extrasStudent.id] ?? undefined : undefined}
        onClose={() => setExtrasStudent(null)}
        onSaveMonthly={(sid, draft) => patchDraft(sid, draft)}
        onSaveSemester={(sid, draft) => {
          const { scores, ...rest } = draft
          patchSemesterDraft(sid, { scores: { ...semesterDrafts[sid]?.scores, ...scores }, ...rest })
        }}
      />
    </div>
  )
}
