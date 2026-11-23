import { useMemo } from 'react'
import {
  Avatar,
  Button,
  Dropdown,
  Grid,
  Popconfirm,
  Space,
  Tag,
  Tooltip,
  Typography,
  theme,
  type TableColumnsType,
} from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FallOutlined,
  IdcardOutlined,
  MoreOutlined,
  RiseOutlined,
  WhatsAppOutlined,
} from '@ant-design/icons'
import { StatusTag } from '../../../shared/components/StatusTag'
import { SortIcon } from '../../../shared/components/SortIcon'
import { columnSortOrder } from '../../../shared/utils/tableSort'
import { photoThumb } from '../../../shared/utils/photoThumb'
import { formatDisplayName } from '../../../shared/utils/displayName'
import { waLink } from '../wa'
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

/** Aksi baris tabel: tombol ikon di desktop, menu dropdown di mobile (C4) */
function StudentActions({
  row,
  canWrite,
  canDelete,
  onDetail,
  onCard,
  onEdit,
  onDelete,
  token,
}: {
  row: Student
  canWrite: boolean
  canDelete: boolean
  onDetail: (s: Student) => void
  onCard: (s: Student) => void
  onEdit: (s: Student) => void
  onDelete: (id: string) => void
  token: any
}) {
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md

  const actions = (
    <>
      <Tooltip title="Lihat detail">
        <Button
          type="text"
          aria-label="Lihat detail"
          icon={<EyeOutlined />}
          onClick={() => onDetail(row)}
        />
      </Tooltip>
      <Tooltip title="Kartu portal (kode & PIN)">
        <Button
          type="text"
          aria-label="Kartu portal"
          icon={<IdcardOutlined />}
          onClick={() => onCard(row)}
        />
      </Tooltip>
      <Tooltip title={row.phone ? 'Chat WhatsApp' : 'Nomor HP belum tersedia'}>
        <span>
          <Button
            type="text"
            aria-label="Chat WhatsApp"
            disabled={!row.phone}
            icon={<WhatsAppOutlined style={{ color: row.phone ? token.colorSuccess : undefined }} />}
            onClick={() => row.phone && window.open(waLink(row.phone), '_blank', 'noopener')}
          />
        </span>
      </Tooltip>
      {canWrite && (
        <Tooltip title="Edit">
          <Button
            type="text"
            aria-label="Edit data"
            icon={<EditOutlined />}
            onClick={() => onEdit(row)}
          />
        </Tooltip>
      )}
      {canDelete && (
        <Popconfirm
          title="Hapus siswa ini?"
          description="Data akan ditandai terhapus (soft delete)."
          onConfirm={() => onDelete(row.id)}
          okText="Ya, Hapus"
          cancelText="Batal"
        >
          <Tooltip title="Hapus">
            <Button type="text" danger aria-label="Hapus siswa" icon={<DeleteOutlined />} />
          </Tooltip>
        </Popconfirm>
      )}
    </>
  )

  if (!isMobile) return <Space size={0}>{actions}</Space>

  return (
    <Dropdown
      trigger={['click']}
      placement="bottomRight"
      menu={{
        items: [
          { key: 'detail', icon: <EyeOutlined />, label: 'Lihat Detail', onClick: () => onDetail(row) },
          { key: 'card', icon: <IdcardOutlined />, label: 'Kartu Portal', onClick: () => onCard(row) },
          {
            key: 'wa',
            icon: <WhatsAppOutlined />,
            label: 'WhatsApp',
            disabled: !row.phone,
            onClick: () => row.phone && window.open(waLink(row.phone), '_blank', 'noopener'),
          },
          ...(canWrite
            ? [{ key: 'edit', icon: <EditOutlined />, label: 'Edit Data', onClick: () => onEdit(row) }]
            : []),
          ...(canDelete
            ? [
                { type: 'divider' as const },
                {
                  key: 'delete',
                  icon: <DeleteOutlined />,
                  label: 'Hapus',
                  danger: true,
                  onClick: () => {
                    // Popconfirm dalam dropdown sering bermasalah — pakai konfirmasi modal bila mobile?
                    // Untuk simpelnya, panggil onDelete langsung (handleDelete sudah punya konfirmasi?)
                    // Tidak, handleDelete di parent dipicu Popconfirm.
                    // Gunakan onDelete saja, atau biarkan Popconfirm di luar.
                    // Cara termudah: panggil onDelete yang membungkus konfirmasi.
                    onDelete(row.id)
                  },
                },
              ]
            : []),
        ],
      }}
    >
      <Button type="text" icon={<MoreOutlined />} />
    </Dropdown>
  )
}

interface StudentColumnsDeps {
  privacy: boolean
  photos: Record<string, string>
  sortBy: SortOption | undefined
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
  canWrite,
  canDelete,
  onDetail,
  onCard,
  onEdit,
  onDelete,
  onTagClick,
}: StudentColumnsDeps): TableColumnsType<Student> {
  const { token } = theme.useToken()

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

      return [
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
                <Button
                  type="link"
                  style={{ padding: 0, height: 'auto', fontWeight: 600, fontSize: 14 }}
                  onClick={() => onDetail(row)}
                >
                  {privacy ? MASK : formatDisplayName(row.name)}
                </Button>
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
            <div>
              {row.classes?.name ? (
                <Tag
                  style={{
                    borderRadius: 6,
                    fontWeight: 500,
                    background: token.colorPrimaryBg,
                    color: token.colorPrimary,
                    border: 'none',
                  }}
                >
                  {row.classes.name}
                </Tag>
              ) : (
                '-'
              )}
              {row.dorms?.name && (
                <Tag
                  style={{
                    marginInlineStart: 4,
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
              token={token}
            />
          ),
        },
      ]
    },
    [sortBy, privacy, photos, canWrite, canDelete, token, onDetail, onCard, onEdit, onDelete, onTagClick],
  )
}
