import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Link, Navigate, useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { Button, Space, Spin, Typography } from 'antd'
import { MainLayout } from '../layouts/MainLayout'
import { ModuleGuard } from '../shared/components/ModuleGuard'
import { PublicGate } from '../shared/components/PublicGate'
import { ProtectedRoute, PublicRoute } from '../shared/components/ProtectedRoute'
import { RoleRoute } from '../shared/components/RoleRoute'
import { ErrorBoundary } from '../shared/components/ErrorBoundary'
import { LoginPage } from '../features/auth/LoginPage'

// ─── Lazy pages ──────────────────────────────────────────────────────────────
// Dashboard & landing juga lazy — recharts dan halaman publik tidak
// ikut terunduh saat load awal aplikasi
const DashboardPage = lazy(() =>
  import('../features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)
const LandingPage = lazy(() =>
  import('../features/public/LandingPage').then((m) => ({ default: m.LandingPage })),
)

const StudentsPage = lazy(() =>
  import('../features/students/StudentsPage').then((m) => ({ default: m.StudentsPage })),
)
const TeachersPage = lazy(() =>
  import('../features/teachers/TeachersPage').then((m) => ({ default: m.TeachersPage })),
)
const ClassesPage = lazy(() =>
  import('../features/classes/ClassesPage').then((m) => ({ default: m.ClassesPage })),
)
const DormsPage = lazy(() =>
  import('../features/dorms/DormsPage').then((m) => ({ default: m.DormsPage })),
)
const YearsPage = lazy(() =>
  import('../features/academic-years/YearsPage').then((m) => ({ default: m.YearsPage })),
)
const GatePage = lazy(() =>
  import('../features/gate/GatePage').then((m) => ({ default: m.GatePage })),
)
const CardsPage = lazy(() =>
  import('../features/report-cards/CardsPage').then((m) => ({ default: m.CardsPage })),
)
const InputPage = lazy(() =>
  import('../features/report-cards/InputPage').then((m) => ({ default: m.InputPage })),
)
const PreviewPage = lazy(() =>
  import('../features/report-cards/PreviewPage').then((m) => ({ default: m.PreviewPage })),
)
const GradesPage = lazy(() =>
  import('../features/grades/GradesPage').then((m) => ({ default: m.GradesPage })),
)
const GradeInput = lazy(() =>
  import('../features/grades/InputPage').then((m) => ({ default: m.InputPage })),
)
const ProfilePage = lazy(() =>
  import('../features/settings/ProfilePage').then((m) => ({ default: m.ProfilePage })),
)
const AttendancePage = lazy(() =>
  import('../features/attendance/AttendancePage').then((m) => ({ default: m.AttendancePage })),
)
const HealthPage = lazy(() =>
  import('../features/health/HealthPage').then((m) => ({ default: m.HealthPage })),
)
const CounselingPage = lazy(() =>
  import('../features/counseling/CounselingPage').then((m) => ({ default: m.CounselingPage })),
)
const PermitPage = lazy(() =>
  import('../features/leave-permit/PermitPage').then((m) => ({ default: m.PermitPage })),
)
const AdminPage = lazy(() =>
  import('../features/admin/AdminPage').then((m) => ({ default: m.AdminPage })),
)
const AnnouncementsPage = lazy(() =>
  import('../features/announcements/AnnouncementsPage').then((m) => ({
    default: m.AnnouncementsPage,
  })),
)
const SubjectsPage = lazy(() =>
  import('../features/subjects/SubjectsPage').then((m) => ({ default: m.SubjectsPage })),
)
const InventoryPage = lazy(() =>
  import('../features/inventory/InventoryPage').then((m) => ({ default: m.InventoryPage })),
)
const SchedulesPage = lazy(() =>
  import('../features/schedules/SchedulesPage').then((m) => ({ default: m.SchedulesPage })),
)
const HalaqahPage = lazy(() =>
  import('../features/halaqah/HalaqahPage').then((m) => ({ default: m.HalaqahPage })),
)
const EkskulPage = lazy(() =>
  import('../features/ekskul/EkskulPage').then((m) => ({ default: m.EkskulPage })),
)
const LibraryPage = lazy(() =>
  import('../features/library/LibraryPage').then((m) => ({ default: m.LibraryPage })),
)
const SavingsPage = lazy(() =>
  import('../features/savings/SavingsPage').then((m) => ({ default: m.SavingsPage })),
)
const CheckPage = lazy(() =>
  import('../features/public/CheckPage').then((m) => ({ default: m.CheckPage })),
)
const VerifyPage = lazy(() =>
  import('../features/public/VerifyPage').then((m) => ({ default: m.VerifyPage })),
)
const DisiplinPage = lazy(() =>
  import('../features/behavior/DisiplinPage').then((m) => ({ default: m.DisiplinPage })),
)
const GuardianPage = lazy(() =>
  import('../features/suspension/GuardianPage').then((m) => ({ default: m.GuardianPage })),
)
const CbtPage = lazy(() =>
  import('../features/cbt/CbtPage').then((m) => ({ default: m.CbtPage })),
)
const ExamPage = lazy(() =>
  import('../features/public/ExamPage').then((m) => ({ default: m.ExamPage })),
)
const KeuanganPage = lazy(() =>
  import('../features/keuangan/KeuanganPage').then((m) => ({ default: m.KeuanganPage })),
)

function PageFallback() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
      <Spin size="large" />
    </div>
  )
}

