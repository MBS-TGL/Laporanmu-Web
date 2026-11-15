import { useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Dropdown,
  Empty,
  InputNumber,
  Radio,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  theme,
  type TableColumnsType,
} from 'antd'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  FileSyncOutlined,
  MoreOutlined,
  PlusOutlined,
  SaveOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { useParams } from 'react-router-dom'
import { PageHeader } from '../../shared/components/PageHeader'
import { AppModal } from '../../shared/components/AppModal'
import { usePermissions } from '../../shared/hooks/useProfile'
import {
  averageByType,
  weightedFinal,
} from './api'
import {
  useAssessmentScores,
  useAssessments,
  useClassStudents,
  useClassSubject,
  useDeleteAssessment,
  useGenerateSemesterGrade,
  useGradeConfig,
  useSaveAssessmentScores,
} from './hooks'
import { AssessmentModal } from './components/AssessmentModal'
import {
  ASSESSMENT_TYPES,
  ASSESSMENT_TYPE_LABEL,
  DEFAULT_WEIGHT,
  type Assessment,
  type AssessmentStudent,
  type AssessmentType,
  type GradeUpsert,
} from './types'

export function InputPage() {
  const { classSubjectId = '' } = useParams()
  const { message, modal } = App.useApp()
  const { token } = theme.useToken()
  const { canWrite } = usePermissions()

  const csQuery = useClassSubject(classSubjectId)
  const cs = csQuery.data

  const studentsQuery = useClassStudents(cs?.class_id)
  const students = studentsQuery.data ?? []

  const assessmentsQuery = useAssessments(classSubjectId)
  const allAssessments = assessmentsQuery.data ?? []

  const scoresQuery = useAssessmentScores(classSubjectId)
  const savedScores = scoresQuery.data ?? []

  const configQuery = useGradeConfig(cs?.classes ? (cs as unknown as { academic_year_id: string }).academic_year_id : undefined)
  const bobot = configQuery.data?.bobot ?? DEFAULT_WEIGHT

  const [activeTab, setActiveTab] = useState<AssessmentType>('formatif')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingAssessment, setEditingAssessment] = useState<Assessment | null>(null)
  const [generateModalOpen, setGenerateModalOpen] = useState(false)
  const [generateSemester, setGenerateSemester] = useState<1 | 2>(1)

  // Draft nilai yang sedang diedit tapi belum disimpan: studentId -> assessmentId -> number | null
  const [drafts, setDrafts] = useState<Record<string, Record<string, number | null>>>({})

  const saveScoresMutation = useSaveAssessmentScores()
  const deleteAssessmentMutation = useDeleteAssessment()
  const generateMutation = useGenerateSemesterGrade()

  const kkm = cs?.kkm_override ?? cs?.subjects?.kkm ?? 50

  // Lookup nilai tersimpan: `${assessmentId}:${studentId}` -> score
  const savedMap = useMemo(() => {
    const map = new Map<string, number | null>()
    for (const r of savedScores) {
      map.set(`${r.assessment_id}:${r.student_id}`, r.score)
    }
    return map
  }, [savedScores])

  const getScore = (assessmentId: string, studentId: string): number | null => {
    const draft = drafts[studentId]?.[assessmentId]
    if (draft !== undefined) return draft
    return savedMap.get(`${assessmentId}:${studentId}`) ?? null
  }

  const handleScoreChange = (
    assessmentId: string,
    studentId: string,
    val: number | null,
  ) => {
    setDrafts((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] ?? {}),
        [assessmentId]: val,
      },
    }))
  }

  // Hitung jumlah perubahan yang belum disimpan
  const pendingChanges = useMemo(() => {
    const rows: GradeUpsert[] = []
    for (const [studentId, map] of Object.entries(drafts)) {
      for (const [assessmentId, score] of Object.entries(map)) {
        const current = savedMap.get(`${assessmentId}:${studentId}`) ?? null
        if (score !== current) {
          rows.push({ assessment_id: assessmentId, student_id: studentId, score })
        }
      }
    }
    return rows
  }, [drafts, savedMap])

  const handleSaveAll = () => {
    if (pendingChanges.length === 0) return
    saveScoresMutation.mutate(pendingChanges, {
      onSuccess: () => {
        message.success(`${pendingChanges.length} nilai berhasil disimpan`)
        setDrafts({})
      },
      onError: (err: Error) => message.error(err.message || 'Gagal menyimpan nilai'),
    })
  }

  const handleOpenCreate = () => {
    setEditingAssessment(null)
    setModalOpen(true)
  }

  const handleOpenEdit = (a: Assessment) => {
    setEditingAssessment(a)
    setModalOpen(true)
  }

  const handleDelete = (a: Assessment) => {
    deleteAssessmentMutation.mutate(a.id, {
      onSuccess: () => message.success(`Ulangan "${a.title}" dihapus`),
      onError: (err: Error) => message.error(err.message || 'Gagal menghapus ulangan'),
    })
  }

  const handleGenerateRapor = () => {
    generateMutation.mutate(
      { classSubjectId, semester: generateSemester },
      {
        onSuccess: (count) => {
          message.success(
            `Nilai akhir berhasil di-generate ke rapor Semester ${generateSemester} untuk ${count} santri!`,
          )
          setGenerateModalOpen(false)
        },
        onError: (err: Error) =>
          message.error(err.message || 'Gagal generate nilai ke rapor'),
      },
    )
  }

  // Rata-rata per jenis untuk setiap santri (memakai nilai efektif termasuk draf)
  const effectiveScoresList = useMemo(() => {
    const list = [...savedScores]
    for (const [studentId, map] of Object.entries(drafts)) {
      for (const [assessmentId, score] of Object.entries(map)) {
        const idx = list.findIndex(
          (s) => s.assessment_id === assessmentId && s.student_id === studentId,
        )
        if (idx >= 0) {
          list[idx] = { ...list[idx], score }
        } else if (score !== null) {
          list.push({ id: `draft-${Date.now()}`, assessment_id: assessmentId, student_id: studentId, score })
        }
      }
    }
    return list
  }, [savedScores, drafts])

  // Ulangan untuk tab aktif
  const tabAssessments = useMemo(
    () => allAssessments.filter((a) => a.type === activeTab),
    [allAssessments, activeTab],
  )

  // Kolom tabel grid tab aktif
  const tabColumns: TableColumnsType<AssessmentStudent> = [
    {
      title: 'Santri',
      key: 'name',
      fixed: 'left',
      width: 200,
      render: (_, s) => (
        <div>
          <span style={{ fontWeight: 600 }}>{s.name}</span>
          <div style={{ fontSize: 11.5, color: token.colorTextTertiary }}>
            {s.registration_code}
          </div>
        </div>
      ),
    },
    ...tabAssessments.map((a) => ({
      title: (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{a.title}</div>
            <div style={{ fontSize: 11, color: token.colorTextTertiary }}>
              Maks {a.max_score}
              {a.assessment_date && ` · ${new Date(a.assessment_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`}
            </div>
          </div>
          {canWrite && (
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'edit',
                    icon: <EditOutlined />,
                    label: 'Edit Ulangan',
                    onClick: () => handleOpenEdit(a),
                  },
                  {
                    key: 'delete',
                    icon: <DeleteOutlined />,
                    label: 'Hapus',
                    danger: true,
                    onClick: () => {
                      modal.confirm({
                        title: `Hapus ulangan "${a.title}"?`,
                        content: 'Seluruh nilai yang sudah dimasukkan pada ulangan ini akan ikut terhapus.',
                        okText: 'Hapus',
                        okButtonProps: { danger: true },
                        cancelText: 'Batal',
                        onOk: () => handleDelete(a),
                      })
                    },
                  },
                ],
              }}
              trigger={['click']}
            >
              <Button type="text" size="small" icon={<MoreOutlined />} />
            </Dropdown>
          )}
        </div>
      ),
      key: a.id,
      width: 130,
      render: (_: unknown, s: AssessmentStudent) => {
        const val = getScore(a.id, s.id)
        const isDraft = drafts[s.id]?.[a.id] !== undefined
        return (
          <InputNumber
            size="small"
            min={0}
            max={a.max_score}
            precision={1}
            disabled={!canWrite}
            value={val}
            onChange={(v) => handleScoreChange(a.id, s.id, v)}
            style={{
              width: 80,
              borderColor: isDraft ? token.colorPrimary : undefined,
              background: isDraft ? token.colorPrimaryBg : undefined,
            }}
          />
        )
      },
    })),
    {
      title: `Rata-rata ${ASSESSMENT_TYPE_LABEL[activeTab]}`,
      key: 'avg_type',
      width: 130,
      align: 'center',
      render: (_, s) => {
        const avg = averageByType(effectiveScoresList, allAssessments, s.id, activeTab)
        if (avg === null) return <span style={{ color: token.colorTextTertiary }}>—</span>
        return <b>{avg}</b>
      },
    },
  ]

  // Kolom ringkasan nilai akhir (semua jenis terboboti)
  const summaryColumns: TableColumnsType<AssessmentStudent> = [
    {
      title: 'Santri',
      key: 'name',
      render: (_, s) => (
        <div>
          <span style={{ fontWeight: 600 }}>{s.name}</span>
          <span style={{ fontSize: 11.5, color: token.colorTextTertiary, marginLeft: 8 }}>
            {s.registration_code}
          </span>
        </div>
      ),
    },
    {
      title: `Formatif (${bobot.formatif}%)`,
      key: 'f',
      align: 'center',
      render: (_, s) => averageByType(effectiveScoresList, allAssessments, s.id, 'formatif') ?? '—',
    },
    {
      title: `Sumatif (${bobot.sumatif}%)`,
      key: 's',
      align: 'center',
      render: (_, s) => averageByType(effectiveScoresList, allAssessments, s.id, 'sumatif') ?? '—',
    },
    {
      title: `PTS (${bobot.pts}%)`,
      key: 'pts',
      align: 'center',
      render: (_, s) => averageByType(effectiveScoresList, allAssessments, s.id, 'pts') ?? '—',
    },
    {
      title: `PAS (${bobot.pas}%)`,
      key: 'pas',
      align: 'center',
      render: (_, s) => averageByType(effectiveScoresList, allAssessments, s.id, 'pas') ?? '—',
    },
    {
      title: 'Nilai Akhir',
      key: 'final',
      align: 'center',
      render: (_, s) => {
        const averages = {
          formatif: averageByType(effectiveScoresList, allAssessments, s.id, 'formatif'),
          sumatif: averageByType(effectiveScoresList, allAssessments, s.id, 'sumatif'),
          pts: averageByType(effectiveScoresList, allAssessments, s.id, 'pts'),
          pas: averageByType(effectiveScoresList, allAssessments, s.id, 'pas'),
        }
        const fin = weightedFinal(averages, bobot)
        if (fin === null) return <span style={{ color: token.colorTextTertiary }}>—</span>
        return <b style={{ fontSize: 14 }}>{fin}</b>
      },
    },
    {
      title: `Ketuntasan (KKM ${kkm})`,
      key: 'kkm_status',
      align: 'center',
      width: 140,
      render: (_, s) => {
        const averages = {
          formatif: averageByType(effectiveScoresList, allAssessments, s.id, 'formatif'),
          sumatif: averageByType(effectiveScoresList, allAssessments, s.id, 'sumatif'),
          pts: averageByType(effectiveScoresList, allAssessments, s.id, 'pts'),
          pas: averageByType(effectiveScoresList, allAssessments, s.id, 'pas'),
        }
        const fin = weightedFinal(averages, bobot)
        if (fin === null) return <Tag>Belum Ada Nilai</Tag>
        return fin >= kkm ? (
          <Tag color="success" icon={<CheckCircleOutlined />}>
            Tuntas
          </Tag>
        ) : (
          <Tag color="error" icon={<CloseCircleOutlined />}>
            Belum Tuntas
          </Tag>
        )
      },
    },
  ]

  const className = cs?.classes?.name ?? '…'
  const subjectName = cs?.subjects?.name ?? '…'
  const teacherName = cs?.teachers?.name ?? 'Belum ada guru'

  return (
    <div>
      <PageHeader
        title={`${subjectName} (${className})`}
        subtitle={`Pengampu: ${teacherName} · KKM: ${kkm} · ${students.length} santri aktif`}
        extra={
          <Space wrap>
            {canWrite && pendingChanges.length > 0 && (
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={saveScoresMutation.isPending}
                onClick={handleSaveAll}
              >
                Simpan ({pendingChanges.length})
              </Button>
            )}
            {canWrite && (
              <Button
                icon={<ThunderboltOutlined />}
                onClick={() => setGenerateModalOpen(true)}
              >
                Generate ke Rapor
              </Button>
            )}
          </Space>
        }
      />

      {pendingChanges.length > 0 && (
        <Alert
          type="info"
          showIcon
          message={`Ada ${pendingChanges.length} nilai yang belum disimpan. Klik tombol "Simpan" di atas untuk menyimpan ke database.`}
          style={{ marginBottom: 14 }}
        />
      )}

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={(k) => setActiveTab(k as AssessmentType)}
          tabBarExtraContent={
            canWrite && (
              <Button
                size="small"
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleOpenCreate}
              >
                Tambah {ASSESSMENT_TYPE_LABEL[activeTab]}
              </Button>
            )
          }
          items={ASSESSMENT_TYPES.map((type) => {
            const count = allAssessments.filter((a) => a.type === type).length
            return {
              key: type,
              label: `${ASSESSMENT_TYPE_LABEL[type]} (${count})`,
              children: (
                <div>
                  {tabAssessments.length === 0 ? (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={`Belum ada ulangan ${ASSESSMENT_TYPE_LABEL[type]}`}
                    >
                      {canWrite && (
                        <Button
                          type="primary"
                          icon={<PlusOutlined />}
                          onClick={handleOpenCreate}
                        >
                          Tambah Ulangan Pertama
                        </Button>
                      )}
                    </Empty>
                  ) : (
                    <Table<AssessmentStudent>
                      rowKey="id"
                      size="small"
                      columns={tabColumns}
                      dataSource={students}
                      pagination={false}
                      scroll={{ x: true }}
                      loading={studentsQuery.isPending || scoresQuery.isPending}
                    />
                  )}
                </div>
              ),
            }
          })}
        />
      </Card>

      {/* Tabel ringkasan nilai akhir */}
      <Card style={{ marginTop: 16 }} title="Ringkasan Nilai Akhir & Ketuntasan KKM">
        <div style={{ marginBottom: 10, fontSize: 12.5, color: token.colorTextTertiary }}>
          Bobot: Formatif {bobot.formatif}% · Sumatif {bobot.sumatif}% · PTS {bobot.pts}% · PAS {bobot.pas}%.
          Nilai akhir dinormalisasi jika ada jenis yang belum diisi.
        </div>
        <Table<AssessmentStudent>
          rowKey="id"
          size="small"
          columns={summaryColumns}
          dataSource={students}
          pagination={false}
          scroll={{ x: true }}
          loading={studentsQuery.isPending || scoresQuery.isPending}
        />
      </Card>

      <AssessmentModal
        open={modalOpen}
        classSubjectId={classSubjectId}
        defaultType={activeTab}
        editing={editingAssessment}
        onClose={() => setModalOpen(false)}
      />

      <AppModal
        open={generateModalOpen}
        title="Generate Nilai ke Rapor Semester"
        subtitle="Salin nilai terboboti ke rapor semester"
        icon={<FileSyncOutlined />}
        onCancel={() => setGenerateModalOpen(false)}
        onOk={handleGenerateRapor}
        okText="Generate Sekarang"
        confirmLoading={generateMutation.isPending}
        destroyOnHidden
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBlock: 8 }}>
          <Typography.Text>
            Sistem akan menghitung nilai akhir terboboti untuk seluruh santri di kelas ini dan
            menuliskannya langsung ke baris <b>Rapor Semester Umum</b> mapel <b>{subjectName}</b>.
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
            Nilai mapel lain di rapor semester tidak akan tersentuh. Nilai yang di-generate tetap bisa
            di-edit manual di halaman Raport.
          </Typography.Text>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Pilih Semester:</div>
            <Radio.Group
              value={generateSemester}
              onChange={(e) => setGenerateSemester(e.target.value)}
            >
              <Radio value={1}>Semester 1 (Ganjil)</Radio>
              <Radio value={2}>Semester 2 (Genap)</Radio>
            </Radio.Group>
          </div>
        </div>
      </AppModal>
    </div>
  )
}
