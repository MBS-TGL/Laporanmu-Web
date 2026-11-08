import { useState } from 'react'
import { App, Avatar, Button, Card, Input, Popconfirm, Table, Tooltip } from 'antd'
import { ReloadOutlined, SearchOutlined, UndoOutlined } from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { PageHeader } from '../../shared/components/PageHeader'
import { usePermissions } from '../../shared/hooks/useProfile'
import { useAlumni, useRevertGraduation } from './hooks'
import { DetailDrawer } from './components/DetailDrawer'
import type { Student } from './types'

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('')
}

/** Jejak siswa yang telah lulus: daftar alumni + profil + pembatalan kelulusan */
export function AlumniPage() {
  const { message } = App.useApp()
  const qc = useQueryClient()
  const { canWrite } = usePermissions()
  const [search, setSearch] = useState('')
  const [detail, setDetail] = useState<Student | null>(null)
  const alumniQuery = useAlumni(search)
  const revertMutation = useRevertGraduation()

  const handleRevert = (student: Student) => {
    revertMutation.mutate(student.id, {
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: ['students'] })
        message.success(`${student.name} dikembalikan menjadi siswa aktif`)
      },
      onError: (err: Error) => message.error(err.message || 'Gagal membatalkan kelulusan'),
    })
  }

  const rows = alumniQuery.data ?? []

  return (
    <div>
      <PageHeader
        title="Alumni"
        subtitle="Jejak siswa yang telah lulus — riwayat poin, raport, dan log tetap tersimpan"
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => alumniQuery.refetch()}>
            Muat Ulang
          </Button>
        }
      />

      <Card>
        <Input
          placeholder="Cari nama / kode / NISN"
          prefix={<SearchOutlined />}
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginBottom: 16, maxWidth: 360 }}
        />

        <Table<Student>
          rowKey="id"
          loading={alumniQuery.isPending}
          dataSource={rows}
          locale={{ emptyText: 'Belum ada alumni — siswa yang diluluskan akan muncul di sini' }}
          pagination={{ pageSize: 15, showSizeChanger: false, hideOnSinglePage: true }}
          columns={[
            {
              title: 'Siswa',
              key: 'name',
              render: (_, row) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar
                    size={34}
                    style={{ background: '#e0e7ff', color: '#3730a3', fontWeight: 700, fontSize: 13, flexShrink: 0 }}
                  >
                    {initials(row.name)}
                  </Avatar>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{row.name}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      {row.gender === 'P' ? 'Perempuan' : 'Laki-laki'} · {row.registration_code}
                    </div>
                  </div>
                </div>
              ),
            },
            {
              title: 'Kelas Terakhir',
              key: 'last_class',
              render: (_, row) => row.last_class?.name ?? row.classes?.name ?? '—',
            },
            {
              title: 'Tahun Lulus',
              dataIndex: 'graduation_year',
              key: 'graduation_year',
              width: 120,
              render: (v: number | null) => (v != null ? <strong>{v}</strong> : '—'),
            },
            {
              title: 'Tanggal Lulus',
              dataIndex: 'graduated_at',
              key: 'graduated_at',
              width: 140,
              render: (v: string | null) => (v ? dayjs(v).format('DD MMM YYYY') : '—'),
            },
            {
              title: 'Poin',
              dataIndex: 'total_points',
              key: 'total_points',
              width: 80,
              render: (v: number) => <strong>{v > 0 ? `+${v}` : v}</strong>,
            },
            {
              title: 'Aksi',
              key: 'aksi',
              width: 170,
              render: (_, row) => (
                <div style={{ display: 'flex', gap: 6 }}>
                  <Button size="small" onClick={() => setDetail(row)}>
                    Detail
                  </Button>
                  {canWrite && (
                    <Tooltip title="Kembalikan menjadi siswa aktif">
                      <Popconfirm
                        title="Batalkan kelulusan?"
                        description={`${row.name} akan kembali menjadi siswa aktif tanpa jejak kelulusan.`}
                        okText="Ya, Batalkan"
                        cancelText="Batal"
                        onConfirm={() => handleRevert(row)}
                      >
                        <Button size="small" icon={<UndoOutlined />} loading={revertMutation.isPending && revertMutation.variables === row.id} />
                      </Popconfirm>
                    </Tooltip>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>

      <DetailDrawer open={!!detail} student={detail} onClose={() => setDetail(null)} />
    </div>
  )
}