/** Bungkus lazy page dengan Suspense — pola tunggal untuk semua route dalam aplikasi. */
function page(component: ReactNode): ReactNode {
  return <Suspense fallback={<PageFallback />}>{component}</Suspense>
}

/**
 * Route ber-guard permission `<module>:read` — pola layout route + index child
 * (sama seperti /admin). Role tanpa izin melihat 403 RoleRoute, bukan halaman.
 */
function guarded(
  perm: string,
  component: ReactNode,
): { element: ReactNode; children: { index: true; element: ReactNode }[] } {
  return {
    element: <RoleRoute perm={perm} />,
    children: [{ index: true, element: page(component) }],
  }
}

// Redirect path lama berparam — Navigate tidak menginterpolasi :id
function SuspensionIdRedirect() {
  const { id } = useParams()
  return <Navigate to={`/disiplin?tab=skorsing&detail=${id}`} replace />
}

function NotFoundPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(160deg, #eef2ff 0%, #f8fafc 45%, #f8fafc 100%)',
        padding: 24,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 64, fontWeight: 800, color: '#4f46e5', letterSpacing: '-0.04em', lineHeight: 1 }}>
        404
      </div>
      <Typography.Title level={3} style={{ marginTop: 14, marginBottom: 4, letterSpacing: '-0.02em' }}>
        Halaman tidak ditemukan
      </Typography.Title>
      <Typography.Text type="secondary" style={{ marginBottom: 24 }}>
        Alamat yang Anda tuju tidak tersedia atau sudah dipindahkan.
      </Typography.Text>
      <Space wrap style={{ justifyContent: 'center' }}>
        <Link to="/">
          <Button type="primary">Kembali ke Beranda</Button>
        </Link>
        <Link to="/check">
          <Button>Cek Wali Santri</Button>
        </Link>
        <Link to="/dashboard">
          <Button type="text">Dashboard</Button>
        </Link>
      </Space>
    </motion.div>
  )
}

