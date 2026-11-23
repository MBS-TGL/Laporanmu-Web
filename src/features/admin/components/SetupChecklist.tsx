import { useMemo } from 'react'
import { Card, Progress, Skeleton, Typography, theme } from 'antd'
import { CheckCircleOutlined, MinusCircleOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { useIntegrityIssues, useTableStats } from '../hooks'

/**
 * Checklist onboarding setup sekolah: 5 langkah dasar yang harus lengkap
 * sebelum aplikasi dipakai operasional. Progress dihitung dari data
 * Supabase nyata (bukan status manual).
 */
export function SetupChecklist() {
  const { token } = theme.useToken()

  const statsQuery = useTableStats()
  const integrityQuery = useIntegrityIssues()

  // school_settings = tabel single-row (id = true) — head count = ada/tidak
  const profileQuery = useQuery({
    queryKey: ['admin', 'setup-school-profile'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('school_settings')
        .select('*', { count: 'exact', head: true })
        .eq('id', true)
      if (error) throw error
      return (count ?? 0) > 0
    },
    staleTime: 60_000,
  })

  const activeYearsQuery = useQuery({
    queryKey: ['admin', 'setup-active-years'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('academic_years')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
      if (error) throw error
      return count ?? 0
    },
    staleTime: 60_000,
  })

  const steps = useMemo(() => {
    const statOf = (key: string) => statsQuery.data?.find((t) => t.key === key)
    const classStat = statOf('classes')
    const teacherStat = statOf('teachers')
    const homeroomIssue = integrityQuery.data?.find((i) => i.id === 'classes_no_homeroom')
    return [
      { label: 'Profil sekolah terisi', done: profileQuery.data === true },
      { label: 'Kelas terdaftar', done: (classStat?.total ?? 0) > 0 },
      { label: 'Guru terdaftar', done: (teacherStat?.total ?? 0) > 0 },
      { label: 'Tahun akademik aktif', done: (activeYearsQuery.data ?? 0) >= 1 },
      {
        label: 'Wali kelas lengkap',
        done: (classStat?.total ?? 0) > 0 && (homeroomIssue?.count ?? 0) === 0,
      },
    ]
  }, [statsQuery.data, integrityQuery.data, profileQuery.data, activeYearsQuery.data])

  const loading = statsQuery.isPending || integrityQuery.isPending || profileQuery.isPending || activeYearsQuery.isPending
  const doneCount = steps.filter((s) => s.done).length
  const allDone = doneCount === steps.length

  return (
    <Card
      title="Checklist Setup Sekolah"
      size="small"
      style={{ height: '100%' }}
      styles={{ body: { display: 'flex', flexDirection: 'column' } }}
      extra={
        <Typography.Text type="secondary" style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
          {doneCount}/{steps.length}
        </Typography.Text>
      }
    >
      <Progress
        percent={Math.round((doneCount / steps.length) * 100)}
        size="small"
        strokeColor={allDone ? token.colorSuccess : token.colorPrimary}
        style={{ marginBottom: 12 }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, justifyContent: 'space-evenly' }}>
        {loading
          ? steps.map((_, i) => <Skeleton key={i} active paragraph={false} title={{ width: '40%' }} />)
          : steps.map((step) => (
              <span key={step.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {step.done ? (
                  <CheckCircleOutlined style={{ color: token.colorSuccess, fontSize: 14 }} />
                ) : (
                  <MinusCircleOutlined style={{ color: token.colorTextQuaternary, fontSize: 14 }} />
                )}
                <Typography.Text type={step.done ? undefined : 'secondary'} style={{ fontSize: 12.5 }}>
                  {step.label}
                </Typography.Text>
              </span>
            ))}
      </div>
      {!loading && !allDone && (
        <Typography.Text type="secondary" style={{ fontSize: 11.5, display: 'block', marginTop: 10 }}>
          Lengkapi lewat menu Pengaturan Sekolah, Tahun Akademik, Kelas, dan Guru di sidebar.
        </Typography.Text>
      )}
    </Card>
  )
}
