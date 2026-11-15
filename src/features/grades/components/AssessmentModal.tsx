import { useEffect } from 'react'
import { DatePicker, Form, Input, InputNumber, Select } from 'antd'
import { FileDoneOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { AppModal } from '../../../shared/components/AppModal'
import {
  ASSESSMENT_TYPES,
  ASSESSMENT_TYPE_LABEL,
  type Assessment,
  type AssessmentType,
} from '../types'
import { useCreateAssessment, useUpdateAssessment } from '../hooks'
import type { AssessmentFormValues } from '../api'

interface AssessmentModalProps {
  open: boolean
  classSubjectId: string
  defaultType: AssessmentType
  editing: Assessment | null
  onClose: () => void
}

interface FormFields {
  type: AssessmentType
  title: string
  assessment_date?: dayjs.Dayjs
  max_score: number
}

export function AssessmentModal({
  open,
  classSubjectId,
  defaultType,
  editing,
  onClose,
}: AssessmentModalProps) {
  const [form] = Form.useForm<FormFields>()
  const createMutation = useCreateAssessment()
  const updateMutation = useUpdateAssessment()

  useEffect(() => {
    if (open) {
      if (editing) {
        form.setFieldsValue({
          type: editing.type,
          title: editing.title,
          assessment_date: editing.assessment_date ? dayjs(editing.assessment_date) : undefined,
          max_score: editing.max_score,
        })
      } else {
        form.resetFields()
        form.setFieldsValue({
          type: defaultType,
          max_score: 100,
          title: '',
        })
      }
    }
  }, [open, editing, defaultType, form])

  const handleSave = async () => {
    try {
      const vals = await form.validateFields()
      const payload: AssessmentFormValues = {
        type: vals.type,
        title: vals.title.trim(),
        assessment_date: vals.assessment_date ? vals.assessment_date.format('YYYY-MM-DD') : undefined,
        max_score: vals.max_score ?? 100,
      }

      if (editing) {
        updateMutation.mutate(
          { id: editing.id, values: payload },
          { onSuccess: onClose },
        )
      } else {
        createMutation.mutate(
          { classSubjectId, values: payload },
          { onSuccess: onClose },
        )
      }
    } catch {
      // validation error
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <AppModal
      open={open}
      title={editing ? 'Edit Ulangan' : `Tambah ${ASSESSMENT_TYPE_LABEL[defaultType]}`}
      subtitle={editing ? 'Perbarui penilaian' : 'Buat penilaian baru untuk kelas ini'}
      icon={<FileDoneOutlined />}
      onCancel={onClose}
      onOk={handleSave}
      okText="Simpan"
      confirmLoading={isSaving}
      destroyOnHidden
      width={460}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        <Form.Item
          name="type"
          label="Jenis Penilaian"
          rules={[{ required: true, message: 'Wajib dipilih' }]}
        >
          <Select
            disabled={!!editing}
            options={ASSESSMENT_TYPES.map((t) => ({
              value: t,
              label: ASSESSMENT_TYPE_LABEL[t],
            }))}
          />
        </Form.Item>

        <Form.Item
          name="title"
          label="Judul / Keterangan"
          rules={[{ required: true, message: 'Wajib diisi (contoh: UH 1, Bab 3, dsb.)' }]}
        >
          <Input placeholder="Contoh: UH 1 - Aljabar" />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item name="assessment_date" label="Tanggal Pelaksanaan">
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder="Pilih tanggal" />
          </Form.Item>
          <Form.Item
            name="max_score"
            label="Skor Maksimal"
            rules={[{ required: true, message: 'Wajib diisi' }]}
          >
            <InputNumber min={1} max={1000} style={{ width: '100%' }} />
          </Form.Item>
        </div>
      </Form>
    </AppModal>
  )
}
