import { useEffect, useState } from 'react'
import { App, Form, InputNumber, Typography } from 'antd'
import { ControlOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { ModalNotice } from '../../../shared/components/ModalNotice'
import { DEFAULT_WEIGHT, type GradeWeight } from '../types'
import { useGradeConfig, useSaveGradeConfig } from '../hooks'

interface ConfigModalProps {
  open: boolean
  academicYearId: string | undefined
  academicYearName?: string
  onClose: () => void
}

export function ConfigModal({
  open,
  academicYearId,
  academicYearName,
  onClose,
}: ConfigModalProps) {
  const { message } = App.useApp()
  const [form] = Form.useForm<GradeWeight>()
  const configQuery = useGradeConfig(academicYearId)
  const saveMutation = useSaveGradeConfig(academicYearId)
  const [sum, setSum] = useState(100)

  useEffect(() => {
    if (open) {
      const b = configQuery.data?.bobot ?? DEFAULT_WEIGHT
      form.setFieldsValue(b)
      setSum((b.formatif ?? 0) + (b.sumatif ?? 0) + (b.pts ?? 0) + (b.pas ?? 0))
    }
  }, [open, configQuery.data, form])

  const handleValuesChange = () => {
    const vals = form.getFieldsValue()
    const total =
      (vals.formatif ?? 0) + (vals.sumatif ?? 0) + (vals.pts ?? 0) + (vals.pas ?? 0)
    setSum(total)
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      if (sum !== 100) {
        message.warning(`Total bobot saat ini ${sum}%, disarankan tepat 100%`)
      }
      saveMutation.mutate(values, {
        onSuccess: () => {
          message.success('Bobot nilai berhasil disimpan')
          onClose()
        },
        onError: (err: Error) => message.error(err.message || 'Gagal menyimpan bobot'),
      })
    } catch {
      // form validation failed
    }
  }

  return (
    <AppModal
      open={open}
      title={`Konfigurasi Bobot Nilai (${academicYearName ?? 'Tahun Ajaran'})`}
      subtitle="Bobot nilai akhir & generate rapor semester"
      icon={<ControlOutlined />}
      onCancel={onClose}
      onOk={handleSave}
      okText="Simpan"
      confirmLoading={saveMutation.isPending}
      width={460}
      destroyOnHidden
    >
      <div style={{ marginBottom: 16 }}>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          Bobot dipakai saat menghitung nilai akhir dan men-generate nilai ke rapor semester.
          Default: Formatif 30%, Sumatif 20%, PTS 20%, PAS 30%.
        </Typography.Text>
      </div>

      <Form form={form} layout="vertical" onValuesChange={handleValuesChange}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item
            name="formatif"
            label="Formatif (%)"
            rules={[{ required: true, message: 'Wajib diisi' }]}
          >
            <InputNumber min={0} max={100} style={{ width: '100%' }} addonAfter="%" />
          </Form.Item>
          <Form.Item
            name="sumatif"
            label="Sumatif (%)"
            rules={[{ required: true, message: 'Wajib diisi' }]}
          >
            <InputNumber min={0} max={100} style={{ width: '100%' }} addonAfter="%" />
          </Form.Item>
          <Form.Item
            name="pts"
            label="PTS (%)"
            rules={[{ required: true, message: 'Wajib diisi' }]}
          >
            <InputNumber min={0} max={100} style={{ width: '100%' }} addonAfter="%" />
          </Form.Item>
          <Form.Item
            name="pas"
            label="PAS (%)"
            rules={[{ required: true, message: 'Wajib diisi' }]}
          >
            <InputNumber min={0} max={100} style={{ width: '100%' }} addonAfter="%" />
          </Form.Item>
        </div>

        <ModalNotice
          tone={sum === 100 ? 'success' : 'warning'}
          title={
            <>
              Total: <b>{sum}%</b> {sum === 100 ? '✓ Tepat' : '· sebaiknya 100%'}
            </>
          }
        />
      </Form>
    </AppModal>
  )
}
