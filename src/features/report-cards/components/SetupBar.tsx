import { useEffect, useRef, useState } from 'react'
import { Button, Card, Col, Input, InputNumber, Row, Select, Space, Tooltip, Typography } from 'antd'
import { UndoOutlined } from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import { useReportCardClasses } from '../hooks'
import { MONTH_NAMES, REPORT_CARD_TYPE_LABEL } from '../constants'
import type { ReportCardType } from '../types'
import { useAcademicYearsBrief } from '../../classes/hooks'

const REPORT_CARD_TYPES = Object.keys(REPORT_CARD_TYPE_LABEL) as ReportCardType[]

interface PeriodParams {
  type: ReportCardType
  month: number
  year: number
  semester: 1 | 2
  ay: string
  musyrif: string
}

function readParams(sp: URLSearchParams): PeriodParams {
  const now = new Date()
  const typeRaw = sp.get('type')
  const type: ReportCardType =
    typeRaw && (REPORT_CARD_TYPES as string[]).includes(typeRaw) ? (typeRaw as ReportCardType) : 'monthly'
  const month = Number(sp.get('month')) || now.getMonth() + 1
  const year = Number(sp.get('year')) || now.getFullYear()
  const semesterRaw = Number(sp.get('semester'))
  const semester: 1 | 2 = semesterRaw === 2 ? 2 : 1
  const ay = sp.get('ay') ?? ''
  const musyrif = sp.get('musyrif') ?? ''
  return { type, month, year, semester, ay, musyrif }
}

interface SetupBarProps {
  classId: string
  homeroomTeacherName: string | null
}

