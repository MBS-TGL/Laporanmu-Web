import type { ReactNode } from 'react'
import {
  CheckCircleOutlined,
  MinusCircleOutlined,
  SafetyCertificateOutlined,
  SwapOutlined,
} from '@ant-design/icons'
import type { StudentStatus } from './types'

export const STUDENT_STATUS_META: Record<
  StudentStatus,
  { label: string; color: string; icon: ReactNode }
> = {
  aktif: { label: 'Aktif', color: 'green', icon: <CheckCircleOutlined /> },
  lulus: { label: 'Lulus', color: 'blue', icon: <SafetyCertificateOutlined /> },
  pindah: { label: 'Pindah', color: 'orange', icon: <SwapOutlined /> },
  keluar: { label: 'Keluar', color: 'default', icon: <MinusCircleOutlined /> },
}

export const GENDER_LABEL: Record<Gender, string> = {
  L: 'Laki-laki',
  P: 'Perempuan',
}

type Gender = 'L' | 'P'

export const RELIGION_OPTIONS = [
  'Islam',
  'Kristen',
  'Katolik',
  'Hindu',
  'Buddha',
  'Konghucu',
].map((r) => ({ value: r, label: r }))

export const GUARDIAN_RELATION_OPTIONS = [
  'Ayah',
  'Ibu',
  'Wali',
  'Kakak',
  'Lainnya',
].map((r) => ({ value: r, label: r }))
