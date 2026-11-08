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
  RAPORT_TYPE_LABEL,
} from './constants'
import {
  useBehaviorForMonth,
  useMonthlyRows,
  useRaportClasses,
  useRaportStudents,
  useResetMonthlyPeriod,
  useResetSemesterPeriod,
  useSaveMonthly,
  useSaveSemester,
  useSemesterRows,
} from './hooks'
import type {
  MonthlyDraft,
  MonthlyReportPayload,
  RaportStudent,
  RaportType,
  SemesterDraft,
  SemesterReportPayload,
  SemesterType,
} from './types'

const BULANAN_KEYS = [
  'nilai_akhlak',
  'nilai_ibadah',
  'nilai_kebersihan',
  'nilai_quran',
  'nilai_bahasa',
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

  const jenisRaw = searchParams.get('jenis') as RaportType | null
  const jenis: RaportType = jenisRaw && jenisRaw in RAPORT_TYPE_LABEL ? jenisRaw : 'bulanan'
  const bulan = Number(searchParams.get('bulan')) || new Date().getMonth() + 1
  const tahun = Number(searchParams.get('tahun')) || new Date().getFullYear()
  const semester = (searchParams.get('semester') === '2' ? 2 : 1) as 1 | 2
  const ta = searchParams.get('ta') ?? ''
  const musyrif = searchParams.get('musyrif') ?? ''

  const classesQuery = useRaportClasses()
  const classRow = (classesQuery.data ?? []).find((c) => c.id === classId)
  const grade = classRow?.grade ?? null

  const studentsQuery = useRaportStudents(classId || undefined)
  const students = useMemo(() => studentsQuery.data ?? [], [studentsQuery.data])
  const studentIds = useMemo(() => students.map((s) => s.id), [students])

  const isBulanan = jenis === 'bulanan'
  const prevMonth = bulan === 1 ? 12 : bulan - 1
  const prevYear = bulan === 1 ? tahun - 1 : tahun

  const monthlyQuery = useMonthlyRows(studentIds, bulan, tahun)
  const prevMonthlyQuery = useMonthlyRows(studentIds, prevMonth, prevYear)
  const semesterQuery = useSemesterRows(studentIds, jenis as SemesterType, semester, ta || undefined)

  const monthStart = `${tahun}-${String(bulan).padStart(2, '0')}-01T00:00:00Z`
  // hari terakhir bulan berjalan (31 → Nov 30, Feb 28/29, dst.)
  const lastDayOfMonth = new Date(tahun, bulan, 0).getDate()
  const monthEnd = `${tahun}-${String(bulan).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}T23:59:59Z`
  const behaviorQuery = useBehaviorForMonth(isBulanan ? studentIds : [], monthStart, monthEnd)

  const [drafts, setDrafts] = useState<Record<string, MonthlyDraft>>({})
  const [semesterDrafts, setSemesterDrafts] = useState<Record<string, SemesterDraft>>({})
  const [extrasStudent, setExtrasStudent] = useState<RaportStudent | null>(null)

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

  const criteria = getCriteria(jenis, grade)
  const maxScore = isBulanan ? BULANAN_MAX_SCORE : SEMESTER_MAX_SCORE

  const getSavedScore = (studentId: string, key: string): number | null => {
    if (isBulanan) {
      const row = savedMonthlyById.get(studentId)
      if (!row) return null
      return (row as unknown as Record<string, number | null>)[key] ?? null
    }
    return savedSemesterById.get(studentId)?.scores?.[key] ?? null
  }

  const effectiveScores = (studentId: string): Record<string, number | null> => {
    const out: Record<string, number | null> = {}
    for (const c of criteria) {
      if (isBulanan) {
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

  const completeCount = students.filter((s) => isComplete(jenis, effectiveScores(s.id), grade)).length

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
            !!d && BULANAN_KEYS.some((k) => typeof d[k] === 'number') ||
            BULANAN_KEYS.some((k) => typeof (saved as unknown as Record<string, number | null>)?.[k] === 'number')
          )
        })()
        if (hasCurrent) continue
        next[row.student_id] = {
          ...next[row.student_id],
          nilai_akhlak: row.nilai_akhlak,
          nilai_ibadah: row.nilai_ibadah,
          nilai_kebersihan: row.nilai_kebersihan,
          nilai_quran: row.nilai_quran,
          nilai_bahasa: row.nilai_bahasa,
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

    if (isBulanan) {
      const payloads: MonthlyReportPayload[] = []
      const skippedIds: string[] = []

      for (const student of students) {
        const draft = drafts[student.id]
        if (!draft || Object.keys(draft).length === 0) continue
        const saved = savedMonthlyById.get(student.id)
        const merged = {
          nilai_akhlak: saved?.nilai_akhlak ?? null,
          nilai_ibadah: saved?.nilai_ibadah ?? null,
          nilai_kebersihan: saved?.nilai_kebersihan ?? null,
          nilai_quran: saved?.nilai_quran ?? null,
          nilai_bahasa: saved?.nilai_bahasa ?? null,
          berat_badan: saved?.berat_badan ?? null,
          tinggi_badan: saved?.tinggi_badan ?? null,
          ziyadah: saved?.ziyadah ?? null,
          murojaah: saved?.murojaah ?? null,
          total_hafalan: saved?.total_hafalan ?? null,
          sholat: saved?.sholat ?? null,
          hari_sakit: saved?.hari_sakit ?? 0,
          hari_izin: saved?.hari_izin ?? 0,
          hari_alpa: saved?.hari_alpa ?? 0,
          hari_pulang: saved?.hari_pulang ?? 0,
          catatan: saved?.catatan ?? null,
          pelanggaran: saved?.pelanggaran ?? null,
          prestasi: saved?.prestasi ?? null,
          ...draft,
        }
        // data pendukung (fisik, kehadiran) juga dihitung sebagai isi
        const hasAny =
          BULANAN_KEYS.some((k) => typeof merged[k] === 'number') ||
          Boolean(
            merged.catatan ||
              merged.ziyadah ||
              merged.murojaah ||
              merged.total_hafalan ||
              merged.berat_badan ||
              merged.tinggi_badan ||
              merged.sholat ||
              merged.hari_sakit ||
              merged.hari_izin ||
              merged.hari_alpa ||
              merged.hari_pulang,
          )
        // lewati hanya jika belum ada baris tersimpan DAN memang kosong.
        // Jika baris sudah ada, tetap disimpan agar pengosongan nilai ikut tersimpan.
        if (!saved && !hasAny) {
          skippedIds.push(student.id)
          continue
        }
        payloads.push({
          student_id: student.id,
          month: bulan,
          year: tahun,
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
        (p) => !BULANAN_KEYS.every((k) => typeof p[k] === 'number'),
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
      if (!ta) {
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
          berat_badan: draft.berat_badan ?? saved?.extras?.berat_badan ?? null,
          tinggi_badan: draft.tinggi_badan ?? saved?.extras?.tinggi_badan ?? null,
          sholat: draft.sholat ?? saved?.extras?.sholat ?? null,
          hari_sakit: draft.hari_sakit ?? saved?.extras?.hari_sakit ?? 0,
          hari_izin: draft.hari_izin ?? saved?.extras?.hari_izin ?? 0,
          hari_alpa: draft.hari_alpa ?? saved?.extras?.hari_alpa ?? 0,
          hari_pulang: draft.hari_pulang ?? saved?.extras?.hari_pulang ?? 0,
          catatan: draft.catatan ?? saved?.extras?.catatan ?? null,
        }
        const hasAny =
          Object.values(scores).some((v) => typeof v === 'number') ||
          Boolean(
            extras.catatan ||
              extras.berat_badan ||
              extras.tinggi_badan ||
              extras.sholat ||
              extras.hari_sakit ||
              extras.hari_izin ||
              extras.hari_alpa ||
              extras.hari_pulang,
          )
        if (!saved && !hasAny) {
          skippedIds.push(student.id)
          continue
        }
        payloads.push({
          student_id: student.id,
          report_type: jenis as SemesterType,
          semester,
          academic_year_id: ta,
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
    if (isBulanan) {
      resetMonthly.mutate(
        { studentIds: [studentId], month: bulan, year: tahun },
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
        { studentIds: [studentId], reportType: jenis as SemesterType, semester, academicYearId: ta },
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

  const columns: TableColumnsType<RaportStudent> = [
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
      render: (_: unknown, row: RaportStudent) => {
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
              isBulanan
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
        const avg = calcAverage(jenis, effectiveScores(row.id), grade)
        return <Typography.Text strong>{avg ?? '—'}</Typography.Text>
      },
    },
    {
      title: 'Status',
      key: 'status',
      width: 110,
      render: (_, row) =>
        isComplete(jenis, effectiveScores(row.id), grade) ? (
          <StatusTag color="green">Lengkap</StatusTag>
        ) : (
          <StatusTag color="default">Kosong</StatusTag>
        ),
    },
    ...(isBulanan
      ? [
          {
            title: 'Poin Bulan Ini',
            key: 'behavior',
            width: 110,
            responsive: ['lg' as const],
            render: (_: unknown, row: RaportStudent) => {
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
        title={`Input ${RAPORT_TYPE_LABEL[jenis]}`}
        subtitle={classRow ? `Kelas ${classRow.name}` : '...'}
        extra={
          <Space wrap>
            <Link to={previewPath}>
              <Button icon={<PrinterOutlined />}>Preview & Cetak</Button>
            </Link>
            {isBulanan && (
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

      {!isBulanan && !ta && (
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
            {drafts && Object.keys(drafts).length > 0 && isBulanan && (
              <Tag color="processing" style={{ marginLeft: 8 }}>
                {Object.keys(drafts).length} draf belum disimpan
              </Tag>
            )}
            {semesterDrafts && Object.keys(semesterDrafts).length > 0 && !isBulanan && (
              <Tag color="processing" style={{ marginLeft: 8 }}>
                {Object.keys(semesterDrafts).length} draf belum disimpan
              </Tag>
            )}
          </Typography.Text>
        </div>
        <Table<RaportStudent>
          rowKey="id"
          columns={columns}
          dataSource={students}
          loading={
            studentsQuery.isLoading ||
            (isBulanan ? monthlyQuery.isLoading : semesterQuery.isLoading)
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
        type={jenis}
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
