import { useMemo } from 'react'
import {
  Button,
  Card,
  Empty,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  theme,
  type TableColumnsType,
} from 'antd'
import {
  DownloadOutlined,
  PrinterOutlined,
} from '@ant-design/icons'
import Papa from 'papaparse'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../shared/components/PageHeader'
import { useAcademicYearsBrief } from '../classes/hooks'
import { useClassSubjectsBrief, useClassStudents, useSemesterScoresForClass } from './hooks'
import type { AssessmentStudent } from './types'

export function LegerPage() {
  const { token } = theme.useToken()
  const [searchParams, setSearchParams] = useSearchParams()

  const yearsQuery = useAcademicYearsBrief()
  const activeYear = useMemo(
    () => yearsQuery.data?.find((y) => y.is_active) ?? yearsQuery.data?.[0],
    [yearsQuery.data],
  )

  const selectedYearId = searchParams.get('ay') ?? activeYear?.id
  const selectedSemester = ((Number(searchParams.get('sem')) || 1) as 1 | 2)
  const selectedClassId = searchParams.get('class') ?? ''

  const csQuery = useClassSubjectsBrief(selectedYearId)
  const allClassSubjects = csQuery.data ?? []

  // Daftar kelas unik dari class_subjects tahun ajaran
  const classOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const cs of allClassSubjects) {
      if (cs.class_id && cs.classes?.name) {
        map.set(cs.class_id, cs.classes.name)
      }
    }
    return [...map.entries()].map(([id, name]) => ({ value: id, label: name }))
  }, [allClassSubjects])

  const effectiveClassId = selectedClassId || classOptions[0]?.value || ''

  // Mapel-mapel di kelas terpilih
  const classSubjects = useMemo(
    () => allClassSubjects.filter((cs) => cs.class_id === effectiveClassId),
    [allClassSubjects, effectiveClassId],
  )

  const studentsQuery = useClassStudents(effectiveClassId || undefined)
  const students = studentsQuery.data ?? []

  const scoresQuery = useSemesterScoresForClass(
    effectiveClassId || undefined,
    selectedYearId,
    selectedSemester,
  )
  const scoresMap = scoresQuery.data ?? {}

  // Hitung rata-rata dan peringkat per santri
  interface LegerRow extends AssessmentStudent {
    scores: Record<string, number | null>
    avg: number | null
    tuntasCount: number
    rank?: number
  }

  const rows: LegerRow[] = useMemo(() => {
    const computed: LegerRow[] = students.map((s) => {
      const studentScores = scoresMap[s.id] ?? {}
      const vals: number[] = []
      let tuntas = 0

      for (const cs of classSubjects) {
        const score = studentScores[cs.subject_id]
        if (typeof score === 'number') {
          vals.push(score)
          const kkm = cs.kkm_override ?? cs.subjects?.kkm ?? 50
          if (score >= kkm) tuntas += 1
        }
      }

      const avg = vals.length > 0 ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : null
      return {
        ...s,
        scores: studentScores,
        avg,
        tuntasCount: tuntas,
      }
    })

    // Hitung rank berdasarkan avg desc (null di akhir)
    const sorted = [...computed].sort((a, b) => {
      if (a.avg === null && b.avg === null) return 0
      if (a.avg === null) return 1
      if (b.avg === null) return -1
      return b.avg - a.avg
    })

    let currentRank = 1
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].avg === null) {
        sorted[i].rank = undefined
      } else {
        if (i > 0 && sorted[i].avg === sorted[i - 1].avg) {
          sorted[i].rank = sorted[i - 1].rank
        } else {
          sorted[i].rank = currentRank
        }
        currentRank++
      }
    }

    return sorted
  }, [students, scoresMap, classSubjects])

  const handleExportCsv = () => {
    const header = [
      'Peringkat',
      'NIS/Kode',
      'Nama Santri',
      ...classSubjects.map((cs) => cs.subjects?.name ?? 'Mapel'),
      'Rata-rata',
      'Tuntas / Total',
    ]

    const data = rows.map((r) => [
      r.rank ?? '-',
      r.registration_code,
      r.name,
      ...classSubjects.map((cs) => r.scores[cs.subject_id] ?? '-'),
      r.avg ?? '-',
      `${r.tuntasCount}/${classSubjects.length}`,
    ])

    const csv = Papa.unparse({ fields: header, data })
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leger-${selectedYearId}-sem${selectedSemester}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const columns: TableColumnsType<LegerRow> = [
    {
      title: 'Rank',
      key: 'rank',
      fixed: 'left',
      width: 65,
      align: 'center',
      render: (_, r) => (r.rank ? <b>#{r.rank}</b> : <span style={{ color: token.colorTextTertiary }}>—</span>),
    },
    {
      title: 'Santri',
      key: 'name',
      fixed: 'left',
      width: 200,
      render: (_, r) => (
        <div>
          <span style={{ fontWeight: 600 }}>{r.name}</span>
          <div style={{ fontSize: 11.5, color: token.colorTextTertiary }}>
            {r.registration_code}
          </div>
        </div>
      ),
    },
    ...classSubjects.map((cs) => {
      const kkm = cs.kkm_override ?? cs.subjects?.kkm ?? 50
      return {
        title: (
          <Tooltip title={`KKM: ${kkm}${cs.teachers?.name ? ` · Guru: ${cs.teachers.name}` : ''}`}>
            <div>
              <div style={{ fontWeight: 600 }}>{cs.subjects?.code ?? cs.subjects?.name}</div>
              <div style={{ fontSize: 10, color: token.colorTextTertiary }}>KKM {kkm}</div>
            </div>
          </Tooltip>
        ),
        key: cs.subject_id,
        width: 85,
        align: 'center' as const,
        render: (_: unknown, r: LegerRow) => {
          const score = r.scores[cs.subject_id]
          if (typeof score !== 'number') {
            return <span style={{ color: token.colorTextTertiary }}>—</span>
          }
          const isTuntas = score >= kkm
          return (
            <span
              style={{
                fontWeight: 600,
                color: isTuntas ? undefined : token.colorError,
              }}
            >
              {score}
            </span>
          )
        },
      }
    }),
    {
      title: 'Rata-rata',
      key: 'avg',
      fixed: 'right',
      width: 90,
      align: 'center',
      render: (_, r) => (r.avg !== null ? <b>{r.avg}</b> : '—'),
    },
    {
      title: 'Ketuntasan',
      key: 'tuntas',
      fixed: 'right',
      width: 110,
      align: 'center',
      render: (_, r) => {
        if (r.avg === null) return <Tag>—</Tag>
        const allTuntas = r.tuntasCount === classSubjects.length
        return (
          <Tag color={allTuntas ? 'success' : 'warning'}>
            {r.tuntasCount}/{classSubjects.length} Tuntas
          </Tag>
        )
      },
    },
  ]

  const selectedClassName =
    classOptions.find((c) => c.value === effectiveClassId)?.label ?? 'Pilih Kelas'

  return (
    <div>
      <PageHeader
        title="Leger Nilai"
        subtitle={`Nilai seluruh mapel kelas ${selectedClassName}, semester ${selectedSemester}`}
        extra={
          <Space wrap>
            <Tooltip title="Ekspor leger (CSV)">
              <Button icon={<DownloadOutlined />} onClick={handleExportCsv} disabled={rows.length === 0} />
            </Tooltip>
            <Tooltip title="Cetak leger">
              <Button icon={<PrinterOutlined />} onClick={() => window.print()} disabled={rows.length === 0} />
            </Tooltip>
          </Space>
        }
      />

      <Card style={{ marginBottom: 14 }}>
        <Space wrap size="middle">
          <Select
            style={{ width: 180 }}
            placeholder="Tahun Ajaran"
            value={selectedYearId}
            onChange={(v) => setSearchParams({ ay: v, sem: String(selectedSemester), class: effectiveClassId })}
            options={(yearsQuery.data ?? []).map((y) => ({
              value: y.id,
              label: `${y.name}${y.is_active ? ' (Aktif)' : ''}`,
            }))}
          />

          <Select
            style={{ width: 160 }}
            value={selectedSemester}
            onChange={(v) => setSearchParams({ ay: selectedYearId ?? '', sem: String(v), class: effectiveClassId })}
            options={[
              { value: 1, label: 'Semester 1 (Ganjil)' },
              { value: 2, label: 'Semester 2 (Genap)' },
            ]}
          />

          <Select
            style={{ width: 160 }}
            placeholder="Pilih Kelas"
            value={effectiveClassId || undefined}
            onChange={(v) => setSearchParams({ ay: selectedYearId ?? '', sem: String(selectedSemester), class: v })}
            options={classOptions}
          />
        </Space>
      </Card>

      <Card>
        {!effectiveClassId ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Pilih kelas terlebih dahulu untuk melihat leger"
          />
        ) : classSubjects.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Kelas ini belum memiliki mata pelajaran"
          />
        ) : (
          <Table<LegerRow>
            rowKey="id"
            size="small"
            columns={columns}
            dataSource={rows}
            pagination={false}
            scroll={{ x: true }}
            loading={studentsQuery.isPending || scoresQuery.isPending}
          />
        )}
      </Card>
    </div>
  )
}
