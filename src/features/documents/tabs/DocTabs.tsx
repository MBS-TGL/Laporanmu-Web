/**
 * KHS (semester), Transkrip (per tahun ajaran), dan Buku Induk (biodata)
 * — tiga dokumen kelas yang memakai pola cetak yang sama.
 */
import { useMemo, useState } from 'react'
import { App, Button, Card, Empty, Segmented, Select, Space, Spin, Table, Typography } from 'antd'
import { PrinterOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { fetchClassSubjectsBrief, fetchSemesterScoresForClass } from '../../grades/api'
import {
  useActiveAcademicYear,
  useAcademicYearsList,
  useDocClassSubjects,
  useDocSemesterScores,
  useDocStudents,
} from '../hooks'
import { fetchBukuIndukStudents } from '../api'
import { downloadXlsx } from '../../../shared/export/download'
import { useTablePagination } from '../../../shared/hooks/useTablePagination'
import { DocPrintModal } from '../components/DocPrintModal'
import { predikatLabel, predikatOf } from '../raporUtil'

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

function ClassPicker({
  classId,
  onChange,
  classSubjects,
  csLoading,
}: {
  classId: string | undefined
  onChange: (v: string) => void
  classSubjects: Array<{ class_id: string; classes: { name: string } | null }>
  csLoading: boolean
}) {
  const options = useMemo(
    () =>
      [
        ...new Map(
          classSubjects.filter((cs) => cs.classes).map((cs) => [cs.class_id, cs.classes!.name]),
        ).entries(),
      ].map(([id, name]) => ({ value: id, label: name })),
    [classSubjects],
  )
  return (
    <Select
      showSearch
      optionFilterProp="label"
      placeholder="Pilih kelas"
      style={{ minWidth: 180 }}
      value={classId}
      options={options}
      loading={csLoading}
      onChange={onChange}
      aria-label="Pilih kelas"
    />
  )
}

// ─── KHS: satu santri, satu semester ─────────────────────────────────────────

export function KhsTab() {
  const activeYear = useActiveAcademicYear()
  const ayId = activeYear.data?.id
  const [classId, setClassId] = useState<string | undefined>(undefined)
  const [studentId, setStudentId] = useState<string | undefined>(undefined)
  const [semester, setSemester] = useState<'1' | '2'>('1')
  const [printOpen, setPrintOpen] = useState(false)

  const csQuery = useDocClassSubjects(classId, ayId)
  const classSubjects = useMemo(
    () => (csQuery.data ?? []).filter((cs) => cs.class_id === classId),
    [csQuery.data, classId],
  )
  const studentsQuery = useDocStudents(classId)
  const students = studentsQuery.data ?? []
  const scoresQuery = useDocSemesterScores(classId, ayId, Number(semester) as 1 | 2)
  const studentScores = studentId ? (scoresQuery.data?.[studentId] ?? {}) : {}
  const student = students.find((s) => s.id === studentId)

  const rows = useMemo(
    () =>
      classSubjects.map((cs) => ({
        subject: cs.subjects?.name ?? 'Tanpa mapel',
        score: (studentScores[cs.subject_id] as number | null | undefined) ?? null,
        kkm: cs.kkm_override ?? cs.subjects?.kkm ?? 75,
      })),
    [classSubjects, studentScores],
  )

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Card styles={{ body: { padding: '12px 16px' } }}>
        <Space wrap size={10} align="center">
          <ClassPicker classId={classId} onChange={(v) => { setClassId(v); setStudentId(undefined) }} classSubjects={csQuery.data ?? []} csLoading={csQuery.isPending} />
          <Segmented
            value={semester}
            onChange={(v) => setSemester(v as '1' | '2')}
            options={[
              { label: 'Semester 1', value: '1' },
              { label: 'Semester 2', value: '2' },
            ]}
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
          <Button type="primary" icon={<PrinterOutlined />} disabled={!studentId} onClick={() => setPrintOpen(true)}>
            Cetak KHS
          </Button>
        </Space>
      </Card>

      {!studentId ? (
        <Card>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Pilih kelas dan santri untuk menyusun KHS" />
        </Card>
      ) : (
        <KhsPrintTable
          studentName={student?.name ?? ''}
          semesterLabel={semester === '1' ? '1 (Ganjil)' : '2 (Genap)'}
          yearName={activeYear.data?.name ?? ''}
          rows={rows}
          printOpen={printOpen}
          setPrintOpen={setPrintOpen}
        />
      )}
    </div>
  )
}

