import { useMemo, useState, type Key as ReactKey } from 'react'
import { Alert, App, Button, Input, Popconfirm, Select, Space, Table, Tag, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  DatabaseOutlined,
  DeleteOutlined,
  EditOutlined,
  ExportOutlined,
  FileAddOutlined,
  ImportOutlined,
  PlusOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { StatChip } from '../../../shared/components/StatChip'
import { FilterChips } from '../../../shared/components/FilterChips'
import { ActionBar } from '../../../shared/components/ActionBar'
import { ShellItem } from '../../../shared/components/ShellMotion'
import { useTabActions } from '../../../shared/components/ActionsSlot'
import { useDebounce } from '../../../shared/hooks/useDebounce'
import { usePermissions } from '../../../shared/hooks/useProfile'
import { useSubjectOptions } from '../useSubjectOptions'
import { useCbtQuestions, useBulkDeleteCbtQuestions, useCreateCbtQuestion, useDeleteCbtQuestion, useUpdateCbtQuestion } from '../hooks'
import { QUESTION_TYPE_LABEL, type CbtQuestion, type QuestionFormValues, type QuestionType } from '../types'
import { QuestionModal } from '../components/QuestionModal'
import { ImportModal } from '../components/ImportModal'
import { ExportModal } from '../components/ExportModal'
import { InputModal } from '../components/InputModal'
import { GenerateModal } from '../components/GenerateModal'

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E']

function buildQuestionInput(
  values: QuestionFormValues,
  classSubjectId: string,
): {
  class_subject_id: string
  question: string
  type?: string
  difficulty?: string
  options: { key: string; text: string }[]
  answer_key: string
  answer?: unknown
  pairs?: unknown
  points: number
  explanation: string | null
} {
  const base = {
    class_subject_id: classSubjectId,
    question: values.question.trim(),
    type: values.type,
    difficulty: values.difficulty,
    points: values.points,
    explanation: values.explanation?.trim() || null,
  }

  // PG klasik — kompatibel dengan data lama (answer_key)
  if (values.type === 'pg') {
    return {
      ...base,
      options: values.options
        .map((o, i) => ({ key: OPTION_LETTERS[i], text: o.text.trim() }))
        .filter((o) => o.text !== ''),
      answer_key: values.answer_key,
    }
  }

  // PG kompleks — answer = array huruf kunci
  if (values.type === 'pg_multi') {
    return {
      ...base,
      options: values.options
        .map((o, i) => ({ key: OPTION_LETTERS[i], text: o.text.trim() }))
        .filter((o) => o.text !== ''),
      answer_key: '',
      answer: values.answer_multi ?? [],
    }
  }

  // Benar-salah — opsi bawaan B/S
  if (values.type === 'true_false') {
    return {
      ...base,
      options: [
        { key: 'B', text: 'Benar' },
        { key: 'S', text: 'Salah' },
      ],
      answer_key: '',
      answer: values.answer_tf ?? 'B',
    }
  }

  // Menjodohkan — options = item kiri, pairs = pasangan kanan + kunci
  if (values.type === 'matching') {
    const rights = (values.rights ?? [])
      .map((r, i) => ({ key: `R${i + 1}`, text: r.text.trim() }))
      .filter((r) => r.text !== '')
    const correct: Record<string, string> = {}
    for (const [leftKey, rightKey] of Object.entries(values.correct_pairs ?? {})) {
      if (rights.some((r) => r.key === rightKey)) correct[leftKey] = rightKey
    }
    return {
      ...base,
      options: values.options
        .map((o, i) => ({ key: String(i + 1), text: o.text.trim() }))
        .filter((o) => o.text !== ''),
      answer_key: '',
      answer: null,
      pairs: { rights, correct },
    }
  }

  // Uraian — dinilai manual
  return {
    ...base,
    options: [],
    answer_key: '',
    answer: null,
  }
}

/** Tab Bank Soal: daftar soal pilihan ganda per kelas-mapel. */
export function BankTab({ active }: { active: boolean }) {
  const { message } = App.useApp()
  const { canWrite } = usePermissions()

  const csOptions = useSubjectOptions()
  const questionsQuery = useCbtQuestions()

  const [classSubjectId, setClassSubjectId] = useState<string>()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search)
  const [selected, setSelected] = useState<ReactKey[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CbtQuestion | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)

  const createQ = useCreateCbtQuestion()
  const updateQ = useUpdateCbtQuestion()
  const deleteQ = useDeleteCbtQuestion()
  const bulkDelete = useBulkDeleteCbtQuestions()

  const classSubjectOptions = csOptions.options

  const allQuestions = questionsQuery.data ?? []
  const rows = useMemo(() => {
    let list = allQuestions
    if (classSubjectId) list = list.filter((q) => q.class_subject_id === classSubjectId)
    if (debouncedSearch) {
      const s = debouncedSearch.toLowerCase()
      list = list.filter((q) => q.question.toLowerCase().includes(s))
    }
    return list
  }, [allQuestions, classSubjectId, debouncedSearch])

  const filledCsCount = useMemo(
    () => new Set(allQuestions.map((q) => q.class_subject_id)).size,
    [allQuestions],
  )

  const chips = useMemo(() => {
    const out: { key: string; label: string; onClear: () => void }[] = []
    if (classSubjectId) {
      out.push({
        key: 'cs',
        label: `Mapel: ${csOptions.labelOf(classSubjectId)}`,
        onClear: () => setClassSubjectId(undefined),
      })
    }
    if (debouncedSearch) {
      out.push({ key: 'q', label: `Cari: ${debouncedSearch}`, onClear: () => setSearch('') })
    }
    return out
  }, [classSubjectId, csOptions, debouncedSearch])

  const handleSave = async (values: QuestionFormValues, id?: string) => {
    if (!classSubjectId) return
    try {
      if (id) await updateQ.mutateAsync({ id, input: buildQuestionInput(values, classSubjectId) })
      else await createQ.mutateAsync(buildQuestionInput(values, classSubjectId))
      message.success(id ? 'Soal diperbarui' : 'Soal ditambahkan ke bank')
      setFormOpen(false)
      setEditing(null)
    } catch (err) {
      message.error((err as Error).message)
    }
  }

  const handleBulkDelete = async () => {
    try {
      await bulkDelete.mutateAsync(selected.map(String))
      message.success(`${selected.length} soal diarsipkan`)
      setSelected([])
    } catch (err) {
      message.error((err as Error).message)
    }
  }

  const columns: ColumnsType<CbtQuestion> = [
    {
      title: 'Soal',
      dataIndex: 'question',
      render: (_, q) => (
        <Tooltip title={q.question}>
          <span style={{ display: 'inline-block', maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>
            {q.question}
          </span>
        </Tooltip>
      ),
    },
    { title: 'Kelas', width: 110, render: (_, q) => q.class_subject?.class?.name ?? '-' },
    { title: 'Mapel', width: 150, render: (_, q) => q.class_subject?.subject?.name ?? '-' },
    {
      title: 'Tipe',
      width: 110,
      render: (_, q) => {
        const t = (q.type ?? 'pg') as QuestionType
        const color = t === 'essay' ? 'purple' : t === 'pg' ? 'geekblue' : 'cyan'
        return <Tag color={color}>{QUESTION_TYPE_LABEL[t]}</Tag>
      },
    },
    {
      title: 'Kunci',
      width: 90,
      render: (_, q) => {
        if (q.type === 'pg_multi' && Array.isArray(q.answer)) {
          return <Tag color="indigo">{(q.answer as string[]).sort().join('')}</Tag>
        }
        if (q.type === 'true_false') return <Tag color="indigo">{q.answer === 'B' ? 'Benar' : 'Salah'}</Tag>
        if (q.type === 'matching') return <Tag color="indigo">{Object.keys(q.pairs?.correct ?? {}).length} pasang</Tag>
        if (q.type === 'essay') return <Tag color="purple">Manual</Tag>
        return <Tag color="indigo">{q.answer_key}</Tag>
      },
    },
    {
      title: 'Poin',
      dataIndex: 'points',
      width: 80,
      align: 'right',
      render: (p: number) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{p}</span>,
    },
  ]

  if (canWrite) {
    columns.push({
      title: '',
      key: 'aksi',
      width: 100,
      render: (_, q) => (
        <Space size={0}>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditing(q)
              setFormOpen(true)
            }}
            title="Ubah soal"
          />
          <Popconfirm
            title="Arsipkan soal ini?"
            okText="Ya, Arsipkan"
            cancelText="Batal"
            okButtonProps={{ loading: deleteQ.isPending }}
            onConfirm={async () => {
              try {
                await deleteQ.mutateAsync(q.id)
                message.success('Soal diarsipkan')
              } catch (err) {
                message.error((err as Error).message)
              }
            }}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} title="Arsipkan soal" />
          </Popconfirm>
        </Space>
      ),
    })
  }

  const noCsSelected = !classSubjectId

  return (
    <ShellItem>
      <Space size={12} wrap style={{ marginBottom: 16 }}>
        <Select
          showSearch
          allowClear
          placeholder="Pilih kelas & mapel"
          style={{ minWidth: 240 }}
          loading={csOptions.loading}
          value={classSubjectId}
          onChange={(v) => {
            setClassSubjectId(v)
            setSelected([])
          }}
          options={classSubjectOptions.map((o) => ({ value: o.value, label: o.label }))}
          filterOption={(input, option) =>
            String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
        />
        <Input.Search
          allowClear
          placeholder="Cari teks soal"
          style={{ width: 240 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Space>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <StatChip icon={<DatabaseOutlined />} label="Soal Tampil" value={rows.length} loading={questionsQuery.isPending} />
        <StatChip
          icon={<DatabaseOutlined />}
          label="Kelas·Mapel Terisi"
          value={filledCsCount}
          color="sky"
          hideIfZero
        />
      </div>

      <FilterChips chips={chips} />

      {questionsQuery.isError && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="Gagal memuat bank soal"
          description={(questionsQuery.error as Error | null)?.message}
          action={
            <Button size="small" onClick={() => void questionsQuery.refetch()}>
              Coba lagi
            </Button>
          }
        />
      )}

      {noCsSelected && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Pilih kelas & mapel untuk menambah atau mengimpor soal"
          description="Soal tersimpan per kombinasi kelas-mapel, sama seperti plotting guru pengampu."
        />
      )}

      <Table<CbtQuestion>
        rowKey="id"
        size="middle"
        loading={questionsQuery.isPending}
        columns={columns}
        dataSource={rows}
        pagination={{ pageSize: 15, showSizeChanger: false, showTotal: (t) => `${t} soal` }}
        rowSelection={
          canWrite ? { selectedRowKeys: selected, onChange: (keys) => setSelected(keys) } : undefined
        }
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: noCsSelected ? 'Pilih kelas & mapel untuk melihat soal' : 'Belum ada soal di mapel ini. Tambah soal atau impor dari Excel.' }}
      />

      <ActionBar
        count={selected.length}
        onClear={() => setSelected([])}
        actions={[
          { key: 'export', label: 'Ekspor', icon: <ExportOutlined />, onClick: () => setExportOpen(true) },
          {
            key: 'delete',
            label: 'Arsipkan',
            icon: <DeleteOutlined />,
            variant: 'danger',
            hidden: !canWrite,
            loading: bulkDelete.isPending,
            confirm: {
              title: `Arsipkan ${selected.length} soal terpilih?`,
              description: 'Soal terarsip tidak dipakai ujian baru, tapi riwayat ujian tetap utuh.',
              okText: 'Ya, Arsipkan',
            },
            onClick: handleBulkDelete,
          },
        ]}
      />

      <QuestionModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        classSubjectId={classSubjectId}
        initial={editing}
        onSave={handleSave}
      />
      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        classSubjectId={classSubjectId as string}
        existingQuestions={allQuestions.map((q) => q.question)}
        onFinished={() => {
          setImportOpen(false)
          void questionsQuery.refetch()
          message.success('Impor bank soal selesai')
        }}
      />
      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        rows={rows}
        allRows={allQuestions}
        selected={selected.map(String)}
      />
      <InputModal
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
        classSubjectId={classSubjectId as string}
        existingQuestions={allQuestions.map((q) => q.question)}
        onFinished={() => {
          setQuickOpen(false)
          void questionsQuery.refetch()
        }}
      />
      <GenerateModal
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        classSubjectId={classSubjectId as string}
        existingQuestions={allQuestions.map((q) => q.question)}
        onFinished={() => {
          setAiOpen(false)
          void questionsQuery.refetch()
        }}
      />

      {/* Aksi kanan judul via portal — host dipasang CbtPage (PageHeader.extra) */}
      <BankTabActions
        active={active}
        canWrite={canWrite}
        noCsSelected={noCsSelected}
        refetch={() => void questionsQuery.refetch()}
        onAdd={() => {
          setEditing(null)
          setFormOpen(true)
        }}
        onImport={() => setImportOpen(true)}
        onExport={() => setExportOpen(true)}
        onQuick={() => setQuickOpen(true)}
        onAi={() => setAiOpen(true)}
      />
    </ShellItem>
  )
}

