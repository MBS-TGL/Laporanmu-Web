import { useMemo, useState } from 'react'
import { App, InputNumber, Table, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ThunderboltOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { useProfile } from '../../../shared/hooks/useProfile'
import { activateExamToken, createRemedialExam } from '../api'
import { generateExamToken } from '../examUtil'
import type { CbtAttempt, CbtExam } from '../types'

interface RemedialModalProps {
  open: boolean
  exam: CbtExam
  attempts: CbtAttempt[]
  onClose: () => void
  onCreated: (info: { display: string; expiresAt: string }) => void
}

const DEFAULT_KKM = 75

/**
 * Remedial 1-klik: santri dengan skor < KKM, salinan ujian + token baru.
 * Ujian remedial tidak menggandakan entri penilaian (assessment_id null)
 * agar skor asli tetap utuh.
 */
export function RemedialModal({ open, exam, attempts, onClose, onCreated }: RemedialModalProps) {
  const { message } = App.useApp()
  const { profile } = useProfile()
  const [kkm, setKkm] = useState(DEFAULT_KKM)

  const below = useMemo(
    () => attempts.filter((a) => a.status === 'submitted' && (a.score ?? 0) < kkm),
    [attempts, kkm],
  )

  const columns: ColumnsType<CbtAttempt> = [
    { title: 'Santri', render: (_, a) => a.student?.name ?? '-' },
    {
      title: 'Skor',
      width: 90,
      align: 'right',
      render: (_, a) => <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{a.score}</span>,
    },
  ]

  const handleOk = async () => {
    if (below.length === 0) {
      message.warning('Tidak ada santri di bawah KKM')
      return
    }
    try {
      const remedial = await createRemedialExam(exam, profile?.id ?? null)
      const tk = await generateExamToken()
      await activateExamToken({
        examId: remedial.id,
        assessment: null, // remedial tidak masuk pipeline nilai
        tokenHash: tk.hash,
        tokenPrefix: tk.prefix,
        tokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      message.success(`Ujian remedial diterbitkan untuk ${below.length} santri di bawah KKM`)
      onCreated({ display: tk.display, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleString('id-ID') })
    } catch (err) {
      message.error((err as Error).message)
    }
  }

  return (
    <AppModal
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      okText="Terbitkan Remedial"
      okButtonProps={{ icon: <ThunderboltOutlined /> }}
      title="Terbitkan Ujian Remedial"
      subtitle="Salinan ujian dengan token baru — nilai remedial tidak menggantikan nilai asli"
      icon={<ThunderboltOutlined />}
      width={560}
      destroyOnHidden
      maskClosable={false}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <Typography.Text style={{ fontSize: 13.5 }}>KKM:</Typography.Text>
        <InputNumber min={0} max={100} value={kkm} onChange={(v) => setKkm(v ?? DEFAULT_KKM)} style={{ width: 90 }} />
        <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
          Santri dengan skor di bawah KKM:
        </Typography.Text>
      </div>
      <Table<CbtAttempt>
        rowKey="id"
        size="small"
        columns={columns}
        dataSource={below}
        pagination={false}
        locale={{ emptyText: `Tidak ada santri dengan skor di bawah ${kkm}` }}
        style={{ marginBottom: 12 }}
      />
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        Ujian remedial dibuat sebagai salinan (soal sama), token baru berlaku 7 hari, dan tidak mengubah skor asli.
      </Typography.Text>
    </AppModal>
  )
}
