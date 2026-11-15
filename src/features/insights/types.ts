export interface ClassSize {
  name: string
  count: number
  /** Rata-rata total_points santri di kelas ini */
  avgPoints: number
  /** Santri dengan poin ≤ -25 di kelas ini */
  riskCount: number
}

export interface DormNegative {
  name: string
  /** Santri dengan poin negatif di asrama ini */
  negativeStudents: number
  /** Akumulasi poin negatif di asrama ini */
  negativePoints: number
}

export interface RiskBucket {
  label: string
  value: number
  color: string
}

export interface DormOccupancy {
  name: string
  occupied: number
  capacity: number
}

export interface DailyReportCount {
  date: string
  pelanggaran: number
  prestasi: number
}

export interface InsightsSnapshot {
  generatedAt: string
  studentTotal: number
  studentNoClass: number
  studentRisk: number
  studentNoNisn: number
  studentNoPhone: number
  classCount: number
  classSizes: ClassSize[]
  dormOccupancy: DormOccupancy[]
  dormNegative: DormNegative[]
  riskBreakdown: RiskBucket[]
  /** Tren harian 14 hari terakhir (pelanggaran = poin < 0) */
  reportsDaily: DailyReportCount[]
  reports7d: number
  tahfidz7d: number
  savingsBalance: number
  savingsAccounts: number
  booksOverdue: number
  suspensionsActive: number
}

export type InsightPreset = 'general' | 'risk' | 'ops' | 'leadership'
