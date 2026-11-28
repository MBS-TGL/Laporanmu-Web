import { useMemo } from 'react'
import { Avatar, Tag, Tooltip, Typography, theme, type TableColumnsType } from 'antd'
import { FallOutlined, RiseOutlined } from '@ant-design/icons'
import { StatusTag } from '../../../shared/components/StatusTag'
import { SortIcon } from '../../../shared/components/SortIcon'
import { StudentName } from '../../../shared/components/StudentName'
import { ClassChip } from '../../../shared/components/ClassChip'
import { StudentActions } from './StudentActions'
import { columnSortOrder } from '../../../shared/utils/tableSort'
import { photoThumb } from '../../../shared/utils/photoThumb'
import { STUDENT_STATUS_META, GENDER_LABEL } from '../status'
import type { SortOption, Student, StudentStatus } from '../types'

const MASK = '••••••'

// Pasangan [asc, desc] per kolom — dipakai header tabel, dropdown "Urutkan", dan onChange sorter
export const SORT_PAIRS = {
  name: ['name_asc', 'name_desc'],
  class: ['class_asc', 'class_desc'],
  status: ['status_asc', 'status_desc'],
  total_points: ['points_asc', 'points_desc'],
} as const

function initials(name: string): string {
  return name.charAt(0).toUpperCase()
}

interface StudentColumnsDeps {
  privacy: boolean
  photos: Record<string, string>
  sortBy: SortOption | undefined
  /** Baris hasil filter — dipakai menyembunyikan kolom yang seragam */
  rows: Student[]
  canWrite: boolean
  canDelete: boolean
  onDetail: (student: Student) => void
  onCard: (student: Student) => void
  onEdit: (student: Student) => void
  onDelete: (id: string) => void
  /** klik chip tag pada kolom Siswa → set filter tag */
  onTagClick: (tag: string) => void
}

/** Kolom tabel siswa — Siswa (foto & nama tersamar saat mode privasi), Kelas, Status, Poin, Aksi */
export function useStudentColumns({
  privacy,
  photos,
  sortBy,
  rows,
  canWrite,
  canDelete,
  onDetail,
  onCard,
  onEdit,
  onDelete,
  onTagClick,
}: StudentColumnsDeps): TableColumnsType<Student> {
  const { token } = theme.useToken()
  // Kolom Status/Poin tidak memberi informasi saat semua baris hasil filter bernilai sama.
  const hideStatus = rows.length > 1 && rows.every((r) => r.status === rows[0].status)
  const hidePoints = rows.length > 1 && rows.every((r) => r.total_points === rows[0].total_points)

  return useMemo<TableColumnsType<Student>>(
    () => {
      // Ikon sorter gaya Esceha.id — template di shared/components/SortIcon.
      // Dibungkus fungsi: antd memanggil sortIcon sebagai fungsi biasa, jadi komponen
      // harus dirender sebagai elemen agar hooks-nya legal.
      const sortIcon = ({ sortOrder }: { sortOrder?: 'ascend' | 'descend' | null }) => (
        <SortIcon sortOrder={sortOrder} />
      )

      // Urutan kolom sinkron dengan state sortBy (dipakai juga dropdown "Urutkan")
      const sortOrderOf = (key: keyof typeof SORT_PAIRS) =>
        columnSortOrder(sortBy, key, SORT_PAIRS)

      const cols: TableColumnsType<Student> = [
        {
          title: 'Santri',
          dataIndex: 'name',
          key: 'name',
          sorter: true,
          sortIcon,
          sortOrder: sortOrderOf('name'),
          render: (_, row) => (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar
                size={32}
                src={privacy ? undefined : photoThumb(row.photo_url ?? photos[row.id])}
                style={{ background: token.colorPrimaryBg, color: token.colorPrimaryTextActive, fontWeight: 700, flexShrink: 0 }}
              >
                {privacy ? '*' : initials(row.name)}
              </Avatar>
              <div style={{ minWidth: 0 }}>
                <StudentName name={row.name} masked={privacy} onClick={() => onDetail(row)} />
                <div style={{ fontSize: 12, color: token.colorTextTertiary, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>
                    {row.gender ? `${GENDER_LABEL[row.gender]} · ` : ''}
                    {privacy ? MASK : row.registration_code}
                  </span>
                  {row.tags && row.tags.length > 0 && (
                    <span>
                      {row.tags.slice(0, 2).map((t) => (
                        <Tag
                          key={t}
                          onClick={(e) => {
                            e.stopPropagation()
                            onTagClick(t)
                          }}
                          style={{ borderRadius: 6, fontSize: 11, lineHeight: '16px', paddingInline: 5, cursor: 'pointer' }}
                        >
                          {t}
                        </Tag>
                      ))}
                      {row.tags.length > 2 && (
                        <Tooltip title={row.tags.slice(2).join(', ')}>
                          <Tag style={{ borderRadius: 6, fontSize: 11, lineHeight: '16px', paddingInline: 5 }}>
                            +{row.tags.length - 2}
                          </Tag>
                        </Tooltip>
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ),
        },
        {
          title: 'Kelas',
          key: 'class',
          sorter: true,
          sortIcon,
          sortOrder: sortOrderOf('class'),
          render: (_, row) => (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
              {row.classes?.name ? <ClassChip name={row.classes.name} /> : '-'}
              {row.dorms?.name && (
                <Tag
                  style={{
                    borderRadius: 6,
                    fontWeight: 500,
                    background: token.colorFillTertiary,
                    color: token.colorTextSecondary,
                    border: 'none',
                  }}
                >
                  {row.dorms.name}
                </Tag>
              )}
            </div>
          ),
        },
        {
          title: 'Status',
          dataIndex: 'status',
          key: 'status',
          width: 130,
          sorter: true,
          sortIcon,
          sortOrder: sortOrderOf('status'),
          render: (v: StudentStatus) => {
            const meta = STUDENT_STATUS_META[v]
            return (
              <StatusTag color={meta.color} icon={meta.icon}>
                {meta.label}
              </StatusTag>
            )
          },
        },
        {
          title: 'Poin',
          dataIndex: 'total_points',
          key: 'total_points',
          width: 100,
          sorter: true,
          sortIcon,
          // Klik pertama = tertinggi (desc) — arah angka yang paling sering dicari
          sortDirections: ['descend', 'ascend'],
          sortOrder: sortOrderOf('total_points'),
          render: (v: number) => (
            <Typography.Text
              strong
              style={{
                color: v < 0 ? token.colorError : v > 0 ? token.colorSuccess : undefined,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {v < 0 ? <FallOutlined /> : v > 0 ? <RiseOutlined /> : null}
              {v > 0 ? `+${v}` : v}
            </Typography.Text>
          ),
          responsive: ['md'],
        },
        {
          title: 'Aksi',
          key: 'actions',
          width: 170,
          render: (_, row) => (
            <StudentActions
              row={row}
              canWrite={canWrite}
              canDelete={canDelete}
              onDetail={onDetail}
              onCard={onCard}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ),
        },
      ]
      return cols.filter(
        (col) =>
          !(hideStatus && col.key === 'status') && !(hidePoints && col.key === 'total_points'),
      )
    },
    [sortBy, privacy, photos, canWrite, canDelete, token, onDetail, onCard, onEdit, onDelete, onTagClick, hideStatus, hidePoints],
  )
}
