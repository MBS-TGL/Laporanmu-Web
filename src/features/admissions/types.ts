export type AdmissionStage =
  | 'registered'
  | 'selection'
  | 'accepted'
  | 'rejected'
  | 'enrolled'

export interface Admission {
  id: string
  registration_number: string
  full_name: string
  gender: 'L' | 'P' | null
  birth_place: string | null
  birth_date: string | null
  origin_school: string | null
  target_grade: string | null
  parent_name: string | null
  parent_phone: string | null
  address: string | null
  stage: AdmissionStage
  notes: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface AdmissionFilters {
  search?: string
  stage?: AdmissionStage
  archived?: boolean
}

export interface ConversionInput {
  admissionId: string
  classId: string
  registrationCode?: string
}

export type StageColor = 'blue' | 'cyan' | 'green' | 'red' | 'purple' | 'default'

export const STAGE_META: Record<AdmissionStage, { label: string; color: StageColor }> = {
  registered: { label: 'Baru', color: 'blue' },
  selection: { label: 'Seleksi', color: 'cyan' },
  accepted: { label: 'Diterima', color: 'green' },
  rejected: { label: 'Ditolak', color: 'red' },
  enrolled: { label: 'Daftar Ulang', color: 'purple' },
}

/** Metadata aman untuk nilai enum lama/baru yang belum dikenal UI. */
export function stageMeta(stage: string | null | undefined): { label: string; color: StageColor } {
  if (stage && stage in STAGE_META) return STAGE_META[stage as AdmissionStage]
  return { label: stage || 'Tidak diketahui', color: 'default' }
}
