import { useEffect, useState } from 'react'
import { Alert, DatePicker, Form, Input, InputNumber, Segmented, Select } from 'antd'
import { AudioOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { AppModal } from '../../../shared/components/AppModal'
import { StudentSelect } from '../../../shared/components/StudentSelect'
import { useTeachersBrief, useTahfidzByStudent } from '../hooks'
import type { TahfidzKind, TahfidzQuality, TahfidzRecord, TahfidzFormValues } from '../types'

const QUALITY_META: Record<TahfidzQuality, { label: string; color: string }> = {
  excellent: { label: 'Sangat Baik', color: 'green' },
  good: { label: 'Baik', color: 'blue' },
  needs_work: { label: 'Perlu Perbaikan', color: 'orange' },
}

interface TahfidzFormShape {
  student_id: string
  kind: TahfidzKind
  surah: string
  from_ayat?: number
  to_ayat?: number
  quality?: TahfidzQuality
  teacher_id?: string
  note?: string
  recorded_at: Dayjs
}

interface TahfidzFormProps {
  open: boolean
  record: TahfidzRecord | null
  submitting: boolean
  onCancel: () => void
  onSubmit: (values: TahfidzFormValues) => void
}

export function TahfidzForm({ open, record, submitting, onCancel, onSubmit }: TahfidzFormProps) {
  const [form] = Form.useForm<TahfidzFormShape>()
  const teachersQuery = useTeachersBrief()
  const watchedStudentId = Form.useWatch('student_id', form)

  // Riwayat terakhir santri — konteks bagi mudarris sebelum mencatat
  const historyQuery = useTahfidzByStudent(open ? watchedStudentId : undefined)

  // Opsi awal agar nama santri terpilih tetap tampil saat edit
  const [initialStudentOptions, setInitialStudentOptions] = useState<
    { value: string; label: string }[]
  >([])
  useEffect(() => {
    if (open && record?.student) {
      setInitialStudentOptions([
        {
          value: record.student.id,
          label: `${record.student.name} (${record.student.registration_code})`,
        },
      ])
    }
    if (!open) setInitialStudentOptions([])
  }, [open, record])

  useEffect(() => {
    if (!open) return
    if (record) {
      form.setFieldsValue({
        student_id: record.student_id,
        kind: record.kind,
        surah: record.surah,
        from_ayat: record.from_ayat ?? undefined,
        to_ayat: record.to_ayat ?? undefined,
        quality: record.quality ?? undefined,
        teacher_id: record.teacher_id ?? undefined,
        note: record.note ?? undefined,
        recorded_at: dayjs(record.recorded_at),
      })
    } else {
      form.resetFields()
      form.setFieldsValue({ kind: 'ziyadah', recorded_at: dayjs() })
    }
  }, [open, record, form])

  const handleFinish = (values: TahfidzFormShape) => {
    onSubmit({
      student_id: values.student_id,
      kind: values.kind,
      surah: values.surah,
      from_ayat: values.from_ayat,
      to_ayat: values.to_ayat,
      quality: values.quality,
      teacher_id: values.teacher_id,
      note: values.note,
      recorded_at: values.recorded_at.format('YYYY-MM-DD'),
    })
  }

  const history = historyQuery.data ?? []

  return (
    <AppModal
      title={record ? 'Edit Setoran Hafalan' : 'Catat Setoran Hafalan'}
      subtitle="Setoran ziyadah (hafalan baru) atau murojaah (mengulang)"
      icon={<AudioOutlined />}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      width={560}
      destroyOnHidden
    >
      <Form<TahfidzFormShape>
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        disabled={submitting}
        initialValues={{ kind: 'ziyadah' }}
      >
        <Form.Item
          name="student_id"
          label="Santri"
          rules={[{ required: true, message: 'Santri wajib dipilih' }]}
        >
          <StudentSelect initialOptions={initialStudentOptions} />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
          <Form.Item name="kind" label="Jenis Setoran">
            <Segmented
              block
              options={[
                { label: 'Ziyadah', value: 'ziyadah' },
                { label: 'Murojaah', value: 'murojaah' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="recorded_at"
            label="Tanggal Setoran"
            rules={[{ required: true, message: 'Tanggal wajib diisi' }]}
          >
            <DatePicker format="DD MMM YYYY" style={{ width: '100%' }} />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0 12px' }}>
          <Form.Item
            name="surah"
            label="Surah"
            rules={[{ required: true, message: 'Nama surah wajib diisi' }]}
          >
            <Input placeholder="Contoh: Al-Baqarah" maxLength={80} />
          </Form.Item>
          <Form.Item name="from_ayat" label="Ayat Awal">
            <InputNumber style={{ width: '100%' }} min={1} max={286} precision={0} placeholder="1" />
          </Form.Item>
          <Form.Item
            name="to_ayat"
            label="Ayat Akhir"
            dependencies={['from_ayat']}
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value: number | undefined) {
                  const start = getFieldValue('from_ayat') as number | undefined
                  if (!value || !start || value >= start) return Promise.resolve()
                  return Promise.reject(new Error('Ayat akhir ≥ ayat awal'))
                },
              }),
            ]}
          >
            <InputNumber style={{ width: '100%' }} min={1} max={286} precision={0} placeholder="20" />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
          <Form.Item name="quality" label="Mutu Setoran">
            <Select
              allowClear
              placeholder="Pilih mutu"
              options={Object.entries(QUALITY_META).map(([value, meta]) => ({
                value: value as TahfidzQuality,
                label: meta.label,
              }))}
            />
          </Form.Item>
          <Form.Item name="teacher_id" label="Musyrif / Penguji">
            <Select
              showSearch
              optionFilterProp="label"
              allowClear
              placeholder="Pilih musyrif"
              loading={teachersQuery.isPending}
              options={(teachersQuery.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
            />
          </Form.Item>
        </div>

        <Form.Item name="note" label="Catatan">
          <Input.TextArea rows={2} placeholder="Catatan tajwid, kelancaran, dll. (opsional)" maxLength={500} />
        </Form.Item>

        {watchedStudentId && history.length > 0 && (
          <Alert
            type="info"
            showIcon
            message="Setoran terakhir santri ini"
            description={
              <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                {history.map((h) => (
                  <li key={h.id}>
                    {h.kind === 'ziyadah' ? 'Ziyadah' : 'Murojaah'} {h.surah}
                    {h.from_ayat ? ` : ${h.from_ayat}${h.to_ayat && h.to_ayat !== h.from_ayat ? `–${h.to_ayat}` : ''}` : ''}{' '}
                    — {dayjs(h.recorded_at).format('DD MMM YYYY')}
                  </li>
                ))}
              </ul>
            }
          />
        )}
      </Form>
    </AppModal>
  )
}
