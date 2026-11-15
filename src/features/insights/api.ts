import { supabase } from '../../lib/supabase'
import { callAi } from '../../shared/lib/ai'
import type { DailyReportCount, DormNegative, InsightsSnapshot, InsightPreset, RiskBucket } from './types'

/** Ambang santri berisiko di halaman Insights (konsisten dengan chip "Poin Berisiko") */
const RISK = -25

/** Ambil angka-angka terkini dari berbagai modul (query ringan, field minim). */
export async function fetchSnapshot(): Promise<InsightsSnapshot> {
  const today = new Date()
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 6)
  const twoWeeksAgo = new Date(today)
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 13)

  const [studentsRes, classesRes, dormsRes, reportsRes, tahfidzRes, savingsRes, loansRes, suspensionsRes] =
    await Promise.all([
      supabase
        .from('students')
        .select('id, class_id, dorm_id, total_points, nisn, phone')
        .is('deleted_at', null)
        .eq('status', 'active')
        .limit(1000),
      supabase.from('classes').select('id, name').is('deleted_at', null),
      supabase.from('dorms').select('id, name, capacity').is('deleted_at', null),
      supabase
        .from('reports')
        // Baris 14 hari: dipakai tren harian + hitung 7 hari terakhir vs sebelumnya
        .select('points, reported_at')
        .gte('reported_at', twoWeeksAgo.toISOString())
        .limit(5000),
      supabase
        .from('tahfidz_records')
        .select('id', { count: 'exact', head: true })
        .gte('recorded_at', weekAgo.toISOString().slice(0, 10)),
      supabase
        .from('savings_accounts')
        .select('balance, status')
        .is('deleted_at', null)
        .limit(1000),
      supabase
        .from('book_loans')
        .select('due_date, returned_at')
        .limit(500),
      supabase
        .from('suspensions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active'),
    ])

  if (studentsRes.error) throw studentsRes.error
  if (classesRes.error) throw classesRes.error
  if (dormsRes.error) throw dormsRes.error
  if (reportsRes.error) throw reportsRes.error
  if (tahfidzRes.error) throw tahfidzRes.error
  if (savingsRes.error) throw savingsRes.error
  if (loansRes.error) throw loansRes.error
  if (suspensionsRes.error) throw suspensionsRes.error

  const students = studentsRes.data ?? []
  const classes = classesRes.data ?? []
  const dorms = dormsRes.data ?? []
  const accounts = savingsRes.data ?? []
  const reportRows = (reportsRes.data ?? []) as { points: number; reported_at: string }[]
  const todayStr = today.toISOString().slice(0, 10)

  // Agregasi poin per kelas (avg + risiko) — dasar grafik & prompt
  const classPoints = new Map<string, { sum: number; count: number; risk: number }>()
  for (const s of students) {
    if (!s.class_id) continue
    const bucket = classPoints.get(s.class_id) ?? { sum: 0, count: 0, risk: 0 }
    bucket.sum += s.total_points ?? 0
    bucket.count += 1
    if ((s.total_points ?? 0) <= RISK) bucket.risk += 1
    classPoints.set(s.class_id, bucket)
  }
  const classSizes = classes
    .map((c) => {
      const b = classPoints.get(c.id)
      return {
        name: c.name,
        count: b?.count ?? 0,
        avgPoints: b && b.count > 0 ? Math.round((b.sum / b.count) * 10) / 10 : 0,
        riskCount: b?.risk ?? 0,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'id', { numeric: true }))

  // Agregasi poin negatif per asrama — dasar grafik pembinaan asrama
  const dormNegativeMap = new Map<string, { negativeStudents: number; negativePoints: number }>()
  for (const s of students) {
    const pts = s.total_points ?? 0
    if (!s.dorm_id || pts >= 0) continue
    const bucket = dormNegativeMap.get(s.dorm_id) ?? { negativeStudents: 0, negativePoints: 0 }
    bucket.negativeStudents += 1
    bucket.negativePoints += pts
    dormNegativeMap.set(s.dorm_id, bucket)
  }
  const dormNegative: DormNegative[] = dorms
    .map((d) => ({
      name: d.name,
      negativeStudents: dormNegativeMap.get(d.id)?.negativeStudents ?? 0,
      negativePoints: dormNegativeMap.get(d.id)?.negativePoints ?? 0,
    }))
    .filter((d) => d.negativeStudents > 0)
    .sort((a, b) => a.negativePoints - b.negativePoints)

  // Distribusi risiko untuk donut: berisiko / perlu perhatian / sehat
  const riskBreakdown: RiskBucket[] = [
    { label: 'Berisiko (≤ -25)', value: 0, color: '#ef4444' },
    { label: 'Perlu perhatian', value: 0, color: '#f59e0b' },
    { label: 'Sehat (≥ 0)', value: 0, color: '#22c55e' },
  ]
  for (const s of students) {
    const pts = s.total_points ?? 0
    const bucket = pts <= RISK ? 0 : pts < 0 ? 1 : 2
    riskBreakdown[bucket].value += 1
  }

  // Tren harian pelanggaran/prestasi 14 hari terakhir
  const dailyMap = new Map<string, DailyReportCount>()
  for (let i = 0; i < 14; i++) {
    const d = new Date(twoWeeksAgo)
    d.setDate(d.getDate() + i)
    const key = d.toISOString().slice(0, 10)
    dailyMap.set(key, { date: key, pelanggaran: 0, prestasi: 0 })
  }
  for (const r of reportRows) {
    const day = dailyMap.get(r.reported_at.slice(0, 10))
    if (!day) continue
    if (r.points < 0) day.pelanggaran += 1
    else day.prestasi += 1
  }
  const reportsDaily = [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date))
  const weekAgoStr = weekAgo.toISOString().slice(0, 10)
  const reports7d = reportRows.filter((r) => r.reported_at.slice(0, 10) >= weekAgoStr).length

  const dormOccupancy = dorms.map((d) => ({
    name: d.name,
    occupied: students.filter((s) => s.dorm_id === d.id).length,
    capacity: d.capacity ?? 0,
  }))

  const savingsBalance = accounts
    .filter((a) => a.status === 'active')
    .reduce((sum, a) => sum + Number(a.balance ?? 0), 0)

  return {
    generatedAt: new Date().toISOString(),
    studentTotal: students.length,
    studentNoClass: students.filter((s) => !s.class_id).length,
    studentRisk: students.filter((s) => (s.total_points ?? 0) <= RISK).length,
    studentNoNisn: students.filter((s) => !s.nisn).length,
    studentNoPhone: students.filter((s) => !s.phone).length,
    classCount: classes.length,
    classSizes,
    dormOccupancy,
    dormNegative,
    riskBreakdown,
    reportsDaily,
    reports7d,
    tahfidz7d: tahfidzRes.count ?? 0,
    savingsBalance,
    savingsAccounts: accounts.filter((a) => a.status === 'active').length,
    booksOverdue: (loansRes.data ?? []).filter((l) => !l.returned_at && l.due_date && l.due_date < todayStr).length,
    suspensionsActive: suspensionsRes.count ?? 0,
  }
}

