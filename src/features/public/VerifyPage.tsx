import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Form, Input, Tag, Typography } from 'antd'
import { SafetyCertificateOutlined, SearchOutlined } from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { getGradePredicateMonthly } from '../report-cards/constants'
import { PublicShell } from './PublicShell'
import { PortalCard } from './PortalCard'

interface LetterVerifyResult {
  valid: boolean
  letter_no: string
  type: string
  subject: string
  body_text: string
  issued_date: string
  student_name: string
  registration_code: string
  class_name: string | null
  error?: string
}

interface VerifySemesterResult {
  student: {
    name: string
    registration_code: string
    nisn: string | null
    gender: 'L' | 'P' | null
    class_name: string | null
  }
  report: {
    semester: 1 | 2
    report_type: string
    academic_year_id: string
    scores: Record<string, number | null>
    extras: Record<string, unknown> | null
    musyrif_name: string | null
  }
  academic_year: string | null
  error?: string
}

interface VerifyResult {
  student: {
    name: string
    registration_code: string
    nisn: string | null
    gender: 'L' | 'P' | null
    class_name: string | null
  }
  report: {
    month: number
    year: number
    character_score: number | null
    worship_score: number | null
    cleanliness_score: number | null
    quran_score: number | null
    language_score: number | null
    weight_kg: number | null
    height_cm: number | null
    ziyadah: string | null
    murojaah: string | null
    total_hafalan: string | null
    sick_days: number
    excused_days: number
    absent_days: number
    early_leave_days: number
    notes: string | null
    musyrif_name: string | null
  }
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

// Parse "RPT/7A/NOV2026/1" → { month: 11, year: 2026 }
function parseReportNo(no: string): { month: number; year: number } | null {
  const parts = no.split('/').map((p) => p.trim().toUpperCase())
  const token = parts.find((p) => /^[A-Z]{3,4}\d{4}$/.test(p))
  if (!token) return null
  const letters = token.replace(/\d/g, '')
  const year = Number(token.replace(/\D/g, ''))
  const monthMap: Record<string, number> = {
    JAN: 1, FEB: 2, PEB: 2, MAR: 3, APR: 4, MEI: 5, JUN: 6,
    JUL: 7, AGU: 8, AGS: 8, SEP: 9, OKT: 10, NOV: 11, DES: 12, DEC: 12,
  }
  const month = monthMap[letters.slice(0, 3)]
  if (!month || !year) return null
  return { month, year }
}

export function VerifyPage() {
  const [searchParams] = useSearchParams()
  const [form] = Form.useForm<{ studentId: string }>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [semesterResult, setSemesterResult] = useState<VerifySemesterResult | null>(null)
  const [letterResult, setLetterResult] = useState<LetterVerifyResult | null>(null)

  const paramStudent = searchParams.get('s') ?? searchParams.get('id') ?? ''
  const paramNo = searchParams.get('no') ?? ''
  const paramToken = searchParams.get('token') ?? ''
  const paramType = searchParams.get('type') ?? ''
  const paramSemester = searchParams.get('semester') ?? ''
  const paramAy = searchParams.get('ay') ?? ''
  const isSemesterLink = Boolean(paramType && paramType !== 'monthly')

  useEffect(() => {
    document.title = 'Verifikasi Dokumen · Laporanmu'
  }, [])

  // Jika terdapat token surat resmi (?token=LT-...)
  useEffect(() => {
    if (!paramToken) return
    const verifyLetter = async () => {
      setLoading(true)
      setError(null)
      const { data, error: rpcError } = await supabase.rpc('verify_official_letter', {
        p_token: paramToken.trim(),
      })
      setLoading(false)
      const res = data as unknown as LetterVerifyResult
      if (rpcError || !res || !res.valid) {
        setError(res?.error || rpcError?.message || 'Surat resmi tidak ditemukan atau token tidak valid.')
        setLetterResult(null)
        return
      }
      setLetterResult(res)
    }
    void verifyLetter()
  }, [paramToken])

  // Periode dari nomor rapor pada deep-link (?no=RPT/.../NOV2026/1)
  const deepPeriod = useMemo(() => parseReportNo(paramNo), [paramNo])

  const verify = useCallback(async (studentId: string, month: number | null, year: number | null) => {
    if (!studentId) return
    setLoading(true)
    setError(null)
    const { data, error: rpcError } = await supabase.rpc('verify_report', {
      p_student_id: studentId,
      p_month: month,
      p_year: year,
    })
    setLoading(false)
    const res = data as unknown as VerifyResult | { error: string } | null
    if (rpcError || !res || 'error' in res) {
      setError(
        res && 'error' in res ? res.error : rpcError?.message || 'Gagal memverifikasi dokumen',
      )
      setResult(null)
      return
    }
    setResult(res)
  }, [])

  const verifySemester = useCallback(
    async (studentId: string) => {
      if (!studentId) return
      setLoading(true)
      setError(null)
      const { data, error: rpcError } = await supabase.rpc('verify_semester_report', {
        p_student_id: studentId,
        p_report_type: paramType,
        p_semester: Number(paramSemester) === 2 ? 2 : 1,
        p_academic_year_id: paramAy || null,
      })
      setLoading(false)
      const res = data as unknown as VerifySemesterResult | null
      if (rpcError || !res || res.error) {
        setError(res?.error ?? rpcError?.message ?? 'Gagal memverifikasi dokumen')
        setSemesterResult(null)
        return
      }
      setSemesterResult(res)
    },
    [paramType, paramSemester, paramAy],
  )

  // Deep-link: ?s=<studentId>&no=<nomor raport> — dikirim lewat form
  // agar setState terjadi di callback handler (bukan di effect)
  useEffect(() => {
    if (!paramStudent) return
    const timer = setTimeout(() => form.submit(), 300)
    return () => clearTimeout(timer)
  }, [paramStudent, form])

  const handleSubmit = async (values: { studentId: string }) => {
    const studentId = values.studentId.trim()
    if (isSemesterLink) {
      await verifySemester(studentId)
      return
    }
    await verify(studentId, deepPeriod?.month ?? null, deepPeriod?.year ?? null)
  }

  return (
    <PublicShell tint={letterResult ? 'indigo' : 'green'} footerLabel="Portal Verifikasi Publik">
      {letterResult && (
        <Card style={{ borderRadius: 16, border: '2px solid #6366f1' }}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <Tag color="success" style={{ fontSize: 13, padding: '4px 14px', borderRadius: 999 }}>
              ✓ Dokumen Surat Resmi Sah & Terdaftar
            </Tag>
            <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
              Surat ini diterbitkan secara sah melalui sistem administrasi SMP Muhammadiyah 4 Tanggul.
            </Typography.Paragraph>
          </div>

          <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(88px, auto) 1fr', gap: '8px 12px', fontSize: 13 }}>
              <span style={{ color: '#64748b' }}>Nomor Surat:</span>
              <b>{letterResult.letter_no}</b>
              <span style={{ color: '#64748b' }}>Jenis Surat:</span>
              <span style={{ textTransform: 'capitalize' }}>{letterResult.type}</span>
              <span style={{ color: '#64748b' }}>Perihal:</span>
              <b>{letterResult.subject}</b>
              <span style={{ color: '#64748b' }}>Tanggal Terbit:</span>
              <span>{new Date(letterResult.issued_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              <span style={{ color: '#64748b' }}>Nama Santri:</span>
              <b>{letterResult.student_name} ({letterResult.registration_code})</b>
              <span style={{ color: '#64748b' }}>Kelas:</span>
              <span>{letterResult.class_name ?? '—'}</span>
            </div>
          </div>

          <Typography.Text strong style={{ display: 'block', marginBottom: 6 }}>
            Ringkasan Isi Surat:
          </Typography.Text>
          <div style={{ whiteSpace: 'pre-wrap', background: '#fff', border: '1px solid #e2e8f0', padding: 12, borderRadius: 8, fontSize: 12.5, color: '#334155' }}>
            {letterResult.body_text}
          </div>

          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <Button onClick={() => window.print()}>Cetak Bukti Verifikasi</Button>
          </div>
        </Card>
      )}

      {/* Form tetap ter-mount saat loading agar tidak ada layout jump */}
      {!result && !semesterResult && !letterResult && (
        <PortalCard
          tint="green"
          icon={<SafetyCertificateOutlined />}
          title="Verifikasi Rapor"
          description="Pastikan rapor yang Anda terima benar-benar berasal dari arsip resmi sekolah."
          bullets={[
            'Cocok dengan arsip resmi sekolah',
            'Nilai karakter & presensi lengkap',
            'Hasil dapat dicetak sebagai bukti',
          ]}
          footnote="ID santri tertera pada QR / dokumen rapor."
        >
          <Typography.Title level={4} style={{ margin: 0, letterSpacing: '-0.02em' }}>
            Periksa Dokumen
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ fontSize: 13, marginTop: 4 }}>
            Tempel ID santri yang tertera pada QR atau tautan rapor.
          </Typography.Paragraph>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{ studentId: paramStudent }}
            style={{ marginTop: 18 }}
          >
            <Form.Item
              name="studentId"
              label="ID Santri"
              rules={[{ required: true, message: 'ID santri wajib diisi' }]}
              extra="ID santri adalah kode panjang yang tertera pada QR/tautan rapor — bukan NISN."
            >
              <Input placeholder="Tempel ID santri di sini" disabled={loading} allowClear size="large" />
            </Form.Item>
            {error && (
              <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />
            )}
            <Button
              color="green"
              variant="solid"
              htmlType="submit"
              block
              size="large"
              icon={<SearchOutlined />}
              loading={loading}
            >
              Verifikasi
            </Button>
          </Form>
        </PortalCard>
      )}

      {/* Panduan 3 langkah — hanya pada tampilan form */}
      {!result && !semesterResult && (
        <Card size="small" style={{ marginTop: 16, borderRadius: 14, border: '1px solid #eef2f7' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            {(
              [
                ['1', 'Salin ID santri', 'Dari QR atau tautan pada dokumen rapor.'],
                ['2', 'Tempel & verifikasi', 'Sistem mencocokkan dengan arsip resmi sekolah.'],
                ['3', 'Bandingkan hasil', 'Cocokkan nilai dengan rapor yang Anda terima.'],
              ] as const
            ).map(([no, title, desc]) => (
              <div key={no} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 999,
                    background: '#ecfdf5',
                    color: '#059669',
                    fontWeight: 700,
                    fontSize: 12.5,
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  {no}
                </span>
                <div>
                  <Typography.Text strong style={{ fontSize: 13 }}>
                    {title}
                  </Typography.Text>
                  <Typography.Paragraph
                    type="secondary"
                    style={{ fontSize: 12, marginTop: 2, marginBottom: 0, lineHeight: 1.55 }}
                  >
                    {desc}
                  </Typography.Paragraph>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {semesterResult && (
        <Card style={{ borderRadius: 16 }}>
          <div className="no-print" style={{ textAlign: 'center', marginBottom: 16 }}>
            <Tag color="green" style={{ fontSize: 13, padding: '4px 14px', borderRadius: 999 }}>
              ✓ Dokumen Rapor Semester Sah & Terdaftar
            </Tag>
            <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
              Data berikut sesuai dengan arsip resmi sekolah
            </Typography.Paragraph>
          </div>

          <Typography.Title level={4} style={{ textAlign: 'center', margin: 0 }}>
            {semesterResult.student.name}
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ textAlign: 'center' }}>
            {semesterResult.student.class_name ?? '—'} · {semesterResult.student.registration_code}
            {semesterResult.student.nisn ? ` · NISN ${semesterResult.student.nisn}` : ''}
          </Typography.Paragraph>
          <Typography.Paragraph type="secondary" style={{ textAlign: 'center', fontSize: 12.5 }}>
            Semester {semesterResult.report.semester}
            {semesterResult.academic_year ? ` · ${semesterResult.academic_year}` : ''}
          </Typography.Paragraph>

          <Typography.Text strong style={{ display: 'block', margin: '16px 0 4px' }}>
            Nilai Rapor
          </Typography.Text>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              {Object.entries(semesterResult.report.scores ?? {}).map(([key, value]) => (
                <tr key={key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '6px 4px', color: '#64748b' }}>{key}</td>
                  <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 600 }}>
                    {value ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Musyrif: {semesterResult.report.musyrif_name ?? '—'}
            </Typography.Text>
            <Button onClick={() => window.print()}>Cetak Halaman Ini</Button>
          </div>
        </Card>
      )}

      {result && (
        <Card style={{ borderRadius: 16 }}>
          <div className="no-print" style={{ textAlign: 'center', marginBottom: 16 }}>
            <Tag color="green" style={{ fontSize: 13, padding: '4px 14px', borderRadius: 999 }}>
              ✓ Dokumen Rapor Sah & Terdaftar
            </Tag>
            <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
              Data berikut sesuai dengan arsip resmi sekolah
            </Typography.Paragraph>
          </div>

          <Typography.Title level={4} style={{ textAlign: 'center', margin: 0 }}>
            {result.student.name}
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ textAlign: 'center' }}>
            {result.student.class_name ?? '—'} · {result.student.registration_code}
            {result.student.nisn ? ` · NISN ${result.student.nisn}` : ''}
          </Typography.Paragraph>

          <Typography.Text strong style={{ display: 'block', margin: '16px 0 4px' }}>
            Penilaian Aspek Karakter — {MONTH_NAMES[result.report.month - 1]} {result.report.year}
          </Typography.Text>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              {(
                [
                  ['Akhlak', result.report.character_score],
                  ['Ibadah', result.report.worship_score],
                  ['Kebersihan', result.report.cleanliness_score],
                  ["Al-Qur'an", result.report.quran_score],
                  ['Bahasa', result.report.language_score],
                ] as const
              ).map(([label, v]) => (
                <tr key={label} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '6px 4px', color: '#64748b' }}>{label}</td>
                  <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 600 }}>{v ?? '—'}</td>
                  <td style={{ padding: '6px 4px', textAlign: 'right', color: '#64748b', width: 120 }}>
                    {getGradePredicateMonthly(v)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <Typography.Text strong style={{ display: 'block', margin: '16px 0 4px' }}>
            Presensi & Fisik
          </Typography.Text>
          <Typography.Paragraph style={{ fontSize: 13 }}>
            Sakit {result.report.sick_days} hari · Izin {result.report.excused_days} hari · Alpa{' '}
            {result.report.absent_days} hari · Pulang {result.report.early_leave_days} hari
            <br />
            {result.report.weight_kg ? `BB ${result.report.weight_kg} kg · ` : ''}
            {result.report.height_cm ? `TB ${result.report.height_cm} cm · ` : ''}
            {result.report.total_hafalan ? `Hafalan ${result.report.total_hafalan}` : ''}
          </Typography.Paragraph>

          {result.report.notes && (
            <>
              <Typography.Text strong style={{ display: 'block', margin: '8px 0 4px' }}>
                Catatan Pembina
              </Typography.Text>
              <Typography.Paragraph italic style={{ fontSize: 13 }}>
                “{result.report.notes}”
              </Typography.Paragraph>
            </>
          )}

          <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Musyrif: {result.report.musyrif_name ?? '—'}
            </Typography.Text>
            <Button onClick={() => window.print()}>Cetak Halaman Ini</Button>
          </div>
        </Card>
      )}
    </PublicShell>
  )
}