function KhsPrintTable({
  studentName,
  semesterLabel,
  yearName,
  rows,
  printOpen,
  setPrintOpen,
}: {
  studentName: string
  semesterLabel: string
  yearName: string
  rows: Array<{ subject: string; score: number | null; kkm: number }>
  printOpen: boolean
  setPrintOpen: (v: boolean) => void
}) {
  return (
    <>
      <Card title={`Kartu Hasil Studi · ${studentName}`} styles={{ body: { padding: '8px 12px' } }}>
        <Table
          rowKey="subject"
          size="small"
          pagination={false}
          dataSource={rows}
          columns={[
            { title: 'Mapel', dataIndex: 'subject' },
            { title: 'Nilai', dataIndex: 'score', width: 90, render: (v: number | null) => v ?? '-' },
            { title: 'KKM', dataIndex: 'kkm', width: 80 },
            {
              title: 'Ket',
              key: 'ket',
              width: 160,
              render: (_: unknown, r: { score: number | null }) => {
                const p = predikatOf(r.score)
                return p ? `${p} · ${predikatLabel(p)}` : '-'
              },
            },
          ]}
        />
      </Card>
      <DocPrintModal
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        title="KARTU HASIL STUDI (KHS)"
        subtitle={`Semester ${semesterLabel}${yearName ? ` · Tahun Ajaran ${yearName}` : ''}`}
      >
        <div style={{ fontSize: 12, marginBottom: 10 }}>Nama: <b>{studentName}</b></div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
          <thead>
            <tr style={{ background: '#f1f5f9' }}>
              <th style={thStyle}>No</th>
              <th style={thStyle}>Mapel</th>
              <th style={thStyle}>Nilai</th>
              <th style={thStyle}>KKM</th>
              <th style={thStyle}>Predikat</th>
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
              </tr>
            ))}
          </tbody>
        </table>
      </DocPrintModal>
    </>
  )
}

// ─── Transkrip: satu santri, semua tahun ajaran ─────────────────────────────

