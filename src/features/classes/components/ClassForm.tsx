import { useEffect } from 'react'
import { Form, Input, Select } from 'antd'
import { BankOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { classNameExists } from '../api'
import type { ClassFormValues, ClassRow } from '../types'
import { useAcademicYearsBrief, useTeachersBriefForClasses } from '../hooks'

interface ClassFormProps {
  open: boolean
  cls: ClassRow | null
  submitting: boolean
  onCancel: () => void
  onSubmit: (values: ClassFormValues) => void
}

const GRADE_OPTIONS = ['7', '8', '9', '10', '11', '12'].map((g) => ({ value: g, label: `Kelas ${g}` }))

export function ClassForm({ open, cls, submitting, onCancel, onSubmit }: ClassFormProps) {
  const [form] = Form.useForm<ClassFormValues>()
  const yearsQuery = useAcademicYearsBrief()
  const teachersQuery = useTeachersBriefForClasses()

  useEffect(() => {
    if (!open) return
    if (cls) {
      form.setFieldsValue({
        name: cls.name,
        grade: cls.grade ?? '',
        major: cls.major ?? undefined,
        academic_year_id: cls.academic_year_id ?? '',
        homeroom_teacher_id: cls.homeroom_teacher_id ?? undefined,
      })
    } else {
      form.resetFields()
      const activeYear = (yearsQuery.data ?? []).find((y) => y.is_active)
      const defaultYear = activeYear?.id ?? (yearsQuery.data ?? [])[0]?.id
      form.setFieldsValue({
        grade: '7',
        academic_year_id: defaultYear ?? '',
      })
    }
  }, [open, cls, form, yearsQuery.data])

  return (
    <AppModal
      title={cls ? 'Edit Kelas' : 'Tambah Kelas'}
      subtitle={cls ? 'Perbarui data kelas' : 'Struktur kelas dan wali kelas'}
      icon={<BankOutlined />}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      width={560}
      destroyOnHidden
    >
      <Form<ClassFormValues> form={form} layout="vertical" onFinish={onSubmit} disabled={submitting}>
        <Form.Item
          name="name"
          label="Nama Kelas"
          dependencies={['academic_year_id']}
          rules={[
            { required: true, message: 'Nama kelas wajib diisi' },
            {
              validator: async (_rule, value: string) => {
                if (!value?.trim()) return
                const yearId = form.getFieldValue('academic_year_id') as string | undefined
                if (!yearId) return
                const exists = await classNameExists(value.trim(), yearId, cls?.id)
                if (exists) throw new Error('Nama kelas sudah dipakai di tahun akademik ini')
              },
              validateTrigger: ['onChange', 'onBlur'],
            },
          ]}
        >
          <Input placeholder="Contoh: 7A" maxLength={40} />
        </Form.Item>

        <Form.Item
          name="grade"
          label="Tingkat"
          rules={[{ required: true, message: 'Tingkat wajib dipilih' }]}
        >
          <Select options={GRADE_OPTIONS} placeholder="Pilih tingkat" />
        </Form.Item>

        <Form.Item
          name="academic_year_id"
          label="Tahun Akademik"
          rules={[{ required: true, message: 'Tahun akademik wajib dipilih' }]}
        >
          <Select
            placeholder="Pilih tahun akademik"
            loading={yearsQuery.isPending}
            options={(yearsQuery.data ?? []).map((y) => ({
              value: y.id,
              label: y.is_active ? `${y.name} (Aktif)` : y.name,
            }))}
          />
        </Form.Item>

        <Form.Item name="homeroom_teacher_id" label="Wali Kelas">
          <Select
            placeholder="Pilih wali kelas (opsional)"
            allowClear
            loading={teachersQuery.isPending}
            showSearch
            optionFilterProp="label"
            options={(teachersQuery.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
          />
        </Form.Item>

        <Form.Item name="major" label="Jurusan / Program">
          <Input placeholder="Contoh: IPA, Tahfidz" maxLength={80} />
        </Form.Item>
      </Form>
    </AppModal>
  )
}
