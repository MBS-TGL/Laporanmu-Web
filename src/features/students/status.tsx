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
  active: { label: 'Aktif', color: 'green', icon: <CheckCircleOutlined /> },
  graduated: { label: 'Lulus', color: 'blue', icon: <SafetyCertificateOutlined /> },
  transferred: { label: 'Pindah', color: 'orange', icon: <SwapOutlined /> },
  left: { label: 'Keluar', color: 'default', icon: <MinusCircleOutlined /> },
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

/** Pendidikan terakhir — daftar standar Dapodik */
export const EDUCATION_OPTIONS = [
  'Tidak Sekolah',
  'Putus SD',
  'SD Sederajat',
  'SMP Sederajat',
  'SMA Sederajat',
  'Diploma I/II',
  'Diploma III',
  'Diploma IV/Strata I',
  'Strata II',
  'Strata III',
].map((e) => ({ value: e, label: e }))

/** Rentang penghasilan per bulan — kategori Dapodik */
export const INCOME_OPTIONS = [
  'Kurang dari 500.000',
  '500.000 - 999.999',
  '1.000.000 - 1.999.999',
  '2.000.000 - 4.999.999',
  '5.000.000 - 19.999.999',
  'Lebih dari 20.000.000',
  'Tidak berpenghasilan',
].map((i) => ({ value: i, label: i }))
