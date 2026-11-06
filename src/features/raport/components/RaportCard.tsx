import dayjs from 'dayjs'
import { calcAverage, getCriteria, getPredicate, RAPORT_TYPE_LABEL } from '../constants'
import type { MonthlyReport, RaportStudent, SchoolSettings, SemesterReport } from '../types'
import type { RaportType } from '../types'

interface RaportCardProps {
  type: RaportType
  grade: string | null
  student: RaportStudent
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
    <div className="raport-block">
      <div className="raport-block-title">{title}</div>
      <table className="raport-block-table">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <td className="raport-block-label">{label}</td>
              <td className="raport-block-value">{value || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SignatureCell({ role, name }: { role: string; name: string }) {
  return (
    <td className="raport-sign-cell">
      <div className="raport-sign-role">{role}</div>
      <div className="raport-sign-space" />
      <div className="raport-sign-name">{name || '.......................'}</div>
    </td>
  )
}

export function RaportCard({
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
}: RaportCardProps) {
  const criteria = getCriteria(type, grade)
  const primary = school?.color_primary ?? '#1a5c35'
  const secondary = school?.color_secondary ?? '#c8a400'
  const isBulanan = type === 'bulanan'

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
    <div className="raport-card" style={{ borderColor: primary }}>
      {/* Kop sekolah */}
      <table className="raport-header">
        <tbody>
          <tr>
            <td className="raport-header-logo">
              <img src="/favicon.svg" alt="Logo" width={56} height={56} />
            </td>
            <td className="raport-header-center">
              <div style={{ color: primary, fontWeight: 800, fontSize: 17, letterSpacing: '-0.01em' }}>
                {school?.school_name ?? 'Laporanmu Boarding School'}
              </div>
              {school?.school_address && (
                <div style={{ fontSize: 11, color: '#475569' }}>{school.school_address}</div>
              )}
            </td>
            <td className="raport-header-logo">
              <img src="/favicon.svg" alt="Logo" width={56} height={56} />
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
          {isBulanan ? 'RAPORT BULANAN SANTRI' : `RAPORT ${RAPORT_TYPE_LABEL[type].toUpperCase()}`}
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#334155' }}>{period}</div>
      </div>

      {/* Info siswa */}
      <table className="raport-info">
        <tbody>
          <tr>
            <td className="raport-info-label">Nama Santri</td>
            <td className="raport-info-value">{student.name}</td>
            <td className="raport-info-label">No.</td>
            <td className="raport-info-value">{noUrut}</td>
          </tr>
          <tr>
            <td className="raport-info-label">No. Registrasi</td>
            <td className="raport-info-value">{student.registration_code}</td>
            <td className="raport-info-label">Kelas</td>
            <td className="raport-info-value">{classNameLabel}</td>
          </tr>
          <tr>
            <td className="raport-info-label">{isBulanan ? 'Kamar / Asrama' : 'Wali Santri'}</td>
            <td className="raport-info-value">
              {isBulanan ? student.dorms?.name ?? '—' : student.guardian_name ?? '—'}
            </td>
            <td className="raport-info-label">Musyrif / Wali</td>
            <td className="raport-info-value">{musyrifName ?? '—'}</td>
          </tr>
        </tbody>
      </table>

      {/* Tabel nilai */}
      <table className="raport-scores">
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
          {!isBulanan && (
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
      {isBulanan && monthlyExtras && (
        <>
          <div className="raport-blocks">
            <Block
              title="KETERTIBAN"
              rows={[
                ['Pelanggaran', monthlyExtras.pelanggaran ?? ''],
                ['Prestasi', monthlyExtras.prestasi ?? ''],
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
                ['Sakit', `${monthlyExtras.hari_sakit ?? 0} hari`],
                ['Izin', `${monthlyExtras.hari_izin ?? 0} hari`],
                ['Alpa', `${monthlyExtras.hari_alpa ?? 0} hari`],
                ['Pulang', `${monthlyExtras.hari_pulang ?? 0} hari`],
              ]}
            />
          </div>
          <div className="raport-blocks">
            <Block
              title="PERKEMBANGAN FISIK"
              rows={[
                ['Berat Badan', monthlyExtras.berat_badan ? `${monthlyExtras.berat_badan} kg` : ''],
                ['Tinggi Badan', monthlyExtras.tinggi_badan ? `${monthlyExtras.tinggi_badan} cm` : ''],
              ]}
            />
            <Block title="Catatan Musyrif" rows={[['Catatan', monthlyExtras.catatan ?? '']]} />
          </div>
        </>
      )}

      {/* Blok data semester */}
      {!isBulanan && semesterExtras && (
        <div className="raport-blocks">
          <Block
            title="DATA PENDUKUNG"
            rows={[
              ['Berat Badan', semesterExtras.berat_badan ? `${semesterExtras.berat_badan} kg` : ''],
              ['Tinggi Badan', semesterExtras.tinggi_badan ? `${semesterExtras.tinggi_badan} cm` : ''],
              ['Sholat', semesterExtras.sholat ?? ''],
              [
                'Absensi',
                `Sakit ${semesterExtras.hari_sakit ?? 0} · Izin ${semesterExtras.hari_izin ?? 0} · Alpa ${
                  semesterExtras.hari_alpa ?? 0
                } · Pulang ${semesterExtras.hari_pulang ?? 0}`,
              ],
              ['Catatan', semesterExtras.catatan ?? ''],
            ]}
          />
        </div>
      )}

      {/* Tanda tangan */}
      <table className="raport-signatures">
        <tbody>
          <tr>
            <SignatureCell role="Wali Santri" name={student.guardian_name ?? ''} />
            <SignatureCell role="Musyrif / Wali Kelas" name={musyrifName ?? ''} />
            <SignatureCell role="Pengasuh" name={school?.pengasuh_name ?? ''} />
          </tr>
        </tbody>
      </table>

      {/* Footer */}
      <div className="raport-footer">
        <span>No. Raport: {reportNo}</span>
        <span>Dicetak {dayjs().format('DD/MM/YYYY HH:mm')}</span>
      </div>
    </div>
  )
}
