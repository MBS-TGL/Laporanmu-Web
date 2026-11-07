import { lazy, Suspense } from 'react'
import { createBrowserRouter, Link } from 'react-router-dom'
import { Button, Space, Spin, Typography } from 'antd'
import { MainLayout } from '../layouts/MainLayout'
import { ProtectedRoute, PublicRoute } from '../shared/components/ProtectedRoute'
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
const StudentArchivePage = lazy(() =>
  import('../features/students/StudentArchivePage').then((m) => ({ default: m.StudentArchivePage })),
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
const AcademicYearsPage = lazy(() =>
  import('../features/academic-years/AcademicYearsPage').then((m) => ({ default: m.AcademicYearsPage })),
)
const PointRulesPage = lazy(() =>
  import('../features/behavior/PointRulesPage').then((m) => ({ default: m.PointRulesPage })),
)
const BehaviorReportsPage = lazy(() =>
  import('../features/behavior/BehaviorReportsPage').then((m) => ({ default: m.BehaviorReportsPage })),
)
const GateLogsPage = lazy(() =>
  import('../features/gate/GateLogsPage').then((m) => ({ default: m.GateLogsPage })),
)
const RaportPage = lazy(() =>
  import('../features/raport/RaportPage').then((m) => ({ default: m.RaportPage })),
)
const RaportInputPage = lazy(() =>
  import('../features/raport/RaportInputPage').then((m) => ({ default: m.RaportInputPage })),
)
const RaportPreviewPage = lazy(() =>
  import('../features/raport/RaportPreviewPage').then((m) => ({ default: m.RaportPreviewPage })),
)
const RaportArchivePage = lazy(() =>
  import('../features/raport/RaportArchivePage').then((m) => ({ default: m.RaportArchivePage })),
)
const SchoolSettingsPage = lazy(() =>
  import('../features/settings/SchoolSettingsPage').then((m) => ({ default: m.SchoolSettingsPage })),
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
const LeavePermitPage = lazy(() =>
  import('../features/leave-permit/LeavePermitPage').then((m) => ({ default: m.LeavePermitPage })),
)
const UsersPage = lazy(() =>
  import('../features/admin/UsersPage').then((m) => ({ default: m.UsersPage })),
)
const AuditLogPage = lazy(() =>
  import('../features/admin/AuditLogPage').then((m) => ({ default: m.AuditLogPage })),
)
const AnnouncementsPage = lazy(() =>
  import('../features/announcements/AnnouncementsPage').then((m) => ({ default: m.AnnouncementsPage })),
)
const ParentCheckPage = lazy(() =>
  import('../features/public/ParentCheckPage').then((m) => ({ default: m.ParentCheckPage })),
)
const VerifyPage = lazy(() =>
  import('../features/public/VerifyPage').then((m) => ({ default: m.VerifyPage })),
)
const SkorsingPage = lazy(() =>
  import('../features/suspension/SkorsingPage').then((m) => ({ default: m.SkorsingPage })),
)
const SkorsingDetailPage = lazy(() =>
  import('../features/suspension/SkorsingDetailPage').then((m) => ({ default: m.SkorsingDetailPage })),
)
const SuspensionWaliPage = lazy(() =>
  import('../features/suspension/SuspensionWaliPage').then((m) => ({ default: m.SuspensionWaliPage })),
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
  { path: '/', element: <LandingPage /> },
  { path: '/check', element: <ParentCheckPage /> },
  { path: '/verify', element: <VerifyPage /> },
  { path: '/suspension/:token', element: <SuspensionWaliPage /> },
  {
    path: '/login',
    element: <PublicRoute />,
    children: [{ index: true, element: <LoginPage /> }],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <MainLayout />,
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
                <StudentArchivePage />
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
                <AcademicYearsPage />
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
                <PointRulesPage />
              </Suspense>
            ),
          },
          {
            path: 'points/reports',
            element: (
              <Suspense fallback={<PageFallback />}>
                <BehaviorReportsPage />
              </Suspense>
            ),
          },
          {
            path: 'gate/logs',
            element: (
              <Suspense fallback={<PageFallback />}>
                <GateLogsPage />
              </Suspense>
            ),
          },
          {
            path: 'report-cards',
            element: (
              <Suspense fallback={<PageFallback />}>
                <RaportPage />
              </Suspense>
            ),
          },
          {
            path: 'report-cards/archive',
            element: (
              <Suspense fallback={<PageFallback />}>
                <RaportArchivePage />
              </Suspense>
            ),
          },
          {
            path: 'report-cards/input/:classId',
            element: (
              <Suspense fallback={<PageFallback />}>
                <RaportInputPage />
              </Suspense>
            ),
          },
          {
            path: 'report-cards/preview/:classId',
            element: (
              <Suspense fallback={<PageFallback />}>
                <RaportPreviewPage />
              </Suspense>
            ),
          },
          {
            path: 'settings/school',
            element: (
              <Suspense fallback={<PageFallback />}>
                <SchoolSettingsPage />
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
                <LeavePermitPage />
              </Suspense>
            ),
          },
          {
            path: 'suspension',
            element: (
              <Suspense fallback={<PageFallback />}>
                <SkorsingPage />
              </Suspense>
            ),
          },
          {
            path: 'suspension/detail/:id',
            element: (
              <Suspense fallback={<PageFallback />}>
                <SkorsingDetailPage />
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
            path: 'settings/users',
            element: (
              <Suspense fallback={<PageFallback />}>
                <UsersPage />
              </Suspense>
            ),
          },
          {
            path: 'settings/audit-log',
            element: (
              <Suspense fallback={<PageFallback />}>
                <AuditLogPage />
              </Suspense>
            ),
          },
        ],
      },
    ],
  },
  // 404 publik — menangkap semua URL yang tidak dikenal
  { path: '*', element: <NotFoundPage /> },
])
