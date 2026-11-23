import { useMemo } from 'react'
import { Button, Popconfirm, Space, Tag, Tooltip, theme, type TableColumnsType } from 'antd'
import { DeleteOutlined, EditOutlined, IdcardOutlined, WarningOutlined } from '@ant-design/icons'
import { SortIcon } from '../../../shared/components/SortIcon'
import { columnSortOrder } from '../../../shared/utils/tableSort'
import type { ClassRow, ClassSort } from '../types'

// Pasangan [asc, desc] per kolom — dipakai header tabel, dropdown "Urutkan", dan onChange sorter
export const SORT_PAIRS = {
  name: ['name_asc', 'name_desc'],
  grade: ['grade_asc', 'grade_desc'],
  count: ['count_asc', 'count_desc'],
} as const

interface ClassColumnsDeps {
  sortBy: ClassSort | undefined
  canWrite: boolean
  canDelete: boolean
  /** Jumlah santri aktif per kelas id (cache gender-counts halaman) */
  countsMap: Map<string, { total: number; male: number; female: number }>
  onDetail: (cls: ClassRow) => void
  onEdit: (cls: ClassRow) => void
  onDelete: (cls: ClassRow) => void
}

/** Kolom tabel kelas — Kelas (warn tanpa wali), Tingkat, TA, Wali, Jumlah Siswa, Aksi */
export function useClassColumns({
  sortBy,
  canWrite,
  canDelete,
  countsMap,
  onDetail,
  onEdit,
  onDelete,
}: ClassColumnsDeps): TableColumnsType<ClassRow> {
  const { token } = theme.useToken()

  return useMemo<TableColumnsType<ClassRow>>(() => {
    // Ikon sorter gaya Esceha.id — template di shared/components/SortIcon.
    // Dibungkus fungsi: antd memanggil sortIcon sebagai fungsi biasa, jadi komponen
    // harus dirender sebagai elemen agar hooks-nya legal.
    const sortIcon = ({ sortOrder }: { sortOrder?: 'ascend' | 'descend' | null }) => (
      <SortIcon sortOrder={sortOrder} />
    )
    const sortOrderOf = (key: keyof typeof SORT_PAIRS) => columnSortOrder(sortBy, key, SORT_PAIRS)

    return [
      {
        title: 'Kelas',
        dataIndex: 'name',
        key: 'name',
        sorter: true,
        sortIcon,
        sortOrder: sortOrderOf('name'),
        render: (_, row) => (
          <div>
            <Space size={4}>
              <Button
                type="link"
                style={{ padding: 0, height: 'auto', fontWeight: 600, fontSize: 14 }}
                onClick={() => onDetail(row)}
              >
                {row.name}
              </Button>
              {!row.homeroom_teacher_id && (
                <Tooltip title="Tanpa wali kelas">
                  <WarningOutlined style={{ color: token.colorWarning }} />
                </Tooltip>
              )}
            </Space>
            {row.major && (
              <div style={{ fontSize: 12, color: token.colorTextTertiary }}>{row.major}</div>
            )}
          </div>
        ),
      },
      {
        title: 'Tingkat',
        dataIndex: 'grade',
        key: 'grade',
        width: 110,
        sorter: true,
        sortIcon,
        sortOrder: sortOrderOf('grade'),
        render: (v: string | null) => (v ? <Tag>{v}</Tag> : '-'),
      },
      {
        title: 'Tahun Akademik',
        key: 'year',
        responsive: ['md'],
        render: (_, row) => row.academic_year?.name || '-',
      },
      {
        title: 'Wali Kelas',
        key: 'homeroom',
        render: (_, row) => row.homeroom_teacher?.name || <Tag color="warning">Belum ada</Tag>,
      },
      {
        title: 'Jumlah Santri',
        key: 'count',
        width: 130,
        sorter: true,
        sortIcon,
        sortOrder: sortOrderOf('count'),
        responsive: ['md'],
        render: (_, row) => {
          const g = countsMap.get(row.id)
          return (
            <div>
              <strong>{g?.total ?? 0}</strong>
              {g && g.total > 0 && (
                <div style={{ fontSize: 11.5, color: token.colorTextTertiary }}>
                  L {g.male} · P {g.female}
                </div>
              )}
            </div>
          )
        },
      },
      {
        title: 'Aksi',
        key: 'actions',
        width: 140,
        render: (_, row) => (
          <Space size={0}>
            <Tooltip title="Lihat detail">
              <Button
                type="text"
                aria-label="Lihat detail kelas"
                icon={<IdcardOutlined />}
                onClick={() => onDetail(row)}
              />
            </Tooltip>
            {canWrite && (
              <Tooltip title="Edit">
                <Button
                  type="text"
                  aria-label="Edit kelas"
                  icon={<EditOutlined />}
                  onClick={() => onEdit(row)}
                />
              </Tooltip>
            )}
            {canDelete && (
              <Popconfirm
                title="Arsipkan kelas ini?"
                description="Data ditandai terhapus dan bisa dipulihkan lewat menu Arsip."
                onConfirm={() => onDelete(row)}
                okText="Ya, Arsipkan"
                cancelText="Batal"
              >
                <Tooltip title="Arsipkan">
                  <Button type="text" danger aria-label="Arsipkan kelas" icon={<DeleteOutlined />} />
                </Tooltip>
              </Popconfirm>
            )}
          </Space>
        ),
      },
    ]
  }, [sortBy, canWrite, canDelete, countsMap, token, onDetail, onEdit, onDelete])
}
