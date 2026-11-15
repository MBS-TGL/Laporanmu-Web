import type { ReactNode } from 'react'
import { CheckCircleOutlined, StopOutlined, TeamOutlined } from '@ant-design/icons'
import type { DormStatus } from './types'

/** Meta status & gender kamar — dipakai bersama oleh tabel, papan, dan drawer */
export const STATUS_META: Record<DormStatus, { label: string; color?: string; icon: ReactNode }> = {
  active: { label: 'Aktif', color: 'green', icon: <CheckCircleOutlined /> },
  full: { label: 'Penuh', color: 'orange', icon: <TeamOutlined /> },
  inactive: { label: 'Nonaktif', icon: <StopOutlined /> },
}

export const GENDER_LABEL: Record<string, string> = {
  male: 'Putra',
  female: 'Putri',
  mixed: 'Campur',
}

export const GENDER_COLOR: Record<string, string> = {
  male: 'geekblue',
  female: 'magenta',
  mixed: 'purple',
}

export const GENDER_OPTIONS = [
  { value: 'male', label: 'Putra' },
  { value: 'female', label: 'Putri' },
  { value: 'mixed', label: 'Campur' },
]

export const STATUS_OPTIONS = [
  { value: 'active', label: 'Aktif' },
  { value: 'full', label: 'Penuh' },
  { value: 'inactive', label: 'Nonaktif' },
]

/** Warna meter okupansi: merah ≥100%, amber ≥80%, hijau di bawahnya */
export function occupancyStroke(pct: number): string {
  return pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#10b981'
}
