import { useEffect, useState } from 'react'
import { App, Button, Card, ColorPicker, Form, Input, Typography } from 'antd'
import { KeyOutlined, SaveOutlined } from '@ant-design/icons'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../shared/components/PageHeader'
import { useSaveSchoolSettings, useSchoolSettings } from '../report-cards/hooks'
import { setStaffPin } from '../savings/api'
import type { SchoolSettings } from '../report-cards/types'

interface SchoolSettingsFormValues {
  school_name: string
  school_address?: string
  headmaster_name?: string
  caretaker_name?: string
  color_primary: string
  color_secondary: string
}

export function ProfilePage() {
  const { message } = App.useApp()
  const settingsQuery = useSchoolSettings()
  const saveMutation = useSaveSchoolSettings()
  const [form] = Form.useForm<SchoolSettingsFormValues>()
  const [pinForm] = Form.useForm<{ pin: string; confirm: string }>()
  const [savingPin, setSavingPin] = useState(false)

  const handleSavePin = async (values: { pin: string; confirm: string }) => {
    if (values.pin !== values.confirm) {
      message.error('Konfirmasi PIN tidak sama')
      return
    }
    setSavingPin(true)
    try {
      await setStaffPin(values.pin)
      message.success('PIN otorisasi kas tersimpan')
      pinForm.resetFields()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Gagal menyimpan PIN')
    } finally {
      setSavingPin(false)
    }
  }

  useEffect(() => {
    if (!settingsQuery.data) return
    form.setFieldsValue({
      school_name: settingsQuery.data.school_name,
      school_address: settingsQuery.data.school_address ?? undefined,
      headmaster_name: settingsQuery.data.headmaster_name ?? undefined,
      caretaker_name: settingsQuery.data.caretaker_name ?? undefined,
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
      caretaker_name: values.caretaker_name || null,
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
        subtitle="Identitas sekolah pada kop rapor"
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
            <Input maxLength={120} placeholder="Contoh: Muhammadiyah Boarding School Tanggul" />
          </Form.Item>

          <Form.Item name="school_address" label="Alamat">
            <Input.TextArea rows={2} maxLength={200} placeholder="Alamat lengkap sekolah" />
          </Form.Item>

          <Form.Item name="headmaster_name" label="Nama Kepala Sekolah">
            <Input maxLength={120} placeholder="Nama lengkap beserta gelar" />
          </Form.Item>

          <Form.Item name="caretaker_name" label="Nama Pengasuh">
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

      <Card style={{ maxWidth: 640, marginTop: 16 }} title="PIN Otorisasi Kas">
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          PIN ini dipakai petugas untuk mengesahkan transaksi tabungan. Simpan PIN pribadi,
          jangan dibagikan.
        </Typography.Paragraph>
        <Form
          form={pinForm}
          layout="vertical"
          onFinish={(values) => void handleSavePin(values)}
          disabled={savingPin}
        >
          <Form.Item
            name="pin"
            label="PIN Baru"
            rules={[
              { required: true, message: 'PIN wajib diisi' },
              { pattern: /^\d{4,8}$/, message: 'PIN harus 4 sampai 8 digit angka' },
            ]}
          >
            <Input.Password maxLength={8} inputMode="numeric" placeholder="4-8 digit" />
          </Form.Item>
          <Form.Item
            name="confirm"
            label="Ulangi PIN Baru"
            dependencies={['pin']}
            rules={[
              { required: true, message: 'Ulangi PIN baru' },
              ({ getFieldValue }) => ({
                validator: (_rule, value) =>
                  !value || value === getFieldValue('pin')
                    ? Promise.resolve()
                    : Promise.reject(new Error('Konfirmasi PIN tidak sama')),
              }),
            ]}
          >
            <Input.Password maxLength={8} inputMode="numeric" placeholder="Ulangi PIN" />
          </Form.Item>
          <Button type="primary" htmlType="submit" icon={<KeyOutlined />} loading={savingPin}>
            Simpan PIN
          </Button>
        </Form>
      </Card>
    </div>
  )
}
