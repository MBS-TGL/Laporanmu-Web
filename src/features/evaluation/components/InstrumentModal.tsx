import { useEffect } from 'react'
import { Form, Input, Select } from 'antd'
import { FundProjectionScreenOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { useClasses } from '../../classes/hooks'
import { useAcademicYearsBrief } from '../../classes/hooks'
import { useMemo } from 'react'
import { TEMPLATES } from '../templates'
import type { InstrumentKind } from '../types'

interface InstrumentModalProps {
  open: boolean
  onClose: () => void
  onSave: (values: { kind: string; title: string; description: string | null; target_class_id: string; questions: unknown[] }) => Promise<void>
}

/**
 * Buat angket: pilih jenis → template bawaan terisi otomatis (AKPD,
 * Sosiometri, MBTI, EDOM) → pertanyaan tetap bisa disunting lewat
 * "Sunting Pertanyaan" setelah dibuat.
 */
export function InstrumentModal({ open, onClose, onSave }: InstrumentModalProps) {
  const [form] = Form.useForm()
  const yearsQuery = useAcademicYearsBrief()
  const activeYear = yearsQuery.data?.find((y) => y.is_active) ?? yearsQuery.data?.[0]
  const classesQuery = useClasses({ page: 1, pageSize: 200, academicYearId: activeYear?.id })

  const kind = (Form.useWatch('kind', form) ?? 'akpd') as InstrumentKind
  const template = TEMPLATES[kind as keyof typeof TEMPLATES]

  const classOptions = useMemo(
    () => (classesQuery.data?.data ?? []).map((c) => ({ value: c.id, label: c.name })),
    [classesQuery.data],
  )

  useEffect(() => {
    if (!open) return
    form.setFieldsValue({ kind: 'akpd', title: TEMPLATES.akpd.title, description: TEMPLATES.akpd.description })
  }, [open, form])

  const handleKindChange = (v: string) => {
    const t = TEMPLATES[v as keyof typeof TEMPLATES]
    if (t) {
      form.setFieldsValue({ title: t.title, description: t.description })
    }
  }

  const handleOk = async () => {
    const values = await form.validateFields()
    const questions = template ? template.questions.map((q, i) => ({ ...q, id: `${values.kind}-${i + 1}` })) : []
    await onSave({ ...values, questions })
  }

  return (
    <AppModal
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      okText="Buat Angket"
      title="Buat Angket Evaluasi"
      subtitle="Template bawaan terisi otomatis — pertanyaan bisa disunting setelahnya"
      icon={<FundProjectionScreenOutlined />}
      width={560}
      destroyOnHidden
      maskClosable={false}
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item name="kind" label="Jenis angket" rules={[{ required: true }]}>
          <Select
            onChange={handleKindChange}
            options={Object.entries(TEMPLATES).map(([k, t]) => ({ value: k, label: t.title }))}
          />
        </Form.Item>
        <Form.Item name="title" label="Judul" rules={[{ required: true, message: 'Judul wajib diisi' }]}>
          <Input maxLength={150} showCount />
        </Form.Item>
        <Form.Item name="target_class_id" label="Kelas target" rules={[{ required: true, message: 'Pilih kelas target' }]}>
          <Select
            showSearch
            placeholder="Pilih kelas"
            loading={classesQuery.isPending}
            options={classOptions}
            filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
          />
        </Form.Item>
        <Form.Item name="description" label="Deskripsi (opsional)">
          <Input.TextArea rows={2} maxLength={300} />
        </Form.Item>
        {template && (
          <div style={{ fontSize: 12.5, color: 'rgba(0,0,0,0.45)' }}>
            Template "{template.title}" berisi {template.questions.length} pertanyaan.
          </div>
        )}
      </Form>
    </AppModal>
  )
}
