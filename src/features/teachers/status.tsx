import type { ReactNode } from 'react'
import { CheckCircleOutlined, PauseCircleOutlined, StopOutlined } from '@ant-design/icons'
import type { Gender, TeacherStatus } from './types'

export const TEACHER_STATUS_META: Record<
  TeacherStatus,
  { label: string; color?: string; icon: ReactNode }
> = {
  active: { label: 'Aktif', color: 'green', icon: <CheckCircleOutlined /> },
  inactive: { label: 'Nonaktif', icon: <StopOutlined /> },
  on_leave: { label: 'Cuti', color: 'orange', icon: <PauseCircleOutlined /> },
}

export const GENDER_LABEL: Record<Gender, string> = {
  L: 'Laki-laki',
  P: 'Perempuan',
}
