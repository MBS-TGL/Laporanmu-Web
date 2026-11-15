import { useEffect, useMemo } from 'react'
import { AutoComplete, Col, Form, Input, InputNumber, Row, Select, Switch } from 'antd'
import { BookOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { subjectCodeExists } from '../api'
import type { Subject, SubjectFormValues } from '../types'

// Kategori bawaan — digabung dengan kategori yang sudah dipakai
const PRESET_CATEGORIES = ['Umum', 'Diniyah', 'Bahasa', 'Keagamaan', 'Muatan Lokal']

export const PHASE_OPTIONS = [
  { value: 'A', label: 'Fase A (Kelas 1-2)' },
  { value: 'B', label: 'Fase B (Kelas 3-4)' },
  { value: 'C', label: 'Fase C (Kelas 5-6)' },
  { value: 'D', label: 'Fase D (Kelas 7-9)' },
  { value: 'E', label: 'Fase E (Kelas 10)' },
  { value: 'F', label: 'Fase F (Kelas 11-12)' },
]

const CURRICULUM_GROUP_OPTIONS = [
  { value: 'A', label: 'Kelompok A (Wajib)' },
  { value: 'B', label: 'Kelompok B (Pilihan)' },
]

interface SubjectFormProps {
  open: boolean
  subject: Subject | null
  submitting: boolean
  usedCategories?: string[]
  onCancel: () => void
  onSubmit: (values: SubjectFormValues) => void
}

export function SubjectForm({ open, subject, submitting, usedCategories = [], onCancel, onSubmit }: SubjectFormProps) {
  const categoryOptions = useMemo(
    () => Array.from(new Set([...PRESET_CATEGORIES, ...usedCategories.filter(Boolean)])).map((c) => ({ value: c })),
    [usedCategories],
  )
  const [form] = Form.useForm<SubjectFormValues>()

  useEffect(() => {
    if (!open) return
    if (subject) {
      form.setFieldsValue({
        name: subject.name,
        code: subject.code ?? undefined,
        weekly_hours: subject.weekly_hours,
        category: subject.category ?? undefined,
        description: subject.description ?? undefined,
        is_active: subject.is_active,
        kkm: subject.kkm ?? 50,
        phase: subject.phase ?? undefined,
        curriculum_group: subject.curriculum_group ?? undefined,
        sort_order: subject.sort_order ?? 0,
      })
    } else {
      form.resetFields()
    }
  }, [open, subject, form])

  return (
    <AppModal
      title={subject ? 'Edit Mata Pelajaran' : 'Tambah Mata Pelajaran'}
      subtitle={subject ? 'Perbarui detail mata pelajaran' : 'Mapel yang diajarkan beserta jam per minggu'}
      icon={<BookOutlined />}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      width={560}
      destroyOnHidden
    >
      <Form<SubjectFormValues>
        form={form}
        layout="vertical"
        onFinish={onSubmit}
        disabled={submitting}
        initialValues={{ weekly_hours: 2, is_active: true, kkm: 50, sort_order: 0 }}
      >
        <Form.Item
          name="name"
          label="Nama Mapel"
          rules={[{ required: true, message: 'Nama mapel wajib diisi' }]}
        >
          <Input placeholder="Contoh: Matematika" maxLength={100} />
        </Form.Item>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item
              name="code"
              label="Kode Mapel"
              rules={[
                {
                  validator: async (_, value: string | undefined) => {
                    if (!value?.trim() || value.trim() === subject?.code) return
                    if (await subjectCodeExists(value.trim())) {
                      throw new Error('Kode mapel sudah dipakai')
                    }
                  },
                },
              ]}
            >
              <Input placeholder="Contoh: MAT" maxLength={20} style={{ textTransform: 'uppercase' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="category" label="Kategori">
              <AutoComplete
                options={categoryOptions}
                filterOption={(input, option) =>
                  String(option?.value ?? '').toLowerCase().includes(input.toLowerCase())
                }
                placeholder="Contoh: Umum"
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={8}>
            <Form.Item name="curriculum_group" label="Kelompok KurMer">
              <Select
                allowClear
                placeholder="A / B"
                options={CURRICULUM_GROUP_OPTIONS}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="phase" label="Fase">
              <Select
                allowClear
                placeholder="Fase"
                options={PHASE_OPTIONS}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="kkm"
              label="KKM"
              tooltip="Kriteria Ketuntasan Minimal (0-100)"
            >
              <InputNumber style={{ width: '100%' }} min={0} max={100} precision={0} placeholder="50" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item
              name="weekly_hours"
              label="JP per Minggu"
              rules={[{ required: true, message: 'JP wajib diisi' }]}
            >
              <InputNumber style={{ width: '100%' }} min={0} max={40} precision={0} placeholder="Contoh: 3" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="sort_order"
              label="Urutan Tampil"
              tooltip="Urutan tampil di rapor/leger (0 = paling atas)"
            >
              <InputNumber style={{ width: '100%' }} min={0} max={999} precision={0} placeholder="0" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="description" label="Keterangan">
          <Input.TextArea rows={2} placeholder="Keterangan singkat (opsional)" maxLength={300} />
        </Form.Item>

        <Form.Item name="is_active" label="Status" valuePropName="checked">
          <Switch checkedChildren="Aktif" unCheckedChildren="Nonaktif" />
        </Form.Item>
      </Form>
    </AppModal>
  )
}