export function TranscriptTab() {
  const activeYear = useActiveAcademicYear()
  const yearsQuery = useAcademicYearsList()
  const [classId, setClassId] = useState<string | undefined>(undefined)
  const [studentId, setStudentId] = useState<string | undefined>(undefined)
  const [printOpen, setPrintOpen] = useState(false)

  const csQuery = useDocClassSubjects(classId, activeYear.data?.id)
  const studentsQuery = useDocStudents(classId)
  const students = studentsQuery.data ?? []
  const student = students.find((s) => s.id === studentId)
  const years = yearsQuery.data ?? []
  const yearKey = years.map((y) => y.id).join(',')

  // Satu query agregat: per tahun ajaran, class_subjects + nilai semester 1 & 2.
  // (Jangan hooks-in-loop — jumlah hook harus stabil antar render.)
  const transcriptQuery = useQuery({
    queryKey: ['doc-transcript', classId, yearKey],
    queryFn: async () => {
      const out: Array<{
        yearId: string
        yearName: string
        subjects: Array<{ subject: string; subject_id: string; kkm: number }>
        sem1: Record<string, Record<string, number | null>>
        sem2: Record<string, Record<string, number | null>>
      }> = []
      for (const y of years) {
        const [csList, sem1, sem2] = await Promise.all([
          fetchClassSubjectsBrief(y.id),
          fetchSemesterScoresForClass(classId!, y.id, 1),
          fetchSemesterScoresForClass(classId!, y.id, 2),
        ])
        out.push({
          yearId: y.id,
          yearName: y.name,
          subjects: csList
            .filter((cs) => cs.class_id === classId)
            .map((cs) => ({
              subject: cs.subjects?.name ?? 'Tanpa mapel',
              subject_id: cs.subject_id,
              kkm: cs.kkm_override ?? cs.subjects?.kkm ?? 75,
            })),
          sem1: sem1 as Record<string, Record<string, number | null>>,
          sem2: sem2 as Record<string, Record<string, number | null>>,
        })
      }
      return out
    },
    enabled: Boolean(classId) && years.length > 0,
  })
  const transcript = transcriptQuery.data ?? []

  const columnsLabels = transcript.flatMap((t) => [
    `${t.yearName} · Sem 1`,
    `${t.yearName} · Sem 2`,
  ])

  // Gabungan mapel unik (urut abjad) + matriks nilai per label
  const subjectUnion = useMemo(() => {
    const seen = new Set<string>()
    for (const t of transcript) for (const s of t.subjects) seen.add(s.subject)
    return [...seen].sort((a, b) => a.localeCompare(b, 'id'))
  }, [transcript])

  const scoreMatrix = useMemo(() => {
    const bySubject = new Map<string, Record<string, number | null>>()
    for (const t of transcript) {
      for (const cs of t.subjects) {
        const row = bySubject.get(cs.subject) ?? {}
        row[`${t.yearName} · Sem 1`] = t.sem1[studentId ?? '']?.[cs.subject_id] ?? null
        row[`${t.yearName} · Sem 2`] = t.sem2[studentId ?? '']?.[cs.subject_id] ?? null
        bySubject.set(cs.subject, row)
      }
    }
    return bySubject
  }, [transcript, studentId])

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
            options={(csQuery.data ?? [])
              .filter((cs) => cs.classes)
              .map((cs) => ({ value: cs.class_id, label: cs.classes!.name }))
              .filter((opt, i, arr) => arr.findIndex((o) => o.value === opt.value) === i)}
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
          <Button type="primary" icon={<PrinterOutlined />} disabled={!studentId} onClick={() => setPrintOpen(true)}>
            Cetak Transkrip
          </Button>
        </Space>
        <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
          Nilai per mapel diambil dari kelas terpilih pada tiap tahun ajaran. Anggota kelas mengikuti daftar santri kelas itu di tiap tahun.
        </Typography.Text>
      </Card>

      {!studentId ? (
        <Card>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Pilih kelas dan santri untuk menyusun transkrip" />
        </Card>
      ) : transcriptQuery.isPending ? (
        <Card>
          <div style={{ textAlign: 'center', padding: 32 }}>
            <Spin />
          </div>
        </Card>
      ) : (
        <Card
          title={`Transkrip Nilai · ${student?.name ?? ''}`}
          styles={{ body: { padding: '8px 12px' } }}
        >
          <Table
            rowKey="subject"
            size="small"
            pagination={false}
            dataSource={subjectUnion.map((subject) => ({ subject }))}
            columns={[
              { title: 'Mapel', dataIndex: 'subject', fixed: 'left' as const, width: 160 },
              ...columnsLabels.map((label) => ({
                title: label,
                key: label,
                width: 110,
                render: (_: unknown, r: { subject: string }) => {
                  const v = scoreMatrix.get(r.subject)?.[label]
                  return v ?? '-'
                },
              })),
            ]}
            scroll={{ x: 160 + columnsLabels.length * 110 }}
          />
        </Card>
      )}

      <DocPrintModal
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        title="TRANSKRIP NILAI"
        subtitle="Gabungan nilai semester selama menempuh pendidikan"
      >
        <div style={{ fontSize: 12, marginBottom: 10 }}>Nama: <b>{student?.name ?? ''}</b></div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ background: '#f1f5f9' }}>
              <th style={thStyle}>Mapel</th>
              {columnsLabels.map((label) => (
                <th key={label} style={thStyle}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {subjectUnion.map((subject) => (
              <tr key={subject}>
                <td style={tdStyle}>{subject}</td>
                {columnsLabels.map((label) => (
                  <td key={label} style={tdStyle}>{scoreMatrix.get(subject)?.[label] ?? '-'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </DocPrintModal>
    </div>
  )
}

// ─── Buku induk: biodata satu kelas ─────────────────────────────────────────

export function BukuIndukTab() {
  const { message } = App.useApp()
  const activeYear = useActiveAcademicYear()
  const ayId = activeYear.data?.id
  const [classId, setClassId] = useState<string | undefined>(undefined)
  const [printOpen, setPrintOpen] = useState(false)

  const csQuery = useDocClassSubjects(classId, ayId)
  const query = useQuery({
    queryKey: ['buku-induk', classId],
    queryFn: () => fetchBukuIndukStudents(classId!),
    enabled: Boolean(classId),
  })
  const students = query.data ?? []
  const pg = useTablePagination(students.length, { defaultPageSize: 20, hideOnSinglePage: true })

  const exportXlsx = async () => {
    try {
      await downloadXlsx(
        'buku-induk',
        'Buku Induk',
        ['No', 'Nama', 'NIS', 'NISN', 'L/P', 'Tempat Lahir', 'Tanggal Lahir', 'Alamat', 'Nama Wali', 'HP Wali'],
        students.map((s, i) => [
          i + 1,
          s.name,
          s.nis ?? '',
          s.nisn ?? '',
          s.gender ?? '',
          s.birth_place ?? '',
          s.birth_date ?? '',
          s.address ?? '',
          s.parent_name ?? '',
          s.parent_phone ?? '',
        ]),
      )
      void message.success('Buku induk diekspor')
    } catch (err) {
      message.error((err as Error).message || 'Gagal mengekspor')
    }
  }

  const columns = [
    { title: 'Nama', dataIndex: 'name', fixed: 'left' as const, width: 170 },
    { title: 'NIS', dataIndex: 'nis', width: 110 },
    { title: 'NISN', dataIndex: 'nisn', width: 110 },
    { title: 'L/P', dataIndex: 'gender', width: 60 },
    { title: 'Tempat/Tgl Lahir', key: 'birth', width: 180, render: (_: unknown, r: { birth_place: string | null; birth_date: string | null }) => `${r.birth_place ?? ''}${r.birth_date ? `, ${r.birth_date}` : ''}` },
    { title: 'Alamat', dataIndex: 'address', ellipsis: true },
    { title: 'Wali', dataIndex: 'parent_name', width: 150 },
    { title: 'HP Wali', dataIndex: 'parent_phone', width: 130 },
  ]

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Card styles={{ body: { padding: '12px 16px' } }}>
        <Space wrap size={10} align="center">
          <ClassPicker classId={classId} onChange={setClassId} classSubjects={csQuery.data ?? []} csLoading={csQuery.isPending} />
          <Button icon={<PrinterOutlined />} disabled={!classId} onClick={() => setPrintOpen(true)}>
            Cetak
          </Button>
          <Button disabled={!classId || students.length === 0} onClick={() => void exportXlsx()}>
            Unduh Excel
          </Button>
        </Space>
      </Card>

      {!classId ? (
        <Card>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Pilih kelas untuk melihat buku induk" />
        </Card>
      ) : query.isPending ? (
        <Card>
          <div style={{ textAlign: 'center', padding: 32 }}>
            <Spin />
          </div>
        </Card>
      ) : (
        <Card title={`Buku Induk · ${students.length} santri`} styles={{ body: { padding: '8px 12px' } }}>
          <Table rowKey="id" size="small" columns={columns} dataSource={students} pagination={pg.pagination} scroll={{ x: 900 }} />
        </Card>
      )}

      <DocPrintModal
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        title="BUKU INDUK SANTRI"
        subtitle={activeYear.data?.name ?? ''}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ background: '#f1f5f9' }}>
              <th style={thStyle}>No</th>
              <th style={thStyle}>Nama</th>
              <th style={thStyle}>NIS/NISN</th>
              <th style={thStyle}>L/P</th>
              <th style={thStyle}>Lahir</th>
              <th style={thStyle}>Wali</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s, i) => (
              <tr key={s.id}>
                <td style={tdStyle}>{i + 1}</td>
                <td style={tdStyle}>{s.name}</td>
                <td style={tdStyle}>{[s.nis, s.nisn].filter(Boolean).join(' / ')}</td>
                <td style={tdStyle}>{s.gender ?? '-'}</td>
                <td style={tdStyle}>{`${s.birth_place ?? ''}${s.birth_date ? `, ${s.birth_date}` : ''}`}</td>
                <td style={tdStyle}>{s.parent_name ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DocPrintModal>
    </div>
  )
}
