import type { HealthStatus } from './types'

export const STATUS_LABEL: Record<HealthStatus, string> = {
  UKS: 'Rawat di UKS',
  Dormitory: 'Rest di Asrama',
  Returned: 'Kembali KBM',
}

export const STATUS_COLOR: Record<HealthStatus, string> = {
  UKS: 'orange',
  Dormitory: 'purple',
  Returned: 'green',
}

/** Warna aksen CSS (border/dot) per status — tag antd memakai STATUS_COLOR */
export const STATUS_HEX: Record<HealthStatus, string> = {
  UKS: '#d97706',
  Dormitory: '#7c3aed',
  Returned: '#16a34a',
}

/** Status yang masih perlu dipantau (belum pulih) */
export const RESTING_STATUSES: readonly HealthStatus[] = ['UKS', 'Dormitory']

export const MEDICINE_CATEGORY_OPTIONS = [
  'Analgesik / Antipiretik',
  'Antibiotik',
  'Obat Lambung',
  'Obat Flu & Batuk',
  'Antiseptik',
  'Anti-alergi',
  'Multivitamin',
].map((c) => ({ value: c, label: c }))

export const MEDICINE_UNIT_OPTIONS = [
  { value: 'tablet', label: 'Tablet / Kaplet' },
  { value: 'botol', label: 'Botol / Syrup' },
  { value: 'tube', label: 'Tube / Salep' },
  { value: 'sachet', label: 'Sachet / Puyer' },
]

/** Satuan legal untuk impor obat — selain ini baris ditandai error */
export const MEDICINE_UNIT_VALUES = MEDICINE_UNIT_OPTIONS.map((u) => u.value)
