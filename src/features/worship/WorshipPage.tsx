import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Empty,
  Progress,
  Result,
  Space,
  Spin,
  Tabs,
  Tooltip,
  Typography,
} from 'antd'
import {
  BarChartOutlined,
  DownloadOutlined,
  PlusOutlined,
  PrinterOutlined,
  SafetyCertificateOutlined,
  StarFilled,
  StarOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { PageHeader } from '../../shared/components/PageHeader'
import { TabActionsContext, useTabActions } from '../../shared/components/ActionsSlot'
import { StatChip } from '../../shared/components/StatChip'
import { usePermissions } from '../../shared/hooks/useProfile'
import { useUrlTab } from '../../shared/hooks/useUrlTab'
import { useReportCardClasses, useReportCardStudents } from '../report-cards/hooks'
import {
  useCreateWorshipItem,
  useDeleteWorshipItem,
  useLoadWorshipPresets,
  useReorderWorshipItems,
  useSyncWorshipToMonthlyReports,
  useUpdateWorshipItem,
  useWorshipItems,
  useWorshipMastery,
  useWorshipScores,
} from './hooks'
import {
  WORSHIP_CATEGORY_ORDER,
  getCumulativeGradePresets,
  isItemApplicableForGrade,
  suppressCombinedPresets,
} from './presets'
import { WORSHIP_CATEGORY_LABEL, type WorshipCategory, type WorshipFormValues } from './types'
import { WorshipToolbar } from './components/WorshipToolbar'
import { MasteryGrid } from './components/MasteryGrid'
import { ScoresGrid } from './components/ScoresGrid'
import { ItemsPanel } from './components/ItemsPanel'
import { WorshipItemModal } from './components/WorshipItemModal'
import { WorshipExportModal } from './components/WorshipExportModal'
import { WorshipDrawer } from './components/WorshipDrawer'
import { ClassAnalyticsDrawer } from './components/ClassAnalyticsDrawer'
import { WorshipPrintSheet } from './components/WorshipPrintSheet'
import { WorshipImportModal } from './components/WorshipImportModal'

const TAB_META: Record<WorshipCategory, { title: string; subtitle: string }> = {
  wudhu: {
    title: 'Kemahiran Wudhu',
    subtitle: 'Klik bintang untuk menandai santri terampil · preset dapat dimuat sekali klik',
  },
  sholat: {
    title: 'Kemahiran Sholat',
    subtitle: 'Papan kemahiran sholat per santri + nilai bulanan per butir',
  },
  hafalan_hadist: {
    title: 'Kemahiran Hafalan Hadist',
    subtitle: 'Papan kemahiran hafalan hadist per santri + nilai bulanan per butir',
  },
  hafalan_doa: {
    title: 'Kemahiran Hafalan Doa',
    subtitle: 'Papan kemahiran hafalan doa per santri + nilai bulanan per butir',
  },
}

const LAST_CLASS_KEY = 'worship:lastClass'
const LAST_MODE_KEY = 'worship:lastMode'

type Mode = 'mastery' | 'scores'
type ClassList = NonNullable<ReturnType<typeof useReportCardClasses>['data']>

function readStored(key: string): string | undefined {
  try {
    return localStorage.getItem(key) ?? undefined
  } catch {
    return undefined
  }
}

/** Urutan tampil berikutnya: setelah butir terbesar (aman walau ada butir terhapus). */
const nextSortOrder = (items: Array<{ sort_order: number }>) =>
  Math.max(0, ...items.map((i) => i.sort_order)) + 10

/**
 * Halaman Ibadah (P3): kemahiran butir ibadah per kategori + nilai bulanan
 * + papan progres kelas. Filter (kelas, mode, bulan) dibagi antar tab dan
 * kelas/mode terakhir diingat di perangkat.
 */
export function WorshipPage() {
  const { tab, setTab } = useUrlTab('wudhu', { keys: WORSHIP_CATEGORY_ORDER })
  const category = (WORSHIP_CATEGORY_ORDER as readonly string[]).includes(tab)
    ? (tab as WorshipCategory)
    : 'wudhu'
  const { canWrite } = usePermissions()
  const meta = TAB_META[category]
  const [actionsHost, setActionsHost] = useState<HTMLDivElement | null>(null)

  // Filter bersama semua tab
  const [classId, setClassId] = useState<string | undefined>(() => readStored(LAST_CLASS_KEY))
  const [mode, setMode] = useState<Mode>(() => (readStored(LAST_MODE_KEY) === 'scores' ? 'scores' : 'mastery'))
  const [month, setMonth] = useState<Dayjs>(dayjs())
  const [search, setSearch] = useState('')

  const classesQuery = useReportCardClasses()
  const classes = useMemo<ClassList>(() => classesQuery.data ?? [], [classesQuery.data])
  // Kelas tersimpan yang sudah tidak ada diabaikan
  const activeClassId =
    classId && classesQuery.data && !classesQuery.data.some((c) => c.id === classId) ? undefined : classId

  useEffect(() => {
    try {
      if (activeClassId) localStorage.setItem(LAST_CLASS_KEY, activeClassId)
      else localStorage.removeItem(LAST_CLASS_KEY)
    } catch {
      /* penyimpanan opsional */
    }
  }, [activeClassId])

  useEffect(() => {
    try {
      localStorage.setItem(LAST_MODE_KEY, mode)
    } catch {
      /* penyimpanan opsional */
    }
  }, [mode])

  return (
    <TabActionsContext.Provider value={actionsHost}>
      <PageHeader
        title={meta.title}
        subtitle={meta.subtitle}
        extra={<div ref={setActionsHost} style={{ display: 'flex', alignItems: 'center' }} />}
      />
      <Tabs
        activeKey={category}
        onChange={setTab}
        items={WORSHIP_CATEGORY_ORDER.map((cat) => ({
          key: cat,
          label: WORSHIP_CATEGORY_LABEL[cat],
          children: (
            <CategorySection
              key={cat}
              category={cat}
              active={cat === category}
              canWrite={canWrite}
              classes={classes}
              classId={activeClassId}
              setClassId={setClassId}
              mode={mode}
              setMode={setMode}
              month={month}
              setMonth={setMonth}
              search={search}
              setSearch={setSearch}
            />
          ),
        }))}
      />
    </TabActionsContext.Provider>
  )
}

interface CategorySectionProps {
  category: WorshipCategory
  active: boolean
  canWrite: boolean
  classes: ClassList
  classId: string | undefined
  setClassId: Dispatch<SetStateAction<string | undefined>>
  mode: Mode
  setMode: Dispatch<SetStateAction<Mode>>
  month: Dayjs
  setMonth: Dispatch<SetStateAction<Dayjs>>
  search: string
  setSearch: Dispatch<SetStateAction<string>>
}

function CategorySection({
  category,
  active,
  canWrite,
  classes,
  classId,
  setClassId,
  mode,
  setMode,
  month,
  setMonth,
  search,
  setSearch,
}: CategorySectionProps) {
  const { message } = App.useApp()

  const selectedClass = useMemo(() => classes.find((c) => c.id === classId), [classes, classId])
  const currentGrade = useMemo(() => (selectedClass?.grade ? Number(selectedClass.grade) : null), [selectedClass])

  const itemsQuery = useWorshipItems(category)
  const rawItems = useMemo(() => itemsQuery.data ?? [], [itemsQuery.data])

  // Filter butir aktif: jika kelas dipilih, hanya tampilkan butir yang berlaku untuk jenjang kelas tersebut (kumulatif)
  const items = useMemo(() => {
    if (!currentGrade) return rawItems
    return rawItems.filter((i) => isItemApplicableForGrade(i.label, currentGrade))
  }, [rawItems, currentGrade])

  const itemIds = useMemo(() => new Set(items.map((i) => i.id)), [items])

  const studentsQuery = useReportCardStudents(classId)
  const students = useMemo(() => studentsQuery.data ?? [], [studentsQuery.data])
  const studentOptions = useMemo(
    () => students.map((s) => ({ id: s.id, name: s.name })),
    [students],
  )

  const masteryQuery = useWorshipMastery(category, classId)
  const mastery = useMemo(() => masteryQuery.data ?? [], [masteryQuery.data])

  const scoresQuery = useWorshipScores(category, classId, month.year(), month.month() + 1)
  const scores = useMemo(() => scoresQuery.data ?? [], [scoresQuery.data])

  // Papan progres: bintang per santri & per butir (hanya butir aktif)
  const { starsByStudent, masteredByItem } = useMemo(() => {
    const byStudent = new Map<string, number>()
    const byItem = new Map<string, number>()
    for (const m of mastery) {
      if (!m.mastered || !itemIds.has(m.item_id)) continue
      byStudent.set(m.student_id, (byStudent.get(m.student_id) ?? 0) + 1)
      byItem.set(m.item_id, (byItem.get(m.item_id) ?? 0) + 1)
    }
    return { starsByStudent: byStudent, masteredByItem: byItem }
  }, [mastery, itemIds])

  const fullMastered = students.filter(
    (s) => items.length > 0 && (starsByStudent.get(s.id) ?? 0) === items.length,
  ).length

  // Insight kelas
  const insight = useMemo(() => {
    if (!classId || items.length === 0 || students.length === 0) return null
    let totalStars = 0
    starsByStudent.forEach((v) => (totalStars += v))
    const percent = Math.round((totalStars / (items.length * students.length)) * 100)
    const noStars = students.filter((s) => (starsByStudent.get(s.id) ?? 0) === 0).length
    let hardest: { label: string; percent: number } | null = null
    for (const item of items) {
      const p = Math.round(((masteredByItem.get(item.id) ?? 0) / students.length) * 100)
      if (!hardest || p < hardest.percent) hardest = { label: item.label, percent: p }
    }
    return { percent, noStars, hardest }
  }, [classId, items, students, starsByStudent, masteredByItem])

  const loadPresets = useLoadWorshipPresets()
  const createItem = useCreateWorshipItem()
  const updateItem = useUpdateWorshipItem()
  const reorderItems = useReorderWorshipItems()
  const deleteItem = useDeleteWorshipItem()
  const syncMonthly = useSyncWorshipToMonthlyReports()

  const [formOpen, setFormOpen] = useState(false)
  const [formValues, setFormValues] = useState<WorshipFormValues>({
    category,
    label: '',
    sort_order: nextSortOrder(items),
  })
  const [exportOpen, setExportOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)
  const [spiritualStudent, setSpiritualStudent] = useState<{ id: string; name: string; class_name?: string } | null>(null)
  const [itemsOpenPref, setItemsOpenPref] = useState<boolean | undefined>(undefined)
  const itemsOpen = itemsOpenPref ?? (!classId || items.length === 0)

  const className = classes.find((c) => c.id === classId)?.name ?? ''
  const targetPresets = useMemo(() => {
    const base = getCumulativeGradePresets(category, currentGrade)
    // Butir gabungan dilewat bila semua komponennya sudah ada di baris DB
    return suppressCombinedPresets(
      base,
      rawItems.map((i) => i.label),
    )
  }, [category, currentGrade, rawItems])
  const allPresetsExist = targetPresets.every((l) => rawItems.some((i) => i.label === l))

  const hasError =
    itemsQuery.isError ||
    (Boolean(classId) &&
      (masteryQuery.isError ||
        studentsQuery.isError ||
        (mode === 'scores' && scoresQuery.isError)))

  const retry = () => {
    void itemsQuery.refetch()
    if (classId) {
      void masteryQuery.refetch()
      void studentsQuery.refetch()
      if (mode === 'scores') void scoresQuery.refetch()
    }
  }

  const duplicateAware = (err: Error, fallback: string) =>
    (err as { code?: string }).code === '23505'
      ? 'Butir dengan nama itu sudah ada'
      : err.message || fallback

  const openForm = () => {
    setFormValues({ category, label: '', sort_order: nextSortOrder(items) })
    setFormOpen(true)
  }

  const submitCreate = () => {
    if (formValues.label.trim().length < 2) {
      message.warning('Nama butir minimal 2 karakter')
      return
    }
    createItem.mutate(formValues, {
      onSuccess: () => {
        message.success('Butir ditambahkan')
        setFormOpen(false)
      },
      onError: (err: Error) => message.error(duplicateAware(err, 'Gagal menambah butir')),
    })
  }

  const handleLoadPresets = () =>
    loadPresets.mutate(
      { category, labels: targetPresets },
      {
        onSuccess: (count) =>
          message.success(
            count > 0
              ? `${count} butir preset ditambahkan (${currentGrade ? `Kelas ${currentGrade}` : 'Umum'})`
              : 'Semua preset untuk jenjang ini sudah ada',
          ),
        onError: (err: Error) => message.error(err.message || 'Gagal memuat preset'),
      },
    )

  const handleDelete = (id: string) =>
    deleteItem.mutate(
      { id, category, label: items.find((i) => i.id === id)?.label ?? '' },
      {
        onSuccess: () => message.success('Butir dihapus'),
        onError: (err: Error) => message.error(err.message || 'Gagal menghapus butir'),
      },
    )

  const handleRename = (id: string, label: string, done: () => void) => {
    if (label.trim().length < 2) {
      message.warning('Nama butir minimal 2 karakter')
      return
    }
    updateItem.mutate(
      { id, label, category },
      {
        onSuccess: () => {
          message.success('Nama butir diperbarui')
          done()
        },
        onError: (err: Error) => message.error(duplicateAware(err, 'Gagal mengubah nama butir')),
      },
    )
  }

  const handleMove = (updates: Array<{ id: string; sort_order: number }>) =>
    reorderItems.mutate(
      { updates, category },
      { onError: (err: Error) => message.error(err.message || 'Gagal mengubah urutan') },
    )

  // Aksi esensial di kanan judul halaman (PageHeader): Tambah Butir, Analitik, Cetak, Impor & Ekspor
  const actions = useTabActions(
    active,
    <Space size={8} wrap>
      <Tooltip title={classId ? 'Analisis ketuntasan materi kelas' : 'Pilih kelas dulu'}>
        <Button
          icon={<BarChartOutlined />}
          disabled={!classId}
          onClick={() => setAnalyticsOpen(true)}
        >
          Analisis Kelas
        </Button>
      </Tooltip>
      <Tooltip title={classId ? 'Cetak lembar pantau resmi' : 'Pilih kelas dulu'}>
        <Button
          icon={<PrinterOutlined />}
          disabled={!classId}
          onClick={() => setPrintOpen(true)}
        >
          Cetak
        </Button>
      </Tooltip>
      <Tooltip title={classId && canWrite ? 'Impor nilai kemahiran dari Excel' : 'Pilih kelas dulu'}>
        <Button
          icon={<UploadOutlined />}
          disabled={!classId || !canWrite}
          onClick={() => setImportOpen(true)}
        >
          Impor
        </Button>
      </Tooltip>
      <Tooltip title={classId ? undefined : 'Pilih kelas dulu'}>
        <Button icon={<DownloadOutlined />} disabled={!classId} onClick={() => setExportOpen(true)}>
          Ekspor
        </Button>
      </Tooltip>
      <Button type="primary" icon={<PlusOutlined />} disabled={!canWrite} onClick={openForm}>
        Tambah Butir
      </Button>
    </Space>,
  )

  return (
    // minmax(0, 1fr): cegah konten lebar (tabel) mendorong halaman melebar; scroll terjadi di dalam kartu
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14 }}>
      {actions}

      {/* Toolbar: Kelas, Mode, Bulan, Cari Santri, Preset, Sync */}
      <WorshipToolbar
        category={category}
        classId={classId}
        setClassId={setClassId}
        classes={classes}
        mode={mode}
        setMode={setMode}
        month={month}
        setMonth={setMonth}
        search={search}
        setSearch={setSearch}
        canWrite={canWrite}
        hasScores={scores.length > 0}
        className={className}
        allPresetsExist={allPresetsExist}
        loadingPresets={loadPresets.isPending}
        syncingMonthly={syncMonthly.isPending}
        onLoadPresets={handleLoadPresets}
        onSyncMonthly={() => {
          if (!classId) return
          syncMonthly.mutate(
            { classId, year: month.year(), month: month.month() + 1 },
            {
              onSuccess: (res) =>
                message.success(
                  res.updatedCount > 0
                    ? `${res.updatedCount} santri disinkronkan ke Rapor Bulanan`
                    : 'Tidak ada nilai ibadah untuk disinkronkan',
                ),
              onError: (err: Error) =>
                message.error(err.message || 'Gagal menyinkronkan ke Rapor Bulanan'),
            },
          )
        }}
      />

      {/* Statistik Ringkas */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <StatChip
          icon={<SafetyCertificateOutlined />}
          label="Total Butir"
          value={items.length}
          color="indigo"
          loading={itemsQuery.isLoading}
        />
        <StatChip
          icon={<StarFilled />}
          label="Terampil Penuh"
          value={classId ? fullMastered : '–'}
          color="emerald"
          loading={Boolean(classId) && masteryQuery.isLoading}
        />
        <StatChip
          icon={<StarOutlined />}
          label="Santri di Kelas"
          value={classId ? students.length : '–'}
          color="sky"
          loading={Boolean(classId) && studentsQuery.isLoading}
        />
      </div>

      {hasError ? (
        <Card>
          <Result
            status="error"
            title="Data gagal dimuat"
            subTitle="Periksa koneksi internet, lalu coba lagi."
            extra={
              <Button type="primary" onClick={retry}>
                Coba lagi
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          {/* Belum pilih kelas: butir tetap terlihat di bawah */}
          {!classId && (
            <Alert
              type="info"
              showIcon
              message="Pilih kelas untuk mengisi kemahiran & nilai ibadah santri"
              description="Daftar butir di bawah tetap bisa dikelola tanpa memilih kelas."
            />
          )}

          {/* Insight penguasaan kelas */}
          {insight && (
            <Card size="small">
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 220, flex: '1 1 260px' }}>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Penguasaan {className || 'kelas'} · {WORSHIP_CATEGORY_LABEL[category]}
                  </Typography.Text>
                  <Progress
                    percent={insight.percent}
                    status={insight.percent === 100 ? 'success' : 'active'}
                    style={{ marginBottom: 0 }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  <div>
                    <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                      Belum punya bintang
                    </Typography.Text>
                    <Typography.Text strong>{insight.noStars} santri</Typography.Text>
                  </div>
                  {insight.hardest && (
                    <div>
                      <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                        Butir paling sulit
                      </Typography.Text>
                      <Typography.Text strong>
                        {insight.hardest.label} ({insight.hardest.percent}%)
                      </Typography.Text>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Papan kelas (hanya setelah pilih kelas) */}
          {classId &&
            (itemsQuery.isLoading || masteryQuery.isLoading || (mode === 'scores' && scoresQuery.isLoading) ? (
              <Card>
                <div style={{ textAlign: 'center', padding: 36 }}>
                  <Spin size="large" />
                </div>
              </Card>
            ) : items.length === 0 ? null : students.length === 0 ? (
              <Card>
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Tidak ada santri aktif di kelas ini" />
              </Card>
            ) : mode === 'mastery' ? (
              <MasteryGrid
                category={category}
                items={items}
                students={studentOptions}
                mastery={mastery}
                starsByStudent={starsByStudent}
                search={search}
                canWrite={canWrite}
                onOpenSpiritualDrawer={(s) => setSpiritualStudent({ id: s.id, name: s.name, class_name: className })}
                deleting={deleteItem.isPending}
                onDeleteItem={handleDelete}
              />
            ) : (
              <ScoresGrid
                category={category}
                items={items}
                students={studentOptions}
                scores={scores}
                year={month.year()}
                monthValue={month.month() + 1}
                search={search}
                canWrite={canWrite}
              />
            ))}

          {/* Daftar butir: selalu terlihat */}
          <ItemsPanel
            items={items}
            loading={itemsQuery.isLoading}
            canWrite={canWrite}
            open={itemsOpen}
            onToggle={() => setItemsOpenPref(!itemsOpen)}
            studentCount={classId && !studentsQuery.isLoading ? students.length : undefined}
            masteredByItem={masteredByItem}
            allPresetsExist={allPresetsExist}
            loadingPresets={loadPresets.isPending}
            deleting={deleteItem.isPending}
            saving={updateItem.isPending || reorderItems.isPending}
            onAdd={openForm}
            onLoadPresets={handleLoadPresets}
            onDelete={handleDelete}
            onRename={handleRename}
            onMove={handleMove}
          />
        </>
      )}

      {/* Modal Tambah Butir */}
      <WorshipItemModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        category={category}
        values={formValues}
        setValues={setFormValues}
        loading={createItem.isPending}
        onSubmit={submitCreate}
      />

      {/* Modal Ekspor */}
      {classId && (
        <WorshipExportModal
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          category={category}
          className={className}
          items={items}
          students={studentOptions}
          mastery={mastery}
        />
      )}

      {/* Modal Impor Excel */}
      {classId && (
        <WorshipImportModal
          open={importOpen}
          onClose={() => setImportOpen(false)}
          category={category}
          className={className}
          items={items}
          students={studentOptions}
          onSuccess={() => {
            void masteryQuery.refetch()
          }}
        />
      )}

      {/* Drawer Analisis Capaian Kelas */}
      {classId && (
        <ClassAnalyticsDrawer
          open={analyticsOpen}
          onClose={() => setAnalyticsOpen(false)}
          category={category}
          className={className}
          items={items}
          totalStudents={students.length}
          mastery={mastery}
        />
      )}

      {/* Modal Cetak Lembar Pantau Ibadah */}
      {classId && (
        <WorshipPrintSheet
          open={printOpen}
          onClose={() => setPrintOpen(false)}
          category={category}
          className={className}
          items={items}
          students={studentOptions}
          mastery={mastery}
        />
      )}

      {/* Drawer Profil Spiritual Terpadu & Evaluasi Cepat */}
      <WorshipDrawer
        open={Boolean(spiritualStudent)}
        onClose={() => setSpiritualStudent(null)}
        student={spiritualStudent}
        canWrite={canWrite}
      />
    </div>
  )
}
