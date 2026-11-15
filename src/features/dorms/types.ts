export type DormGender = 'male' | 'female' | 'mixed'
export type DormStatus = 'active' | 'full' | 'inactive'

export interface Dorm {
  id: string
  name: string
  gender: DormGender | null
  capacity: number
  musyrif_id: string | null
  status: DormStatus
  deleted_at: string | null
  created_at?: string
  updated_at?: string
  musyrif?: { name: string } | null
}

export interface DormFormValues {
  name: string
  gender?: DormGender
  capacity: number
  musyrif_id?: string
  status: DormStatus
}

/** Kamar untuk penempatan: brief + okupansi terisi */
export interface DormRoom {
  id: string
  name: string
  gender: DormGender | null
  capacity: number
  occupied: number
  status: DormStatus
}

export interface DormFilters {
  search?: string
  gender?: DormGender
  status?: DormStatus
}

export type StudentGender = 'L' | 'P'

/** Santri untuk tab penempatan (join kelas & asrama) */
export interface Placement {
  id: string
  name: string
  gender: StudentGender | null
  class_id: string | null
  classes?: { name: string } | null
  dorm_id: string | null
  dorms?: { name: string } | null
}

export interface PlacementFilters {
  search?: string
  placement: 'all' | 'unassigned' | 'assigned'
  gender?: StudentGender
  classId?: string
  page: number
  pageSize: number
}

// ------------------------------------------------------------
// Import CSV kamar (parser pure: importParse.ts)
// ------------------------------------------------------------
export type ImportRowStatus = 'siap' | 'error' | 'duplikat'

export interface ParsedDormRow {
  /** Nomor baris di file (1-based, setelah header) */
  row: number
  name: string
  gender: DormGender | null
  capacity: number
  musyrifName: string | null
  /** Resolved via daftar musyrif — null bila tidak ditemukan */
  musyrifId: string | null
  status: DormStatus
  rowStatus: ImportRowStatus
  /** Pesan error (rowStatus 'error'/'duplikat') atau peringatan (rowStatus 'siap') */
  message?: string
}

export interface DormImportContext {
  /** Nama kamar existing (lowercase) untuk deteksi duplikat */
  existingNames: string[]
  /** Daftar musyrif untuk resolve nama → id */
  teachers: { id: string; name: string }[]
}

export interface DormParseResult {
  rows: ParsedDormRow[]
  /** Baris kosong yang dilewati */
  skippedRows: number
}

// ------------------------------------------------------------
// Distribusi otomatis (pure: dormDistribute.ts)
// ------------------------------------------------------------
export interface DistribRoom {
  id: string
  name: string
  gender: DormGender | null
  capacity: number
  occupied: number
}

export interface DistribStudent {
  id: string
  name: string
  gender: StudentGender | null
}

export interface DistribAssignment {
  roomId: string
  studentIds: string[]
}

export interface DistribPreviewRow {
  roomId: string
  roomName: string
  occupiedBefore: number
  incoming: number
  occupiedAfter: number
  capacity: number
}

export interface DistributeResult {
  assignments: DistribAssignment[]
  preview: DistribPreviewRow[]
  /** Santri yang tidak bisa ditempatkan (kapasitas habis) */
  unplaced: DistribStudent[]
}
