import { useMemo, useState } from 'react'
import { Alert, Button, Progress, Segmented, Select, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExportOutlined,
  ReloadOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { StatChip } from '../../../shared/components/StatChip'
import { useTabActions } from '../../../shared/components/ActionsSlot'
import { useTablePagination } from '../../../shared/hooks/useTablePagination'
import { useStudentDetail } from '../../students/useStudentDetail'
import { fetchStudentsByIds } from '../../students/api'
import { useInstrumentResponses, useInstruments } from '../hooks'
import { analyze } from '../analysis'
import { INSTRUMENT_KIND_LABEL, type InstrumentResponse } from '../types'
import { Sosiogram } from '../components/Sosiogram'
import { ExportModal } from '../../finance/components/ExportModal'
import { useQuery } from '@tanstack/react-query'

/** Tab Hasil: pilih angket → analisis (dimensi/MBTI/sosiometri) + daftar respons. */
export function ResultsTab({ active }: { active: boolean }) {
  const instrumentsQuery = useInstruments()
  const [pickedId, setPickedId] = useState<string | undefined>(undefined)
  const [hasPicked, setHasPicked] = useState(false)
  const responsesQuery = useInstrumentResponses(pickedId)
  const { open: openStudent } = useStudentDetail()
  const [exportOpen, setExportOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'mengisi' | 'belum'>('all')

  const rows = instrumentsQuery.data ?? []
  // Auto-pilih angket pertama sekali (sampai user secara eksplisit memilih/clear)
  const instrumentId = hasPicked ? pickedId : pickedId ?? rows[0]?.id
  const selected = rows.find((i) => i.id === instrumentId) ?? null

  const responses = useMemo(() => responsesQuery.data ?? [], [responsesQuery.data])
  const submitted = responses.filter((r) => r.submitted_at)
  const notSubmitted = responses.filter((r) => !r.submitted_at)

  const classmateIds = useMemo(() => {
    const ids = new Set<string>()
    for (const r of responses) {
      ids.add(r.student_id)
      for (const value of Object.values(r.answers ?? {})) {
        if (Array.isArray(value)) value.forEach((v) => typeof v === 'string' && ids.add(v))
        else if (typeof value === 'string') ids.add(value)
      }
    }
    return [...ids]
  }, [responses])

  // Nama untuk semua peserta sosiogram (pemilih + dipilih yang belum merespons)
  const namesQuery = useQuery({
    queryKey: ['sosiogram-names', classmateIds.join(',')],
    queryFn: () => fetchStudentsByIds(classmateIds),
    enabled: classmateIds.length > 0,
    staleTime: 5 * 60_000,
  })
  const nameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of namesQuery.data ?? []) map.set(s.id, s.name)
    for (const r of responses) {
      if (r.student) map.set(r.student.id, r.student.name)
    }
    return map
  }, [namesQuery.data, responses])

  const analysis = useMemo(
    () =>
      selected
        ? analyze(selected.kind, selected.questions ?? [], responses, classmateIds)
        : { dimensions: [], mbtiDistribution: [], sociometry: null },
    [selected, responses, classmateIds],
  )

  const tableRows = useMemo(() => {
    if (statusFilter === 'mengisi') return submitted
    if (statusFilter === 'belum') return notSubmitted
    return responses
  }, [responses, submitted, notSubmitted, statusFilter])

  const pg = useTablePagination(tableRows.length, { label: 'respons', defaultPageSize: 10, showSizeChanger: false })

  const columns: ColumnsType<InstrumentResponse> = [
    {
      title: 'Santri',
      dataIndex: 'student',
      key: 'name',
      sorter: (a, b) => (a.student?.name ?? '').localeCompare(b.student?.name ?? '', 'id'),
      render: (_, r) =>
        r.student ? (
          <Button type="link" size="small" style={{ paddingInline: 0 }} onClick={() => openStudent(r.student!.id)}>
            {r.student.name}
          </Button>
        ) : (
          '-'
        ),
    },
    { title: 'Kelas', width: 140, render: (_, r) => r.student?.class?.name ?? '-' },
    {
      title: 'Status',
      width: 130,
      render: (_, r) =>
        r.submitted_at ? (
          <Tag color="green">Mengisi</Tag>
        ) : (
          <Tag color="default">Belum Mengisi</Tag>
        ),
    },
    {
      title: 'Waktu Mengisi',
      width: 170,
      sorter: (a, b) =>
        (a.submitted_at ?? '').localeCompare(b.submitted_at ?? ''),
      render: (_, r) => (r.submitted_at ? new Date(r.submitted_at).toLocaleString('id-ID') : '-'),
    },
  ]

  const node = (
    <Space size={8} wrap>
      <Button icon={<ReloadOutlined />} onClick={() => void responsesQuery.refetch()} aria-label="Segarkan respons" />
      <Button icon={<ExportOutlined />} onClick={() => setExportOpen(true)} disabled={!selected}>
        Ekspor
      </Button>
    </Space>
  )
  const actions = useTabActions(active, node)

  return (
    <div>
      <Select
        showSearch
        allowClear
        placeholder="Pilih angket untuk melihat hasil"
        style={{ maxWidth: 420, marginBottom: 16 }}
        value={instrumentId}
        onChange={(v) => {
          setHasPicked(true)
          setPickedId(v)
        }}
        loading={instrumentsQuery.isPending}
        options={rows.map((i) => ({
          value: i.id,
          label: `${i.title} (${INSTRUMENT_KIND_LABEL[i.kind]})`,
        }))}
        filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
      />

      {responsesQuery.isError ? (
        <Alert
          type="error"
          showIcon
          message="Gagal memuat respons"
          description="Pastikan migration 0049_evaluasi.sql sudah diterapkan di Supabase."
          style={{ marginBottom: 12 }}
        />
      ) : null}

      {actions}

      {!selected ? (
        <Typography.Text type="secondary">Pilih angket di atas untuk melihat hasil analisis.</Typography.Text>
      ) : responsesQuery.isPending ? (
        <Typography.Text type="secondary">Memuat respons…</Typography.Text>
      ) : responses.length === 0 ? (
        <Alert
          type="info"
          showIcon
          message="Belum ada respons masuk"
          description="Bagikan token angket ke santri: mereka membuka /survey, memasukkan token dan NIS/kode registrasi. Respons akan muncul di sini secara otomatis."
          style={{ borderRadius: 10, marginTop: 12 }}
        />
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16, marginTop: 12 }}>
            <StatChip
              icon={<TeamOutlined />}
              label="Respons"
              value={responses.length}
              color="indigo"
              loading={responsesQuery.isPending}
            />
            <StatChip icon={<CheckCircleOutlined />} label="Mengisi" value={submitted.length} color="emerald" />
            <StatChip icon={<ClockCircleOutlined />} label="Belum Mengisi" value={notSubmitted.length} color="sky" />
            {analysis.sociometry && (
              <>
                <StatChip
                  icon={<TeamOutlined />}
                  label="Kohesi"
                  value={`${Math.round(analysis.sociometry.cohesion * 100)}%`}
                  color="emerald"
                />
                <StatChip
                  icon={<ClockCircleOutlined />}
                  label="Terisolasi"
                  value={analysis.sociometry.isolated.length}
                  color="rose"
                  hideIfZero
                />
              </>
            )}
          </div>

          {/* Dimensi (AKPD/EDOM/MBTI rekap) */}
          {analysis.dimensions.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <Typography.Title level={5} style={{ marginBottom: 10 }}>
                {selected.kind === 'mbti' ? 'Preferensi per Dimensi' : 'Rata-rata per Dimensi'}
              </Typography.Title>
              {analysis.dimensions.map((d) => (
                <div key={d.dimension} style={{ maxWidth: 520, marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 2 }}>
                    <span>
                      {selected.kind === 'mbti' && d.dimension.includes('-')
                        ? `${d.dimension} (kiri = huruf pertama)`
                        : d.dimension}
                    </span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      {Math.round(d.avg * 100) / 100}
                    </span>
                  </div>
                  <Progress percent={Math.round(d.avg * 100)} showInfo={false} size={['100%', 6]} strokeColor="#4f46e5" />
                </div>
              ))}
            </div>
          )}

          {/* Distribusi MBTI */}
          {analysis.mbtiDistribution.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <Typography.Title level={5} style={{ marginBottom: 10 }}>
                Distribusi Tipe
              </Typography.Title>
              <Space size={8} wrap>
                {analysis.mbtiDistribution.map((d) => (
                  <Tag key={d.type} color="geekblue" style={{ fontSize: 14, padding: '4px 12px' }}>
                    {d.type} · {d.count}
                  </Tag>
                ))}
              </Space>
            </div>
          )}

          {/* Sosiometri */}
          {analysis.sociometry && submitted.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <Typography.Title level={5} style={{ marginBottom: 10 }}>
                Sosiogram
              </Typography.Title>
              <Sosiogram responses={responses} result={analysis.sociometry} nameById={nameById} />
              <Typography.Paragraph type="secondary" style={{ fontSize: 12.5, marginTop: 8 }}>
                Terpopuler:{' '}
                {analysis.sociometry.stars.length
                  ? analysis.sociometry.stars.map((s) => nameById.get(s.studentId) ?? s.studentId).join(', ')
                  : '—'}
                {analysis.sociometry.isolated.length > 0 && (
                  <>
                    {' '}· Terisolasi:{' '}
                    {analysis.sociometry.isolated.map((id) => nameById.get(id) ?? id).join(', ')} (perlu perhatian BK)
                  </>
                )}
              </Typography.Paragraph>
            </div>
          )}

          <Typography.Title level={5} style={{ marginBottom: 8 }}>
            Daftar Respons
          </Typography.Title>
          <Space size={8} style={{ marginBottom: 10 }}>
            <Segmented
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as 'all' | 'mengisi' | 'belum')}
              options={[
                { label: `Semua (${responses.length})`, value: 'all' },
                { label: `Mengisi (${submitted.length})`, value: 'mengisi' },
                { label: `Belum (${notSubmitted.length})`, value: 'belum' },
              ]}
            />
          </Space>
          <Table<InstrumentResponse>
            rowKey="id"
            size="middle"
            loading={responsesQuery.isPending}
            columns={columns}
            dataSource={tableRows}
            pagination={pg.pagination}
            scroll={{ x: 'max-content' }}
            locale={{ emptyText: 'Tidak ada respons pada filter ini.' }}
          />
        </>
      )}

      <ExportModal<InstrumentResponse>
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Export Respons Angket"
        filename={`respons-${selected?.kind ?? 'angket'}`}
        auditTable="instrument_responses"
        rows={submitted}
        columns={[
          { header: 'Santri', value: (r) => r.student?.name ?? '' },
          { header: 'Kelas', value: (r) => r.student?.class?.name ?? '' },
          { header: 'Mengisi', value: (r) => (r.submitted_at ? new Date(r.submitted_at).toLocaleString('id-ID') : '') },
          { header: 'Jawaban', value: (r) => JSON.stringify(r.answers) },
        ]}
      />
    </div>
  )
}
