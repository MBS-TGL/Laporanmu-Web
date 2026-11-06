import { useEffect } from 'react'
import { App, Button, Card, ColorPicker, Form, Input } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../shared/components/PageHeader'
import { useSaveSchoolSettings, useSchoolSettings } from '../raport/hooks'
import type { SchoolSettings } from '../raport/types'

interface SchoolSettingsFormValues {
  school_name: string
  school_address?: string
  headmaster_name?: string
  pengasuh_name?: string
  color_primary: string
  color_secondary: string
}

export function SchoolSettingsPage() {
  const { message } = App.useApp()
  const settingsQuery = useSchoolSettings()
  const saveMutation = useSaveSchoolSettings()
  const [form] = Form.useForm<SchoolSettingsFormValues>()

  useEffect(() => {
    if (!settingsQuery.data) return
    form.setFieldsValue({
      school_name: settingsQuery.data.school_name,
      school_address: settingsQuery.data.school_address ?? undefined,
      headmaster_name: settingsQuery.data.headmaster_name ?? undefined,
      pengasuh_name: settingsQuery.data.pengasuh_name ?? undefined,
      color_primary: settingsQuery.data.color_primary,
      color_secondary: settingsQuery.data.color_secondary,
    })
  }, [settingsQuery.data, form])

  const handleSave = async (values: SchoolSettingsFormValues) => {
    const { data } = await supabase.auth.getUser()
    const payload: SchoolSettings = {
      school_name: values.school_name,
      school_address: values.school_address || null,
      headmaster_name: values.headmaster_name || null,
      pengasuh_name: values.pengasuh_name || null,
      color_primary: values.color_primary,
      color_secondary: values.color_secondary,
    }
    saveMutation.mutate(
      { values: payload, updatedBy: data.user?.id ?? null },
      {
        onSuccess: () => message.success('Profil sekolah tersimpan'),
        onError: (err: Error) => message.error(err.message || 'Gagal menyimpan'),
      },
    )
  }

  return (
    <div>
      <PageHeader
        title="Profil Sekolah"
        subtitle="Identitas yang tampil di kop kartu raport saat dicetak"
      />

      <Card style={{ maxWidth: 640 }}>
        <Form<SchoolSettingsFormValues>
          form={form}
          layout="vertical"
          onFinish={(values) => void handleSave(values)}
          disabled={saveMutation.isPending}
        >
          <Form.Item
            name="school_name"
            label="Nama Sekolah / Pondok"
            rules={[{ required: true, message: 'Nama sekolah wajib diisi' }]}
          >
            <Input maxLength={120} placeholder="Contoh: Laporanmu Boarding School" />
          </Form.Item>

          <Form.Item name="school_address" label="Alamat">
            <Input.TextArea rows={2} maxLength={200} placeholder="Alamat lengkap sekolah" />
          </Form.Item>

          <Form.Item name="headmaster_name" label="Nama Kepala Sekolah">
            <Input maxLength={120} placeholder="Nama lengkap beserta gelar" />
          </Form.Item>

          <Form.Item name="pengasuh_name" label="Nama Pengasuh">
            <Input maxLength={120} placeholder="Nama lengkap beserta gelar" />
          </Form.Item>

          <Form.Item name="color_primary" label="Warna Utama Kop">
            <ColorPicker
              showText
              format="hex"
              onChange={(color) => form.setFieldValue('color_primary', color.toHexString())}
              styles={{ popup: { root: { zIndex: 2000 } } }}
            />
          </Form.Item>

          <Form.Item name="color_secondary" label="Warna Sekunder Kop">
            <ColorPicker
              showText
              format="hex"
              onChange={(color) => form.setFieldValue('color_secondary', color.toHexString())}
              styles={{ popup: { root: { zIndex: 2000 } } }}
            />
          </Form.Item>

          <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saveMutation.isPending}>
            Simpan
          </Button>
        </Form>
      </Card>
    </div>
  )
}
