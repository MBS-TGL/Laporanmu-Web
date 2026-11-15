import { useMemo, useState } from 'react'
import {
  Button,
  Card,
  Empty,
  Input,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  theme,
  type TableColumnsType,
} from 'antd'
import {
  DeleteOutlined,
  FileTextOutlined,
  PlusOutlined,
  PrinterOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { PageHeader } from '../../../shared/components/PageHeader'
import { StatChip } from '../../../shared/components/StatChip'
import { usePermissions } from '../../../shared/hooks/useProfile'
import { useDeleteOfficialLetter, useOfficialLetters } from './hooks'
import { LetterModal } from './LetterModal'
import { PrintModal } from './PrintModal'
import {
  LETTER_TYPE_META,
  type OfficialLetter,
  type OfficialLetterType,
} from './types'

export function LettersPage() {
  const { token } = theme.useToken()
  const { canWrite, canDelete } = usePermissions()

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string | undefined>()
  const [createOpen, setCreateOpen] = useState(false)
  const [printLetter, setPrintLetter] = useState<OfficialLetter | null>(null)

  const lettersQuery = useOfficialLetters()
  const deleteMutation = useDeleteOfficialLetter()
  const letters = lettersQuery.data ?? []

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return letters.filter((l) => {
      if (typeFilter && l.type !== typeFilter) return false
      if (!q) return true
      return (
        l.letter_no.toLowerCase().includes(q) ||
        l.subject.toLowerCase().includes(q) ||
        (l.students?.name && l.students.name.toLowerCase().includes(q)) ||
        (l.students?.registration_code && l.students.registration_code.toLowerCase().includes(q))
      )
    })
  }, [letters, search, typeFilter])

  const counts = useMemo(() => {
    return {
      total: letters.length,
      panggilan: letters.filter((l) => l.type === 'panggilan').length,
      peringatan: letters.filter((l) => l.type === 'peringatan').length,
      pujian: letters.filter((l) => l.type === 'pujian').length,
    }
  }, [letters])

  const columns: TableColumnsType<OfficialLetter> = [
    {
      title: 'Nomor & Tanggal',
      key: 'no',
      width: 220,
      render: (_, r) => (
        <div>
          <span style={{ fontWeight: 600 }}>{r.letter_no}</span>
          <div style={{ fontSize: 11.5, color: token.colorTextTertiary }}>
            {new Date(r.issued_date).toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </div>
        </div>
      ),
    },
    {
      title: 'Santri & Kelas',
      key: 'student',
      render: (_, r) => (
        <div>
          <span style={{ fontWeight: 600 }}>{r.students?.name ?? '—'}</span>
          <div style={{ fontSize: 11.5, color: token.colorTextTertiary }}>
            {r.students?.registration_code} {r.students?.classes?.name ? `· ${r.students.classes.name}` : ''}
          </div>
        </div>
      ),
    },
    {
      title: 'Jenis Surat',
      dataIndex: 'type',
      key: 'type',
      width: 170,
      render: (t: OfficialLetterType) => {
        const meta = LETTER_TYPE_META[t]
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: 'Perihal',
      dataIndex: 'subject',
      key: 'subject',
      ellipsis: true,
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 120,
      align: 'right',
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Cetak Surat">
            <Button
              type="text"
              size="small"
              icon={<PrinterOutlined />}
              onClick={() => setPrintLetter(r)}
            />
          </Tooltip>
          {canDelete && (
            <Popconfirm
              title="Hapus arsip surat ini?"
              onConfirm={() => deleteMutation.mutate(r.id)}
              okText="Hapus"
              cancelText="Batal"
            >
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Surat Resmi BK & Kesiswaan"
        subtitle="Penerbitan surat panggilan orang tua, surat peringatan (SP), dan piagam penghargaan resmi dengan QR verifikasi."
        extra={
          <Space wrap>
            <Tooltip title="Muat Ulang">
              <Button
                icon={<ReloadOutlined spin={lettersQuery.isFetching} />}
                onClick={() => void lettersQuery.refetch()}
              />
            </Tooltip>
            {canWrite && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setCreateOpen(true)}
              >
                Terbitkan Surat
              </Button>
            )}
          </Space>
        }
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <StatChip
          icon={<FileTextOutlined />}
          label="Total Surat Terbit"
          value={counts.total}
          color="indigo"
          loading={lettersQuery.isPending}
        />
        <StatChip
          icon={<FileTextOutlined />}
          label="Panggilan Ortu"
          value={counts.panggilan}
          color={counts.panggilan > 0 ? 'rose' : 'slate'}
          loading={lettersQuery.isPending}
        />
        <StatChip
          icon={<FileTextOutlined />}
          label="Peringatan (SP)"
          value={counts.peringatan}
          color={counts.peringatan > 0 ? 'amber' : 'slate'}
          loading={lettersQuery.isPending}
        />
        <StatChip
          icon={<FileTextOutlined />}
          label="Pujian / Prestasi"
          value={counts.pujian}
          color="emerald"
          loading={lettersQuery.isPending}
        />
      </div>

      <Card>
        <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          <Input
            placeholder="Cari nomor surat, nama santri, atau perihal..."
            prefix={<SearchOutlined />}
            allowClear
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 320 }}
          />
          <Select
            placeholder="Semua Jenis Surat"
            allowClear
            style={{ width: 180 }}
            value={typeFilter}
            onChange={setTypeFilter}
            options={Object.entries(LETTER_TYPE_META).map(([val, meta]) => ({
              value: val,
              label: meta.label,
            }))}
          />
        </div>

        <Table<OfficialLetter>
          rowKey="id"
          size="middle"
          columns={columns}
          dataSource={filtered}
          loading={lettersQuery.isPending}
          pagination={{ pageSize: 15, showTotal: (t) => `Total ${t} surat` }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Belum ada surat resmi yang diterbitkan"
              />
            ),
          }}
        />
      </Card>

      <LetterModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />

      <PrintModal
        open={!!printLetter}
        letter={printLetter}
        onClose={() => setPrintLetter(null)}
      />
    </div>
  )
}
