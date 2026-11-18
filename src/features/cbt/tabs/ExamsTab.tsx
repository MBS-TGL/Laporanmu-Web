import { useState } from 'react'
import { App, Alert, Button, Popconfirm, Space, Table, Tag, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FieldTimeOutlined,
  FileProtectOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { ShellItem } from '../../../shared/components/ShellMotion'
import { useTabActions } from '../../../shared/components/ActionsSlot'
import { StatChip } from '../../../shared/components/StatChip'
import { usePermissions } from '../../../shared/hooks/useProfile'
import { useProfile } from '../../../shared/hooks/useProfile'
import { useTablePagination } from '../../../shared/hooks/useTablePagination'
import { useCbtExams, useCreateCbtExam, useDeleteCbtExam, useUpdateCbtExam } from '../hooks'
import type { CbtExam, ExamFormValues } from '../types'
import { ExamModal } from '../components/ExamModal'
import { ExamDrawer } from '../components/ExamDrawer'
import { useSubjectOptions } from '../useSubjectOptions'

/** Tab Sesi Ujian: daftar ujian CBT, penerbitan token, dan pintu monitoring. */
export function ExamsTab({ active }: { active: boolean }) {
  const { message } = App.useApp()
  const { canWrite } = usePermissions()
  const { profile } = useProfile()
  const csOptions = useSubjectOptions()

  const examsQuery = useCbtExams()
  const createExam = useCreateCbtExam()
  const updateExam = useUpdateCbtExam()
  const deleteExam = useDeleteCbtExam()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CbtExam | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)

  const rows = examsQuery.data ?? []
  const pg = useTablePagination(rows.length, { label: 'ujian', defaultPageSize: 10, showSizeChanger: false })
  const detailExam = rows.find((e) => e.id === detailId) ?? null
  const publishedCount = rows.filter((e) => e.is_published).length

  const handleSave = async (values: ExamFormValues, id?: string) => {
    try {
      if (id) {
        await updateExam.mutateAsync({ id, values })
        message.success('Ujian diperbarui')
      } else {
        await createExam.mutateAsync({ values, createdBy: profile?.id ?? null })
        message.success('Sesi ujian dibuat. Terbitkan & aktifkan token untuk membuka ujian.')
      }
      setFormOpen(false)
      setEditing(null)
    } catch (err) {
      message.error((err as Error).message)
    }
  }

  const columns: ColumnsType<CbtExam> = [
    {
      title: 'Judul',
      dataIndex: 'title',
      render: (_, e) => (
        <Button type="link" size="small" style={{ paddingInline: 0 }} onClick={() => setDetailId(e.id)}>
          {e.title}
        </Button>
      ),
    },
    { title: 'Kelas · Mapel', width: 200, render: (_, e) => csOptions.labelOf(e.class_subject_id) || '-' },
    {
      title: 'Jenis',
      width: 100,
      render: (_, e) => <Tag>{e.exam_type === 'pts' ? 'PTS' : e.exam_type === 'pas' ? 'PAS' : e.exam_type === 'formatif' ? 'Formatif' : 'Sumatif'}</Tag>,
    },
    { title: 'Durasi', width: 90, align: 'right', render: (_, e) => `${e.duration_minutes} mnt` },
    { title: 'Soal', width: 80, align: 'right', render: (_, e) => (e.question_count ? `${e.question_count} acak` : 'Semua') },
    {
      title: 'Status',
      width: 110,
      render: (_, e) =>
        e.is_published ? <Tag color="green">Terbit</Tag> : <Tag>Draft</Tag>,
    },
  ]

  if (canWrite) {
    columns.push({
      title: '',
      key: 'aksi',
      width: 110,
      render: (_, e) => (
        <Space size={0}>
          <Tooltip title="Detail & monitoring">
            <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => setDetailId(e.id)} />
          </Tooltip>
          <Tooltip title="Ubah ujian">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                setEditing(e)
                setFormOpen(true)
              }}
            />
          </Tooltip>
          <Popconfirm
            title="Arsipkan ujian ini?"
            description="Attempt yang sudah ada tetap tersimpan."
            okText="Ya, Arsipkan"
            cancelText="Batal"
            okButtonProps={{ loading: deleteExam.isPending }}
            onConfirm={async () => {
              try {
                await deleteExam.mutateAsync(e.id)
                message.success('Ujian diarsipkan')
              } catch (err) {
                message.error((err as Error).message)
              }
            }}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} title="Arsipkan ujian" />
          </Popconfirm>
        </Space>
      ),
    })
  }

  return (
    <ShellItem>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <StatChip icon={<FileProtectOutlined />} label="Total Ujian" value={rows.length} loading={examsQuery.isPending} />
        <StatChip icon={<FieldTimeOutlined />} label="Terbit" value={publishedCount} color="emerald" hideIfZero />
      </div>

      {examsQuery.isError && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="Gagal memuat daftar ujian"
          description={(examsQuery.error as Error | null)?.message}
          action={
            <Button size="small" onClick={() => void examsQuery.refetch()}>
              Coba lagi
            </Button>
          }
        />
      )}

      <Table<CbtExam>
        rowKey="id"
        size="middle"
        loading={examsQuery.isPending}
        columns={columns}
        dataSource={rows}
        pagination={pg.pagination}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: 'Belum ada sesi ujian. Buat ujian, lalu terbitkan token untuk santri.' }}
      />

      <ExamModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        initial={editing}
        onSave={handleSave}
      />
      <ExamDrawer open={detailId !== null} exam={detailExam} onClose={() => setDetailId(null)} />

      <ExamsTabActions
        active={active}
        canWrite={canWrite}
        refetch={() => void examsQuery.refetch()}
        onAdd={() => {
          setEditing(null)
          setFormOpen(true)
        }}
      />
    </ShellItem>
  )
}

function ExamsTabActions({
  active,
  canWrite,
  refetch,
  onAdd,
}: {
  active: boolean
  canWrite: boolean
  refetch: () => void
  onAdd: () => void
}) {
  const node = (
    <Space size={8} wrap>
      <Tooltip title="Muat ulang">
        <Button icon={<ReloadOutlined />} onClick={refetch} />
      </Tooltip>
      <Button type="primary" icon={<PlusOutlined />} onClick={onAdd} disabled={!canWrite}>
        Buat Ujian
      </Button>
    </Space>
  )
  const actions = useTabActions(active, node)
  return <>{actions}</>
}
