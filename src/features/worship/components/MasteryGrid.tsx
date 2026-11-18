import { useCallback, useMemo, useState } from 'react'
import {
  App,
  Card,
  Empty,
  Select,
  Space,
  Table,
  Tooltip,
  Typography,
  theme,
} from 'antd'
import { CheckOutlined, StarFilled, StarOutlined, ThunderboltOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useStudentDetail } from '../../students/useStudentDetail'
import { ActionBar, type BulkActionItem } from '../../../shared/components/ActionBar'
import { AppModal } from '../../../shared/components/AppModal'
import { useUpsertWorshipMastery } from '../hooks'
import { maybeSendMasteryWa } from '../waAuto'
import type { WorshipCategory, WorshipItem } from '../types'

const cellKey = (studentId: string, itemId: string) => `${studentId}:${itemId}`

/** "MOH MAKSIM MALAKAI" -> "Moh Maksim Malakai" (lebih mudah dibaca). */
const titleCase = (s: string) =>
  s.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase())

/** Bar progres tipis tanpa dependensi versi antd. */
function MiniBar({ percent, color, track, width }: { percent: number; color: string; track: string; width: number | string }) {
  return (
    <div style={{ width, height: 4, borderRadius: 2, background: track, overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ width: `${Math.max(0, Math.min(100, percent))}%`, height: '100%', background: color, borderRadius: 2 }} />
    </div>
  )
}

interface StudentBrief {
  id: string
  name: string
}

type ItemBrief = Pick<WorshipItem, 'id' | 'label'>

interface MasteryGridProps {
  category: WorshipCategory
  items: ItemBrief[]
  students: StudentBrief[]
  mastery: Array<{ student_id: string; item_id: string; mastered: boolean }>
  starsByStudent: Map<string, number>
  search: string
  canWrite: boolean
  onOpenSpiritualDrawer?: (student: StudentBrief) => void
  deleting?: boolean
  onDeleteItem?: (id: string) => void
}

/**
 * Papan Kemahiran Ibadah: matriks santri × butir ibadah dengan bintang interaktif.
 * Dilengkapi dengan selection massal (ActionBar) untuk penilaian kelompok di asrama.
 */
