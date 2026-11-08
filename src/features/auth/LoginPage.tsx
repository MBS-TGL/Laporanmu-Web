import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Button, Form, Input, Typography } from 'antd'
import { DashboardOutlined, LockOutlined, MailOutlined } from '@ant-design/icons'
import { useLogin } from './hooks'
import { PublicShell } from '../public/PublicShell'
import { PortalCard } from '../public/PortalCard'

interface LoginFormValues {
  email: string
  password: string
}

export function LoginPage() {
  const login = useLogin()
  const [form] = Form.useForm<LoginFormValues>()

  useEffect(() => {
    document.title = 'Masuk · Laporanmu'
  }, [])

  const onFinish = (values: LoginFormValues) => {
    login.mutate(values)
  }

  return (
    <PublicShell tint="indigo" footerLabel="Portal Staf" hideFooterLinks>
      <PortalCard
        tint="indigo"
        icon={<DashboardOutlined />}
        title="Aplikasi Staf"
        description="Satu dasbor untuk mencatat, memantau, dan melaporkan pembinaan santri."
        bullets={[
          'Poin, raport & kehadiran terpadu',
          'Portal wali santri real-time',
          'Peran guru, pengurus & admin',
        ]}
      >
        <Typography.Title level={4} style={{ margin: 0, letterSpacing: '-0.02em' }}>
          Masuk ke Akun
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ fontSize: 13, marginTop: 4 }}>
          Gunakan email staf yang terdaftar di sekolah.
        </Typography.Paragraph>
        <Form<LoginFormValues>
          form={form}
          layout="vertical"
          onFinish={onFinish}
          requiredMark={false}
          disabled={login.isPending}
          style={{ marginTop: 18 }}
        >
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Email wajib diisi' },
              { type: 'email', message: 'Format email tidak valid' },
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="email@contoh.com" autoComplete="email" size="large" />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={[{ required: true, message: 'Password wajib diisi' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Password"
              autoComplete="current-password"
              size="large"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 12, marginTop: 20 }}>
            <Button
              type="primary"
              htmlType="submit"
              block
              size="large"
              loading={login.isPending}
            >
              Masuk
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center' }}>
          <Link to="/" style={{ fontSize: 12.5 }}>
            ← Kembali ke Beranda
          </Link>
          <Typography.Paragraph type="secondary" style={{ fontSize: 12.5, margin: '8px 0 0' }}>
            Wali santri?{' '}
            <Link to="/check" style={{ fontWeight: 600 }}>
              Cek poin anak Anda di sini
            </Link>
          </Typography.Paragraph>
        </div>
      </PortalCard>
    </PublicShell>
  )
}
