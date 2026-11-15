import { useMemo, useState } from 'react'
import {
  Alert,
  App,
  Col,
  DatePicker,
  Form,
  Input,
  Row,
  Segmented,
  Select,
  Statistic,
  Typography,
  theme,
} from 'antd'
import { TeamOutlined } from '@ant-design/icons'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { AppModal } from '../../../shared/components/AppModal'
import { StudentMultiSelect } from '../../../shared/components/StudentSelect'
import { supabase } from '../../../lib/supabase'
import { useClassesBrief } from '../../students/hooks'
import { useAllPermitStudents, useCreatePermitsBulk } from '../hooks'
import type { LeavePermit, PermitBulkRow } from '../types'

const PURPOSE_PRESETS = [
  'Pulang ke rumah',
  'Belanja kebutuhan',
  'Kontrol kesehatan',
  'Keperluan keluarga',
  'Mengurus administrasi',
  'Lainnya',
]

interface Props {
  open: boolean
  onClose: () => void
  /** Izin ter-load dari halaman — deteksi santri yang sudah punya izin aktif */
  existingPermits: LeavePermit[]
}

/**
 * Terbitkan izin massal (pulang massal): satu kelas / banyak santri sekaligus,
 * satu jadwal untuk semua — satu batch insert.
 */
