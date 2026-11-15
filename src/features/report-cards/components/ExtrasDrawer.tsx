import { useEffect } from 'react'
import { Button, Col, Drawer, Form, Input, InputNumber, Row, Select, Space } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { SectionDivider } from '../../../shared/components/SectionDivider'
import { useActivityByStudent } from '../../extracurricular/hooks'
import { CATATAN_TEMPLATES, HAFALAN_PRESETS } from '../constants'
import type { MonthlyDraft, ReportCardStudent, ReportCardType, SemesterDraft } from '../types'

interface ExtrasDrawerProps {
  open: boolean
  student: ReportCardStudent | null
  type: ReportCardType
  monthlyInitial?: MonthlyDraft | null
  semesterInitial?: SemesterDraft | null
  onClose: () => void
  onSaveMonthly: (studentId: string, draft: MonthlyDraft) => void
  onSaveSemester: (studentId: string, draft: SemesterDraft) => void
}

export function ExtrasDrawer({
  open,
  student,
  type,
  monthlyInitial,
  semesterInitial,
  onClose,
  onSaveMonthly,
  onSaveSemester,
}: ExtrasDrawerProps) {
  const [form] = Form.useForm()
  const isMonthly = type === 'monthly'
  // Keikutsertaan ekskul santri — hanya relevan untuk raport semester
  const ekskulQuery = useActivityByStudent(!isMonthly && open ? student?.id : undefined)

  useEffect(() => {
    if (!open || !student) return
    form.resetFields()
    if (type === 'monthly') {
      form.setFieldsValue(monthlyInitial ?? {})
    } else {
      form.setFieldsValue(semesterInitial ?? {})
    }
  }, [open, student, type, monthlyInitial, semesterInitial, form])

  // Auto-append keikutsertaan ekskul dari DB yang belum ada di draf (tidak menimpa catatan)
  useEffect(() => {
    if (isMonthly || !open || !ekskulQuery.data) return
    const current = ((form.getFieldValue('ekskul') ?? []) as { name?: string }[]).filter(
      (r) => r && r.name,
    )
    const known = new Set(current.map((r) => r.name!.toLowerCase()))
    const additions = ekskulQuery.data
      .filter((e) => e.activity && !known.has(e.activity.name.toLowerCase()))
      .map((e) => ({ name: e.activity!.name, note: '' }))
    if (additions.length > 0) {
      form.setFieldValue('ekskul', [...current, ...additions])
    }
  }, [ekskulQuery.data, open, isMonthly, form])

  const handleSave = () => {
    if (!student) return
    const values = form.getFieldsValue()
    if (type === 'monthly') {
      onSaveMonthly(student.id, values as MonthlyDraft)
    } else {
      // Baris ekskul tanpa nama dibuang agar jsonb raport tidak berisi sampah
      const draft = values as SemesterDraft
      draft.ekskul = (draft.ekskul ?? []).filter((r) => r && r.name?.trim())
      onSaveSemester(student.id, draft)
    }
    onClose()
  }

  return (
    <Drawer
      title={`Data Pendukung — ${student?.name ?? ''}`}
      open={open}
      onClose={onClose}
      size="min(520px, 94vw)"
      destroyOnHidden
      styles={{ body: { scrollbarWidth: 'none' } }}
      footer={
        <Space style={{ float: 'right' }}>
          <Button onClick={onClose}>Batal</Button>
          <Button type="primary" onClick={handleSave}>
            Simpan ke Draf
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical">
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="weight_kg" label="Berat Badan (kg)">
              <InputNumber style={{ width: '100%' }} min={0} max={300} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="height_cm" label="Tinggi Badan (cm)">
              <InputNumber style={{ width: '100%' }} min={0} max={250} />
            </Form.Item>
          </Col>
        </Row>

        <Col span={24}><SectionDivider>
          Kehadiran (hari)
        </SectionDivider></Col>
        <Row gutter={12}>
          <Col span={6}>
            <Form.Item name="sick_days" label="Sakit">
              <InputNumber style={{ width: '100%' }} min={0} max={365} precision={0} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="excused_days" label="Izin">
              <InputNumber style={{ width: '100%' }} min={0} max={365} precision={0} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="absent_days" label="Alpa">
              <InputNumber style={{ width: '100%' }} min={0} max={365} precision={0} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="early_leave_days" label="Pulang">
              <InputNumber style={{ width: '100%' }} min={0} max={365} precision={0} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="sholat" label="Sholat">
          <Input placeholder="Contoh: Berjamaah teratur" maxLength={120} />
        </Form.Item>

        {!isMonthly && (
          <>
            <Col span={24}><SectionDivider>
              Ekstrakurikuler
            </SectionDivider></Col>
            <Form.List name="ekskul">
              {(fields, { add, remove }) => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                  {fields.map((field) => (
                    <Row key={field.key} gutter={8} align="top">
                      <Col span={9}>
                        <Form.Item
                          name={[field.name, 'name']}
                          rules={[{ required: false }]}
                          style={{ marginBottom: 0 }}
                        >
                          <Input placeholder="Nama kegiatan" maxLength={60} />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          name={[field.name, 'note']}
                          style={{ marginBottom: 0 }}
                        >
                          <Input placeholder="Keterangan / capaian" maxLength={200} />
                        </Form.Item>
                      </Col>
                      <Col span={3}>
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => remove(field.name)}
                          aria-label="Hapus baris ekskul"
                        />
                      </Col>
                    </Row>
                  ))}
                  <Button
                    type="dashed"
                    icon={<PlusOutlined />}
                    onClick={() => add({ name: '', note: '' })}
                    style={{ alignSelf: 'flex-start' }}
                  >
                    Tambah Ekskul
                  </Button>
                </div>
              )}
            </Form.List>
          </>
        )}

        {isMonthly && (
          <>
            <Col span={24}><SectionDivider>
              Perkembangan Hafalan
            </SectionDivider></Col>
            <Row gutter={12}>
              <Col span={8}>
                <Form.Item name="ziyadah" label="Ziyadah">
                  <Select
                    placeholder="Pilih / ketik"
                    allowClear
                    showSearch
                    options={HAFALAN_PRESETS.map((h) => ({ value: h, label: h }))}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="murojaah" label="Muroja'ah">
                  <Select
                    placeholder="Pilih / ketik"
                    allowClear
                    showSearch
                    options={HAFALAN_PRESETS.map((h) => ({ value: h, label: h }))}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="total_hafalan" label="Total Hafalan">
                  <Select
                    placeholder="Pilih / ketik"
                    allowClear
                    showSearch
                    options={HAFALAN_PRESETS.map((h) => ({ value: h, label: h }))}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Col span={24}><SectionDivider>
              Catatan Khusus
            </SectionDivider></Col>
            <Form.Item name="pelanggaran" label="Pelanggaran">
              <Input.TextArea rows={2} placeholder="Ringkasan pelanggaran bulan ini" maxLength={300} />
            </Form.Item>
            <Form.Item name="prestasi" label="Prestasi">
              <Input.TextArea rows={2} placeholder="Prestasi / capaian bulan ini" maxLength={300} />
            </Form.Item>
          </>
        )}

        <Form.Item
          name="catatan"
          label="Catatan Utama Musyrif"
          extra={
            isMonthly ? (
              <Space wrap size={4} style={{ marginTop: 6 }}>
                {CATATAN_TEMPLATES.map((t) => (
                  <Button
                    key={t}
                    size="small"
                    type="dashed"
                    onClick={() => form.setFieldValue('catatan', t)}
                  >
                    {t.length > 34 ? `${t.slice(0, 34)}…` : t}
                  </Button>
                ))}
              </Space>
            ) : undefined
          }
        >
          <Input.TextArea rows={3} maxLength={500} placeholder="Catatan musyrif untuk wali santri" />
        </Form.Item>
      </Form>
    </Drawer>
  )
}
