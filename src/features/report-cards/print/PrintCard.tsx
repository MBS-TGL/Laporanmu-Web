import { QRCodeSVG } from 'qrcode.react'
import type { CSSProperties } from 'react'
import {
  BULAN,
  LABEL,
  LIST_KAMAR,
  getReportLabels,
  toArabicNum,
} from './labels'
import { DEFAULT_LAYOUT_CONFIG, type LayoutConfig } from './layout'
import {
  getGradePredicate,
  ORAL_GRADE_SCALE,
  ORAL_PRACTICAL_SCALE,
  type V1ReportType,
} from './predicates'
import { RAPORT_AR_FONT, RAPORT_SANS, RAPORT_SERIF } from './fonts'
import {
  formatPrintDate,
  getYearDisplay,
  type PrintExtra,
  type PrintSettings,
  type PrintStudent,
} from './adapters'
import type { PrintCriterion, PrintFlags } from './criteria'
import { SignatureBlock } from './SignatureBlock'
import { titleCaseName } from './text'
import { translitClassToAr, translitToAr } from './translit'

interface PrintCardProps {
  student: PrintStudent
  criteria: PrintCriterion[]
  scores: Record<string, number | null>
  extra: PrintExtra
  settings: PrintSettings
  reportType: V1ReportType
  flags: PrintFlags
  bulan: number
  year: number
  semester: 1 | 2
  academicYear: string
  className: string
  musyrif: string | null
  lang: 'id' | 'ar'
  pageSize: 'a4' | 'f4'
  studentIndex: number
  reportNo: string
  verifyUrl: string
  signMode: 'basah' | 'qrcode'
  layoutConfig: LayoutConfig
}

const border = '1px solid #999'

