/**
 * Rapor Kurmer (P4): nilai semester per mapel + KKM + predikat +
 * deskripsi otomatis + polesan AI (callAi, guru review sebelum cetak).
 */
import { useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Col,
  Empty,
  Input,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
  theme,
} from 'antd'
import { BulbOutlined, PrinterOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useAcademicYearsList, useActiveAcademicYear } from '../hooks'
import {
  fetchClassSubjectsBrief,
  fetchSemesterScoresForClass,
  fetchClassStudents,
} from '../../grades/api'
import { callAi } from '../../../shared/lib/ai'
import { usePermissions } from '../../../shared/hooks/useProfile'
import { DocPrintModal } from '../components/DocPrintModal'
import { RaporRadarChart } from '../components/RaporRadarChart'
import { autoDescription, predikatLabel, predikatOf } from '../raporUtil'

const AI_SYSTEM =
  'Kamu guru madrasah Indonesia. Perbaiki kalimat deskripsi capaian mapel agar mengalir, ' +
  'objektif, dan hangat. Pertahankan angka nilai dan nama mapel. Jawab per baris dengan ' +
  'format "MAPEL|deskripsi" tanpa penjelasan lain.'

interface SubjectRow {
  subject: string
  score: number | null
  kkm: number
}

export function RaporTab() {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const { canWrite } = usePermissions()
  const activeYear = useActiveAcademicYear()
  const yearsQuery = useAcademicYearsList()
  const ayId = activeYear.data?.id
  const [classId, setClassId] = useState<string | undefined>(undefined)
  const [studentId, setStudentId] = useState<string | undefined>(undefined)
  const [semester, setSemester] = useState<'1' | '2'>('1')
  const [printOpen, setPrintOpen] = useState(false)
  const [printWithRadar, setPrintWithRadar] = useState(true)
  const [aiDraft, setAiDraft] = useState<Record<string, string>>({})
  const [aiLoading, setAiLoading] = useState(false)

  const csQuery = useQuery({
    queryKey: ['doc-class-subjects', ayId],
    queryFn: () => fetchClassSubjectsBrief(ayId!),
    enabled: Boolean(ayId),
  })
  const classSubjects = useMemo(
    () => (csQuery.data ?? []).filter((cs) => cs.class_id === classId),
    [csQuery.data, classId],
  )

  const studentsQuery = useQuery({
    queryKey: ['doc-students', classId],
    queryFn: () => fetchClassStudents(classId!),
    enabled: Boolean(classId),
  })
  const students = useMemo(() => studentsQuery.data ?? [], [studentsQuery.data])

  const scoresQuery = useQuery({
    queryKey: ['doc-semester-scores', classId, ayId, semester],
    queryFn: () => fetchSemesterScoresForClass(classId!, ayId!, Number(semester) as 1 | 2),
    enabled: Boolean(classId) && Boolean(ayId),
  })
  const student = students.find((s) => s.id === studentId)

  const rows = useMemo<SubjectRow[]>(() => {
    const scoresByStudent = scoresQuery.data ?? {}
    const studentScores = studentId ? (scoresByStudent[studentId] ?? {}) : {}
    return classSubjects.map((cs) => {
      const subjectId = cs.subject_id
      const score = studentScores[subjectId] ?? null
      return {
        subject: cs.subjects?.name ?? 'Tanpa mapel',
        score: typeof score === 'number' ? score : null,
        kkm: cs.kkm_override ?? cs.subjects?.kkm ?? 75,
      }
    })
  }, [classSubjects, scoresQuery.data, studentId])

  const avg = useMemo(() => {
    const nums = rows.filter((r) => r.score !== null).map((r) => r.score as number)
    if (nums.length === 0) return null
    return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100
  }, [rows])

  const descFor = (r: SubjectRow) => aiDraft[r.subject] ?? autoDescription(r.subject, r.score)

  const runAiPolish = async () => {
    if (rows.length === 0) return
    setAiLoading(true)
    try {
      const prompt = rows
        .map((r) => `${r.subject}|${autoDescription(r.subject, r.score)}`)
        .join('\n')
      const reply = await callAi({ system: AI_SYSTEM, prompt, maxOutputTokens: 2048 })
      const map: Record<string, string> = {}
      for (const line of reply.split('\n')) {
        const [subject, ...rest] = line.split('|')
        if (subject && rest.length > 0) map[subject.trim()] = rest.join('|').trim()
      }
      if (Object.keys(map).length === 0) {
        message.info('AI tidak mengembalikan hasil yang bisa dipakai, deskripsi tetap otomatis')
      } else {
        setAiDraft(map)
        message.success('Deskripsi AI siap, tinjau dan edit sebelum cetak')
      }
    } catch (err) {
      message.error((err as Error).message || 'Gagal memanggil AI')
    } finally {
      setAiLoading(false)
    }
  }

  const columns = [
    {
      title: 'Mapel',
      dataIndex: 'subject',
      key: 'subject',
      render: (v: string) => <Typography.Text strong>{v}</Typography.Text>,
    },
    {
      title: 'Nilai',
      dataIndex: 'score',
      key: 'score',
      width: 90,
      render: (v: number | null) =>
        v === null ? <Tag style={{ borderRadius: 999 }}>Belum ada</Tag> : <Typography.Text style={{ fontVariantNumeric: 'tabular-nums' }}>{v}</Typography.Text>,
    },
    { title: 'KKM', dataIndex: 'kkm', key: 'kkm', width: 70 },
    {
      title: 'Predikat',
      key: 'predikat',
      width: 110,
      render: (_: unknown, r: SubjectRow) => {
        const p = predikatOf(r.score)
        if (!p) return '-'
        const color = p === 'A' ? 'success' : p === 'B' ? 'processing' : p === 'C' ? 'warning' : 'error'
        return <Tag color={color} style={{ borderRadius: 999 }}>{p} · {predikatLabel(p)}</Tag>
      },
    },
  ]

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Card styles={{ body: { padding: '12px 16px' } }}>
        <Space wrap size={10} align="center">
          <Select
            placeholder="Tahun ajaran"
            style={{ minWidth: 160 }}
            value={ayId}
            disabled
            options={(yearsQuery.data ?? []).map((y) => ({ value: y.id, label: y.name }))}
          />
          <Segmented
            value={semester}
            onChange={(v) => setSemester(v as '1' | '2')}
            options={[
              { label: 'Semester 1 (Ganjil)', value: '1' },
              { label: 'Semester 2 (Genap)', value: '2' },
            ]}
          />
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Pilih kelas"
            style={{ minWidth: 180 }}
            value={classId}
            options={[...new Map((csQuery.data ?? []).filter((cs) => cs.classes).map((cs) => [cs.class_id, cs.classes!.name])).entries()].map(([id, name]) => ({ value: id, label: name }))}
            onChange={(v) => {
              setClassId(v)
              setStudentId(undefined)
            }}
            aria-label="Pilih kelas"
          />
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Pilih santri"
            style={{ minWidth: 220 }}
            value={studentId}
            options={students.map((s) => ({ value: s.id, label: s.name }))}
            onChange={setStudentId}
            disabled={!classId}
            aria-label="Pilih santri"
          />
          <Tooltip title="Poleskan deskripsi dengan AI, lalu tinjau sebelum cetak">
            <Button
              icon={<BulbOutlined />}
              loading={aiLoading}
              disabled={!studentId || rows.length === 0}
              onClick={() => void runAiPolish()}
            >
              Poleskan AI
            </Button>
          </Tooltip>
          <Button
            type="primary"
            icon={<PrinterOutlined />}
            disabled={!studentId}
            onClick={() => setPrintOpen(true)}
          >
            Cetak Rapor
          </Button>
        </Space>
        {avg !== null && (
          <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
            Rata-rata {rows.filter((r) => r.score !== null).length}/{rows.length} mapel terisi: <b style={{ color: token.colorText }}>{avg}</b>
          </Typography.Text>
        )}
      </Card>

      {!studentId ? (
        <Card>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Pilih kelas dan santri untuk menyusun raport" />
        </Card>
      ) : scoresQuery.isPending ? (
        <Card>
          <div style={{ textAlign: 'center', padding: 32 }}>
            <Spin />
          </div>
        </Card>
      ) : (
        <Row gutter={[16, 16]} align="top">
          <Col xs={24} lg={rows.length >= 3 ? 14 : 24}>
            <Card
              title={`Rapor Semester ${semester === '1' ? '1 (Ganjil)' : '2 (Genap)'} · ${student?.name ?? ''}`}
              styles={{ body: { padding: '8px 12px' } }}
            >
              <Table rowKey="subject" size="small" columns={columns} dataSource={rows} pagination={false} />
              <div style={{ marginTop: 12 }}>
                <Typography.Text strong style={{ fontSize: 12.5 }}>
                  Deskripsi per mapel {Object.keys(aiDraft).length > 0 && '(hasil polesan AI, dapat diedit)'}
                </Typography.Text>
                <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                  {rows.map((r) => (
                    <div key={r.subject}>
                      <Typography.Text style={{ fontSize: 12, fontWeight: 600 }}>{r.subject}</Typography.Text>
                      <Input.TextArea
                        rows={2}
                        value={descFor(r)}
                        onChange={(e) => setAiDraft((prev) => ({ ...prev, [r.subject]: e.target.value }))}
                        disabled={!canWrite}
                        style={{ marginTop: 4 }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </Col>

          {rows.length >= 3 && (
            <Col xs={24} lg={10}>
              <div style={{ position: 'sticky', top: 76 }}>
                <RaporRadarChart data={rows} height={340} />
              </div>
            </Col>
          )}
        </Row>
      )}

      <DocPrintModal
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        title="RAPORT CAPAIAN PEMBELAJARAN"
        subtitle={`Semester ${semester === '1' ? '1 (Ganjil)' : '2 (Genap)'}${activeYear.data?.name ? ` · Tahun Ajaran ${activeYear.data.name}` : ''}`}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 12 }}>Nama: <b>{student?.name ?? ''}</b></div>
          {rows.length >= 3 && (
            <div className="no-print">
              <Checkbox
                checked={printWithRadar}
                onChange={(e) => setPrintWithRadar(e.target.checked)}
              >
                Sertakan Grafik Capaian
              </Checkbox>
            </div>
          )}
        </div>

        {printWithRadar && rows.length >= 3 && (
          <div style={{ marginBottom: 16, borderBottom: '1px solid #e2e8f0', paddingBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 6, textAlign: 'center' }}>
              DIAGRAM CAPAIAN KOMPETENSI SISWA VS STANDAR KKM
            </div>
            <RaporRadarChart data={rows} height={260} isPrint />
          </div>
        )}

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
          <thead>
            <tr style={{ background: '#f1f5f9' }}>
              <th style={thStyle}>No</th>
              <th style={thStyle}>Mapel</th>
              <th style={thStyle}>Nilai</th>
              <th style={thStyle}>KKM</th>
              <th style={thStyle}>Predikat</th>
              <th style={thStyle}>Deskripsi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.subject}>
                <td style={tdStyle}>{i + 1}</td>
                <td style={tdStyle}>{r.subject}</td>
                <td style={tdStyle}>{r.score ?? '-'}</td>
                <td style={tdStyle}>{r.kkm}</td>
                <td style={tdStyle}>{predikatOf(r.score) ?? '-'}</td>
                <td style={tdStyle}>{descFor(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {avg !== null && <div style={{ fontSize: 11.5, marginTop: 8 }}>Rata-rata: <b>{avg}</b></div>}
      </DocPrintModal>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  border: '1px solid #000',
  padding: '5px 7px',
  textAlign: 'left',
  fontSize: 11,
}

const tdStyle: React.CSSProperties = {
  border: '1px solid #000',
  padding: '5px 7px',
  verticalAlign: 'top',
  fontSize: 11,
}

// Alert keterangan AI opsional
export function RaporAiNote() {
  return (
    <Alert
      type="info"
      showIcon
      message="Polesan AI opsional"
      description="Jika layanan AI belum dikonfigurasi di server, tombol AI hanya mengembalikan catatan. Deskripsi otomatis selalu tersedia."
      style={{ borderRadius: 10 }}
    />
  )
}
