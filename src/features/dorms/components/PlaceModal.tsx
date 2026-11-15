import { useMemo, useState } from 'react'
import { Alert, App, Button, Checkbox, Input, Select, Table, Tag, Typography, type TableColumnsType } from 'antd'
import { CopyOutlined, FileTextOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { useDistributeStudents, useDormRooms, useDorms, usePlacementOptions } from '../hooks'
import {
  matchTextBlocks,
  parseDormText,
  rowsToAssignments,
  type TextPlacementRow,
} from '../textPlace'

const PLACEHOLDER = `Mas Mansyur (16)
Wali Kamar : Aziz

1. Adli Malik
2. Azka Al Fatih
3. Akmal Pratama

Ibrahim (20)
1. Alif Ikbar Jauhari
2. Haidar Ali William`

interface PlaceModalProps {
  open: boolean
  onClose: () => void
}

/**
 * Penempatan via teks: user menempel daftar kamar + nama santri (gaya
 * WhatsApp), sistem mencocokkan tiap nama ke database dan menampilkan
 * preview sebelum diterapkan. Parser & matcher pure ada di textPlace.ts.
 */
export function PlaceModal({ open, onClose }: PlaceModalProps) {
  const { message } = App.useApp()
  const [text, setText] = useState('')
  // Kamar fallback untuk baris tanpa header; "paksa semua" mengabaikan header
  const [fallbackDormId, setFallbackDormId] = useState<string>()
  const [forceAll, setForceAll] = useState(false)
  const dormsQuery = useDorms()
  const roomsQuery = useDormRooms()
  const studentsQuery = usePlacementOptions()
  const distributeMutation = useDistributeStudents()

  const knownRoomNames = useMemo(
    () => (dormsQuery.data ?? []).map((d) => d.name),
    [dormsQuery.data],
  )
  const blocks = useMemo(
    () => (text.trim() ? parseDormText(text, { knownRoomNames }) : []),
    [text, knownRoomNames],
  )
  const preview = useMemo(
    () =>
      blocks.length && roomsQuery.data && studentsQuery.data
        ? matchTextBlocks(blocks, roomsQuery.data, studentsQuery.data, {
            fallbackDormId,
            forceDormId: forceAll ? fallbackDormId : undefined,
          })
        : null,
    [blocks, roomsQuery.data, studentsQuery.data, fallbackDormId, forceAll],
  )
  const readyAssignments = useMemo(
    () => (preview ? rowsToAssignments(preview.rows) : []),
    [preview],
  )
  const totalReady = readyAssignments.reduce((sum, a) => sum + a.studentIds.length, 0)
  const errorRows = preview?.rows.filter((r) => r.status === 'error') ?? []
  const roomWarnings = preview?.rooms.flatMap((r) => r.warnings.map((w) => `${r.roomName}: ${w}`)) ?? []

  const handleCopyFailed = async () => {
    try {
      await navigator.clipboard.writeText(errorRows.map((r) => r.raw).join('\n'))
      message.success(`${errorRows.length} nama gagal disalin ke clipboard`)
    } catch {
      message.error('Gagal menyalin ke clipboard')
    }
  }

  const resetAndClose = () => {
    setText('')
    setFallbackDormId(undefined)
    setForceAll(false)
    onClose()
  }

  const handleApply = () => {
    distributeMutation.mutate(
      { assignments: readyAssignments, mode: 'tempel-teks' },
      {
        onSuccess: (moved) => {
          resetAndClose()
          message.success(`${moved} santri berhasil ditempatkan ke kamar`)
        },
        onError: (err: Error) => message.error(err.message || 'Gagal menempatkan santri'),
      },
    )
  }

  const columns: TableColumnsType<TextPlacementRow> = [
    {
      title: 'Kamar',
      dataIndex: 'roomName',
      key: 'roomName',
      width: 150,
      // Blok anonim dengan fallback: tampilkan nama kamar yang resolved
      render: (v: string, row) => (
        <Typography.Text strong type={row.dormName ? undefined : 'danger'}>
          {row.dormName || v || '(tanpa kamar)'}
        </Typography.Text>
      ),
    },
    { title: 'Nama di Teks', dataIndex: 'raw', key: 'raw' },
    {
      title: 'Teridentifikasi',
      dataIndex: 'matchedName',
      key: 'matchedName',
      render: (v: string | null) =>
        v ? (
          <Typography.Text>{v}</Typography.Text>
        ) : (
          <Typography.Text type="secondary">-</Typography.Text>
        ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 200,
      render: (v: string, row) =>
        v === 'siap' ? (
          <Tag color="green" style={{ marginInlineEnd: 0 }}>
            Siap
          </Tag>
        ) : (
          <Typography.Text type="danger" style={{ fontSize: 12.5 }}>
            {row.message ?? 'Error'}
          </Typography.Text>
        ),
    },
  ]

  return (
    <AppModal
      title="Penempatan via Teks"
      subtitle="Tempel daftar kamar & santri (misalnya dari WhatsApp), nama dicocokkan otomatis ke database"
      icon={<FileTextOutlined />}
      open={open}
      onCancel={resetAndClose}
      onOk={handleApply}
      okText={`Tempatkan ${totalReady} Santri`}
      okButtonProps={{ disabled: totalReady === 0 }}
      confirmLoading={distributeMutation.isPending}
      width={760}
      destroyOnHidden
      maskClosable={false}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Input.TextArea
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={PLACEHOLDER}
          style={{ fontFamily: 'monospace', fontSize: 13 }}
        />

        {!text.trim() && (
          <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
            Format bebas: header "Nama Kamar (16)", "(16 orang)", "Kamar: nama1, nama2", daftar
            bernomor / bullet / koma, semuanya terbaca. Baris "Wali Kamar : ..." diabaikan
            otomatis. Emoji, huruf besar-kecil, dan typo kecil pada nama ditoleransi. Tanpa
            header? Pilih Kamar Fallback di bawah.
          </Typography.Text>
        )}

        {text.trim() && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Select
              placeholder="Kamar Fallback (untuk nama tanpa header)"
              allowClear
              showSearch
              optionFilterProp="label"
              style={{ minWidth: 260, flex: 1, maxWidth: 340 }}
              value={fallbackDormId}
              onChange={(v) => setFallbackDormId(v)}
              options={(roomsQuery.data ?? []).map((r) => ({
                value: r.id,
                label: `${r.name} (${r.occupied}/${r.capacity})`,
              }))}
            />
            {fallbackDormId && (
              <Checkbox
                checked={forceAll}
                onChange={(e) => setForceAll(e.target.checked)}
              >
                Paksa semua nama ke kamar ini (abaikan header)
              </Checkbox>
            )}
          </div>
        )}

        {preview && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <Typography.Text>
                <b>{preview.totalMatched}</b> dari {preview.rows.length} nama teridentifikasi di{' '}
                <b>{readyAssignments.length}</b> kamar.
              </Typography.Text>
              {errorRows.length > 0 && (
                <Button
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => void handleCopyFailed()}
                  style={{ marginInlineStart: 'auto' }}
                >
                  Salin nama gagal ({errorRows.length})
                </Button>
              )}
            </div>

            {roomWarnings.map((w) => (
              <Alert key={w} type="warning" showIcon message={w} style={{ padding: '4px 12px' }} />
            ))}

            {errorRows.length > 0 && (
              <Alert
                type="error"
                showIcon
                message={`${errorRows.length} nama tidak bisa diproses, baris ini dilewati saat diterapkan`}
                description={errorRows
                  .slice(0, 6)
                  .map((r) => `${r.raw}: ${r.message}`)
                  .join('; ')}
              />
            )}

            <Table
              rowKey={(r) => `${r.roomName}-${r.raw}-${r.studentId ?? 'err'}`}
              size="small"
              columns={columns}
              dataSource={preview.rows}
              pagination={{ pageSize: 50, showSizeChanger: false, hideOnSinglePage: true }}
              scroll={{ y: 300 }}
            />
          </>
        )}
      </div>
    </AppModal>
  )
}
