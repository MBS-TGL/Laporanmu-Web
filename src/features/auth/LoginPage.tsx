import { Button, Card, Form, Input, Typography } from 'antd'
import { LockOutlined, MailOutlined } from '@ant-design/icons'
import { useLogin } from './hooks'

interface LoginFormValues {
  email: string
  password: string
}

export function LoginPage() {
  const login = useLogin()
  const [form] = Form.useForm<LoginFormValues>()

  const onFinish = (values: LoginFormValues) => {
    login.mutate(values)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(160deg, #eef2ff 0%, #f8fafc 45%, #f8fafc 100%)',
        padding: 16,
      }}
    >
      <Card
        style={{
          width: 410,
          borderRadius: 18,
          boxShadow: '0 8px 32px rgba(15, 23, 42, 0.08)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img
            src="/favicon.svg"
            alt="Logo Laporanmu"
            width={52}
            height={52}
            style={{ marginBottom: 12 }}
          />
          <Typography.Title level={3} style={{ marginBottom: 2, letterSpacing: '-0.02em' }}>
            Laporanmu
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 13.5 }}>
            Sistem Manajemen Perilaku Siswa
          </Typography.Text>
        </div>

        <Form<LoginFormValues>
          form={form}
          layout="vertical"
          onFinish={onFinish}
          requiredMark={false}
          disabled={login.isPending}
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

          <Form.Item style={{ marginBottom: 8, marginTop: 20 }}>
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
      </Card>
    </div>
  )
}
