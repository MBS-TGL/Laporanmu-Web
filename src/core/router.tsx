import { lazy, Suspense } from 'react'
import { createBrowserRouter, Link, Navigate } from 'react-router-dom'
import { Spin } from 'antd'
import { MainLayout } from '../layouts/MainLayout'
import { ProtectedRoute, PublicRoute } from '../shared/components/ProtectedRoute'
import { LoginPage } from '../features/auth/LoginPage'
import { DashboardPage } from '../features/dashboard/DashboardPage'

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
    <div style={{ textAlign: 'center', padding: '64px 16px' }}>
      <h2>404</h2>
      <p>Halaman tidak ditemukan.</p>
      <Link to="/dashboard">Kembali ke Dashboard</Link>
    </div>
  )
}

export const appRouter = createBrowserRouter([
  // Halaman publik (tanpa login)
  { path: '/cek', element: <ParentCheckPage /> },
  { path: '/verifikasi', element: <VerifyPage /> },
  { path: '/skorsing/:token', element: <SuspensionWaliPage /> },
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
          { index: true, element: <Navigate to="/dashboard" replace /> },
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
            path: 'poin/rules',
            element: (
              <Suspense fallback={<PageFallback />}>
                <PointRulesPage />
              </Suspense>
            ),
          },
          {
            path: 'poin/reports',
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
            path: 'raport',
            element: (
              <Suspense fallback={<PageFallback />}>
                <RaportPage />
              </Suspense>
            ),
          },
          {
            path: 'raport/arsip',
            element: (
              <Suspense fallback={<PageFallback />}>
                <RaportArchivePage />
              </Suspense>
            ),
          },
          {
            path: 'raport/input/:classId',
            element: (
              <Suspense fallback={<PageFallback />}>
                <RaportInputPage />
              </Suspense>
            ),
          },
          {
            path: 'raport/preview/:classId',
            element: (
              <Suspense fallback={<PageFallback />}>
                <RaportPreviewPage />
              </Suspense>
            ),
          },
          {
            path: 'pengaturan/sekolah',
            element: (
              <Suspense fallback={<PageFallback />}>
                <SchoolSettingsPage />
              </Suspense>
            ),
          },
          {
            path: 'absensi',
            element: (
              <Suspense fallback={<PageFallback />}>
                <AttendancePage />
              </Suspense>
            ),
          },
          {
            path: 'boarding/kesehatan',
            element: (
              <Suspense fallback={<PageFallback />}>
                <HealthPage />
              </Suspense>
            ),
          },
          {
            path: 'boarding/bk',
            element: (
              <Suspense fallback={<PageFallback />}>
                <CounselingPage />
              </Suspense>
            ),
          },
          {
            path: 'boarding/izin-pulang',
            element: (
              <Suspense fallback={<PageFallback />}>
                <LeavePermitPage />
              </Suspense>
            ),
          },
          {
            path: 'skorsing',
            element: (
              <Suspense fallback={<PageFallback />}>
                <SkorsingPage />
              </Suspense>
            ),
          },
          {
            path: 'skorsing/detail/:id',
            element: (
              <Suspense fallback={<PageFallback />}>
                <SkorsingDetailPage />
              </Suspense>
            ),
          },
          {
            path: 'pengaturan/pengguna',
            element: (
              <Suspense fallback={<PageFallback />}>
                <UsersPage />
              </Suspense>
            ),
          },
          {
            path: 'pengaturan/audit-log',
            element: (
              <Suspense fallback={<PageFallback />}>
                <AuditLogPage />
              </Suspense>
            ),
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
])