export function MasteryGrid({
  category,
  items,
  students,
  mastery,
  starsByStudent,
  search,
  canWrite,
  onOpenSpiritualDrawer,
}: MasteryGridProps) {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const { open: openStudentDetail } = useStudentDetail()
  const upsert = useUpsertWorshipMastery(category)

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])

  const serverMap = useMemo(() => {
    const map = new Map<string, boolean>()
    for (const m of mastery) map.set(cellKey(m.student_id, m.item_id), m.mastered)
    return map
  }, [mastery])

  // Jumlah santri terampil per butir (untuk subjudul kolom)
  const masteredByItem = useMemo(() => {
    const map = new Map<string, number>()
    for (const m of mastery) {
      if (m.mastered) map.set(m.item_id, (map.get(m.item_id) ?? 0) + 1)
    }
    return map
  }, [mastery])

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return students
    return students.filter((s) => s.name.toLowerCase().includes(q))
  }, [students, search])

  const toggle = useCallback(
    async (student: StudentBrief, item: ItemBrief) => {
      const current = serverMap.get(cellKey(student.id, item.id)) ?? false
      const next = !current
      try {
        await upsert.mutateAsync([
          {
            student_id: student.id,
            item_id: item.id,
            mastered: next,
            mastered_at: next ? dayjs().format('YYYY-MM-DD') : null,
            recorded_by: null,
          },
        ])
        if (next) void maybeSendMasteryWa(student.id, item.id, category, item.label)
      } catch (err) {
        message.error((err as Error).message || 'Gagal menyimpan kemahiran')
      }
    },
    [serverMap, upsert, category, message],
  )

  // Aksi Massal: Tandai Terampil atau Reset banyak santri sekaligus
  const handleBulkMastery = async (itemId: string, mastered: boolean) => {
    if (selectedRowKeys.length === 0) return
    const targetItem = items.find((i) => i.id === itemId)
    if (!targetItem) return

    const now = dayjs().format('YYYY-MM-DD')
    const payload = selectedRowKeys.map((sId) => ({
      student_id: String(sId),
      item_id: itemId,
      mastered,
      mastered_at: mastered ? now : null,
      recorded_by: null,
    }))

    try {
      await upsert.mutateAsync(payload)
      message.success(
        `${selectedRowKeys.length} santri ditandai ${mastered ? 'terampil' : 'belum terampil'} pada "${targetItem.label}"`,
      )
      if (mastered) {
        selectedRowKeys.forEach((sId) => {
          void maybeSendMasteryWa(String(sId), itemId, category, targetItem.label)
        })
      }
      setSelectedRowKeys([])
    } catch (err) {
      message.error((err as Error).message || 'Gagal memperbarui status santri')
    }
  }

  // Tandai Terampil Semua Butir untuk santri yang dipilih
  const handleBulkAllItems = async () => {
    if (selectedRowKeys.length === 0 || items.length === 0) return
    const now = dayjs().format('YYYY-MM-DD')
    const payload: Array<{ student_id: string; item_id: string; mastered: boolean; mastered_at: string | null; recorded_by: null }> = []

    selectedRowKeys.forEach((sId) => {
      items.forEach((item) => {
        payload.push({
          student_id: String(sId),
          item_id: item.id,
          mastered: true,
          mastered_at: now,
          recorded_by: null,
        })
      })
    })

    try {
      await upsert.mutateAsync(payload)
      message.success(`${selectedRowKeys.length} santri berhasil ditandai TERAMPIL LENGKAP`)
      setSelectedRowKeys([])
    } catch (err) {
      message.error((err as Error).message || 'Gagal memperbarui kemahiran santri')
    }
  }

  const columns = useMemo(
    () => [
      {
        title: 'Santri',
        key: 'name',
        fixed: 'left' as const,
        width: 210,
        render: (_: unknown, row: StudentBrief, index: number) => {
          const display = titleCase(row.name)
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span
                style={{
                  width: 20,
                  flexShrink: 0,
                  textAlign: 'right',
                  fontSize: 11.5,
                  color: token.colorTextTertiary,
                }}
              >
                {index + 1}
              </span>
              <Tooltip title="Klik untuk membuka Profil & Evaluasi Spiritual">
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenSpiritualDrawer) {
                      onOpenSpiritualDrawer(row)
                    } else {
                      openStudentDetail(row.id)
                    }
                  }}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: 'block',
                    padding: 0,
                    border: 'none',
                    background: 'none',
                    font: 'inherit',
                    fontWeight: 600,
                    color: token.colorText,
                    textAlign: 'left',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {display}
                </button>
              </Tooltip>
            </div>
          )
        },
      },
      {
        title: 'Progres',
        key: 'progress',
        fixed: 'left' as const,
        width: 105,
        render: (_: unknown, row: StudentBrief) => {
          const starCount = starsByStudent.get(row.id) ?? 0
          const total = items.length
          const isFull = total > 0 && starCount === total
          return (
            <Tooltip title={`${starCount} dari ${total} butir terampil`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <MiniBar
                  percent={total > 0 ? (starCount / total) * 100 : 0}
                  color={isFull ? token.colorWarning : token.colorPrimary}
                  track={token.colorFillSecondary}
                  width={42}
                />
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    color: isFull ? token.colorWarning : token.colorTextSecondary,
                  }}
                >
                  {starCount}/{total}
                </span>
              </div>
            </Tooltip>
          )
        },
      },
      ...items.map((item) => ({
        title: (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2px 0',
              lineHeight: 1.2,
            }}
          >
            <Tooltip title={item.label}>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  display: 'block',
                  maxWidth: 95,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textAlign: 'center',
                }}
              >
                {item.label}
              </span>
            </Tooltip>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 500,
                color: token.colorTextTertiary,
                marginTop: 2,
              }}
            >
              {masteredByItem.get(item.id) ?? 0}/{students.length}
            </span>
          </div>
        ),
        key: item.id,
        width: 105,
        align: 'center' as const,
        render: (_: unknown, row: StudentBrief) => {
          const mastered = serverMap.get(cellKey(row.id, item.id)) ?? false
          return (
            <button
              type="button"
              disabled={!canWrite}
              onClick={() => void toggle(row, item)}
              aria-pressed={mastered}
              aria-label={`${row.name} · ${item.label}: ${mastered ? 'terampil' : 'belum'}`}
              style={{
                width: 36,
                height: 32,
                borderRadius: 8,
                border: `1px solid ${mastered ? token.colorWarningBorder : token.colorBorderSecondary}`,
                background: mastered ? token.colorWarningBg : token.colorBgContainer,
                color: mastered ? token.colorWarning : token.colorTextQuaternary,
                fontSize: 16,
                cursor: canWrite ? 'pointer' : 'not-allowed',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              {mastered ? <StarFilled /> : <StarOutlined />}
            </button>
          )
        },
      })),
    ],
    [items, students.length, starsByStudent, serverMap, masteredByItem, canWrite, openStudentDetail, onOpenSpiritualDrawer, toggle, token],
  )

  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [bulkTargetItem, setBulkTargetItem] = useState<string | undefined>(undefined)

  const bulkActions: BulkActionItem[] = [
    {
      key: 'all-mastered',
      label: 'Tandai Semua Butir Terampil',
      icon: <CheckOutlined />,
      confirm: {
        title: 'Tandai Semua Butir Terampil?',
        description: `Seluruh ${items.length} butir ${category} akan ditandai TERAMPIL untuk ${selectedRowKeys.length} santri terpilih.`,
        okText: 'Ya, Tandai Semua',
      },
      onClick: () => void handleBulkAllItems(),
    },
  ]

  return (
    <Card style={{ minWidth: 0 }} styles={{ body: { padding: 0 } }}>
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
        <Space size={8} wrap>
          <Typography.Text strong style={{ fontSize: 13.5 }}>
            Papan Kemahiran
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Klik bintang untuk menandai santri terampil · klik nama santri untuk profil lengkap
          </Typography.Text>
        </Space>
      </div>
      {filteredStudents.length === 0 ? (
        <div style={{ padding: 32 }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={search ? `Tidak ada santri yang cocok dengan "${search}"` : 'Tidak ada santri aktif'}
          />
        </div>
      ) : (
        <Table
          rowKey="id"
          size="middle"
          className="worship-table-scroll"
          columns={columns}
          dataSource={filteredStudents}
          pagination={false}
          rowSelection={
            canWrite
              ? {
                  selectedRowKeys,
                  onChange: setSelectedRowKeys,
                }
              : undefined
          }
          scroll={{ x: 210 + 105 + items.length * 105, y: 520 }}
        />
      )}

      {/* Floating Action Bar untuk penilaian massal santri terpilih */}
      {canWrite && (
        <>
          <ActionBar
            count={selectedRowKeys.length}
            onClear={() => setSelectedRowKeys([])}
            actions={[
              ...bulkActions,
              {
                key: 'mark-item',
                label: 'Tandai Butir Pilihan...',
                icon: <ThunderboltOutlined />,
                onClick: () => {
                  setBulkTargetItem(items[0]?.id)
                  setBulkModalOpen(true)
                },
              },
            ]}
          />

          <AppModal
            open={bulkModalOpen}
            onCancel={() => setBulkModalOpen(false)}
            title="Tandai Butir Massal"
            size="sm"
            okText="Tandai Terampil"
            onOk={() => {
              if (bulkTargetItem) {
                void handleBulkMastery(bulkTargetItem, true)
                setBulkModalOpen(false)
              }
            }}
          >
            <p style={{ marginBottom: 12, fontSize: 13, color: token.colorTextSecondary }}>
              Pilih butir yang ingin ditandai untuk <strong>{selectedRowKeys.length} santri</strong> yang dipilih:
            </p>
            <Select
              style={{ width: '100%' }}
              value={bulkTargetItem}
              onChange={setBulkTargetItem}
              options={items.map((i) => ({ value: i.id, label: i.label }))}
            />
          </AppModal>
        </>
      )}
    </Card>
  )
}
