import { useMemo, useState } from 'react'
import {
  App,
  Button,
  Card,
  Col,
  Empty,
  InputNumber,
  Result,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  theme,
  type TableColumnsType,
} from 'antd'
import {
  RiseOutlined,
  SafetyCertificateOutlined,
  UndoOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { AppModal } from '../../shared/components/AppModal'
import { ModalFooter } from '../../shared/components/ModalFooter'
import { ModalNotice } from '../../shared/components/ModalNotice'
import { WizardSteps } from '../../shared/components/WizardSteps'
import { useAcademicYearsBrief } from '../classes/hooks'
import {
  useClassesForPromotion,
  useGraduateStudentsBulk,
  usePromoteStudents,
  useStudents,
  useUndoPromotion,
} from './hooks'
import { revertGraduation } from './api'
import type { PromotionClassBrief, Student } from './types'

/** Heuristik level dari grade string atau nama kelas ("7" / "7A" → 7) */
function parseLevel(grade: string | null | undefined, name: string): number | null {
  if (grade && /^\d+$/.test(grade)) return Number(grade)
  const match = /\d+/.exec(name)
  return match ? Number(match[0]) : null
}

/** Ekstrak suffix rombel dari nama ("7A" → "A", "8 B" → "B") */
function parseSuffix(name: string): string {
  return name.replace(/^\d+\s*/, '').trim().toUpperCase()
}

type TargetAction =
  | { type: 'class'; classId: string }
  | { type: 'graduate' }
  | { type: 'skip' }

interface SourceRow {
  key: string
  classId: string | null
  className: string
  grade: number | null
  major: string | null
  academicYearName: string | null
  academicYearId: string | null
  count: number
  students: Student[]
  target: TargetAction
}

interface PromoteModalProps {
  open: boolean
  onClose: () => void
}

/**
 * Modal wizard kenaikan kelas — dibuka dari halaman Santri (tab Aktif).
 * Tidak lagi route terpisah (pola: aksi massal = modal, lihat SKILLS.md §Skill 2).
 */
export function PromoteModal({ open, onClose }: PromoteModalProps) {
  const { message, modal } = App.useApp()
  const { token } = theme.useToken()

  const [currentStep, setCurrentStep] = useState(0)
  const [graduationYear, setGraduationYear] = useState<number>(dayjs().year())
  const [mappingOverrides, setMappingOverrides] = useState<Record<string, TargetAction>>({})

  // Hasil eksekusi untuk step 2 (sukses + undo)
  const [executionResult, setExecutionResult] = useState<{
    batchId: string
    promotedCount: number
    graduatedCount: number
    graduatedIds: string[]
  } | null>(null)
  const [undoing, setUndoing] = useState(false)

  const yearsQuery = useAcademicYearsBrief()
  const activeYear = (yearsQuery.data ?? []).find((y) => y.is_active)

  const classesQuery = useClassesForPromotion()
  const allClasses = classesQuery.data ?? []

  // Ambil seluruh siswa aktif (fetch 1000)
  const studentsQuery = useStudents({ page: 1, pageSize: 1000, status: 'active' })
  const allStudents = useMemo(() => studentsQuery.data?.data ?? [], [studentsQuery.data])

  const promoteMutation = usePromoteStudents()
  const graduateMutation = useGraduateStudentsBulk()
  const undoMutation = useUndoPromotion()

  // Heuristik saran kelas tujuan untuk kelas asal
  const suggestTarget = (
    sourceName: string,
    sourceGrade: number | null,
    sourceMajor: string | null,
    sourceYearId: string | null,
  ): TargetAction => {
    // Kelas akhir (tingkat 9 untuk MTs/SMP atau 12 untuk MA/SMA) → default Luluskan
    if (sourceGrade !== null && (sourceGrade === 9 || sourceGrade >= 12)) {
      return { type: 'graduate' }
    }
    if (sourceGrade === null) return { type: 'skip' }

    const nextLevel = sourceGrade + 1
    const suffix = parseSuffix(sourceName)

    // Prioritaskan kelas tingkat berikutnya dari tahun ajaran BERBEDA (tahun ajaran baru)
    const candidates = allClasses.filter((c) => {
      const lvl = parseLevel(c.grade, c.name)
      return lvl === nextLevel
    })

    if (candidates.length === 0) {
      // Tidak ada kelas di atasnya → sarankan luluskan jika sudah tingkat atas
      return sourceGrade >= 9 ? { type: 'graduate' } : { type: 'skip' }
    }

    // 1. Cocokkan suffix rombel ("A" → "A") + tahun ajaran berbeda + jurusan sama
    const exactDiffYear = candidates.find(
      (c) =>
        parseSuffix(c.name) === suffix &&
        c.academic_year_id !== sourceYearId &&
        (!sourceMajor || c.major === sourceMajor),
    )
    if (exactDiffYear) return { type: 'class', classId: exactDiffYear.id }

    // 2. Cocokkan suffix rombel saja
    const exactAnyYear = candidates.find((c) => parseSuffix(c.name) === suffix)
    if (exactAnyYear) return { type: 'class', classId: exactAnyYear.id }

    // 3. Kelas pertama di level tersebut
    return { type: 'class', classId: candidates[0]!.id }
  }

  // Kelompokkan siswa aktif berdasarkan kelas asal
  const sourceRows: SourceRow[] = useMemo(() => {
    const classMap = new Map<string, PromotionClassBrief>()
    for (const c of allClasses) classMap.set(c.id, c)

    const groups = new Map<string, { className: string; students: Student[] }>()
    for (const s of allStudents) {
      const key = s.class_id ?? '__no_class__'
      const group = groups.get(key) ?? {
        className: s.classes?.name ?? 'Tanpa Kelas',
        students: [],
      }
      group.students.push(s)
      groups.set(key, group)
    }

    const rows: SourceRow[] = []
    for (const [key, group] of groups.entries()) {
      const cls = key === '__no_class__' ? null : classMap.get(key)
      const grade = parseLevel(cls?.grade, group.className)
      const major = cls?.major ?? null
      const yearId = cls?.academic_year_id ?? null
      const yearName = cls?.academic_year_name ?? null

      const defaultTarget =
        key === '__no_class__'
          ? ({ type: 'skip' } as TargetAction)
          : suggestTarget(group.className, grade, major, yearId)

      const target = mappingOverrides[key] ?? defaultTarget

      rows.push({
        key,
        classId: cls?.id ?? null,
        className: group.className,
        grade,
        major,
        academicYearId: yearId,
        academicYearName: yearName,
        count: group.students.length,
        students: group.students,
        target,
      })
    }

    return rows.sort((a, b) => {
      if (a.key === '__no_class__') return 1
      if (b.key === '__no_class__') return -1
      return (a.grade ?? 0) - (b.grade ?? 0) || a.className.localeCompare(b.className, 'id', { numeric: true })
    })
  }, [allStudents, allClasses, mappingOverrides])

  // Ringkasan aksi untuk konfirmasi
  const summary = useMemo(() => {
    let promoteCount = 0
    let graduateCount = 0
    let skipCount = 0
    const promoteMoves: { studentId: string; classId: string }[] = []
    const graduateIds: string[] = []

    for (const row of sourceRows) {
      if (row.target.type === 'class') {
        promoteCount += row.count
        for (const s of row.students) promoteMoves.push({ studentId: s.id, classId: row.target.classId })
      } else if (row.target.type === 'graduate') {
        graduateCount += row.count
        for (const s of row.students) graduateIds.push(s.id)
      } else {
        skipCount += row.count
      }
    }
    return { promoteCount, graduateCount, skipCount, promoteMoves, graduateIds }
  }, [sourceRows])

  const setTargetForRow = (rowKey: string, action: TargetAction) => {
    setMappingOverrides((prev) => ({ ...prev, [rowKey]: action }))
  }

  // Opsi dropdown kelas tujuan
  const targetSelectOptions = useMemo(() => {
    const list = allClasses.map((c) => ({
      value: `class:${c.id}`,
      label: `${c.name}${c.academic_year_name ? ` · ${c.academic_year_name}` : ''}`,
    }))
    return [
      {
        label: 'Aksi Khusus',
        options: [
          { value: 'graduate', label: '🎓 Luluskan (masuk Alumni)' },
          { value: 'skip', label: '⏸ Lewati (tetap di kelas ini)' },
        ],
      },
      { label: 'Pindah ke Kelas', options: list },
    ]
  }, [allClasses])

  const handleExecute = async () => {
    if (summary.promoteMoves.length === 0 && summary.graduateIds.length === 0) {
      message.warning('Tidak ada siswa yang dipilih untuk dinaikkan atau diluluskan')
      return
    }

    try {
      let batchId = ''
      if (summary.promoteMoves.length > 0) {
        batchId = await promoteMutation.mutateAsync(summary.promoteMoves)
      }

      if (summary.graduateIds.length > 0) {
        await graduateMutation.mutateAsync({
          ids: summary.graduateIds,
          graduationYear,
        })
      }

      setExecutionResult({
        batchId,
        promotedCount: summary.promoteCount,
        graduatedCount: summary.graduateCount,
        graduatedIds: summary.graduateIds,
      })
      setCurrentStep(2)
      message.success('Kenaikan kelas berhasil diproses')
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Gagal memproses kenaikan kelas')
    }
  }

  const handleUndo = () => {
    if (!executionResult) return
    modal.confirm({
      title: 'Batalkan kenaikan kelas ini?',
      content:
        'Santri yang dipromosikan akan dikembalikan ke kelas asal. Santri yang diluluskan akan dikembalikan menjadi santri aktif.',
      okText: 'Ya, Batalkan',
      okButtonProps: { danger: true },
      cancelText: 'Tutup',
      onOk: async () => {
        setUndoing(true)
        try {
          if (executionResult.batchId) {
            await undoMutation.mutateAsync(executionResult.batchId)
          }
          // Kembalikan kelulusan per-siswa
          for (const id of executionResult.graduatedIds) {
            await revertGraduation(id)
          }
          message.success('Kenaikan kelas telah dibatalkan seluruhnya')
          setExecutionResult(null)
          setCurrentStep(0)
          void studentsQuery.refetch()
        } catch (err) {
          message.error(err instanceof Error ? err.message : 'Gagal membatalkan')
        } finally {
          setUndoing(false)
        }
      },
    })
  }

  const columns: TableColumnsType<SourceRow> = [
    {
      title: 'Kelas Asal',
      key: 'source',
      render: (_, r) => (
        <div>
          <span style={{ fontWeight: 600 }}>{r.className}</span>
          {r.academicYearName && (
            <div style={{ fontSize: 12, color: token.colorTextTertiary }}>
              {r.academicYearName}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Tingkat',
      dataIndex: 'grade',
      key: 'grade',
      width: 90,
      render: (v) => (v ? <Tag>Kelas {v}</Tag> : '—'),
    },
    {
      title: 'Jumlah',
      dataIndex: 'count',
      key: 'count',
      width: 100,
      render: (v: number) => <b>{v} santri</b>,
    },
    {
      title: 'Aksi / Kelas Tujuan',
      key: 'target',
      render: (_, r) => {
        const val =
          r.target.type === 'class'
            ? `class:${r.target.classId}`
            : r.target.type === 'graduate'
              ? 'graduate'
              : 'skip'
        return (
          <Select
            style={{ minWidth: 260 }}
            value={val}
            onChange={(raw) => {
              if (raw === 'graduate') setTargetForRow(r.key, { type: 'graduate' })
              else if (raw === 'skip') setTargetForRow(r.key, { type: 'skip' })
              else if (raw.startsWith('class:')) {
                setTargetForRow(r.key, { type: 'class', classId: raw.slice(6) })
              }
            }}
            options={targetSelectOptions}
          />
        )
      },
    },
  ]

  const isExecuting = promoteMutation.isPending || graduateMutation.isPending

  return (
    <AppModal
      title="Kenaikan Kelas"
      subtitle="Proses massal akhir tahun ajaran: naikkan santri ke kelas berikutnya dan luluskan tingkat akhir."
      icon={<RiseOutlined />}
      open={open}
      onCancel={onClose}
      width={880}
      footer={null}
      destroyOnHidden
    >

      <WizardSteps
        current={currentStep}
        items={[
          { title: 'Pemetaan Kelas', description: 'Atur tujuan tiap kelas' },
          { title: 'Konfirmasi', description: 'Review ringkasan aksi' },
          { title: 'Selesai', description: 'Hasil & opsi pembatalan' },
        ]}
      />

      {/* Step 0: Pemetaan Kelas */}
      {currentStep === 0 && (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <ModalNotice
            tone="info"
            title={
              activeYear
                ? `Tahun Ajaran Aktif Saat Ini: ${activeYear.name}`
                : 'Belum ada tahun ajaran yang ditandai aktif'
            }
          >
            Sistem telah menyarankan kelas tujuan berdasarkan tingkat & nama rombel (mis. 7A → 8A). Kelas tingkat 9 & 12 otomatis disarankan untuk diluluskan. Anda dapat mengubah pilihan per baris sebelum lanjut.
          </ModalNotice>

          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <span>Pemetaan Kelas Asal ke Kelas Baru</span>
                <Space>
                  <span style={{ fontSize: 13, fontWeight: 400 }}>Tahun kelulusan:</span>
                  <InputNumber
                    min={1980}
                    max={2200}
                    value={graduationYear}
                    onChange={(v) => v && setGraduationYear(v)}
                    style={{ width: 100 }}
                  />
                </Space>
              </div>
            }
          >
            <Table<SourceRow>
              columns={columns}
              dataSource={sourceRows}
              scroll={{ x: 'max-content' }}
              pagination={false}
              loading={studentsQuery.isPending || classesQuery.isPending}
              locale={{
                emptyText: <Empty description="Tidak ada siswa aktif yang perlu dinaikkan" />,
              }}
            />

            <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${token.colorBorderSecondary}` }}>
              <ModalFooter
                left={
                  <Typography.Text type="secondary">
                    Akan dipromosikan: <b>{summary.promoteCount}</b> · Diluluskan: <b>{summary.graduateCount}</b> · Dilewati: <b>{summary.skipCount}</b>
                  </Typography.Text>
                }
                onOk={() => setCurrentStep(1)}
                okText="Lanjut ke Konfirmasi"
                okIcon={<RiseOutlined />}
                okDisabled={summary.promoteCount === 0 && summary.graduateCount === 0}
              />
            </div>
          </Card>
        </Space>
      )}

      {/* Step 1: Konfirmasi */}
      {currentStep === 1 && (
        <Card title="Konfirmasi Kenaikan Kelas">
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={8}>
              <Card size="small" style={{ background: token.colorPrimaryBg, borderColor: token.colorPrimaryBorder }}>
                <div style={{ fontSize: 12, color: token.colorPrimaryText }}>Akan Naik Kelas</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: token.colorPrimaryTextActive }}>
                  {summary.promoteCount} santri
                </div>
                <div style={{ fontSize: 12, color: token.colorPrimaryTextHover, marginTop: 4 }}>
                  dari {sourceRows.filter((r) => r.target.type === 'class').length} kelas asal
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card size="small" style={{ background: token.colorSuccessBg, borderColor: token.colorSuccessBorder }}>
                <div style={{ fontSize: 12, color: token.colorSuccessTextActive }}>Akan Diluluskan ({graduationYear})</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: token.colorSuccessText }}>
                  {summary.graduateCount} santri
                </div>
                <div style={{ fontSize: 12, color: token.colorSuccessTextHover, marginTop: 4 }}>
                  pindah otomatis ke daftar Alumni
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card size="small" style={{ background: token.colorBgLayout, borderColor: token.colorBorderSecondary }}>
                <div style={{ fontSize: 12, color: token.colorTextSecondary }}>Dilewati / Tetap</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: token.colorText }}>
                  {summary.skipCount} santri
                </div>
                <div style={{ fontSize: 12, color: token.colorTextTertiary, marginTop: 4 }}>
                  termasuk santri tanpa kelas
                </div>
              </Card>
            </Col>
          </Row>

          <div style={{ marginTop: 20 }}>
            <ModalNotice tone="warning" title="Tindakan ini mengubah data siswa secara massal">
              Kenaikan kelas akan dicatat dengan ID batch sehingga dapat dibatalkan (undo) jika terjadi kesalahan. Santri yang diluluskan akan kehilangan kelas dan asramanya, serta pindah ke halaman Alumni.
            </ModalNotice>
          </div>

          <div style={{ marginTop: 24 }}>
            <ModalFooter
              left={
                <Button onClick={() => setCurrentStep(0)} disabled={isExecuting}>
                  Kembali & Koreksi
                </Button>
              }
              onOk={handleExecute}
              okText={`Eksekusi Kenaikan Kelas (${summary.promoteCount + summary.graduateCount} Santri)`}
              okIcon={<SafetyCertificateOutlined />}
              okDanger
              okLoading={isExecuting}
            />
          </div>
        </Card>
      )}

      {/* Step 2: Selesai + Undo */}
      {currentStep === 2 && executionResult && (
        <Card>
          <Result
            status="success"
            title="Kenaikan Kelas Berhasil Diproses"
            subTitle={
              <>
                Sebanyak <b>{executionResult.promotedCount} santri</b> berhasil dinaikkan kelas dan{' '}
                <b>{executionResult.graduatedCount} santri</b> diluluskan pada tahun {graduationYear}.
              </>
            }
            extra={[
              <Button key="back" type="primary" onClick={onClose}>
                Kembali ke Santri
              </Button>,
              <Button
                key="undo"
                danger
                icon={<UndoOutlined />}
                loading={undoing}
                onClick={handleUndo}
              >
                Batalkan Kenaikan Kelas (Undo)
              </Button>,
            ]}
          />
        </Card>
      )}
    </AppModal>
  )
}
