import { useMemo, useState } from 'react'
import { Button, Progress, Select, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ExportOutlined, ReloadOutlined } from '@ant-design/icons'
import { ShellItem } from '../../../shared/components/ShellMotion'
import { StatChip } from '../../../shared/components/StatChip'
import { useTabActions } from '../../../shared/components/ActionsSlot'
import { useStudentDetail } from '../../students/useStudentDetail'
import { useInstrumentResponses, useInstruments } from '../hooks'
import { analyze } from '../analysis'
import { INSTRUMENT_KIND_LABEL, type InstrumentResponse } from '../types'
import { Sosiogram } from '../components/Sosiogram'
import { ExportModal } from '../../finance/components/ExportModal'

/** Tab Hasil: pilih angket → analisis (dimensi/MBTI/sosiometri) + daftar respons. */
export function ResultsTab({ active }: { active: boolean }) {
  const instrumentsQuery = useInstruments()
  const [instrumentId, setInstrumentId] = useState<string | undefined>()
  const selected = (instrumentsQuery.data ?? []).find((i) => i.id === instrumentId) ?? null
  const responsesQuery = useInstrumentResponses(instrumentId)
  const { open: openStudent } = useStudentDetail()
  const [exportOpen, setExportOpen] = useState(false)

  const responses = responsesQuery.data ?? []
  const submitted = responses.filter((r) => r.submitted_at)
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

  const analysis = useMemo(
    () =>
      selected
        ? analyze(selected.kind, selected.questions ?? [], responses, classmateIds)
        : { dimensions: [], mbtiDistribution: [], sociometry: null },
    [selected, responses, classmateIds],
  )

  const columns: ColumnsType<InstrumentResponse> = [
    {
      title: 'Santri',
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
      render: (_, r) => (r.submitted_at ? new Date(r.submitted_at).toLocaleString('id-ID') : '-'),
    },
  ]

  const node = (
    <Space size={8} wrap>
      <Button icon={<ReloadOutlined />} onClick={() => void responsesQuery.refetch()} />
      <Button icon={<ExportOutlined />} onClick={() => setExportOpen(true)} disabled={!selected} />
    </Space>
  )
  const actions = useTabActions(active, node)

  return (
    <ShellItem>
      <Select
        showSearch
        allowClear
        placeholder="Pilih angket untuk melihat hasil"
        style={{ maxWidth: 420, marginBottom: 16 }}
        value={instrumentId}
        onChange={setInstrumentId}
        loading={instrumentsQuery.isPending}
        options={(instrumentsQuery.data ?? []).map((i) => ({
          value: i.id,
          label: `${i.title} (${INSTRUMENT_KIND_LABEL[i.kind]})`,
        }))}
        filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
      />

      {!selected ? (
        <Typography.Text type="secondary">Pilih angket di atas untuk melihat hasil analisis.</Typography.Text>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <StatChip icon={<ReloadOutlined />} label="Respons" value={submitted.length} loading={responsesQuery.isPending} />
            {analysis.sociometry && (
              <>
                <StatChip icon={<ExportOutlined />} label="Kohesi" value={`${Math.round(analysis.sociometry.cohesion * 100)}%`} color="emerald" />
                <StatChip icon={<ExportOutlined />} label="Terisolasi" value={analysis.sociometry.isolated.length} color="rose" hideIfZero />
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
          {analysis.sociometry && (
            <div style={{ marginBottom: 20 }}>
              <Typography.Title level={5} style={{ marginBottom: 10 }}>
                Sosiogram
              </Typography.Title>
              <Sosiogram responses={responses} result={analysis.sociometry} />
              <Typography.Paragraph type="secondary" style={{ fontSize: 12.5, marginTop: 8 }}>
                Terpopuler:{' '}
                {analysis.sociometry.stars.length
                  ? analysis.sociometry.stars.map((s) => s.studentId).join(', ')
                  : '—'}
                {analysis.sociometry.isolated.length > 0 && (
                  <>
                    {' '}· Terisolasi: <b>{analysis.sociometry.isolated.length} santri</b> (perlu perhatian BK)
                  </>
                )}
              </Typography.Paragraph>
            </div>
          )}

          <Typography.Title level={5} style={{ marginBottom: 8 }}>
            Daftar Respons
          </Typography.Title>
          <Table<InstrumentResponse>
            rowKey="id"
            size="middle"
            loading={responsesQuery.isPending}
            columns={columns}
            dataSource={responses}
            pagination={{ pageSize: 10, showSizeChanger: false, showTotal: (t) => `${t} respons` }}
            scroll={{ x: 'max-content' }}
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
      {actions}
    </ShellItem>
  )
}
