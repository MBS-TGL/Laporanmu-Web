import { useMemo } from 'react'
import {
  Avatar,
  Button,
  Popconfirm,
  Space,
  Tooltip,
  theme,
  type TableColumnsType,
} from 'antd'
import { DeleteOutlined, IdcardOutlined, UndoOutlined } from '@ant-design/icons'
import { SortIcon } from '../../../shared/components/SortIcon'
import { columnSortOrder } from '../../../shared/utils/tableSort'
import { photoThumb } from '../../../shared/utils/photoThumb'
import { formatDisplayName } from '../../../shared/utils/displayName'
import type { useDeleteStudent, useRevertGraduation } from '../hooks'
import type { SortOption, Student } from '../types'

const MASK = '••••••'

/** Subset SortOption yang relevan untuk alumni — dipakai juga filter export server-side */
export type AlumniSort = Extract<
  SortOption,
  | 'name_asc'
  | 'name_desc'
  | 'graduated_desc'
  | 'graduated_asc'
  | 'year_desc'
  | 'year_asc'
  | 'points_desc'
  | 'points_asc'
>

// Pasangan [asc, desc] per kolom — dipakai header tabel, dropdown "Urutkan", dan onChange sorter
export const SORT_PAIRS = {
  name: ['name_asc', 'name_desc'],
  graduated_at: ['graduated_asc', 'graduated_desc'],
  graduation_year: ['year_asc', 'year_desc'],
  total_points: ['points_asc', 'points_desc'],
} as const

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('')
}

interface AlumniColumnsDeps {
  privacy: boolean
  photos: Record<string, string>
  pointsHistoryIds: Set<string>
  sortBy: AlumniSort
  canWrite: boolean
  canDelete: boolean
  revertMutation: ReturnType<typeof useRevertGraduation>
  deleteMutation: ReturnType<typeof useDeleteStudent>
  onDetail: (student: Student) => void
  onRevert: (student: Student) => void
  onDelete: (student: Student) => void
}

/** Kolom tabel alumni — Siswa (foto + nama tersamar saat privasi), Kelas Terakhir, Tahun/Tanggal Lulus, Poin, Aksi */
export function useAlumniColumns({
  privacy,
  photos,
  pointsHistoryIds,
  sortBy,
  canWrite,
  canDelete,
  revertMutation,
  deleteMutation,
  onDetail,
  onRevert,
  onDelete,
}: AlumniColumnsDeps): TableColumnsType<Student> {
  const { token } = theme.useToken()

  return useMemo<TableColumnsType<Student>>(
    () => {
      // Ikon sorter gaya Esceha.id — template di shared/components/SortIcon.
      // Dibungkus fungsi: antd memanggil sortIcon sebagai fungsi biasa, jadi komponen
      // harus dirender sebagai elemen agar hooks-nya legal.
      const sortIcon = ({ sortOrder }: { sortOrder?: 'ascend' | 'descend' | null }) => (
        <SortIcon sortOrder={sortOrder} />
      )

      return [
        {
          title: 'Santri',
          dataIndex: 'name',
          key: 'name',
          sorter: true,
          sortIcon,
          sortOrder: columnSortOrder(sortBy, 'name', SORT_PAIRS),
          render: (_, row) => (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar
                size={34}
                src={privacy ? undefined : photoThumb(row.photo_url ?? photos[row.id])}
                style={{ background: token.colorPrimaryBg, color: token.colorPrimaryTextActive, fontWeight: 700, fontSize: 13, flexShrink: 0 }}
              >
                {privacy ? '*' : initials(row.name)}
              </Avatar>
              <div style={{ minWidth: 0 }}>
                <Button
                  type="link"
                  style={{ padding: 0, height: 'auto', fontWeight: 600, fontSize: 13.5 }}
                  onClick={() => onDetail(row)}
                >
                  {privacy ? MASK : formatDisplayName(row.name)}
                </Button>
                <div style={{ fontSize: 12, color: token.colorTextTertiary }}>
                  {row.gender === 'P' ? 'Perempuan' : 'Laki-laki'} ·{' '}
                  {privacy ? MASK : row.registration_code}
                </div>
              </div>
            </div>
          ),
        },
        {
          title: 'Kelas Terakhir',
          key: 'last_class',
          responsive: ['md'],
          render: (_, row) => row.last_class?.name ?? row.classes?.name ?? '—',
        },
        {
          title: 'Tahun Lulus',
          dataIndex: 'graduation_year',
          key: 'graduation_year',
          width: 120,
          sorter: true,
          sortIcon,
          sortOrder: columnSortOrder(sortBy, 'graduation_year', SORT_PAIRS),
          render: (v: number | null) => (v != null ? <strong>{v}</strong> : '—'),
        },
        {
          title: 'Tanggal Lulus',
          dataIndex: 'graduated_at',
          key: 'graduated_at',
          width: 140,
          sorter: true,
          sortIcon,
          sortOrder: columnSortOrder(sortBy, 'graduated_at', SORT_PAIRS),
          responsive: ['lg'],
          render: (v: string | null) => (v ? new Date(v).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'),
        },
        {
          title: 'Poin',
          dataIndex: 'total_points',
          key: 'total_points',
          width: 90,
          sorter: true,
          sortIcon,
          sortOrder: columnSortOrder(sortBy, 'total_points', SORT_PAIRS),
          sortDirections: ['descend', 'ascend'],
          responsive: ['md'],
          render: (v: number, row) => {
            const hasHistory = pointsHistoryIds.has(row.id)
            if (!hasHistory) return '—'
            return <strong>{v > 0 ? `+${v}` : v}</strong>
          },
        },
        {
          title: 'Aksi',
          key: 'aksi',
          width: 150,
          render: (_, row) => (
            <Space size={0}>
              <Tooltip title="Lihat detail">
                <Button type="text" icon={<IdcardOutlined />} onClick={() => onDetail(row)} />
              </Tooltip>
              {canWrite && (
                <Tooltip title="Kembalikan menjadi siswa aktif">
                  <Popconfirm
                    title="Batalkan kelulusan?"
                    description={`${formatDisplayName(row.name)} akan kembali menjadi siswa aktif tanpa jejak kelulusan.`}
                    okText="Ya, Batalkan"
                    cancelText="Batal"
                    onConfirm={() => onRevert(row)}
                  >
                    <Button
                      type="text"
                      icon={<UndoOutlined />}
                      loading={revertMutation.isPending && revertMutation.variables === row.id}
                    />
                  </Popconfirm>
                </Tooltip>
              )}
              {canDelete && (
                <Tooltip title="Hapus alumni">
                  <Popconfirm
                    title="Hapus alumni ini?"
                    description={`${formatDisplayName(row.name)} akan dipindahkan ke arsip.`}
                    okText="Ya, Hapus"
                    okButtonProps={{ danger: true }}
                    cancelText="Batal"
                    onConfirm={() => onDelete(row)}
                  >
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      loading={deleteMutation.isPending && deleteMutation.variables === row.id}
                    />
                  </Popconfirm>
                </Tooltip>
              )}
            </Space>
          ),
        },
      ]
    },
    [privacy, photos, pointsHistoryIds, sortBy, canWrite, canDelete, revertMutation, deleteMutation, token, onDetail, onRevert, onDelete],
  )
}