export function PrintCard({
  student,
  criteria,
  scores,
  extra,
  settings,
  reportType,
  flags,
  bulan,
  year,
  semester,
  academicYear,
  className,
  musyrif,
  lang,
  pageSize,
  studentIndex,
  reportNo,
  verifyUrl,
  signMode,
  layoutConfig,
}: PrintCardProps) {
  const isAr = lang === 'ar'
  const L = LABEL[lang]
  const RL = getReportLabels(settings)
  const lc = { ...DEFAULT_LAYOUT_CONFIG, ...layoutConfig }
  const isA4 = pageSize === 'a4'
  const pageW = pageSize === 'f4' ? '215mm' : '210mm'
  const pageH = pageSize === 'f4' ? '330mm' : '297mm'
  const isLisan = reportType === 'pondok_lisan'
  const isMapelPondok = reportType === 'pondok_mapel'
  const isSemesterExam = isLisan || isMapelPondok
  const kkmScore = 50
  const monthObj = BULAN[bulan - 1] ?? BULAN[0]

  const gradeOf = (value: number | null | undefined, criterionKey = '') =>
    getGradePredicate(value, reportType, criterionKey)
  const gradeLabel = (value: number | null | undefined, criterionKey = '') =>
    isAr ? gradeOf(value, criterionKey).label : gradeOf(value, criterionKey).id

  // Ujian Lisan: materi praktik dicetak di bagian sendiri dan tidak ikut jumlah/rata-rata
  const lisanCriteria = isLisan ? criteria.filter((criterion) => !criterion.practical) : criteria
  const practicalCriteria = isLisan ? criteria.filter((criterion) => criterion.practical) : []
  const subjectHeader = isLisan ? L.subjectLisan : L.subject

  const displayName = isAr
    ? student.nameAr || titleCaseName(student.name)
    : titleCaseName(student.name)
  const displayClassName = isAr ? translitClassToAr(className) : className
  const displayRoom = isAr
    ? (LIST_KAMAR.find((room) => room.id.toLowerCase() === student.room.toLowerCase())?.ar ??
      student.room)
    : student.room
  const displayMusyrif = isAr && musyrif ? translitToAr(musyrif) : musyrif
  // Nama wali santri tidak dicetak: kolom tanda tangan dibiarkan kosong
  // untuk diisi manual saat raport dibagikan.
  const displayGuardian = '......................'
  const displayHeadmaster = isAr ? settings.headmaster_name_ar : settings.headmaster_name_id
  const displayPengasuh = isAr ? settings.pengasuh_name_ar : settings.pengasuh_name_id
  const yearDisplay = getYearDisplay(bulan, year, lang, academicYear)

  const filledScores = lisanCriteria
    .map((criterion) => scores[criterion.key])
    .filter((value): value is number => typeof value === 'number')
  const total = filledScores.reduce((sum, value) => sum + value, 0)
  // Rata-rata mengikuti Excel (AVERAGE, 2 desimal) — praktik dikecualikan.
  const average = filledScores.length
    ? Math.round((total / filledScores.length) * 100) / 100
    : null
  const averageText = average === null ? '—' : average.toFixed(2)

  const rowPadding = isAr
    ? isSemesterExam
      ? isA4
        ? '1px 0'
        : '2px 0'
      : isA4
        ? '2.5px 0'
        : '4px 0'
    : isSemesterExam
      ? isA4
        ? '2px 0'
        : '4px 0'
      : isA4
        ? '4px 0'
        : '7px 0'
  const secPadding = isAr ? (isA4 ? '3px 7px' : '6px 7px') : isA4 ? '5px 7px' : '9.5px 7px'
  const absPadding = isAr ? (isA4 ? '1.5px 7px' : '3px 7px') : isA4 ? '3.5px 7px' : '6.5px 7px'
  // Padding baris tabel nilai (v1 `rp`): lebih rapat dari baris info santri.
  const cellPadding = isSemesterExam ? (isA4 ? '1px' : '2px') : isA4 ? '1.5px' : '2px'

  const displayVal = (value: PrintExtra[string], zeroAsDash = false): string | number => {
    if (
      value === '' ||
      value === null ||
      value === undefined ||
      (value === 0 && zeroAsDash) ||
      (value === '0' && zeroAsDash)
    ) {
      return '—'
    }
    if (isAr) {
      return toArabicNum(
        String(value)
          .replace(/Halaman/gi, 'صفحة')
          .replace(/Juz/gi, 'جزء')
          .replace(/hari/gi, 'يوم'),
      )
    }
    return value
  }

  const reportTitle =
    reportType === 'bulanan'
      ? L.reportTitle
      : isLisan
        ? isAr
          ? RL.ujian_lisan_report.ar
          : RL.ujian_lisan_report.id
        : isMapelPondok
          ? isAr
            ? RL.ujian_pondok_report.ar
            : RL.ujian_pondok_report.id
          : isAr
            ? 'التقرير العام'
            : 'RAPORT UMUM'

  const semesterPair = semester === 2 ? RL.semester_genap : RL.semester_ganjil
  const periodTitle =
    reportType === 'bulanan'
      ? `${L.month} ${isAr ? monthObj.ar : monthObj.id_str}`
      : (() => {
          const prefix = isLisan
            ? RL.period_prefix_lisan
            : isMapelPondok
              ? RL.period_prefix_pondok
              : RL.period_prefix_general
          return isAr ? `${prefix.ar} ${semesterPair.ar}` : `${prefix.id} ${semesterPair.id}`
        })()

  const unitLogo = /sma|^(10|11|12)/i.test(className)
    ? '/logos/logo-sma.jpg'
    : '/logos/logo-smp.png'

  const headerCell: CSSProperties = {
    border,
    verticalAlign: 'middle',
    textAlign: 'center',
    fontWeight: 800,
    color: '#000',
    background: '#f0f4f8',
    padding: `${cellPadding} 6px`,
    fontSize: isAr ? '16pt' : '10.5pt',
    textTransform: isAr ? undefined : 'uppercase',
    lineHeight: 1.1,
  }
  const bodyCell: CSSProperties = {
    border,
    verticalAlign: 'middle',
    color: '#000',
    fontSize: isAr ? (isSemesterExam ? '16pt' : '13.5pt') : '10.5pt',
    lineHeight: 1.2,
  }

  const displayText = (value: PrintExtra[string]): string | number =>
    isAr && typeof value === 'string' && value.trim() ? translitToAr(value) : displayVal(value)

  const hafalanTotal = (() => {
    if (extra.total_hafalan) return extra.total_hafalan
    const ziyadah = Number(extra.ziyadah)
    const murojaah = Number(extra.murojaah)
    if (Number.isNaN(ziyadah) || Number.isNaN(murojaah)) return ''
    return String(ziyadah + murojaah)
  })()

  const showBlocks = (flags.hasFisik || flags.hasHafalan || flags.hasAttendance) && !isSemesterExam
  const sectionTitleStyle: CSSProperties = {
    fontSize: isAr ? '14.5pt' : '9pt',
    fontWeight: 800,
    textAlign: 'center',
    background: '#f0f4f8',
    border,
    borderBottom: 'none',
    padding: '3px 0',
    fontFamily: isAr ? RAPORT_AR_FONT : 'inherit',
    lineHeight: isAr ? 1.15 : 'normal',
    textTransform: isAr ? undefined : 'uppercase',
    letterSpacing: isAr ? undefined : '0.02em',
  }
  const sectionLabel: CSSProperties = {
    border,
    padding: secPadding,
    fontSize: isAr ? `${lc.arSecFontSize}pt` : '9.5pt',
    fontFamily: isAr ? RAPORT_AR_FONT : 'inherit',
  }
  const sectionValue: CSSProperties = {
    ...sectionLabel,
    textAlign: 'center',
    fontWeight: 700,
  }

  const signatureQr = (role: string) => `${verifyUrl}&sig=${role}`

  const signatures = isAr
    ? [
        {
          key: 'pengasuh',
          label: isSemesterExam ? 'رئيس المدرسة' : settings.headmaster_title_ar || 'المشرف',
          nama: isSemesterExam ? displayHeadmaster : displayPengasuh,
          topLabel: undefined as string | undefined,
          mode: signMode,
          qrValue: signatureQr('pengasuh'),
        },
        {
          key: 'wali_kelas',
          label: isSemesterExam ? 'رائد الفصل' : L.musyrif,
          nama: displayMusyrif || '',
          topLabel: undefined as string | undefined,
          mode: signMode,
          qrValue: signatureQr('wali_kelas'),
        },
        {
          key: 'wali_santri',
          label: isLisan ? L.guardianLisan : L.guardian,
          nama: displayGuardian,
          topLabel: undefined as string | undefined,
          mode: 'basah' as const,
          qrValue: undefined as string | undefined,
        },
      ]
    : [
        {
          key: 'wali_santri',
          label: isLisan ? L.guardianLisan : L.guardian,
          nama: displayGuardian,
          topLabel: undefined as string | undefined,
          mode: 'basah' as const,
          qrValue: undefined as string | undefined,
        },
        {
          key: 'wali_kelas',
          label: isSemesterExam ? 'Wali Kelas' : 'Kepala Sekolah',
          nama: isSemesterExam ? displayMusyrif || '' : displayHeadmaster,
          topLabel: isSemesterExam ? undefined : 'Mengetahui,',
          mode: signMode,
          qrValue: signatureQr('wali_kelas'),
        },
        {
          key: 'pengasuh',
          label: isSemesterExam ? 'Kepala Sekolah' : settings.headmaster_title_id,
          nama: isSemesterExam ? displayHeadmaster : displayPengasuh,
          topLabel: undefined as string | undefined,
          mode: signMode,
          qrValue: signatureQr('pengasuh'),
        },
      ]

  // Ringkasan Ujian Lisan seperti di Excel: Jumlah/Rata-rata + Ujian Praktik | Sistem Penilaian | Predikat Praktik
  const lisanSummary = isLisan
    ? (() => {
        const numFmt = (value: number | string) => (isAr ? toArabicNum(value) : String(value))
        const miniCell: CSSProperties = {
          border,
          padding: isAr ? '1px 6px' : '2px 6px',
          fontSize: isAr ? '12.5pt' : '9.5pt',
          fontFamily: isAr ? RAPORT_AR_FONT : 'inherit',
          lineHeight: 1.2,
          color: '#000',
          textAlign: 'center',
          verticalAlign: 'middle',
        }
        const miniHead: CSSProperties = { ...miniCell, fontWeight: 800, background: '#f0f4f8' }
        const miniTitle: CSSProperties = {
          fontWeight: 700,
          fontSize: isAr ? '13pt' : '10.5pt',
          fontFamily: isAr ? RAPORT_AR_FONT : 'inherit',
          textAlign: isAr ? 'right' : 'left',
          lineHeight: 1.2,
          margin: '6px 0 2px',
        }
        const miniTable: CSSProperties = { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }
        // Rentang angka selalu dibaca kiri-ke-kanan, juga di halaman RTL
        const ltr = (text: string) => (
          <span style={{ direction: 'ltr', unicodeBidi: 'isolate', display: 'inline-block' }}>{numFmt(text)}</span>
        )
        const hasPractical = practicalCriteria.length > 0

        return (
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              direction: isAr ? 'rtl' : 'ltr',
              alignItems: 'flex-start',
              gap: 8,
              marginTop: 6,
              marginBottom: isA4 ? 3 : 4,
            }}
          >
            <div style={{ flex: '1 1 40%', minWidth: 0 }}>
              <table style={miniTable}>
                <tbody>
                  <tr>
                    <td style={{ ...miniCell, textAlign: isAr ? 'right' : 'left', fontWeight: 700 }}>{L.totalLisan}</td>
                    <td style={{ ...miniHead, width: '28%' }}>{numFmt(total)}</td>
                  </tr>
                  <tr>
                    <td style={{ ...miniCell, textAlign: isAr ? 'right' : 'left', fontWeight: 700 }}>{L.avgLisan}</td>
                    <td style={{ ...miniHead, width: '28%' }}>{numFmt(averageText)}</td>
                  </tr>
                </tbody>
              </table>

              {hasPractical && (
                <>
                  <div style={miniTitle}>{L.practicalTitle}</div>
                  <table style={miniTable}>
                    <thead>
                      <tr>
                        <th style={{ ...miniHead, width: '12%' }}>{L.num}</th>
                        <th style={miniHead}>{L.practicalSubject}</th>
                        <th style={{ ...miniHead, width: '18%' }}>{L.score}</th>
                        <th style={{ ...miniHead, width: '18%' }}>{L.grade}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {practicalCriteria.map((criterion, index) => {
                        const value = scores[criterion.key] ?? null
                        return (
                          <tr key={criterion.key}>
                            <td style={miniCell}>{numFmt(index + 1)}</td>
                            <td style={{ ...miniCell, textAlign: isAr ? 'right' : 'left' }}>
                              {isAr ? criterion.ar ?? criterion.id : criterion.id}
                            </td>
                            <td style={{ ...miniCell, fontWeight: 700 }}>{displayVal(value)}</td>
                            <td style={{ ...miniCell, fontWeight: 700 }}>{gradeLabel(value, criterion.key)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </>
              )}
            </div>

            <div style={{ flex: '1 1 32%', minWidth: 0, marginTop: 6 }}>
              <table style={miniTable}>
                <thead>
                  <tr>
                    <th colSpan={2} style={miniHead}>{L.gradeSystem}</th>
                  </tr>
                </thead>
                <tbody>
                  {ORAL_GRADE_SCALE.map((row) => (
                    <tr key={row.min}>
                      <td style={{ ...miniCell, fontWeight: 700 }}>{isAr ? row.ar : row.id}</td>
                      <td style={miniCell}>{ltr(`${row.min} - ${row.max}`)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {hasPractical && (
              <div style={{ flex: '1 1 28%', minWidth: 0, marginTop: 6 }}>
                <table style={miniTable}>
                  <thead>
                    <tr>
                      <th colSpan={2} style={miniHead}>{L.practicalPredicate}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ORAL_PRACTICAL_SCALE.map((row) => (
                      <tr key={row.id}>
                        <td style={{ ...miniCell, fontWeight: 700 }}>{isAr ? row.ar : row.id}</td>
                        <td style={miniCell}>{ltr(row.range)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })()
    : null
  return (
    <div
      className="raport-card"
      data-student-id={student.id}
      style={{
        fontFamily: RAPORT_SERIF,
        width: pageW,
        minWidth: pageW,
        height: pageH,
        minHeight: pageH,
        background: '#fff',
        color: '#000',
        padding: isA4 ? '4mm 10mm 2mm 20mm' : '8mm 10mm 2mm 20mm',
        boxSizing: 'border-box',
        fontSize: '11pt',
        lineHeight: 1.4,
        pageBreakAfter: 'always',
        margin: '0 auto',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <style>{`
        .raport-signature-row { display: flex !important; flex-direction: row !important; justify-content: space-between !important; gap: 10px !important; }
        .raport-card-body { flex: 1 1 auto; min-height: 0; }
        .raport-card-footer { flex-shrink: 0; margin-top: auto; }
      `}</style>

      <div className="raport-card-body">
        {/* Kop sekolah */}
        <div style={{ marginBottom: isSemesterExam ? (isA4 ? 4 : 6) : isA4 ? 6 : 12 }}>
          <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', border: 'none', margin: '0 0 10px 0' }}>
            <tbody>
              <tr>
                <td style={{ width: isSemesterExam ? '60pt' : '68pt', verticalAlign: 'middle', textAlign: 'center' }}>
                  <img
                    src={unitLogo}
                    alt="Logo unit"
                    style={{ maxWidth: isSemesterExam ? '60pt' : '68pt', maxHeight: isSemesterExam ? '60pt' : '68pt', objectFit: 'contain', display: 'block', margin: '0 auto' }}
                  />
                </td>
                <td style={{ padding: '0 10px', verticalAlign: 'middle', textAlign: 'center' }}>
                  {settings.school_subtitle_ar && (
                    <div style={{ fontSize: isSemesterExam ? '10.5pt' : '12.5pt', color: '#444', direction: 'rtl', marginBottom: 2, fontFamily: RAPORT_AR_FONT, fontWeight: 700, lineHeight: 1.3 }}>
                      {settings.school_subtitle_ar}
                    </div>
                  )}
                  <div style={{ fontSize: isSemesterExam ? '26pt' : '30pt', fontWeight: 900, color: settings.report_color_primary, direction: 'rtl', fontFamily: RAPORT_AR_FONT, lineHeight: 1.05, marginBottom: 4 }}>
                    {settings.school_name_ar}
                  </div>
                  <div style={{ fontSize: isSemesterExam ? '13pt' : '15pt', fontWeight: 800, letterSpacing: 0.8, color: '#111', marginTop: 2 }}>
                    {settings.school_name_id}
                  </div>
                  <div style={{ fontSize: '8.5pt', color: '#666', marginTop: 4, lineHeight: 1.3, fontWeight: 400, fontFamily: RAPORT_SANS }}>
                    <div>{settings.school_address_line1}</div>
                    <div>{settings.school_address_line2}</div>
                  </div>
                </td>
                <td style={{ width: isSemesterExam ? '60pt' : '68pt', verticalAlign: 'middle', textAlign: 'center' }}>
                  <img
                    src={settings.logo_url}
                    alt="Logo pondok"
                    style={{ maxWidth: isSemesterExam ? '60pt' : '68pt', maxHeight: isSemesterExam ? '60pt' : '68pt', objectFit: 'contain', display: 'block', margin: '0 auto' }}
                  />
                </td>
              </tr>
            </tbody>
          </table>
          <div style={{ height: 3, background: `linear-gradient(90deg, ${settings.report_color_primary}, ${settings.report_color_secondary}, ${settings.report_color_primary})` }} />
          <div style={{ borderBottom: `3px double ${settings.report_color_primary}`, marginTop: 3 }} />
        </div>

        {/* Judul laporan */}
        <div style={{ textAlign: 'center', margin: isSemesterExam ? (isA4 ? '2px 0' : '2px 0 4px') : isA4 ? '6px 0 8px' : '12px 0 16px', fontFamily: isAr ? RAPORT_AR_FONT : 'inherit' }}>
          <div style={{ fontSize: isAr ? '28pt' : isSemesterExam ? '14pt' : '18pt', fontWeight: 900, direction: isAr ? 'rtl' : 'ltr', lineHeight: isAr ? 1.15 : 1.3, textTransform: isLisan && !isAr ? 'uppercase' : undefined }}>
            {reportTitle}
          </div>
          <div style={{ fontSize: isAr ? '22pt' : isSemesterExam ? '12pt' : '14pt', fontWeight: 700, direction: isAr ? 'rtl' : 'ltr', marginTop: isAr ? 4 : 10, lineHeight: isAr ? 1.15 : 1.3, textTransform: isLisan && !isAr ? 'uppercase' : undefined }}>
            {periodTitle}
          </div>
        </div>

        {/* Info santri */}
        <table style={{ width: '100%', marginBottom: isSemesterExam ? (isA4 ? 4 : 6) : isA4 ? 6 : 10, fontSize: isAr ? '10.5pt' : '11.5pt', borderCollapse: 'collapse', tableLayout: 'fixed', direction: isAr ? 'rtl' : 'ltr' }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid #ccc' }}>
              <td style={{ width: '14%', verticalAlign: 'middle', padding: rowPadding }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingRight: isAr ? 0 : '10px' }}>
                  <span>{L.studentName}</span>
                  <span>:</span>
                </div>
              </td>
              <td style={{ width: '38%', verticalAlign: 'middle', fontWeight: 700, padding: rowPadding, paddingRight: isAr ? 0 : '18px', textAlign: isAr ? 'right' : 'left', fontFamily: isAr ? RAPORT_AR_FONT : 'inherit', fontSize: isAr ? '16pt' : '12pt', lineHeight: 1.25 }}>
                {displayName}
              </td>
              <td style={{ width: '14%', verticalAlign: 'middle', padding: rowPadding }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingRight: isAr ? 0 : '10px' }}>
                  <span>{isSemesterExam ? L.class : L.room}</span>
                  <span>:</span>
                </div>
              </td>
              <td style={{ width: '34%', verticalAlign: 'middle', fontWeight: 700, padding: rowPadding, textAlign: isAr ? 'right' : 'left', fontFamily: isAr ? RAPORT_AR_FONT : 'inherit', fontSize: isAr ? '16pt' : '12pt' }}>
                {isSemesterExam ? displayClassName : displayRoom || '—'}
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #ccc' }}>
              <td style={{ width: '14%', verticalAlign: 'middle', padding: rowPadding }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingRight: isAr ? 0 : '10px' }}>
                  <span>{isSemesterExam ? (isAr ? 'رقم الطالب' : 'No. Absen') : L.class}</span>
                  <span>:</span>
                </div>
              </td>
              <td style={{ width: '38%', verticalAlign: 'middle', fontWeight: 700, padding: rowPadding, paddingRight: isAr ? 0 : '18px', textAlign: isAr ? 'right' : 'left', fontFamily: isAr ? RAPORT_AR_FONT : 'inherit', fontSize: isAr ? '16pt' : '12pt' }}>
                {isSemesterExam ? (isAr ? toArabicNum(studentIndex) : studentIndex) : displayClassName}
              </td>
              <td style={{ width: '14%', verticalAlign: 'middle', padding: rowPadding }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingRight: isAr ? 0 : '10px' }}>
                  <span>{L.year}</span>
                  <span>:</span>
                </div>
              </td>
              <td style={{ width: '34%', verticalAlign: 'middle', fontWeight: 700, padding: rowPadding, textAlign: isAr ? 'right' : 'left', fontFamily: isAr ? RAPORT_AR_FONT : 'inherit', fontSize: isAr ? '16pt' : '12pt' }}>
                {yearDisplay}
              </td>
            </tr>
          </tbody>
        </table>

        {(isLisan || isMapelPondok) && (
          <div style={{ textAlign: isAr ? 'right' : 'left', direction: isAr ? 'rtl' : 'ltr', fontFamily: isAr ? RAPORT_AR_FONT : 'inherit', fontSize: isAr ? '13pt' : '11pt', fontWeight: 700, marginBottom: 2 }}>
            {isLisan
              ? isAr
                ? 'الاختبار الشفهي'
                : 'Ujian Lisan'
              : isAr
                ? 'الاختبار للدراسة الإسلامية'
                : 'Ujian Mapel Pondok'}
          </div>
        )}

        {/* Tabel nilai */}
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '10.5pt', marginBottom: isSemesterExam ? (isA4 ? 3 : 4) : isA4 ? 6 : 12 }}>
          <thead>
            <tr>
              {isAr ? (
                isMapelPondok ? (
                  <>
                    <th style={{ ...headerCell, width: `${lc.gradeColWidth}%` }}>{L.grade}</th>
                    <th style={{ ...headerCell, width: `${lc.scoreColWidth}%` }}>{L.score}</th>
                    <th style={{ ...headerCell, width: '8%' }}>{RL.kkm_label.ar}</th>
                    <th style={headerCell} colSpan={2}>{subjectHeader}</th>
                    <th style={{ ...headerCell, width: `${lc.numColWidth}%` }}>{L.num}</th>
                  </>
                ) : (
                  <>
                    <th style={{ ...headerCell, width: `${lc.gradeColWidth}%` }}>{L.grade}</th>
                    <th style={{ ...headerCell, width: `${lc.scoreColWidth}%` }}>{L.score}</th>
                    <th style={headerCell} colSpan={2}>{subjectHeader}</th>
                    <th style={{ ...headerCell, width: `${lc.numColWidth}%` }}>{L.num}</th>
                  </>
                )
              ) : isMapelPondok ? (
                <>
                  <th style={{ ...headerCell, width: `${lc.numColWidth}%` }}>{L.num}</th>
                  <th style={headerCell} colSpan={2}>{subjectHeader}</th>
                  <th style={{ ...headerCell, width: '8%' }}>{RL.kkm_label.id}</th>
                  <th style={{ ...headerCell, width: `${lc.scoreColWidth}%` }}>{L.score}</th>
                  <th style={{ ...headerCell, width: `${lc.gradeColWidth}%` }}>{L.grade}</th>
                </>
              ) : (
                <>
                  <th style={{ ...headerCell, width: `${lc.numColWidth}%` }}>{L.num}</th>
                  <th style={headerCell} colSpan={2}>{subjectHeader}</th>
                  <th style={{ ...headerCell, width: `${lc.scoreColWidth}%` }}>{L.score}</th>
                  <th style={{ ...headerCell, width: `${lc.gradeColWidth}%` }}>{L.grade}</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {lisanCriteria.map((criterion, index) => {
              const value = scores[criterion.key] ?? null
              const subjectAr = criterion.ar
              return (
                <tr key={criterion.key}>
                  {isAr ? (
                    <>
                      <td style={{ ...bodyCell, textAlign: 'center', padding: `${cellPadding} 8px`, fontWeight: 700 }}>{gradeLabel(value, criterion.key)}</td>
                      <td style={{ ...bodyCell, textAlign: 'center', padding: `${cellPadding} 6px`, fontWeight: 700 }}>{displayVal(value)}</td>
                      {isMapelPondok && (
                        <td style={{ ...bodyCell, textAlign: 'center', padding: `${cellPadding} 6px`, fontWeight: 700 }}>{displayVal(kkmScore)}</td>
                      )}
                      {isSemesterExam && subjectAr ? (
                        <td colSpan={2} style={{ ...bodyCell, textAlign: 'right', padding: `${cellPadding} 10px`, fontFamily: RAPORT_AR_FONT, fontSize: isSemesterExam ? '16pt' : `${lc.arMainFontSize}pt` }}>
                          {subjectAr}
                        </td>
                      ) : subjectAr ? (
                        <>
                          <td style={{ ...bodyCell, textAlign: 'right', padding: `${cellPadding} 10px`, fontFamily: RAPORT_AR_FONT, fontSize: `${lc.arMainFontSize}pt`, width: `${lc.subjectArWidth}%` }}>{subjectAr}</td>
                          <td style={{ ...bodyCell, textAlign: 'right', padding: `${cellPadding} 10px`, color: '#444', fontSize: '10.5pt', width: `${lc.subjectIdWidth}%` }}>{criterion.id}</td>
                        </>
                      ) : (
                        <td colSpan={2} style={{ ...bodyCell, textAlign: 'right', padding: `${cellPadding} 10px`, color: '#444', fontSize: '10.5pt' }}>{criterion.id}</td>
                      )}
                      <td style={{ ...bodyCell, textAlign: 'center', padding: `${cellPadding} 6px`, fontFamily: RAPORT_AR_FONT, fontSize: `${lc.arValueFontSize}pt` }}>{toArabicNum(index + 1)}</td>
                    </>
                  ) : (
                    <>
                      <td style={{ ...bodyCell, textAlign: 'center', padding: `${cellPadding} 6px`, width: `${lc.numColWidth}%` }}>{index + 1}</td>
                      {subjectAr ? (
                        <>
                          <td style={{ ...bodyCell, textAlign: 'left', padding: `${cellPadding} 10px`, color: '#444', width: `${lc.subjectIdWidth}%` }}>{criterion.id}</td>
                          <td style={{ ...bodyCell, textAlign: 'right', direction: 'rtl', padding: `${cellPadding} 10px`, fontFamily: RAPORT_AR_FONT, fontSize: `${lc.arMainFontSize}pt`, width: `${lc.subjectArWidth}%` }}>{subjectAr}</td>
                        </>
                      ) : (
                        <td colSpan={2} style={{ ...bodyCell, textAlign: 'left', padding: `${cellPadding} 10px`, color: '#444' }}>{criterion.id}</td>
                      )}
                      {isMapelPondok && (
                        <td style={{ ...bodyCell, textAlign: 'center', padding: `${cellPadding} 6px`, fontWeight: 700 }}>{kkmScore}</td>
                      )}
                      <td style={{ ...bodyCell, textAlign: 'center', padding: `${cellPadding} 6px`, fontWeight: 700 }}>{displayVal(value)}</td>
                      <td style={{ ...bodyCell, textAlign: 'center', padding: `${cellPadding} 8px`, fontWeight: 700 }}>{gradeLabel(value, criterion.key)}</td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>

        {isSemesterExam && !isLisan && filledScores.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5pt', marginBottom: 6, marginTop: -1, direction: isAr ? 'rtl' : 'ltr' }}>
            <tbody>
              <tr>
                {isAr ? (
                  <>
                    <td style={{ border, padding: '4px 16px', textAlign: 'center', fontWeight: 700, background: '#f0f4f8', width: '25%', fontFamily: RAPORT_AR_FONT }}>{toArabicNum(total)}</td>
                    <td style={{ border, padding: '4px 14px', textAlign: 'right', fontFamily: RAPORT_AR_FONT, fontWeight: 700 }}>{RL.total_label.ar}</td>
                  </>
                ) : (
                  <>
                    <td style={{ border, padding: '4px 14px', textAlign: 'left', fontWeight: 700 }}>{RL.total_label.id}</td>
                    <td style={{ border, padding: '4px 16px', textAlign: 'center', fontWeight: 700, background: '#f0f4f8', width: '25%' }}>{total}</td>
                  </>
                )}
              </tr>
              <tr>
                {isAr ? (
                  <>
                    <td style={{ border, padding: '4px 16px', textAlign: 'center', fontWeight: 700, background: '#f0f4f8', width: '25%', fontFamily: RAPORT_AR_FONT }}>{toArabicNum(averageText === '—' ? '0' : averageText)}</td>
                    <td style={{ border, padding: '4px 14px', textAlign: 'right', fontFamily: RAPORT_AR_FONT, fontWeight: 700 }}>{RL.avg_label.ar}</td>
                  </>
                ) : (
                  <>
                    <td style={{ border, padding: '4px 14px', textAlign: 'left', fontWeight: 700 }}>{RL.avg_label.id}</td>
                    <td style={{ border, padding: '4px 16px', textAlign: 'center', fontWeight: 700, background: '#f0f4f8', width: '25%' }}>{averageText}</td>
                  </>
                )}
              </tr>
            </tbody>
          </table>
        )}

        {isLisan && extra.hafalan_note ? (
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              tableLayout: 'fixed',
              fontSize: '10.5pt',
              marginBottom: isA4 ? 3 : 4,
              direction: isAr ? 'rtl' : 'ltr',
            }}
          >
            <tbody>
              <tr>
                <td
                  style={{
                    border,
                    padding: isAr ? '1px 6px' : '2px 6px',
                    fontWeight: 700,
                    background: '#f0f4f8',
                    width: '18%',
                    textAlign: isAr ? 'right' : 'left',
                    fontFamily: isAr ? RAPORT_AR_FONT : 'inherit',
                    fontSize: isAr ? '12.5pt' : '9.5pt',
                  }}
                >
                  {L.hafalanLisan}
                </td>
                <td
                  style={{
                    border,
                    padding: isAr ? '1px 6px' : '2px 6px',
                    textAlign: isAr ? 'right' : 'left',
                    fontFamily: isAr ? RAPORT_AR_FONT : 'inherit',
                    fontSize: isAr ? '12.5pt' : '9.5pt',
                  }}
                >
                  {displayVal(extra.hafalan_note)}
                </td>
              </tr>
            </tbody>
          </table>
        ) : null}

        {lisanSummary}

        {showBlocks && (
          <>
            <div style={{ display: 'flex', gap: 0, marginBottom: isA4 ? 8 : 14, flexDirection: isAr ? 'row-reverse' : 'row', alignItems: 'stretch' }}>
              <div style={{ width: '40%', flexShrink: 0, display: 'flex', flexDirection: 'column', paddingRight: 7 }}>
                <div style={sectionTitleStyle}>{isAr ? RL.section_perilaku.ar : RL.section_perilaku.id}</div>
                <table style={{ width: '100%', height: '100%', borderCollapse: 'collapse', flex: 1 }}>
                  <tbody>
                    {[
                      { key: 'pelanggaran', label: RL.pelanggaran_label },
                      { key: 'prestasi', label: RL.prestasi_label },
                      { key: 'sholat', label: RL.sholat_label },
                    ].map((item) => (
                      <tr key={item.key} style={{ height: '33.33%' }}>
                        {isAr ? (
                          <>
                            <td style={{ ...sectionValue, width: '70%' }}>{displayText(extra[item.key])}</td>
                            <td style={{ ...sectionLabel, width: '30%', textAlign: 'right' }}>{item.label.ar}</td>
                          </>
                        ) : (
                          <>
                            <td style={{ ...sectionLabel, width: '30%' }}>{item.label.id}</td>
                            <td style={{ ...sectionValue, width: '70%' }}>{displayText(extra[item.key])}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {flags.hasHafalan && (
                <div style={{ width: '40%', flexShrink: 0, display: 'flex', flexDirection: 'column', paddingRight: 7 }}>
                  <div style={sectionTitleStyle}>{isAr ? RL.section_hafalan.ar : RL.section_hafalan.id}</div>
                  <table style={{ width: '100%', height: '100%', borderCollapse: 'collapse', flex: 1 }}>
                    <tbody>
                      <tr style={{ height: lc.showCapaianHafalan ? '33.33%' : '50%' }}>
                        {isAr ? (
                          <>
                            <td style={{ ...sectionValue, width: '70%' }}>{displayVal(extra.ziyadah, true)}</td>
                            <td style={{ ...sectionLabel, width: '30%', textAlign: 'right' }}>{L.ziyadah}</td>
                          </>
                        ) : (
                          <>
                            <td style={{ ...sectionLabel, width: '30%' }}>{L.ziyadah}</td>
                            <td style={{ ...sectionValue, width: '70%' }}>{displayVal(extra.ziyadah, true)}</td>
                          </>
                        )}
                      </tr>
                      <tr style={{ height: lc.showCapaianHafalan ? '33.33%' : '50%' }}>
                        {isAr ? (
                          <>
                            <td style={{ ...sectionValue, width: '70%' }}>{displayVal(extra.murojaah, true)}</td>
                            <td style={{ ...sectionLabel, width: '30%', textAlign: 'right' }}>{L.murojaah}</td>
                          </>
                        ) : (
                          <>
                            <td style={{ ...sectionLabel, width: '30%' }}>{L.murojaah}</td>
                            <td style={{ ...sectionValue, width: '70%' }}>{displayVal(extra.murojaah, true)}</td>
                          </>
                        )}
                      </tr>
                      {lc.showCapaianHafalan && (
                        <tr style={{ height: '33.33%' }}>
                          {isAr ? (
                            <>
                              <td style={{ ...sectionValue, width: '70%' }}>{displayVal(hafalanTotal, true)}</td>
                              <td style={{ ...sectionLabel, width: '30%', textAlign: 'right' }}>{L.totalHafalan}</td>
                            </>
                          ) : (
                            <>
                              <td style={{ ...sectionLabel, width: '30%' }}>{L.totalHafalan}</td>
                              <td style={{ ...sectionValue, width: '70%' }}>{displayVal(hafalanTotal, true)}</td>
                            </>
                          )}
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {flags.hasAttendance && (
                <div style={{ width: flags.hasHafalan ? '20%' : '60%', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
                  <div style={sectionTitleStyle}>{isAr ? RL.section_attendance.ar : RL.section_attendance.id}</div>
                  <table style={{ width: '100%', height: '100%', borderCollapse: 'collapse', flex: 1 }}>
                    <tbody>
                      {[
                        { key: 'hari_sakit', label: L.sick },
                        { key: 'hari_izin', label: L.izin },
                        { key: 'hari_alpa', label: L.alpa },
                        { key: 'hari_pulang', label: L.home },
                      ].map((item) => (
                        <tr key={item.key}>
                          {isAr ? (
                            <>
                              <td style={{ ...sectionValue, width: '50%', padding: absPadding }}>
                                {displayVal(extra[item.key], true) === '—' ? '—' : `${displayVal(extra[item.key], true)} يَوْم`}
                              </td>
                              <td style={{ ...sectionLabel, width: '50%', textAlign: 'right', padding: absPadding }}>{item.label}</td>
                            </>
                          ) : (
                            <>
                              <td style={{ ...sectionLabel, width: '50%', padding: absPadding }}>{item.label}</td>
                              <td style={{ ...sectionValue, width: '50%', padding: absPadding }}>
                                {displayVal(extra[item.key], true) === '—' ? '—' : `${displayVal(extra[item.key], true)} hari`}
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 0, marginBottom: isA4 ? 8 : 14, flexDirection: isAr ? 'row-reverse' : 'row', alignItems: 'stretch' }}>
              {flags.hasFisik && (
                <div style={{ width: '25%', flexShrink: 0, display: 'flex', flexDirection: 'column', paddingRight: 7 }}>
                  <div style={sectionTitleStyle}>{isAr ? RL.section_physical.ar : RL.section_physical.id}</div>
                  <table style={{ width: '100%', height: '100%', borderCollapse: 'collapse', flex: 1 }}>
                    <tbody>
                      <tr style={{ height: '50%' }}>
                        {isAr ? (
                          <>
                            <td style={{ ...sectionValue, width: '35%' }}>{extra.berat_badan ? `${extra.berat_badan} kg` : '—'}</td>
                            <td style={{ ...sectionLabel, textAlign: 'right' }}>{L.weight}</td>
                          </>
                        ) : (
                          <>
                            <td style={sectionLabel}>{L.weight}</td>
                            <td style={{ ...sectionValue, width: '35%' }}>{extra.berat_badan ? `${extra.berat_badan} kg` : '—'}</td>
                          </>
                        )}
                      </tr>
                      <tr style={{ height: '50%' }}>
                        {isAr ? (
                          <>
                            <td style={{ ...sectionValue, width: '35%' }}>{extra.tinggi_badan ? `${extra.tinggi_badan} cm` : '—'}</td>
                            <td style={{ ...sectionLabel, textAlign: 'right' }}>{L.height}</td>
                          </>
                        ) : (
                          <>
                            <td style={sectionLabel}>{L.height}</td>
                            <td style={{ ...sectionValue, width: '35%' }}>{extra.tinggi_badan ? `${extra.tinggi_badan} cm` : '—'}</td>
                          </>
                        )}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {flags.hasCatatan && (
                <div style={{ width: '50%', flexShrink: 0, alignSelf: 'stretch', border: '1px solid #ccc', borderRadius: 4, padding: isA4 ? '6px 10px' : '8px 12px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontWeight: 700, fontSize: isAr ? '12pt' : '9pt', color: '#555', marginBottom: 4, direction: isAr ? 'rtl' : 'ltr', fontFamily: isAr ? RAPORT_AR_FONT : 'inherit', textAlign: isAr ? 'right' : 'left' }}>
                    {isAr ? RL.catatan_label.ar : RL.catatan_label.id}
                  </div>
                  <div style={{ fontSize: isAr ? '12pt' : '9.5pt', direction: isAr ? 'rtl' : 'ltr', fontFamily: isAr ? RAPORT_AR_FONT : 'inherit', textAlign: isAr ? 'right' : 'left', lineHeight: isA4 ? 1.4 : 1.6, color: extra.catatan ? '#000' : '#999', fontStyle: extra.catatan ? 'normal' : 'italic', flex: 1 }}>
                    {displayText(extra.catatan)}
                  </div>
                </div>
              )}

              <div style={{ width: '25%', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 4 }}>
                <div style={{ width: '100%', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isAr ? '13pt' : '10.5pt', fontWeight: 700, fontFamily: isAr ? RAPORT_AR_FONT : 'inherit', textAlign: 'center' }}>
                  {isAr ? 'مربي الفصل' : 'Wali Kelas'}
                </div>
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ height: '80px' }} />
                  <div style={{ width: isAr ? '148px' : '128px', borderTop: '1px solid rgb(156, 163, 175)' }} />
                  <div style={{ width: '100%', fontWeight: 700, fontSize: isAr ? '14pt' : '11.5pt', fontFamily: isAr ? RAPORT_AR_FONT : 'inherit', marginTop: '8px', textAlign: 'center' }}>
                    {displayMusyrif || '......................'}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="raport-card-footer">
        <div className="raport-signature-row" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', direction: isAr ? 'rtl' : 'ltr', gap: 10 }}>
          {signatures.map((signature) => (
            <SignatureBlock
              key={signature.key}
              label={signature.label}
              topLabel={signature.topLabel}
              nama={signature.nama}
              mode={signature.mode}
              qrValue={signature.qrValue}
              isAr={isAr}
            />
          ))}
        </div>

        <div style={{ marginTop: isA4 ? '6mm' : '8mm', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '7.5pt', color: '#888', borderTop: '1px solid #eee', paddingTop: '6px', direction: isAr ? 'rtl' : 'ltr' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {signMode === 'qrcode' ? null : verifyUrl ? (
              <QRCodeSVG value={verifyUrl} size={42} level="M" bgColor="#ffffff" fgColor="#111827" style={{ display: 'block', padding: 2, border: '1px solid #eee', borderRadius: 4 }} />
            ) : (
              <div style={{ width: 42, height: 42 }} />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', textAlign: isAr ? 'right' : 'left', lineHeight: 1.2 }}>
              <span style={{ fontWeight: 700, color: '#555' }}>{isAr ? 'بوابة LaporanMu الأكاديمية' : 'LaporanMu Academic Portal'}</span>
              <span style={{ fontSize: '6.5pt', color: '#999', fontStyle: 'italic' }}>
                {signMode === 'qrcode'
                  ? isAr
                    ? 'امسح رمز QR على التوقيع للتحقق'
                    : 'Pindai QR pada kolom tanda tangan untuk verifikasi'
                  : isAr
                    ? 'امسح الرمز للتحقق من صحة التقرير'
                    : 'Pindai QR untuk verifikasi keaslian raport'}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', textAlign: isAr ? 'left' : 'right', lineHeight: 1.3 }}>
            <span style={{ fontWeight: 600, color: '#aaa' }}>
              {isAr ? `رقم التقرير: ${reportNo}` : `No. Rapor: ${reportNo}`}
            </span>
            <span>{isAr ? `تاريخ الطباعة: ${formatPrintDate('ar')}` : `Waktu Cetak: ${formatPrintDate('id')}`}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