export function IssueModal({ open, onClose, existingPermits }: Props) {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const [form] = Form.useForm()
  const [mode, setMode] = useState<'kelas' | 'santri'>('kelas')
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([])
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])

  const classesQuery = useClassesBrief()
  const studentsQuery = useAllPermitStudents(open)
  const bulkMutation = useCreatePermitsBulk()

  const allStudents = useMemo(() => studentsQuery.data ?? [], [studentsQuery.data])
  const classOptions = (classesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name }))

  const leaveDateWatch = Form.useWatch('leave_date', form)

  const targetStudents = useMemo(() => {
    if (mode === 'kelas') {
      if (selectedClassIds.length === 0) return []
      const ids = new Set(selectedClassIds)
      return allStudents.filter((s) => s.classes?.id && ids.has(s.classes.id))
    }
    const ids = new Set(selectedStudentIds)
    return allStudents.filter((s) => ids.has(s.id))
  }, [mode, selectedClassIds, selectedStudentIds, allStudents])

  const activeKeys = useMemo(
    () =>
      new Set(
        existingPermits
          .filter((p) => p.status === 'issued' || p.status === 'departed')
          .map((p) => `${p.student_id}|${p.leave_date}`),
      ),
    [existingPermits],
  )

  const leaveDateStr = (leaveDateWatch as Dayjs | undefined)?.format('YYYY-MM-DD') ?? dayjs().format('YYYY-MM-DD')

  const duplicateCount = useMemo(
    () => targetStudents.filter((s) => activeKeys.has(`${s.id}|${leaveDateStr}`)).length,
    [targetStudents, activeKeys, leaveDateStr],
  )
  const toIssueCount = targetStudents.length - duplicateCount

  const handleClose = () => {
    if (bulkMutation.isPending) return
    form.resetFields()
    setSelectedClassIds([])
    setSelectedStudentIds([])
    onClose()
  }

  const handleSubmit = async (values: {
    destination: string
    purpose: string
    leave_date: Dayjs
    return_date: Dayjs
    return_time: Dayjs
  }) => {
    if (toIssueCount === 0) {
      message.warning('Tidak ada santri baru untuk diterbitkan izinnya')
      return
    }
    const leaveDate = values.leave_date.format('YYYY-MM-DD')
    const returnDeadline = new Date(
      `${values.return_date.format('YYYY-MM-DD')}T${values.return_time.format('HH:mm')}:00`,
    ).toISOString()

    const rows: PermitBulkRow[] = targetStudents
      .filter((s) => !activeKeys.has(`${s.id}|${leaveDate}`))
      .map((s) => ({
        student_id: s.id,
        phone: s.phone ?? null,
        destination: values.destination,
        purpose: values.purpose,
        leave_date: leaveDate,
        return_deadline: returnDeadline,
      }))

    try {
      const { data: userData } = await supabase.auth.getUser()
      const created = await bulkMutation.mutateAsync({ rows, issuedBy: userData.user?.id ?? null })
      message.success(`${created.length} izin diterbitkan massal`)
      handleClose()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Gagal menerbitkan izin massal')
    }
  }

  return (
    <AppModal
      title="Pulang Massal"
      subtitle="Terbitkan izin untuk satu kelas atau banyak santri sekaligus"
      icon={<TeamOutlined />}
      open={open}
      onCancel={handleClose}
      onOk={() => form.submit()}
      okText={`Terbitkan ${toIssueCount} Izin`}
      okButtonProps={{ disabled: toIssueCount === 0 }}
      confirmLoading={bulkMutation.isPending}
      width={600}
      destroyOnHidden
    >
      <Segmented
        value={mode}
        onChange={(v) => setMode(v as 'kelas' | 'santri')}
        options={[
          { label: 'Per Kelas', value: 'kelas' },
          { label: 'Pilih Santri', value: 'santri' },
        ]}
        style={{ marginBottom: 16 }}
      />

      {mode === 'kelas' ? (
        <Form.Item label="Kelas" required style={{ marginBottom: 12 }}>
          <Select
            mode="multiple"
            placeholder="Pilih satu atau banyak kelas"
            value={selectedClassIds}
            onChange={setSelectedClassIds}
            options={classOptions}
            loading={classesQuery.isLoading}
            optionFilterProp="label"
          />
        </Form.Item>
      ) : (
        <Form.Item label="Santri" required style={{ marginBottom: 12 }}>
          <StudentMultiSelect
            placeholder="Pilih santri (bisa banyak)"
            value={selectedStudentIds}
            onChange={setSelectedStudentIds}
          />
        </Form.Item>
      )}

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        disabled={bulkMutation.isPending}
        initialValues={{
          destination: 'Rumah',
          purpose: 'Pulang ke rumah',
          leave_date: dayjs(),
          return_date: dayjs(),
          return_time: dayjs().add(6, 'hour'),
        }}
      >
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item
              name="destination"
              label="Tujuan (semua)"
              rules={[{ required: true, message: 'Tujuan wajib diisi' }]}
            >
              <Input maxLength={120} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="purpose"
              label="Keperluan (semua)"
              rules={[{ required: true, message: 'Keperluan wajib diisi' }]}
            >
              <Select
                options={PURPOSE_PRESETS.map((p) => ({ value: p, label: p }))}
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={12}>
          <Col span={8}>
            <Form.Item name="leave_date" label="Tanggal Keluar" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="return_date"
              label="Tanggal Kembali"
              dependencies={['leave_date']}
              rules={[
                { required: true },
                ({ getFieldValue }) => ({
                  validator(_, value: Dayjs) {
                    const leave = getFieldValue('leave_date') as Dayjs | undefined
                    if (!value || !leave || !value.isBefore(leave, 'day')) return Promise.resolve()
                    return Promise.reject(new Error('Tidak boleh sebelum tanggal keluar'))
                  },
                }),
              ]}
            >
              <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="return_time" label="Jam Kembali" rules={[{ required: true }]}>
              <DatePicker.TimePicker style={{ width: '100%' }} format="HH:mm" minuteStep={5} />
            </Form.Item>
          </Col>
        </Row>
      </Form>

      <div
        style={{
          display: 'flex',
          gap: 18,
          padding: '12px 16px',
          borderRadius: 10,
          background: token.colorFillAlter,
          border: `1px solid ${token.colorBorderSecondary}`,
          marginTop: 4,
        }}
      >
        <Statistic title="Santri Terpilih" value={targetStudents.length} valueStyle={{ fontSize: 22 }} />
        <Statistic
          title="Akan Diterbitkan"
          value={toIssueCount}
          valueStyle={{ fontSize: 22, color: token.colorSuccess }}
        />
        <Statistic
          title="Dilewati (sudah ada izin)"
          value={duplicateCount}
          valueStyle={{ fontSize: 22, color: duplicateCount > 0 ? token.colorWarning : undefined }}
        />
      </div>

      {duplicateCount > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginTop: 12 }}
          message={`${duplicateCount} santri sudah memiliki izin aktif pada tanggal ${leaveDateStr} — otomatis dilewati.`}
        />
      )}

      {targetStudents.length > 0 && (
        <Typography.Paragraph type="secondary" style={{ fontSize: 12.5, marginTop: 10, marginBottom: 0 }}>
          Contoh: {targetStudents.slice(0, 5).map((s) => s.name).join(', ')}
          {targetStudents.length > 5 ? ` +${targetStudents.length - 5} lainnya` : ''} — semua mendapat jadwal
          yang sama, nomor WA wali ikut tersimpan bila tersedia.
        </Typography.Paragraph>
      )}
    </AppModal>
  )
}
