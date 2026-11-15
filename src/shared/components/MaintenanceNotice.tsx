import { Result } from 'antd'
import { ToolOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'

// Layar pesan pemeliharaan bersama untuk PublicGate (route publik)
// dan MaintenanceGate (dashboard). `message` & `until` datang dari app_settings.
export function MaintenanceNotice({
  title,
  message,
  until,
}: {
  title: string
  message: string
  until: string | null
}) {
  return (
    <Result
      icon={<ToolOutlined style={{ color: '#f59e0b' }} />}
      status="warning"
      title={title}
      subTitle={
        <>
          <div style={{ whiteSpace: 'pre-line' }}>{message}</div>
          {until && dayjs(until).isValid() && (
            <div style={{ marginTop: 8, fontSize: 12.5, color: '#64748b' }}>
              Perkiraan selesai: {dayjs(until).format('DD MMM YYYY HH:mm')}
            </div>
          )}
        </>
      }
    />
  )
}
