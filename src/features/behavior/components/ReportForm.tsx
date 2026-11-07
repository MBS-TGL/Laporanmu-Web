import { useEffect, useState } from 'react'
import { Alert, DatePicker, Form, Input, Select, Spin } from 'antd'
import { ProfileOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { AppModal } from '../../../shared/components/AppModal'
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue'
import { usePointRulesBrief, useStudentsSearch } from '../hooks'
import type { ReportFormValues } from '../types'

interface ReportFormProps {
  open: boolean
  submitting: boolean
  onCancel: () => void
  onSubmit: (values: ReportFormValues) => void
}

interface ReportFormShape {
  student_id: string
  rule_id: string
  reported_at: Dayjs
  notes?: string
}

// Komponen terpisah agar state pencarian ter-reset otomatis
// saat modal ditutup (destroyOnHidden meng-unmount isinya)
function StudentSelect(props: { value?: string; onChange?: (v: string) => void }) {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const studentsQuery = useStudentsSearch(debouncedSearch)

  return (
    <Select
      showSearch
      placeholder="Cari nama atau kode registrasi"
      filterOption={false}
      onSearch={setSearch}
      loading={studentsQuery.isPending}
      notFoundContent={studentsQuery.isPending ? <Spin size="small" /> : 'Tidak ditemukan'}
      options={(studentsQuery.data ?? []).map((s) => ({
        value: s.id,
        label: `${s.name} (${s.registration_code})`,
      }))}
      {...props}
    />
  )
}

export function ReportForm({ open, submitting, onCancel, onSubmit }: ReportFormProps) {
  const [form] = Form.useForm<ReportFormShape>()
  const rulesQuery = usePointRulesBrief()
  const watchedRuleId = Form.useWatch('rule_id', form)

  const selectedRule = (rulesQuery.data ?? []).find((r) => r.id === watchedRuleId)

  useEffect(() => {
    if (!open) return
    form.resetFields()
    form.setFieldsValue({ reported_at: dayjs() })
  }, [open, form])

  const handleFinish = (values: ReportFormShape) => {
    onSubmit({
      student_id: values.student_id,
      rule_id: values.rule_id,
      notes: values.notes,
      reported_at: values.reported_at.toISOString(),
    })
  }

  return (
    <AppModal
      title="Catat Poin"
      subtitle="Catat pelanggaran atau prestasi santri beserta catatannya"
      icon={<ProfileOutlined />}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      width={520}
      destroyOnHidden
    >
      <Form<ReportFormShape> form={form} layout="vertical" onFinish={handleFinish} disabled={submitting}>
        <Form.Item
          name="student_id"
          label="Siswa"
          rules={[{ required: true, message: 'Siswa wajib dipilih' }]}
        >
          <StudentSelect />
        </Form.Item>

        <Form.Item
          name="rule_id"
          label="Aturan Poin"
          rules={[{ required: true, message: 'Aturan wajib dipilih' }]}
        >
          <Select
            showSearch
            placeholder="Pilih pelanggaran / prestasi"
            optionFilterProp="label"
            loading={rulesQuery.isPending}
            options={(rulesQuery.data ?? []).map((r) => ({
              value: r.id,
              label: `${r.name} (${r.points > 0 ? '+' : ''}${r.points})`,
            }))}
          />
        </Form.Item>

        {selectedRule && (
          <Alert
            style={{ marginBottom: 16 }}
            type={selectedRule.is_negative ? 'error' : 'success'}
            showIcon
            message={`Poin ${selectedRule.points > 0 ? '+' : ''}${selectedRule.points} — ${
              selectedRule.is_negative ? 'Pelanggaran' : 'Prestasi'
            }`}
            description={selectedRule.category ? `Kategori: ${selectedRule.category}` : undefined}
          />
        )}

        <Form.Item
          name="reported_at"
          label="Waktu Kejadian"
          rules={[{ required: true, message: 'Waktu wajib diisi' }]}
        >
          <DatePicker showTime={{ format: 'HH:mm' }} format="DD MMM YYYY HH:mm" style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item name="notes" label="Catatan">
          <Input.TextArea rows={3} placeholder="Detail kejadian (opsional)" maxLength={500} />
        </Form.Item>
      </Form>
    </AppModal>
  )
}
