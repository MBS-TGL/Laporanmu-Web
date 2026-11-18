/**
 * Yudisium (P4): cek syarat kelulusan per santri (nilai lengkap, target
 * tahfidz, SPP lunas, poin disiplin) → keputusan → dokumen kelulusan.
 */
import { useMemo, useState } from 'react'
import {
  App,
  Button,
  Card,
  Empty,
  InputNumber,
  Segmented,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd'
import { PrinterOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import {
  fetchGraduationChecks,
  fetchSppOutstanding,
  fetchStudentPoints,
  fetchTahfidzCounts,
  saveGraduationCheck,
  type GraduationCheckRow,
} from '../api'
import { useActiveAcademicYear, useDocClassSubjects, useDocSemesterScores, useDocStudents } from '../hooks'
import { usePermissions, useProfile } from '../../../shared/hooks/useProfile'
import { useTablePagination } from '../../../shared/hooks/useTablePagination'
import { yudisiumChecks, yudisiumPassed, type YudisiumRequirement } from '../raporUtil'
import { DocPrintModal } from '../components/DocPrintModal'

interface StudentBrief {
  id: string
  name: string
}

const thStyle: React.CSSProperties = {
  border: '1px solid #000',
  padding: '5px 7px',
  textAlign: 'left',
  fontSize: 11,
}

export function YudisiumTab() {
  const { message } = App.useApp()
  const { canWrite } = usePermissions()
  const { profile } = useProfile()
  const activeYear = useActiveAcademicYear()
  const ayId = activeYear.data?.id
  const [classId, setClassId] = useState<string | undefined>(undefined)
  const [tahfidzTarget, setTahfidzTarget] = useState<number>(20)
  const [pointsLimit, setPointsLimit] = useState<number>(0)
  const [printStudent, setPrintStudent] = useState<{
    name: string
    requirements: YudisiumRequirement[]
    status: 'pending' | 'lulus' | 'ditahan'
  } | null>(null)

  const csQuery = useDocClassSubjects(classId, ayId)
  const classSubjects = useMemo(
    () => (csQuery.data ?? []).filter((cs) => cs.class_id === classId),
    [csQuery.data, classId],
  )
  const studentsQuery = useDocStudents(classId)
  const students = useMemo(() => studentsQuery.data ?? [], [studentsQuery.data])
  const studentIds = useMemo(() => students.map((s) => s.id), [students])

  const scoresQuery = useDocSemesterScores(classId, ayId, 2)
  const scoresByStudent = scoresQuery.data ?? {}

  const checksQuery = useQuery({
    queryKey: ['graduation-checks', ayId],
    queryFn: () => fetchGraduationChecks(ayId!),
    enabled: Boolean(ayId),
  })
  const savedByStudent = useMemo(() => {
    const map = new Map<string, GraduationCheckRow>()
    for (const r of checksQuery.data ?? []) map.set(r.student_id, r)
    return map
  }, [checksQuery.data])

  const tahfidzQuery = useQuery({
    queryKey: ['doc-tahfidz-counts', studentIds.join(',')],
    queryFn: () => fetchTahfidzCounts(studentIds),
    enabled: studentIds.length > 0,
  })
  const sppQuery = useQuery({
    queryKey: ['doc-spp-outstanding', studentIds.join(',')],
    queryFn: () => fetchSppOutstanding(studentIds),
    enabled: studentIds.length > 0,
  })
  const pointsQuery = useQuery({
    queryKey: ['doc-student-points', studentIds.join(',')],
    queryFn: () => fetchStudentPoints(studentIds),
    enabled: studentIds.length > 0,
  })

  const computeRequirements = (studentId: string): YudisiumRequirement[] => {
    const scores = scoresByStudent[studentId] ?? {}
    const missing = classSubjects.filter((cs) => typeof scores[cs.subject_id] !== 'number').length
    const tahfidzCount = tahfidzQuery.data?.get(studentId) ?? 0
    const sppOutstanding = sppQuery.data?.get(studentId) ?? 0
    const totalPoints = pointsQuery.data?.get(studentId) ?? 0
    return yudisiumChecks({
      gradesComplete: missing === 0 && classSubjects.length > 0,
      subjectsMissing: missing,
      tahfidzCount,
      tahfidzTarget,
      sppOutstanding,
      totalPoints,
      pointsLimit,
    })
  }

  const decide = async (student: StudentBrief, requirements: YudisiumRequirement[], status: 'lulus' | 'ditahan') => {
    try {
      await saveGraduationCheck({
        student_id: student.id,
        academic_year_id: ayId!,
        requirements: Object.fromEntries(requirements.map((r) => [r.key, r.pass])),
        status,
        notes: null,
        approved_by: profile?.id ?? null,
      })
      void message.success(`Yudisium ${student.name}: ${status}`)
    } catch (err) {
      message.error((err as Error).message || 'Gagal menyimpan keputusan yudisium')
    }
  }

  const rows = students.map((s) => {
    const requirements = computeRequirements(s.id)
    const saved = savedByStudent.get(s.id)
    return {
      key: s.id,
      name: s.name,
      requirements,
      passed: yudisiumPassed(requirements),
      status: (saved?.status ?? 'pending') as 'pending' | 'lulus' | 'ditahan',
      student: s,
    }
  })

  const pg = useTablePagination(rows.length, { defaultPageSize: 20, hideOnSinglePage: true })

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
            options={[...new Map((csQuery.data ?? []).filter((cs) => cs.classes).map((cs) => [cs.class_id, cs.classes!.name])).entries()].map(([id, name]) => ({ value: id, label: name }))}
            onChange={setClassId}
            aria-label="Pilih kelas"
          />
          <Space size={6}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Target tahfidz
            </Typography.Text>
            <InputNumber min={0} max={999} value={tahfidzTarget} onChange={(v) => setTahfidzTarget(Number(v ?? 0))} />
          </Space>
          <Space size={6}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Batas poin
            </Typography.Text>
            <InputNumber min={-500} max={0} value={pointsLimit} onChange={(v) => setPointsLimit(Number(v ?? 0))} />
          </Space>
        </Space>
        <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
          Nilai dihitung dari semester 2 tahun ajaran aktif; tahfidz dari total setoran; SPP dari selisih kewajiban-pembayaran; poin dari profil santri.
        </Typography.Text>
      </Card>

      {!classId ? (
        <Card>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Pilih kelas untuk menghitung yudisium kelulusan" />
        </Card>
      ) : scoresQuery.isPending || tahfidzQuery.isPending || sppQuery.isPending || pointsQuery.isPending ? (
        <Card>
          <div style={{ textAlign: 'center', padding: 32 }}>
            <Spin />
          </div>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Tidak ada santri aktif di kelas ini" />
        </Card>
      ) : (
        <Card
          title={
            <Space>
              <SafetyCertificateOutlined />
              <span>Yudisium Kelulusan · {activeYear.data?.name ?? ''}</span>
            </Space>
          }
          styles={{ body: { padding: '8px 12px' } }}
        >
          <Table
            rowKey="key"
            size="small"
            dataSource={rows}
            pagination={pg.pagination}
            columns={[
              {
                title: 'Santri',
                dataIndex: 'name',
                fixed: 'left' as const,
                width: 170,
                render: (name: string) => <Typography.Text strong>{name}</Typography.Text>,
              },
              {
                title: 'Cek Syarat',
                key: 'checks',
                render: (_: unknown, row: (typeof rows)[number]) => (
                  <Space size={4} wrap>
                    {row.requirements.map((r) => (
                      <Tag key={r.key} color={r.pass ? 'success' : 'error'} style={{ borderRadius: 999 }}>
                        {r.label}: {r.detail}
                      </Tag>
                    ))}
                  </Space>
                ),
              },
              {
                title: 'Status',
                dataIndex: 'status',
                width: 110,
                render: (status: (typeof rows)[number]['status']) => (
                  <Tag color={status === 'lulus' ? 'success' : status === 'ditahan' ? 'warning' : 'default'} style={{ borderRadius: 999 }}>
                    {status === 'lulus' ? 'Lulus' : status === 'ditahan' ? 'Ditahan' : 'Menunggu'}
                  </Tag>
                ),
              },
              {
                title: 'Keputusan',
                key: 'decide',
                width: 220,
                render: (_: unknown, row: (typeof rows)[number]) => (
                  <Space size={6}>
                    <Segmented
                      size="small"
                      value={row.status}
                      onChange={(v) => void decide(row.student, row.requirements, v as 'lulus' | 'ditahan')}
                      disabled={!canWrite}
                      options={[
                        { label: 'Lulus', value: 'lulus' },
                        { label: 'Ditahan', value: 'ditahan' },
                      ]}
                    />
                    <Button
                      size="small"
                      icon={<PrinterOutlined />}
                      onClick={() =>
                        setPrintStudent({
                          name: row.name,
                          requirements: row.requirements,
                          status: row.status,
                        })
                      }
                      aria-label={`Cetak dokumen ${row.name}`}
                    >
                      Dokumen
                    </Button>
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      )}

      <DocPrintModal
        open={printStudent !== null}
        onClose={() => setPrintStudent(null)}
        title="SURAT KETETAPAN KELULUSAN"
        subtitle={`Tahun Ajaran ${activeYear.data?.name ?? ''}`}
      >
        {printStudent && (
          <>
            <div style={{ fontSize: 12, marginBottom: 10 }}>
              Berdasarkan hasil yudisium, santri berikut ditetapkan:{' '}
              <b>{printStudent.status === 'lulus' ? 'LULUS' : 'DITAHAN'}</b>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{printStudent.name}</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
              <thead>
                <tr style={{ background: '#f1f5f9' }}>
                  <th style={thStyle}>Syarat</th>
                  <th style={thStyle}>Hasil</th>
                  <th style={thStyle}>Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {printStudent.requirements.map((r) => (
                  <tr key={r.key}>
                    <td style={thStyle}>{r.label}</td>
                    <td style={thStyle}>{r.pass ? 'Terpenuhi' : 'Belum'}</td>
                    <td style={thStyle}>{r.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </DocPrintModal>
    </div>
  )
}
