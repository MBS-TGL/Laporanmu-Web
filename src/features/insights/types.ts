export interface ClassSize {
  name: string
  count: number
}

export interface DormOccupancy {
  name: string
  occupied: number
  capacity: number
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
  reports7d: number
  tahfidz7d: number
  savingsBalance: number
  savingsAccounts: number
  booksOverdue: number
  suspensionsActive: number
}

export type InsightPreset = 'general' | 'risk' | 'ops' | 'leadership'
