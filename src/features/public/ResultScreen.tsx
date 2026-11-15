import dayjs from 'dayjs'
import { Button, Grid, Progress, Typography, theme } from 'antd'
import { motion } from 'motion/react'
import { CheckCircleFilled, FileProtectOutlined, SendOutlined } from '@ant-design/icons'
import {
  EASE,
  pageShellItemTransition,
  pageShellItemVariants,
  pageShellVariants,
} from '../../shared/motion'
import { useCountUp } from './hooks'

interface CbtResult {
  score: number | null
  correct: number | null
  total: number | null
  submittedAt: string | null
}

interface ResultScreenProps {
  studentName: string
  examTitle?: string
  /** Label tipe ujian, mis. "Sumatif". */
  typeLabel?: string
  result: CbtResult | null
  onDone: () => void
}

/** Statistik kecil hasil ujian (varian ringan dari StatTile di ExamPage). */
function CbtResultStat({ value, label, color }: { value: number; label: string; color: string }) {
  const { token } = theme.useToken()
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '12px 4px',
        borderRadius: 12,
        background: token.colorFillQuaternary,
        border: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.1, color, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      <div style={{ fontSize: 11.5, color: token.colorTextSecondary, marginTop: 2 }}>{label}</div>
    </div>
  )
}

/**
 * Layar hasil ujian (fase "Jawaban Terkumpul"), dua panel ala PortalCard:
 * kiri ringkasan ujian + waktu pengumpulan, kanan ring nilai dengan count-up
 * dan rincian benar/belum tepat. Semua angka dari server — tanpa data nyata
 * tidak ditampilkan (skor kosong → status "menyusul di rapor").
 */
export function ResultScreen({ studentName, examTitle, typeLabel, result, onDone }: ResultScreenProps) {
  const { token } = theme.useToken()
  const screens = Grid.useBreakpoint()
  const isDesktop = Boolean(screens.md)
  const score = typeof result?.score === 'number' ? result.score : null
  const shownScore = useCountUp(score ?? 0, score !== null, 900)
  const correct = typeof result?.correct === 'number' ? result.correct : null
  const total = typeof result?.total === 'number' ? result.total : null

  return (
    <motion.div variants={pageShellVariants} initial="initial" animate="animate">
      <div
        style={{
          maxWidth: 660,
          margin: '0 auto',
          display: 'flex',
          flexDirection: isDesktop ? 'row' : 'column',
          borderRadius: 20,
          border: '1px solid #e8edf3',
          boxShadow: '0 18px 50px rgba(15, 23, 42, 0.10)',
          overflow: 'hidden',
          background: token.colorBgContainer,
          textAlign: 'left',
        }}
      >
        {/* Panel kiri: identitas & kronologi ujian */}
        <motion.div
          variants={pageShellItemVariants}
          transition={pageShellItemTransition}
          style={{
            width: isDesktop ? 240 : undefined,
            flexShrink: 0,
            background: '#eef2ff',
            padding: isDesktop ? '26px 22px' : '20px 22px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <span
            style={{
              alignSelf: 'flex-start',
              padding: '4px 12px',
              borderRadius: 999,
              background: token.colorBgContainer,
              color: token.colorPrimary,
              fontSize: 11.5,
              fontWeight: 600,
              letterSpacing: '0.06em',
            }}
          >
            UJIAN CBT
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 40,
                height: 40,
                borderRadius: 12,
                background: token.colorBgContainer,
                color: token.colorPrimary,
                fontSize: 18,
                flexShrink: 0,
              }}
            >
              <FileProtectOutlined />
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3, color: token.colorText }}>
                {examTitle ?? 'Ujian Pilihan Ganda'}
              </div>
              {typeLabel && (
                <div style={{ fontSize: 12, color: token.colorTextSecondary }}>{typeLabel}</div>
              )}
            </div>
          </div>

          <div style={{ marginTop: 'auto', display: 'grid', gap: 7, fontSize: 12.5, color: token.colorTextSecondary }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <CheckCircleFilled style={{ fontSize: 11, color: token.colorPrimary }} />
              Nilai resmi mengikuti rapor semester
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <CheckCircleFilled style={{ fontSize: 11, color: token.colorPrimary }} />
              Pengawas dapat memeriksa rekam jawabanmu
            </span>
          </div>
          {result?.submittedAt && (
            <div
              style={{
                marginTop: 10,
                paddingTop: 10,
                borderTop: `1px solid ${token.colorBorderSecondary}`,
                fontSize: 12,
                color: token.colorTextSecondary,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              Dikumpulkan {dayjs(result.submittedAt).format('DD MMM YYYY · HH.mm')}
            </div>
          )}
        </motion.div>

        {/* Panel kanan: hasil */}
        <motion.div
          variants={pageShellItemVariants}
          transition={pageShellItemTransition}
          style={{
            flex: 1,
            minWidth: 0,
            padding: isDesktop ? '28px 28px 26px' : '24px 20px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <motion.span
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2, ease: EASE, delay: 0.05 }}
            style={{ display: 'inline-flex' }}
          >
            <CheckCircleFilled style={{ fontSize: 44, color: token.colorSuccess }} />
          </motion.span>
          <Typography.Title level={4} style={{ marginTop: 10, marginBottom: 4 }}>
            Jawaban Terkumpul
          </Typography.Title>
          <Typography.Text type="secondary">{studentName}</Typography.Text>

          <div style={{ marginTop: 18 }}>
            {score !== null ? (
              <Progress
                type="circle"
                percent={score}
                size={isDesktop ? 150 : 132}
                strokeColor={token.colorPrimary}
                trailColor={token.colorFillSecondary}
                strokeWidth={8}
                format={() => (
                  <div style={{ lineHeight: 1.05 }}>
                    <div
                      style={{
                        fontSize: 42,
                        fontWeight: 800,
                        letterSpacing: '-0.03em',
                        color: token.colorPrimary,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {shownScore}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: '0.1em',
                        color: token.colorTextSecondary,
                        marginTop: 4,
                      }}
                    >
                      NILAI
                    </div>
                  </div>
                )}
              />
            ) : (
              <Typography.Text type="secondary">Nilai menyusul di rapor semester</Typography.Text>
            )}
          </div>

          {correct !== null && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: total !== null ? '1fr 1fr' : '1fr',
                gap: 10,
                width: '100%',
                maxWidth: 300,
                margin: '18px auto 0',
              }}
            >
              <CbtResultStat value={correct} label="Jawaban Benar" color={token.colorSuccess} />
              {total !== null && (
                <CbtResultStat value={total - correct} label="Belum Tepat" color={token.colorTextSecondary} />
              )}
            </div>
          )}

          <Button
            type="primary"
            size="large"
            icon={<SendOutlined />}
            style={{ marginTop: 20 }}
            onClick={onDone}
          >
            Selesai
          </Button>
        </motion.div>
      </div>
    </motion.div>
  )
}
