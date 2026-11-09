import dayjs from 'dayjs'
import { calcAverage, getCriteria, getPredicate, REPORT_CARD_TYPE_LABEL } from '../constants'
import type { MonthlyReport, ReportCardStudent, SchoolSettings, SemesterReport } from '../types'
import type { ReportCardType } from '../types'

interface ReportCardProps {
  type: ReportCardType
  grade: string | null
  student: ReportCardStudent
  classNameLabel: string
  period: string
  musyrifName: string | null
  noUrut: number
  scores: Record<string, number | null>
  monthlyExtras?: MonthlyReport | null
  semesterExtras?: SemesterReport['extras'] | null
  school: SchoolSettings | null
  reportNo: string
}

function Block({
  title,
  rows,
}: {
  title: string
  rows: [string, string][]
}) {
  return (
    <div className="report-card-block">
      <div className="report-card-block-title">{title}</div>
      <table className="report-card-block-table">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <td className="report-card-block-label">{label}</td>
              <td className="report-card-block-value">{value || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SignatureCell({ role, name }: { role: string; name: string }) {
  return (
    <td className="report-card-sign-cell">
      <div className="report-card-sign-role">{role}</div>
      <div className="report-card-sign-space" />
      <div className="report-card-sign-name">{name || '.......................'}</div>
    </td>
  )
}

export function ReportCard({
  type,
  grade,
  student,
  classNameLabel,
  period,
  musyrifName,
  noUrut,
  scores,
  monthlyExtras,
  semesterExtras,
  school,
  reportNo,
}: ReportCardProps) {
  const criteria = getCriteria(type, grade)
  const primary = school?.color_primary ?? '#1a5c35'
  const secondary = school?.color_secondary ?? '#c8a400'
  const isMonthly = type === 'monthly'

  const scoreRows = criteria.map((c, i) => {
    const value = scores[c.key] ?? null
    return {
      no: i + 1,
      label: c.label,
      value,
      predicate: getPredicate(type, value),
    }
  })
  const average = calcAverage(type, scores, grade)
  const total = scoreRows.reduce((sum, r) => sum + (r.value ?? 0), 0)

  return (
    <div className="report-card-card" style={{ borderColor: primary }}>
      {/* Kop sekolah */}
      <table className="report-card-header">
        <tbody>
          <tr>
            <td className="report-card-header-logo">
              <img src="/logo-icon.png" alt="Logo Laporanmu" width={56} height={56} />
            </td>
            <td className="report-card-header-center">
              <div style={{ color: primary, fontWeight: 800, fontSize: 17, letterSpacing: '-0.01em' }}>
                {school?.school_name ?? 'Laporanmu Boarding School'}
              </div>
              {school?.school_address && (
                <div style={{ fontSize: 11, color: '#475569' }}>{school.school_address}</div>
              )}
            </td>
            <td className="report-card-header-logo">
              <img src="/logo-icon.png" alt="Logo Laporanmu" width={56} height={56} />
            </td>
          </tr>
        </tbody>
      </table>
      <div
        style={{
          height: 4,
          background: `linear-gradient(90deg, ${primary}, ${secondary})`,
          borderRadius: 2,
          margin: '6px 0 12px',
        }}
      />

      {/* Judul */}
      <div style={{ textAlign: 'center', marginBottom: 10 }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: primary }}>
          {isMonthly ? 'RAPORT BULANAN SANTRI' : `RAPORT ${REPORT_CARD_TYPE_LABEL[type].toUpperCase()}`}
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#334155' }}>{period}</div>
      </div>

      {/* Info siswa */}
      <table className="report-card-info">
        <tbody>
          <tr>
            <td className="report-card-info-label">Nama Santri</td>
            <td className="report-card-info-value">{student.name}</td>
            <td className="report-card-info-label">No.</td>
            <td className="report-card-info-value">{noUrut}</td>
          </tr>
          <tr>
            <td className="report-card-info-label">No. Registrasi</td>
            <td className="report-card-info-value">{student.registration_code}</td>
            <td className="report-card-info-label">Kelas</td>
            <td className="report-card-info-value">{classNameLabel}</td>
          </tr>
          <tr>
            <td className="report-card-info-label">{isMonthly ? 'Kamar / Asrama' : 'Wali Santri'}</td>
            <td className="report-card-info-value">
              {isMonthly ? student.dorms?.name ?? '—' : student.guardian_name ?? '—'}
            </td>
            <td className="report-card-info-label">Musyrif / Wali</td>
            <td className="report-card-info-value">{musyrifName ?? '—'}</td>
          </tr>
        </tbody>
      </table>

      {/* Tabel nilai */}
      <table className="report-card-scores">
        <thead>
          <tr style={{ background: `${primary}14` }}>
            <th style={{ width: 34 }}>No</th>
            <th>Aspek Penilaian</th>
            <th style={{ width: 70 }}>Nilai</th>
            <th style={{ width: 110 }}>Predikat</th>
          </tr>
        </thead>
        <tbody>
          {scoreRows.map((row) => (
            <tr key={row.label}>
              <td style={{ textAlign: 'center' }}>{row.no}</td>
              <td>{row.label}</td>
              <td style={{ textAlign: 'center', fontWeight: 600 }}>{row.value ?? '—'}</td>
              <td style={{ textAlign: 'center' }}>{row.predicate}</td>
            </tr>
          ))}
          {!isMonthly && (
            <>
              <tr style={{ background: '#f8fafc' }}>
                <td colSpan={2} style={{ fontWeight: 700 }}>
                  Jumlah Total
                </td>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{total}</td>
                <td />
              </tr>
              <tr style={{ background: '#f8fafc' }}>
                <td colSpan={2} style={{ fontWeight: 700 }}>
                  Nilai Rata-Rata
                </td>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>
                  {average ?? '—'}
                </td>
                <td style={{ textAlign: 'center' }}>{getPredicate(type, average)}</td>
              </tr>
            </>
          )}
        </tbody>
      </table>

      {/* Blok data bulanan */}
      {isMonthly && monthlyExtras && (
        <>
          <div className="report-card-blocks">
            <Block
              title="KETERTIBAN"
              rows={[
                ['Pelanggaran', monthlyExtras.violations ?? ''],
                ['Prestasi', monthlyExtras.achievements ?? ''],
                ['Sholat', monthlyExtras.sholat ?? ''],
              ]}
            />
            <Block
              title="PERKEMBANGAN HAFALAN"
              rows={[
                ['Ziyadah', monthlyExtras.ziyadah ?? ''],
                ["Muroja'ah", monthlyExtras.murojaah ?? ''],
                ['Hafalan', monthlyExtras.total_hafalan ?? ''],
              ]}
            />
            <Block
              title="ABSENSI"
              rows={[
                ['Sakit', `${monthlyExtras.sick_days ?? 0} hari`],
                ['Izin', `${monthlyExtras.excused_days ?? 0} hari`],
                ['Alpa', `${monthlyExtras.absent_days ?? 0} hari`],
                ['Pulang', `${monthlyExtras.early_leave_days ?? 0} hari`],
              ]}
            />
          </div>
          <div className="report-card-blocks">
            <Block
              title="PERKEMBANGAN FISIK"
              rows={[
                ['Berat Badan', monthlyExtras.weight_kg ? `${monthlyExtras.weight_kg} kg` : ''],
                ['Tinggi Badan', monthlyExtras.height_cm ? `${monthlyExtras.height_cm} cm` : ''],
              ]}
            />
            <Block title="Catatan Musyrif" rows={[['Catatan', monthlyExtras.notes ?? '']]} />
          </div>
        </>
      )}

      {/* Blok data semester */}
      {!isMonthly && semesterExtras && (
        <div className="report-card-blocks">
          <Block
            title="DATA PENDUKUNG"
            rows={[
              ['Berat Badan', semesterExtras.weight_kg ? `${semesterExtras.weight_kg} kg` : ''],
              ['Tinggi Badan', semesterExtras.height_cm ? `${semesterExtras.height_cm} cm` : ''],
              ['Sholat', semesterExtras.sholat ?? ''],
              [
                'Absensi',
                `Sakit ${semesterExtras.sick_days ?? 0} · Izin ${semesterExtras.excused_days ?? 0} · Alpa ${
                  semesterExtras.absent_days ?? 0
                } · Pulang ${semesterExtras.early_leave_days ?? 0}`,
              ],
              ['Catatan', semesterExtras.notes ?? ''],
            ]}
          />
        </div>
      )}

      {/* Tanda tangan */}
      <table className="report-card-signatures">
        <tbody>
          <tr>
            <SignatureCell role="Wali Santri" name={student.guardian_name ?? ''} />
            <SignatureCell role="Musyrif / Wali Kelas" name={musyrifName ?? ''} />
            <SignatureCell role="Pengasuh" name={school?.caretaker_name ?? ''} />
          </tr>
        </tbody>
      </table>

      {/* Footer */}
      <div className="report-card-footer">
        <span>No. Raport: {reportNo}</span>
        <span>Dicetak {dayjs().format('DD/MM/YYYY HH:mm')}</span>
      </div>
    </div>
  )
}
