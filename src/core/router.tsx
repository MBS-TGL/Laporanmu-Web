import { lazy, Suspense } from 'react'
import { createBrowserRouter, Link, Navigate } from 'react-router-dom'
import { Button, Space, Spin, Typography } from 'antd'
import { MainLayout } from '../layouts/MainLayout'
import { ProtectedRoute, PublicRoute } from '../shared/components/ProtectedRoute'
import { RoleRoute } from '../shared/components/RoleRoute'
import { RouteErrorBoundary } from '../shared/components/RouteErrorBoundary'
import { LoginPage } from '../features/auth/LoginPage'

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
const StudentArchive = lazy(() =>
  import('../features/students/ArchivePage').then((m) => ({ default: m.ArchivePage })),
)
const AlumniPage = lazy(() =>
  import('../features/students/AlumniPage').then((m) => ({ default: m.AlumniPage })),
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
const RulesPage = lazy(() =>
  import('../features/behavior/RulesPage').then((m) => ({ default: m.RulesPage })),
)
const ReportsPage = lazy(() =>
  import('../features/behavior/ReportsPage').then((m) => ({ default: m.ReportsPage })),
)
const LogsPage = lazy(() =>
  import('../features/gate/LogsPage').then((m) => ({ default: m.LogsPage })),
)
const ReportCardsPage = lazy(() =>
  import('../features/report-cards/ReportCardsPage').then((m) => ({ default: m.ReportCardsPage })),
)
const InputPage = lazy(() =>
  import('../features/report-cards/InputPage').then((m) => ({ default: m.InputPage })),
)
const PreviewPage = lazy(() =>
  import('../features/report-cards/PreviewPage').then((m) => ({ default: m.PreviewPage })),
)
const ReportCardsArchive = lazy(() =>
  import('../features/report-cards/ArchivePage').then((m) => ({ default: m.ArchivePage })),
)
const SettingsPage = lazy(() =>
  import('../features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
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
const UsersPage = lazy(() =>
  import('../features/admin/UsersPage').then((m) => ({ default: m.UsersPage })),
)
const AuditPage = lazy(() =>
  import('../features/admin/AuditPage').then((m) => ({ default: m.AuditPage })),
)
const AdminDashboardPage = lazy(() =>
  import('../features/admin/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })),
)
const AdminDatabasePage = lazy(() =>
  import('../features/admin/DatabasePage').then((m) => ({ default: m.DatabasePage })),
)
const AdminStoragePage = lazy(() =>
  import('../features/admin/StoragePage').then((m) => ({ default: m.StoragePage })),
)
const AdminTasksPage = lazy(() =>
  import('../features/admin/TasksPage').then((m) => ({ default: m.TasksPage })),
)
const DeveloperSettingsPage = lazy(() =>
  import('../features/admin/DeveloperSettingsPage').then((m) => ({ default: m.DeveloperSettingsPage })),
)
const AnnouncementsPage = lazy(() =>
  import('../features/announcements/AnnouncementsPage').then((m) => ({ default: m.AnnouncementsPage })),
)
const CheckPage = lazy(() =>
  import('../features/public/CheckPage').then((m) => ({ default: m.CheckPage })),
)
const VerifyPage = lazy(() =>
  import('../features/public/VerifyPage').then((m) => ({ default: m.VerifyPage })),
)
const SuspensionPage = lazy(() =>
  import('../features/suspension/SuspensionPage').then((m) => ({ default: m.SuspensionPage })),
)
const DetailPage = lazy(() =>
  import('../features/suspension/DetailPage').then((m) => ({ default: m.DetailPage })),
)
const GuardianPage = lazy(() =>
  import('../features/suspension/GuardianPage').then((m) => ({ default: m.GuardianPage })),
)

function PageFallback() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
      <Spin size="large" />
    </div>
  )
}

function NotFoundPage() {
  return (
    <div
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
    </div>
  )
}

export const appRouter = createBrowserRouter([
  // Halaman publik (tanpa login)
  { path: '/', element: <RouteErrorBoundary><LandingPage /></RouteErrorBoundary> },
  { path: '/check', element: <RouteErrorBoundary><CheckPage /></RouteErrorBoundary> },
  { path: '/verify', element: <RouteErrorBoundary><VerifyPage /></RouteErrorBoundary> },
  { path: '/suspension/:token', element: <RouteErrorBoundary><GuardianPage /></RouteErrorBoundary> },
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
          <RouteErrorBoundary>
            <MainLayout />
          </RouteErrorBoundary>
        ),
        children: [
          { path: 'dashboard', element: <DashboardPage /> },
          {
            path: 'master/students',
            element: (
              <Suspense fallback={<PageFallback />}>
                <StudentsPage />
              </Suspense>
            ),
          },
          {
            path: 'master/students/archive',
            element: (
              <Suspense fallback={<PageFallback />}>
                <StudentArchive />
              </Suspense>
            ),
          },
          {
            path: 'master/students/alumni',
            element: (
              <Suspense fallback={<PageFallback />}>
                <AlumniPage />
              </Suspense>
            ),
          },
          {
            path: 'master/teachers',
            element: (
              <Suspense fallback={<PageFallback />}>
                <TeachersPage />
              </Suspense>
            ),
          },
          {
            path: 'master/classes',
            element: (
              <Suspense fallback={<PageFallback />}>
                <ClassesPage />
              </Suspense>
            ),
          },
          {
            path: 'master/academic-years',
            element: (
              <Suspense fallback={<PageFallback />}>
                <YearsPage />
              </Suspense>
            ),
          },
          {
            path: 'boarding/dorms',
            element: (
              <Suspense fallback={<PageFallback />}>
                <DormsPage />
              </Suspense>
            ),
          },
          {
            path: 'points/rules',
            element: (
              <Suspense fallback={<PageFallback />}>
                <RulesPage />
              </Suspense>
            ),
          },
          {
            path: 'points/reports',
            element: (
              <Suspense fallback={<PageFallback />}>
                <ReportsPage />
              </Suspense>
            ),
          },
          {
            path: 'gate/logs',
            element: (
              <Suspense fallback={<PageFallback />}>
                <LogsPage />
              </Suspense>
            ),
          },
          {
            path: 'report-cards',
            element: (
              <Suspense fallback={<PageFallback />}>
                <ReportCardsPage />
              </Suspense>
            ),
          },
          {
            path: 'report-cards/archive',
            element: (
              <Suspense fallback={<PageFallback />}>
                <ReportCardsArchive />
              </Suspense>
            ),
          },
          {
            path: 'report-cards/input/:classId',
            element: (
              <Suspense fallback={<PageFallback />}>
                <InputPage />
              </Suspense>
            ),
          },
          {
            path: 'report-cards/preview/:classId',
            element: (
              <Suspense fallback={<PageFallback />}>
                <PreviewPage />
              </Suspense>
            ),
          },
          {
            path: 'settings/school',
            element: (
              <Suspense fallback={<PageFallback />}>
                <SettingsPage />
              </Suspense>
            ),
          },
          {
            path: 'attendance',
            element: (
              <Suspense fallback={<PageFallback />}>
                <AttendancePage />
              </Suspense>
            ),
          },
          {
            path: 'boarding/health',
            element: (
              <Suspense fallback={<PageFallback />}>
                <HealthPage />
              </Suspense>
            ),
          },
          {
            path: 'boarding/counseling',
            element: (
              <Suspense fallback={<PageFallback />}>
                <CounselingPage />
              </Suspense>
            ),
          },
          {
            path: 'boarding/leave-permit',
            element: (
              <Suspense fallback={<PageFallback />}>
                <PermitPage />
              </Suspense>
            ),
          },
          {
            path: 'suspension',
            element: (
              <Suspense fallback={<PageFallback />}>
                <SuspensionPage />
              </Suspense>
            ),
          },
          {
            path: 'suspension/detail/:id',
            element: (
              <Suspense fallback={<PageFallback />}>
                <DetailPage />
              </Suspense>
            ),
          },
          {
            path: 'settings/announcements',
            element: (
              <Suspense fallback={<PageFallback />}>
                <AnnouncementsPage />
              </Suspense>
            ),
          },
          {
            // ─── Admin & developer tools (dev/admin saja) ───
            path: 'admin',
            element: <RoleRoute roles={['developer', 'admin']} />,
            children: [
              {
                index: true,
                element: (
                  <Suspense fallback={<PageFallback />}>
                    <AdminDashboardPage />
                  </Suspense>
                ),
              },
              {
                path: 'database',
                element: (
                  <Suspense fallback={<PageFallback />}>
                    <AdminDatabasePage />
                  </Suspense>
                ),
              },
              {
                path: 'storage',
                element: (
                  <Suspense fallback={<PageFallback />}>
                    <AdminStoragePage />
                  </Suspense>
                ),
              },
              {
                path: 'tasks',
                element: (
                  <Suspense fallback={<PageFallback />}>
                    <AdminTasksPage />
                  </Suspense>
                ),
              },
              {
                path: 'settings',
                element: (
                  <Suspense fallback={<PageFallback />}>
                    <DeveloperSettingsPage />
                  </Suspense>
                ),
              },
              {
                path: 'users',
                element: (
                  <Suspense fallback={<PageFallback />}>
                    <UsersPage />
                  </Suspense>
                ),
              },
              {
                path: 'audit-log',
                element: (
                  <Suspense fallback={<PageFallback />}>
                    <AuditPage />
                  </Suspense>
                ),
              },
            ],
          },
          // Alias lama — biarkan tautan/bookmark lama tetap berfungsi
          { path: 'settings/users', element: <Navigate to="/admin/users" replace /> },
          { path: 'settings/audit-log', element: <Navigate to="/admin/audit-log" replace /> },
        ],
      },
    ],
  },
  // 404 publik — menangkap semua URL yang tidak dikenal
  { path: '*', element: <NotFoundPage /> },
])