/** Aksi kanan judul (portal ActionsSlot) — dipisah agar hook tetap awal render. */
function BankTabActions({
  active,
  canWrite,
  noCsSelected,
  refetch,
  onAdd,
  onImport,
  onExport,
  onQuick,
  onAi,
}: {
  active: boolean
  canWrite: boolean
  noCsSelected: boolean
  refetch: () => void
  onAdd: () => void
  onImport: () => void
  onExport: () => void
  onQuick: () => void
  onAi: () => void
}) {
  const node = (
    <Space size={8} wrap>
      <Tooltip title="Muat ulang">
        <Button icon={<ReloadOutlined />} onClick={refetch} />
      </Tooltip>
      <Tooltip title={noCsSelected ? 'Pilih kelas & mapel dulu untuk impor' : 'Impor soal dari Excel/CSV'}>
        <span>
          <Button icon={<ImportOutlined />} onClick={onImport} disabled={!canWrite || noCsSelected} />
        </span>
      </Tooltip>
      <Tooltip title={noCsSelected ? 'Pilih kelas & mapel dulu untuk input cepat' : 'Input cepat via tempel teks'}>
        <span>
          <Button icon={<FileAddOutlined />} onClick={onQuick} disabled={!canWrite || noCsSelected} />
        </span>
      </Tooltip>
      <Tooltip title={noCsSelected ? 'Pilih kelas & mapel dulu untuk AI' : 'Buat draf soal dengan AI (materi, CP/TP, atau soal existing)'}>
        <span>
          <Button icon={<ThunderboltOutlined />} onClick={onAi} disabled={!canWrite || noCsSelected} />
        </span>
      </Tooltip>
      <Tooltip title="Ekspor bank soal">
        <Button icon={<ExportOutlined />} onClick={onExport} />
      </Tooltip>
      <Tooltip title={noCsSelected ? 'Pilih kelas & mapel dulu untuk tambah soal' : ''}>
        <span>
          <Button type="primary" icon={<PlusOutlined />} onClick={onAdd} disabled={!canWrite || noCsSelected}>
            Tambah Soal
          </Button>
        </span>
      </Tooltip>
    </Space>
  )
  // Hasil portal WAJIB dirender di JSX — kalau dibuang, host tetap kosong
  const actions = useTabActions(active, node)
  return <>{actions}</>
}
