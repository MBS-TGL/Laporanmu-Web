import { useEffect, useState } from 'react'
import { Col, DatePicker, Form, Input, InputNumber, Row, Segmented, Select, TimePicker } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { AppModal } from '../../../shared/components/AppModal'
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue'
import { searchStudents } from '../../students/api'
import { useQuery } from '@tanstack/react-query'
import type { HealthLogFormValues, HealthStatus, HealthMedicine } from '../types'

interface HealthLogFormProps {
  open: boolean
  medicines: HealthMedicine[]
  submitting: boolean
  onCancel: () => void
  onSubmit: (values: HealthLogFormValues) => void
}

interface HealthLogFormShape {
  student_id: string
  date: Dayjs
  time: Dayjs
  complaint: string
  diagnosis?: string
  treatment: string
  useMedicine: boolean
  medicine_id?: string
  medicine_qty?: number
  status: HealthStatus
}

export function HealthLogForm({ open, medicines, submitting, onCancel, onSubmit }: HealthLogFormProps) {
  const [form] = Form.useForm<HealthLogFormShape>()
  const [studentSearch, setStudentSearch] = useState('')
  const debouncedSearch = useDebouncedValue(studentSearch)

  const studentsQuery = useQuery({
    queryKey: ['students', 'search', debouncedSearch],
    queryFn: () => searchStudents(debouncedSearch),
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!open) return
    form.resetFields()
    form.setFieldsValue({
      date: dayjs(),
      time: dayjs(),
      status: 'Kembali',
      useMedicine: false,
      medicine_qty: 1,
    })
  }, [open, form])

  const handleFinish = (values: HealthLogFormShape) => {
    onSubmit({
      student_id: values.student_id,
      date: values.date.format('YYYY-MM-DD'),
      time: values.time.format('HH:mm'),
      complaint: values.complaint,
      diagnosis: values.diagnosis,
      treatment: values.treatment,
      medicine_id: values.useMedicine ? values.medicine_id : undefined,
      medicine_qty: values.useMedicine ? values.medicine_qty : undefined,
      status: values.status,
    })
  }

  const useMedicine = Form.useWatch('useMedicine', form)
  const medicineId = Form.useWatch('medicine_id', form)
  const selectedMedicine = medicines.find((m) => m.id === medicineId) ?? null

  return (
    <AppModal
      title="Tambah Catatan Kunjungan"
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      width={580}
      destroyOnHidden
    >
      <Form<HealthLogFormShape> form={form} layout="vertical" onFinish={handleFinish} disabled={submitting}>
        <Form.Item
          name="student_id"
          label="Santri / Pasien"
          rules={[{ required: true, message: 'Santri wajib dipilih' }]}
        >
          <Select
            showSearch
            placeholder="Cari nama atau kode registrasi"
            filterOption={false}
            onSearch={setStudentSearch}
            loading={studentsQuery.isPending}
            notFoundContent={studentsQuery.isPending ? 'Mencari…' : 'Tidak ditemukan'}
            options={(studentsQuery.data ?? []).map((s) => ({
              value: s.id,
              label: `${s.name} (${s.registration_code})`,
            }))}
          />
        </Form.Item>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="date" label="Tanggal Masuk" rules={[{ required: true, message: 'Tanggal wajib diisi' }]}>
              <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="time" label="Waktu / Jam" rules={[{ required: true, message: 'Jam wajib diisi' }]}>
              <TimePicker style={{ width: '100%' }} format="HH:mm" minuteStep={5} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="complaint"
          label="Keluhan Santri"
          rules={[{ required: true, message: 'Keluhan wajib diisi' }]}
        >
          <Input.TextArea rows={2} maxLength={300} placeholder="Contoh: Panas dingin, mual, sakit tenggorokan…" />
        </Form.Item>

        <Form.Item name="diagnosis" label="Diagnosis Awal">
          <Input maxLength={150} placeholder="Contoh: ISK ringan, demam berdarah dicurigai" />
        </Form.Item>

        <Form.Item
          name="treatment"
          label="Tindakan / Penanganan"
          rules={[{ required: true, message: 'Tindakan wajib diisi' }]}
        >
          <Input maxLength={200} placeholder="Contoh: Kompres air hangat, istirahat, minum oralit" />
        </Form.Item>

        <Form.Item name="useMedicine" label="Obat Diberikan" valuePropName="checked">
          <Segmented
            options={[
              { label: 'Tanpa obat', value: false },
              { label: 'Dengan obat', value: true },
            ]}
          />
        </Form.Item>

        {useMedicine && (
          <Row gutter={12}>
            <Col span={16}>
              <Form.Item
                name="medicine_id"
                label="Pilih Obat"
                rules={[{ required: true, message: 'Obat wajib dipilih' }]}
              >
                <Select
                  placeholder="Pilih dari stok"
                  showSearch
                  optionFilterProp="label"
                  options={medicines.map((m) => ({
                    value: m.id,
                    label: `${m.name} (Tersedia: ${m.stock} ${m.unit})`,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="medicine_qty" label="Jumlah">
                <InputNumber
                  style={{ width: '100%' }}
                  min={1}
                  max={selectedMedicine?.stock ?? 999}
                  precision={0}
                />
              </Form.Item>
            </Col>
            {selectedMedicine && selectedMedicine.stock <= selectedMedicine.min_stock && (
              <Col span={24}>
                <Input
                  readOnly
                  value={`⚠ Stok ${selectedMedicine.name} menipis (${selectedMedicine.stock}/${selectedMedicine.min_stock})`}
                  style={{ color: '#dc2626', borderColor: '#fca5a5', marginBottom: 12 }}
                />
              </Col>
            )}
          </Row>
        )}

        <Form.Item
          name="status"
          label="Rekomendasi Observasi"
          rules={[{ required: true, message: 'Status wajib dipilih' }]}
        >
          <Segmented
            options={[
              { label: 'Rawat di UKS', value: 'UKS' },
              { label: 'Rest di Asrama', value: 'Asrama' },
              { label: 'Kembali KBM', value: 'Kembali' },
            ]}
          />
        </Form.Item>
      </Form>
    </AppModal>
  )
}
