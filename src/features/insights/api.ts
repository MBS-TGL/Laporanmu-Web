import { supabase } from '../../lib/supabase'
import { callGemini } from '../../shared/lib/ai'
import type { InsightsSnapshot, InsightPreset } from './types'

/** Ambil angka-angka terkini dari berbagai modul (query ringan, field minim). */
export async function fetchSnapshot(): Promise<InsightsSnapshot> {
  const today = new Date()
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 6)

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
        .select('id', { count: 'exact', head: true })
        .gte('reported_at', weekAgo.toISOString()),
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
  const todayStr = today.toISOString().slice(0, 10)

  const classSizes = classes
    .map((c) => ({
      name: c.name,
      count: students.filter((s) => s.class_id === c.id).length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'id', { numeric: true }))

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
    studentRisk: students.filter((s) => (s.total_points ?? 0) <= -25).length,
    studentNoNisn: students.filter((s) => !s.nisn).length,
    studentNoPhone: students.filter((s) => !s.phone).length,
    classCount: classes.length,
    classSizes,
    dormOccupancy,
    reports7d: reportsRes.count ?? 0,
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

  const classLines = snapshot.classSizes.map((c) => `- ${c.name}: ${c.count} santri`).join('\n')
  const dormLines = snapshot.dormOccupancy
    .map((d) => `- ${d.name}: ${d.occupied}/${d.capacity} terisi`)
    .join('\n')

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

AKTIVITAS 7 HARI TERAKHIR
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
  return callGemini({
    system: INSIGHT_SYSTEM,
    prompt: buildInsightPrompt(snapshot, preset),
    maxOutputTokens: 1024,
  })
}
