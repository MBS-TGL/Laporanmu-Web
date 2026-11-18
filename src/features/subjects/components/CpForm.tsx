import { useEffect } from 'react'
import { AutoComplete, Col, Form, Input, InputNumber, Row, Select } from 'antd'
import { AimOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { PHASE_OPTIONS, type CpFormValues } from '../types'
import type { CurriculumCp } from '../../documents/api'

interface CpFormProps {
  open: boolean
  cp: CurriculumCp | null
  submitting: boolean
  subjectOptions: { value: string }[]
  onCancel: () => void
  onSubmit: (values: CpFormValues) => void
}

/** Form tambah / edit Capaian Pembelajaran (CP). */
export function CpForm({
  open,
  cp,
  submitting,
  subjectOptions,
  onCancel,
  onSubmit,
}: CpFormProps) {
  const [form] = Form.useForm<CpFormValues>()

  useEffect(() => {
    if (!open) return
    if (cp) {
      form.setFieldsValue({
        subject: cp.subject,
        phase: cp.phase,
        description: cp.description,
        sort_order: cp.sort_order ?? 0,
      })
    } else {
      form.resetFields()
    }
  }, [open, cp, form])

  return (
    <AppModal
      title={cp ? 'Edit Capaian Pembelajaran' : 'Tambah Capaian Pembelajaran'}
      subtitle={
        cp
          ? 'Perbarui capaian pembelajaran mapel ini'
          : 'Capaian pembelajaran (CP) per mapel dan fase kurikulum'
      }
      icon={<AimOutlined />}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      width={560}
      destroyOnHidden
    >
      <Form<CpFormValues>
        form={form}
        layout="vertical"
        onFinish={onSubmit}
        disabled={submitting}
        initialValues={{ phase: 'D', sort_order: 0 }}
      >
        <Form.Item
          name="subject"
          label="Mata Pelajaran"
          rules={[{ required: true, message: 'Mata pelajaran wajib diisi' }]}
        >
          <AutoComplete
            options={subjectOptions}
            filterOption={(input, option) =>
              String(option?.value ?? '').toLowerCase().includes(input.toLowerCase())
            }
            placeholder="Pilih atau ketik nama mapel"
          />
        </Form.Item>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item
              name="phase"
              label="Fase Kurikulum"
              rules={[{ required: true, message: 'Fase wajib dipilih' }]}
            >
              <Select options={PHASE_OPTIONS} placeholder="Pilih fase" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="sort_order"
              label="Urutan"
              tooltip="Urutan tampil antar-CP di mapel yang sama (0 = teratas)"
            >
              <InputNumber style={{ width: '100%' }} min={0} max={999} precision={0} placeholder="0" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="description"
          label="Deskripsi Capaian"
          rules={[{ required: true, message: 'Deskripsi capaian wajib diisi' }]}
        >
          <Input.TextArea
            rows={4}
            placeholder="Tuliskan rumusan capaian pembelajaran (kompetensi dan lingkup materi)"
            maxLength={600}
            showCount
          />
        </Form.Item>
      </Form>
    </AppModal>
  )
}
