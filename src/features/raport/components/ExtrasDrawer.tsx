import { useEffect } from 'react'
import { Button, Col, Drawer, Form, Input, InputNumber, Row, Select, Space } from 'antd'
import { SectionDivider } from '../../../shared/components/SectionDivider'
import { CATATAN_TEMPLATES, HAFALAN_PRESETS } from '../constants'
import type { MonthlyDraft, RaportStudent, RaportType, SemesterDraft } from '../types'

interface ExtrasDrawerProps {
  open: boolean
  student: RaportStudent | null
  type: RaportType
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

  useEffect(() => {
    if (!open || !student) return
    form.resetFields()
    if (type === 'bulanan') {
      form.setFieldsValue(monthlyInitial ?? {})
    } else {
      form.setFieldsValue(semesterInitial ?? {})
    }
  }, [open, student, type, monthlyInitial, semesterInitial, form])

  const handleSave = () => {
    if (!student) return
    const values = form.getFieldsValue()
    if (type === 'bulanan') {
      onSaveMonthly(student.id, values as MonthlyDraft)
    } else {
      onSaveSemester(student.id, values as SemesterDraft)
    }
    onClose()
  }

  const isBulanan = type === 'bulanan'

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
            <Form.Item name="berat_badan" label="Berat Badan (kg)">
              <InputNumber style={{ width: '100%' }} min={0} max={300} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="tinggi_badan" label="Tinggi Badan (cm)">
              <InputNumber style={{ width: '100%' }} min={0} max={250} />
            </Form.Item>
          </Col>
        </Row>

        <Col span={24}><SectionDivider>
          Kehadiran (hari)
        </SectionDivider></Col>
        <Row gutter={12}>
          <Col span={6}>
            <Form.Item name="hari_sakit" label="Sakit">
              <InputNumber style={{ width: '100%' }} min={0} max={365} precision={0} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="hari_izin" label="Izin">
              <InputNumber style={{ width: '100%' }} min={0} max={365} precision={0} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="hari_alpa" label="Alpa">
              <InputNumber style={{ width: '100%' }} min={0} max={365} precision={0} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="hari_pulang" label="Pulang">
              <InputNumber style={{ width: '100%' }} min={0} max={365} precision={0} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="sholat" label="Sholat">
          <Input placeholder="Contoh: Berjamaah teratur" maxLength={120} />
        </Form.Item>

        {isBulanan && (
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
            isBulanan ? (
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
