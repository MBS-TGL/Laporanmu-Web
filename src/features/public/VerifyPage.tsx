import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Form, Input, Tag, Typography } from 'antd'
import { SafetyCertificateOutlined, SearchOutlined } from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { getGradePredicateBulanan } from '../raport/constants'
import { PublicShell } from './PublicShell'
import { PortalCard } from './PortalCard'

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
    nilai_akhlak: number | null
    nilai_ibadah: number | null
    nilai_kebersihan: number | null
    nilai_quran: number | null
    nilai_bahasa: number | null
    berat_badan: number | null
    tinggi_badan: number | null
    ziyadah: string | null
    murojaah: string | null
    total_hafalan: string | null
    hari_sakit: number
    hari_izin: number
    hari_alpa: number
    hari_pulang: number
    catatan: string | null
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

  const paramStudent = searchParams.get('s') ?? searchParams.get('id') ?? ''
  const paramNo = searchParams.get('no') ?? ''

  useEffect(() => {
    document.title = 'Verifikasi Rapor · Laporanmu'
  }, [])

  // Periode dari nomor rapor pada deep-link (?no=RPT/.../NOV2026/1)
  const deepPeriod = useMemo(() => parseReportNo(paramNo), [paramNo])

  const verify = useCallback(async (studentId: string, month: number | null, year: number | null) => {
    if (!studentId) return
    setLoading(true)
    setError(null)
    const { data, error: rpcError } = await supabase.rpc('verify_raport', {
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

  // Deep-link: ?s=<studentId>&no=<nomor raport> — dikirim lewat form
  // agar setState terjadi di callback handler (bukan di effect)
  useEffect(() => {
    if (!paramStudent) return
    const timer = setTimeout(() => form.submit(), 300)
    return () => clearTimeout(timer)
  }, [paramStudent, form])

  const handleSubmit = async (values: { studentId: string }) => {
    await verify(values.studentId.trim(), deepPeriod?.month ?? null, deepPeriod?.year ?? null)
  }

  return (
    <PublicShell tint="green" footerLabel="Portal Verifikasi Publik">
      {/* Form tetap ter-mount saat loading agar tidak ada layout jump */}
      {!result && (
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

      {result && (
        <Card style={{ borderRadius: 16 }}>
          <div className="no-print" style={{ textAlign: 'center', marginBottom: 16 }}>
            <Tag color="green" style={{ fontSize: 13, padding: '4px 14px', borderRadius: 999 }}>
              ✓ Dokumen Raport Sah & Terdaftar
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
                  ['Akhlak', result.report.nilai_akhlak],
                  ['Ibadah', result.report.nilai_ibadah],
                  ['Kebersihan', result.report.nilai_kebersihan],
                  ["Al-Qur'an", result.report.nilai_quran],
                  ['Bahasa', result.report.nilai_bahasa],
                ] as const
              ).map(([label, v]) => (
                <tr key={label} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '6px 4px', color: '#64748b' }}>{label}</td>
                  <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 600 }}>{v ?? '—'}</td>
                  <td style={{ padding: '6px 4px', textAlign: 'right', color: '#64748b', width: 120 }}>
                    {getGradePredicateBulanan(v)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <Typography.Text strong style={{ display: 'block', margin: '16px 0 4px' }}>
            Presensi & Fisik
          </Typography.Text>
          <Typography.Paragraph style={{ fontSize: 13 }}>
            Sakit {result.report.hari_sakit} hari · Izin {result.report.hari_izin} hari · Alpa{' '}
            {result.report.hari_alpa} hari · Pulang {result.report.hari_pulang} hari
            <br />
            {result.report.berat_badan ? `BB ${result.report.berat_badan} kg · ` : ''}
            {result.report.tinggi_badan ? `TB ${result.report.tinggi_badan} cm · ` : ''}
            {result.report.total_hafalan ? `Hafalan ${result.report.total_hafalan}` : ''}
          </Typography.Paragraph>

          {result.report.catatan && (
            <>
              <Typography.Text strong style={{ display: 'block', margin: '8px 0 4px' }}>
                Catatan Pembina
              </Typography.Text>
              <Typography.Paragraph italic style={{ fontSize: 13 }}>
                “{result.report.catatan}”
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