// ─── Alias redirect lama ─────────────────────────────────────────────────────
// Pasangan [path, tujuan]. Semua alias statis terpusat di sini agar mudah
// diaudit; alias yang perlu interpolasi :id ditulis manual di bawah.
// (lihat SKILLS.md §Skill 5 — URL lama tidak boleh mati begitu saja)
const ALIAS_REDIRECTS: [path: string, to: string][] = [
  ['settings/users', '/admin?tab=pengguna'],
  ['settings/audit-log', '/admin?tab=audit'],
  ['insights', '/admin?tab=insights'],
  ['master/students', '/students'],
  ['master/students/archive', '/students/archive'],
  ['master/students/alumni', '/students/alumni'],
  ['master/teachers', '/teachers'],
  ['master/teachers/archive', '/teachers/archive'],
  ['master/classes', '/classes'],
  ['master/academic-years', '/academic-years'],
  ['master/subjects', '/subjects'],
  ['master/inventory', '/inventory'],
  ['academic/schedules', '/schedules'],
  ['academic/tahfidz', '/halaqah?tab=setoran'],
  ['academic/halaqah', '/halaqah'],
  ['academic/ekskul', '/ekskul'],
  ['academic/library', '/library'],
  ['finance/savings', '/savings'],
  ['boarding/attendance', '/attendance'],
  ['boarding/gate', '/gate'],
  ['gate/logs', '/gate'],
  ['boarding/dorms', '/dorms'],
  ['boarding/health', '/health'],
  ['boarding/counseling', '/counseling'],
  ['boarding/leave-permit', '/leave-permit'],
  ['boarding/suspension', '/disiplin?tab=skorsing'],
  ['suspension', '/disiplin?tab=skorsing'],
  ['points/rules', '/point-rules'],
  ['points/reports', '/point-reports'],
  ['settings/school', '/school'],
  ['settings/announcements', '/announcements'],
  ['counseling/letters', '/counseling?tab=surat-resmi'],
  // ── hasil penggabungan page se-domain (pola ?tab=) ──
  ['admin/insights', '/admin?tab=insights'],
  ['admin/users', '/admin?tab=pengguna'],
  ['admin/roles', '/admin?tab=roles'],
  ['admin/settings', '/admin?tab=pengaturan'],
  ['admin/tasks', '/admin?tab=otomatisasi'],
  ['admin/database', '/admin?tab=database'],
  ['admin/trash', '/admin?tab=sampah'],
  ['admin/storage', '/admin?tab=penyimpanan'],
  ['admin/media', '/admin?tab=media'],
  ['admin/audit-log', '/admin?tab=audit'],
  ['students/archive', '/students?tab=arsip'],
  ['students/alumni', '/students?tab=alumni'],
  ['students/promote', '/students'],
  ['point-rules', '/disiplin?tab=aturan'],
  ['point-reports', '/disiplin?tab=catatan'],
  ['suspensions', '/disiplin?tab=skorsing'],
  ['teaching-load', '/teachers?tab=beban'],
  ['teachers/archive', '/teachers?tab=arsip'],
  ['teachers/attendance', '/attendance?tab=teachers'],
  ['attendance/machines', '/attendance?tab=machines'],
  ['grades/leger', '/grades?tab=leger'],
  ['report-cards/archive', '/report-cards?tab=arsip'],
  ['official-letters', '/counseling?tab=surat-resmi'],
  // Tahfidz digabung ke Halaqah sebagai tab Setoran
  ['tahfidz', '/halaqah?tab=setoran'],
]