// ------------------------------------------------------------
// Prompt builder — data dikirim sebagai angka, AI hanya menafsirkan
// ------------------------------------------------------------

export function buildInsightPrompt(snapshot: InsightsSnapshot, preset: InsightPreset): string {
  const fmt = (n: number) => n.toLocaleString('id-ID')
  const rupiah = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

  const classLines = snapshot.classSizes
    .map(
      (c) =>
        `- ${c.name}: ${c.count} santri, rata-rata poin ${c.avgPoints}, berisiko ${c.riskCount}`,
    )
    .join('\n')
  const dormLines = snapshot.dormOccupancy
    .map((d) => `- ${d.name}: ${d.occupied}/${d.capacity} terisi`)
    .join('\n')
  const dormNegativeLines = snapshot.dormNegative
    .map((d) => `- ${d.name}: ${d.negativeStudents} santri poin negatif (total ${d.negativePoints})`)
    .join('\n')
  const prev7d = snapshot.reportsDaily
    .slice(0, 7)
    .reduce((sum, d) => sum + d.pelanggaran + d.prestasi, 0)
  const trendNote =
    snapshot.reports7d >= prev7d
      ? `aktivitas naik dari ${prev7d} catatan pada 7 hari sebelumnya`
      : `aktivitas turun dari ${prev7d} catatan pada 7 hari sebelumnya`

  const focus: Record<InsightPreset, string> = {
    general: 'Buat ringkasan kondisi pondok secara umum.',
    risk:
      'Fokus pada santri yang butuh perhatian: poin berisiko, tanpa kelas, data belum lengkap. Sarankan langkah pembinaan konkret.',
    ops:
      'Fokus pada operasional harian: setoran tahfidz, pencatatan poin, perpustakaan terlambat, skorsing aktif. Sarankan perbaikan proses.',
    leadership:
      'Rangkum khusus untuk laporan kepala sekolah/pengasuh: padat, angka utama, 3 rekomendasi prioritas.',
  }

  return `Data terkini Laporanmu (per ${new Date(snapshot.generatedAt).toLocaleString('id-ID')}):

SISWA
- Total santri aktif: ${fmt(snapshot.studentTotal)}
- Tanpa kelas: ${fmt(snapshot.studentNoClass)}
- Poin berisiko (≤ -25): ${fmt(snapshot.studentRisk)}
- Tanpa NISN: ${fmt(snapshot.studentNoNisn)}
- Tanpa nomor telepon: ${fmt(snapshot.studentNoPhone)}

KELAS (${snapshot.classCount})
${classLines || '- (belum ada kelas)'}

ASRAMA
${dormLines || '- (belum ada data asrama)'}

POIN NEGATIF PER ASRAMA
${dormNegativeLines || '- (tidak ada santri poin negatif)'}

DISTRIBUSI POIN
${snapshot.riskBreakdown.map((b) => `- ${b.label}: ${b.value} santri`).join('\n')}

AKTIVITAS 7 HARI TERAKHIR (${trendNote})
- Catatan poin: ${fmt(snapshot.reports7d)}
- Setoran tahfidz: ${fmt(snapshot.tahfidz7d)}

KEUANGAN & PERPUSTAKAAN
- Tabungan santri: ${rupiah(snapshot.savingsBalance)} dari ${fmt(snapshot.savingsAccounts)} rekening aktif
- Buku terlambat dikembalikan: ${fmt(snapshot.booksOverdue)}
- Skorsing aktif: ${fmt(snapshot.suspensionsActive)}

Tugas: ${focus[preset]}`
}

const INSIGHT_SYSTEM = `Kamu adalah analis data sekolah pondok santri untuk aplikasi Laporanmu.
ATURAN KETAT:
1. Analisis HANYA berdasarkan angka yang diberikan. DILARANG mengarang data, nama, atau angka baru.
2. Jawab dalam Bahasa Indonesia yang jelas dan praktis.
3. Format jawaban: heading "## " untuk bagian, bullet "- " untuk poin. Maksimal 350 kata.
4. Struktur: ## Ringkasan, ## Temuan Penting, ## Tindak Lanjut yang Disarankan.
5. Angka yang kamu sebut HARUS persis dari data yang diberikan.`

/** Minta Gemini menafsirkan snapshot data. */
export async function generateInsight(
  snapshot: InsightsSnapshot,
  preset: InsightPreset,
): Promise<string> {
  return callAi({
    system: INSIGHT_SYSTEM,
    prompt: buildInsightPrompt(snapshot, preset),
    maxOutputTokens: 1024,
  })
}