// Bar pemilihan periode: membaca/menulis state via URL search params,
// sehingga halaman Input & Preview berbagi periode yang sama.
export function SetupBar({ classId, homeroomTeacherName }: SetupBarProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const params = readParams(searchParams)
  const classesQuery = useReportCardClasses()
  const yearsQuery = useAcademicYearsBrief()

  // Nama musyrif diketik ke state lokal agar input tidak lag;
  // URL baru ditulis setelah 400ms berhenti mengetik (atau saat blur),
  // sehingga halaman Input & Preview tetap berbagi nilai yang sama.
  // Field diisi nama wali kelas sebagai nilai awal (bukan placeholder kosong),
  // dan override dari URL selalu menang.
  const musyrifRef = useRef(params.musyrif)
  const [musyrifValue, setMusyrifValue] = useState(params.musyrif || homeroomTeacherName || '')
  const musyrifTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Ikuti data wali kelas yang datang belakangan (query kelas), tanpa menimpa ketikan user.
  useEffect(() => {
    if (musyrifRef.current || !homeroomTeacherName) return
    setMusyrifValue(homeroomTeacherName)
  }, [homeroomTeacherName])

  const activeYear = (yearsQuery.data ?? []).find((y) => y.is_active)

  const buildSp = (updates: Partial<PeriodParams>) => {
    const next = { ...params, musyrif: musyrifRef.current, ...updates }
    const sp = new URLSearchParams()
    sp.set('type', next.type)
    if (next.type === 'monthly') {
      sp.set('month', String(next.month))
      sp.set('year', String(next.year))
    } else {
      sp.set('semester', String(next.semester))
      if (next.ay) sp.set('ay', next.ay)
    }
    if (next.musyrif) sp.set('musyrif', next.musyrif)
    return sp
  }

  const patch = (updates: Partial<PeriodParams>) => {
    setSearchParams(buildSp(updates), { replace: true })
  }

  const syncMusyrifToUrl = () => {
    setSearchParams(buildSp({}), { replace: true })
  }

  const handleMusyrifChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    musyrifRef.current = e.target.value
    setMusyrifValue(e.target.value)
    if (musyrifTimer.current) clearTimeout(musyrifTimer.current)
    musyrifTimer.current = setTimeout(syncMusyrifToUrl, 400)
  }

  const handleMusyrifBlur = () => {
    if (musyrifTimer.current) {
      clearTimeout(musyrifTimer.current)
      musyrifTimer.current = null
      syncMusyrifToUrl()
    }
  }

  // Kembalikan ke nama wali kelas: hapus override di URL, isi field lagi.
  const resetMusyrif = () => {
    if (musyrifTimer.current) clearTimeout(musyrifTimer.current)
    musyrifRef.current = ''
    setMusyrifValue(homeroomTeacherName ?? '')
    setSearchParams(buildSp({ musyrif: '' }), { replace: true })
  }

  const hasMusyrifOverride = Boolean(params.musyrif)

  const className = (classesQuery.data ?? []).find((c) => c.id === classId)?.name ?? '...'

  // Tahun ajaran efektif: pilihan user, atau year yang aktif
  const effectiveTa = params.ay || activeYear?.id || ''

  const yearOptions = (yearsQuery.data ?? []).map((y) => ({ value: y.id, label: y.name }))
  const isMonthly = params.type === 'monthly'

  return (
    <Card style={{ marginBottom: 16 }}>
      <Row
        gutter={16}
        align="bottom"
        wrap={false}
        style={{ overflowX: 'auto', paddingBottom: 6 }}
      >
        <Col flex="none" style={{ minWidth: 80 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Kelas
          </Typography.Text>
          <div style={{ fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap' }}>{className}</div>
        </Col>
        <Col flex="1" style={{ minWidth: 150 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Jenis Rapor
          </Typography.Text>
          <Select
            style={{ width: '100%' }}
            value={params.type}
            onChange={(v) => patch({ type: v as ReportCardType })}
            options={Object.entries(REPORT_CARD_TYPE_LABEL).map(([value, label]) => ({ value, label }))}
          />
        </Col>

        {isMonthly ? (
          <>
            <Col flex="1" style={{ minWidth: 140 }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Bulan
              </Typography.Text>
              <Select
                style={{ width: '100%' }}
                value={params.month}
                onChange={(v) => patch({ month: v as number })}
                options={MONTH_NAMES.map((m, i) => ({ value: i + 1, label: m }))}
              />
            </Col>
            <Col flex="0 0 100px">
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Tahun
              </Typography.Text>
              <InputNumber
                style={{ width: '100%' }}
                min={2020}
                max={2100}
                value={params.year}
                onChange={(v) => v && patch({ year: v })}
              />
            </Col>
          </>
        ) : (
          <>
            <Col flex="1" style={{ minWidth: 160 }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Semester
              </Typography.Text>
              <Select
                style={{ width: '100%' }}
                value={params.semester}
                onChange={(v) => patch({ semester: v as 1 | 2 })}
                options={[
                  { value: 1, label: 'Semester 1 (Ganjil)' },
                  { value: 2, label: 'Semester 2 (Genap)' },
                ]}
              />
            </Col>
            <Col flex="1" style={{ minWidth: 180 }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Tahun Ajaran
              </Typography.Text>
              <Select
                style={{ width: '100%' }}
                placeholder="Pilih tahun ajaran"
                loading={yearsQuery.isPending}
                value={effectiveTa || undefined}
                onChange={(v) => patch({ ay: v as string })}
                options={yearOptions}
              />
            </Col>
          </>
        )}

        <Col flex="1" style={{ minWidth: 200 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Musyrif / Wali Kelas
          </Typography.Text>
          <Space.Compact style={{ width: '100%' }}>
            <Input
              placeholder={homeroomTeacherName ?? 'Nama musyrif'}
              value={musyrifValue}
              onChange={handleMusyrifChange}
              onBlur={handleMusyrifBlur}
              maxLength={80}
            />
            <Tooltip title="Kembalikan ke wali kelas">
              <Button
                icon={<UndoOutlined />}
                onClick={resetMusyrif}
                disabled={!hasMusyrifOverride}
                aria-label="Kembalikan nama musyrif ke wali kelas"
              />
            </Tooltip>
          </Space.Compact>
        </Col>
      </Row>
    </Card>
  )
}