export const appRouter = createBrowserRouter([
  // Halaman publik (tanpa login). /suspension/:token & /login tidak digate
  // maintenance: surat resmi wali harus tetap terjangkau dan developer butuh
  // login saat perbaikan (lihat PublicGate).
  {
    path: '/',
    element: (
      <ErrorBoundary>
        <PublicGate>
          <LandingPage />
        </PublicGate>
      </ErrorBoundary>
    ),
  },
  {
    path: '/check',
    element: (
      <ErrorBoundary>
        <PublicGate>
          <CheckPage />
        </PublicGate>
      </ErrorBoundary>
    ),
  },
  {
    path: '/verify',
    element: (
      <ErrorBoundary>
        <PublicGate>
          <VerifyPage />
        </PublicGate>
      </ErrorBoundary>
    ),
  },
  { path: '/suspension/:token', element: <ErrorBoundary><GuardianPage /></ErrorBoundary> },
  // Ujian CBT santri — tanpa maintenance gate agar ujian berjalan tidak terhalang.
  // Token TIDAK pernah lewat URL: santri mengetiknya di /exam, sesi disimpan
  // di sessionStorage dan di-replay lewat RPC yang sama saat refresh.
  { path: '/exam', element: <ErrorBoundary><ExamPage /></ErrorBoundary> },
  {
    path: '/login',
    element: <PublicRoute />,
    children: [{ index: true, element: <LoginPage /> }],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: (
          <ErrorBoundary>
            <MainLayout />
          </ErrorBoundary>
        ),
        children: [
          { path: 'dashboard', ...guarded('dashboard:read', <DashboardPage />) },
          { path: 'disiplin', ...guarded('disiplin:read', <DisiplinPage />) },
          { path: 'students', ...guarded('students:read', <StudentsPage />) },
          { path: 'teachers', ...guarded('teachers:read', <TeachersPage />) },
          { path: 'classes', ...guarded('classes:read', <ClassesPage />) },
          { path: 'academic-years', ...guarded('academic_years:read', <YearsPage />) },
          { path: 'subjects', ...guarded('subjects:read', <SubjectsPage />) },
          // Modul opsional — bisa dimatikan via flag module.* (tab Pengaturan Developer)
          { path: 'inventory', ...guarded('inventory:read', <ModuleGuard flag="module.inventory"><InventoryPage /></ModuleGuard>) },
          { path: 'schedules', ...guarded('schedules:read', <ModuleGuard flag="module.schedules"><SchedulesPage /></ModuleGuard>) },
          { path: 'halaqah', ...guarded('halaqah:read', <ModuleGuard flag="module.halaqah"><HalaqahPage /></ModuleGuard>) },
          { path: 'ekskul', ...guarded('ekskul:read', <ModuleGuard flag="module.ekskul"><EkskulPage /></ModuleGuard>) },
          { path: 'library', ...guarded('library:read', <ModuleGuard flag="module.library"><LibraryPage /></ModuleGuard>) },
          { path: 'savings', ...guarded('savings:read', <ModuleGuard flag="module.savings"><SavingsPage /></ModuleGuard>) },
          { path: 'dorms', ...guarded('dorms:read', <ModuleGuard flag="module.dorms"><DormsPage /></ModuleGuard>) },
          { path: 'gate', ...guarded('gate:read', <GatePage />) },
          { path: 'report-cards', ...guarded('report_cards:read', <ModuleGuard flag="module.report_cards"><CardsPage /></ModuleGuard>) },
          { path: 'report-cards/input/:classId', ...guarded('report_cards:read', <ModuleGuard flag="module.report_cards"><InputPage /></ModuleGuard>) },
          { path: 'report-cards/preview/:classId', ...guarded('report_cards:read', <ModuleGuard flag="module.report_cards"><PreviewPage /></ModuleGuard>) },
          { path: 'grades/:classSubjectId', ...guarded('grades:read', <ModuleGuard flag="module.grades"><GradeInput /></ModuleGuard>) },
          { path: 'grades', ...guarded('grades:read', <ModuleGuard flag="module.grades"><GradesPage /></ModuleGuard>) },
          { path: 'cbt', ...guarded('cbt:read', <ModuleGuard flag="module.cbt"><CbtPage /></ModuleGuard>) },
          { path: 'keuangan', ...guarded('keuangan:read', <ModuleGuard flag="module.keuangan_spp"><KeuanganPage /></ModuleGuard>) },
          { path: 'school', ...guarded('school:read', <ProfilePage />) },
          { path: 'attendance', ...guarded('attendance:read', <AttendancePage />) },
          { path: 'health', ...guarded('health:read', <ModuleGuard flag="module.health"><HealthPage /></ModuleGuard>) },
          { path: 'counseling', ...guarded('counseling:read', <ModuleGuard flag="module.counseling"><CounselingPage /></ModuleGuard>) },
          { path: 'leave-permit', ...guarded('leave_permit:read', <ModuleGuard flag="module.leave_permit"><PermitPage /></ModuleGuard>) },
          { path: 'announcements', ...guarded('announcements:read', <AnnouncementsPage />) },
          {
            // ─── Admin & developer tools (guard permission admin:access) ───
            path: 'admin',
            element: <RoleRoute perm="admin:access" />,
            children: [
              { index: true, element: page(<AdminPage />) },
            ],
          },
          // Alias lama — biarkan tautan/bookmark lama tetap berfungsi
          ...ALIAS_REDIRECTS.map(([path, to]) => ({
            path,
            element: <Navigate to={to} replace />,
          })),
          // Alias berparam — perlu interpolasi manual
          { path: 'suspensions/:id', element: <SuspensionIdRedirect /> },
          { path: 'boarding/suspension/:id', element: <SuspensionIdRedirect /> },
          { path: 'suspension/detail/:id', element: <SuspensionIdRedirect /> },
        ],
      },
    ],
  },
  // 404 publik — menangkap semua URL yang tidak dikenal
  { path: '*', element: <NotFoundPage /> },
])
