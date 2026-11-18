import { useEffect, useMemo, useState } from 'react'
import {
  App,
  Button,
  Card,
  Empty,
  InputNumber,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  theme,
} from 'antd'
import { useStudentDetail } from '../../students/useStudentDetail'
import { useUpsertWorshipScores } from '../hooks'
import type { WorshipCategory } from '../types'

const cellKey = (studentId: string, itemId: string) => `${studentId}:${itemId}`

interface StudentBrief {
  id: string
  name: string
}

interface ScoresGridProps {
  category: WorshipCategory
  items: Array<{ id: string; label: string }>
  students: StudentBrief[]
  scores: Array<{ student_id: string; item_id: string; grade: number }>
  year: number
  monthValue: number
  search: string
  canWrite: boolean
}

/**
 * Grid Nilai Bulanan Ibadah: matriks santri × butir ibadah dengan input angka 0–100.
 * Menghitung rata-rata nilai per santri secara otomatis.
 */
export function ScoresGrid({
  category,
  items,
  students,
  scores,
  year,
  monthValue,
  search,
  canWrite,
}: ScoresGridProps) {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const { open: openStudentDetail } = useStudentDetail()
  const upsert = useUpsertWorshipScores(category)

  const serverMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of scores) map.set(cellKey(s.student_id, s.item_id), s.grade)
    return map
  }, [scores])

  // Filter santri berdasarkan pencarian
  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return students
    return students.filter((s) => s.name.toLowerCase().includes(q))
  }, [students, search])

  // Hitung rata-rata per santri dari data skor yang ada
  const studentAverageMap = useMemo(() => {
    const map = new Map<string, number | null>()
    for (const student of students) {
      const grades: number[] = []
      for (const item of items) {
        const val = serverMap.get(cellKey(student.id, item.id))
        if (typeof val === 'number') grades.push(val)
      }
      if (grades.length > 0) {
        const avg = Math.round(grades.reduce((a, b) => a + b, 0) / grades.length)
        map.set(student.id, avg)
      } else {
        map.set(student.id, null)
      }
    }
    return map
  }, [students, items, serverMap])

  const commit = async (student: StudentBrief, item: { id: string }, value: number | null) => {
    if (value === null || Number.isNaN(value)) return
    if (serverMap.get(cellKey(student.id, item.id)) === value) return
    try {
      await upsert.mutateAsync([
        { student_id: student.id, item_id: item.id, year, month: monthValue, grade: value },
      ])
    } catch (err) {
      message.error((err as Error).message || 'Gagal menyimpan nilai')
    }
  }

  // Draft edit per sel (controlled): sel kosong tidak pernah ter-commit sebagai 0,
  // dan tampilan selalu ikut data server setelah refetch.
  const [drafts, setDrafts] = useState<Map<string, number | null>>(new Map())
  const setDraft = (key: string, value: number | null) =>
    setDrafts((prev) => {
      const next = new Map(prev)
      if (value === null && !prev.has(key)) return prev
      next.set(key, value)
      return next
    })
  const clearDraft = (key: string) =>
    setDrafts((prev) => {
      if (!prev.has(key)) return prev
      const next = new Map(prev)
      next.delete(key)
      return next
    })
  const commitDraft = (student: StudentBrief, item: { id: string }) => {
    const key = cellKey(student.id, item.id)
    const draft = drafts.get(key)
    if (draft === undefined || draft === null || Number.isNaN(draft)) {
      clearDraft(key)
      return
    }
    clearDraft(key)
    void commit(student, item, draft)
  }

  useEffect(() => {
    setDrafts(new Map())
  }, [year, monthValue])

  const columns = [
    {
      title: 'Santri',
      dataIndex: 'name',
      key: 'name',
      fixed: 'left' as const,
      width: 210,
      render: (name: string, row: StudentBrief) => (
        <Button
          type="link"
          onClick={() => openStudentDetail(row.id)}
          style={{
            padding: 0,
            height: 'auto',
            fontWeight: 600,
            color: token.colorText,
            textAlign: 'left',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {name}
        </Button>
      ),
    },
    ...items.map((item) => ({
      title: (
        <Tooltip title={item.label}>
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              display: 'block',
              textAlign: 'center',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: 90,
            }}
          >
            {item.label}
          </span>
        </Tooltip>
      ),
      key: item.id,
      width: 100,
      align: 'center' as const,
      render: (_: unknown, row: StudentBrief) => {
        const key = cellKey(row.id, item.id)
        const draft = drafts.get(key)
        const val = draft !== undefined ? draft : serverMap.get(key)
        return (
          <InputNumber
            size="small"
            min={0}
            max={100}
            value={val}
            disabled={!canWrite || upsert.isPending}
            onChange={(v) => setDraft(key, v)}
            onBlur={() => commitDraft(row, item)}
            onPressEnter={() => commitDraft(row, item)}
            style={{ width: 62, textAlign: 'center' }}
            aria-label={`${row.name} · ${item.label}`}
          />
        )
      },
    })),
    {
      title: 'Rata-rata',
      key: 'average',
      fixed: 'right' as const,
      width: 90,
      align: 'center' as const,
      render: (_: unknown, row: StudentBrief) => {
        const avg = studentAverageMap.get(row.id)
        if (avg === null || avg === undefined) {
          return <span style={{ color: token.colorTextQuaternary }}>–</span>
        }
        const color = avg >= 85 ? 'green' : avg >= 70 ? 'blue' : avg >= 60 ? 'orange' : 'red'
        return (
          <Tag color={color} style={{ fontWeight: 700, marginInlineEnd: 0, borderRadius: 6 }}>
            {avg}
          </Tag>
        )
      },
    },
  ]

  return (
    <Card styles={{ body: { padding: 0 } }}>
      <div
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Space size={8}>
          <Typography.Text strong style={{ fontSize: 13.5 }}>
            Nilai Bulanan
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            · Periode {year}-{String(monthValue).padStart(2, '0')} (Skala 0–100, tekan Enter atau ganti sel untuk simpan)
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
          scroll={{ x: 210 + items.length * 100 + 90, y: 520 }}
          sticky
          loading={upsert.isPending}
        />
      )}
    </Card>
  )
}
