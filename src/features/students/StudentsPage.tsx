import { useCallback, useEffect, useRef, useState } from 'react'
import { App, Button, Tabs, type InputRef, type TableProps } from 'antd'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../shared/components/PageHeader'
import { ShellItem, ShellStagger } from '../../shared/components/ShellMotion'
import { TabActionsContext } from '../../shared/components/ActionsSlot'
import { useShortcuts } from '../../shared/hooks/useShortcuts'
import { usePermissions, useProfile } from '../../shared/hooks/useProfile'
import { useUrlTab } from '../../shared/hooks/useUrlTab'
import { sortByFromTableChange } from '../../shared/utils/tableSort'
import {
  useBulkDeleteStudents,
  useBulkRestoreStudents,
  useCreateStudent,
  useDeleteStudent,
  useGenerateStudentPins,
  useSaveStudentGuardians,
  useUpdateStudent,
} from './hooks'
import { useStudentColumns, SORT_PAIRS } from './components/StudentColumns'
import { useHeaderMenu } from './components/HeaderMenu'
import { StudentModals } from './components/StudentModals'
import { useStudentPageState } from './components/useStudentPageState'
import { ActiveTab, studentShortcuts } from './tabs/ActiveTab'
import { WaliTab } from './tabs/WaliTab'
import { ArchivePage } from './ArchivePage'
import { AlumniPage } from './AlumniPage'
import { PromoteModal } from './PromotePage'
import type { Gender, MissingField, PointMode, Student, StudentFormValues } from './types'

// ─── Shell: satu halaman Santri bertab (pola ?tab= — SKILLS.md §Skill 2) ─────
const STUDENT_TAB_ITEMS = [
  { key: 'active', label: 'Santri Aktif' },
  { key: 'archive', label: 'Arsip' },
  { key: 'alumni', label: 'Alumni' },
  { key: 'guardian', label: 'Hub Wali' },
]

/** Judul & subtitle per tab — dirender shell di ATAS tab bar (pola AttendancePage). */
const STUDENT_TAB_META: Record<string, { title: string; subtitle: (total?: number) => string }> = {
  active: {
    title: 'Santri',
    subtitle: (total) => `Kelola ${total ?? '…'} santri aktif`,
  },
  archive: {
    title: 'Arsip Santri',
    subtitle: () => 'Pulihkan santri yang sudah diarsipkan',
  },
  alumni: {
    title: 'Alumni',
    subtitle: () => 'Jejak santri lulus, riwayat poin, rapor, dan log',
  },
  guardian: {
    title: 'Hub Wali',
    subtitle: () => 'Rekap ayah, ibu, dan wali per keluarga',
  },
}

/** Halaman Santri: aktif / arsip / alumni dalam satu route (?tab=), aksi kenaikan kelas = modal. */
export function StudentsPage() {
  const { tab, setTab } = useUrlTab('active', {
    keys: STUDENT_TAB_ITEMS.map((t) => t.key),
    legacy: { aktif: 'active', arsip: 'archive', wali: 'guardian' },
  })
  const { role } = useProfile()
  // RLS student_guardians: hanya developer/admin/manager yang bisa baca
  const canViewWali = Boolean(role && ['developer', 'admin', 'manager'].includes(role))
  const [promoteOpen, setPromoteOpen] = useState(false)
  const meta = STUDENT_TAB_META[tab] ?? STUDENT_TAB_META.active
  // Host aksi di ujung kanan tab bar — diisi tiap tab via useTabActions (ActionsSlot)
  const [actionsHost, setActionsHost] = useState<HTMLDivElement | null>(null)
  const active = tab === 'active'

  const { message } = App.useApp()
  const { canWrite, canDelete } = usePermissions()
  // Deep-link dari halaman lain (mis. ClassDrawer "Kelola santri", DetailDrawer asrama), dibaca sekali saat mount
  const [searchParams, setSearchParams] = useSearchParams()
  const searchInputRef = useRef<InputRef>(null)

  // State, query & memo turunan tab Santri Aktif
  const {
    search, setSearch, debouncedSearch, classId, setClassId, setDormId, tag, setTag,
    gender, setGender, status, setStatus, sortBy, setSortBy, missing, setMissing, pointMode, setPointMode,
    showAdvanced, setShowAdvanced, selectedIds, setSelectedIds, privacy, setPrivacy,
    formOpen, setFormOpen, importOpen, setImportOpen,
    resetOpen, setResetOpen, bulkPhotoOpen, setBulkPhotoOpen,
    exportOpen, setExportOpen, exportScope, setExportScope,
    moveOpen, setMoveOpen, graduateOpen, setGraduateOpen,
    waOpen, setWaOpen, waSettingsOpen, setWaSettingsOpen,
    cardStudents, setCardStudents, bulkCardOpen, setBulkCardOpen,
    scanOpen, setScanOpen, editing, setEditing, detail, setDetail,
    classesQuery, statsQuery, studentsQuery,
    allStudents, isRefreshing, totalActive, isTruncated,
    selectedIdSet, selectedStudents, alreadyPinned,
    tagOptions, noPinCount, rows, pg, paginatedRows, photos,
    resetPage, advFilterCount, filterChips,
  } = useStudentPageState({
    initialClassId: searchParams.get('classId') ?? undefined,
    initialDormId: searchParams.get('dormId') ?? undefined,
  })

  const createMutation = useCreateStudent()
  const updateMutation = useUpdateStudent()
  const saveGuardiansMutation = useSaveStudentGuardians()
  const generatePinsMutation = useGenerateStudentPins()
  const deleteMutation = useDeleteStudent()
  const bulkDeleteMutation = useBulkDeleteStudents()
  const bulkRestoreMutation = useBulkRestoreStudents()

  // D3: Deep-link ?student= untuk membuka drawer langsung via URL yang bisa dibagikan
  const openDetail = useCallback((student: Student) => {
    setDetail(student)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('student', student.id)
      return next
    }, { replace: true })
  }, [setSearchParams])

  const closeDetail = useCallback(() => {
    setDetail(null)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('student')
      return next
    }, { replace: true })
  }, [setSearchParams])

  // Sinkronisasi deep-link ?student= saat pertama kali data termuat
  const urlStudentId = searchParams.get('student')
  useEffect(() => {
    if (urlStudentId && allStudents.length > 0 && detail?.id !== urlStudentId) {
      const found = allStudents.find((s) => s.id === urlStudentId)
      if (found) setDetail(found)
    }
  }, [urlStudentId, allStudents, detail?.id])

  const clearAllFilters = () => {
    setSearch('')
    setClassId(undefined)
    setDormId(undefined)
    setTag(undefined)
    setGender(undefined)
    setStatus('active')
    setSortBy(undefined)
    setMissing(undefined)
    setPointMode(undefined)
    setSelectedIds([])
    resetPage()
  }

  const toggleSelectAll = useCallback(() => {
    const filteredIdSet = new Set(rows.map((r) => r.id))
    const allSelected = rows.length > 0 && rows.every((r) => selectedIdSet.has(r.id))
    setSelectedIds(
      allSelected
        ? selectedIds.filter((id) => !filteredIdSet.has(id))
        : Array.from(new Set([...selectedIds, ...filteredIdSet])),
    )
  }, [rows, selectedIdSet, selectedIds])

  const toggleGender = useCallback((g: Gender) => {
    setGender((prev) => (prev === g ? undefined : g))
    resetPage()
  }, [resetPage])

  const togglePointMode = useCallback((m: PointMode) => {
    setPointMode((prev) => (prev === m ? undefined : m))
    resetPage()
  }, [resetPage])

  const toggleMissing = useCallback((m: MissingField) => {
    setMissing((prev) => (prev === m ? undefined : m))
    resetPage()
  }, [resetPage])

  const handleWorstClass = useCallback((id: string) => {
    setClassId(id)
    resetPage()
  }, [resetPage])

  const handleWorstCompleteness = useCallback((id: string) => {
    setClassId(id)
    setMissing('any')
    resetPage()
  }, [resetPage])

  const handleRefresh = () => {
    void studentsQuery.refetch()
    void statsQuery.refetch()
  }

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (student: Student) => {
    setEditing(student)
    setFormOpen(true)
  }

  const openImport = () => setImportOpen(true)

  const togglePrivacy = () => {
    const next = !privacy
    setPrivacy(next)
    message.info(
      next ? 'Mode privasi diaktifkan — Data sensitif disembunyikan' : 'Mode privasi dinonaktifkan',
    )
  }

  const handleSubmit = (values: StudentFormValues) => {
    const onError = (err: Error) => message.error(err.message || 'Gagal menyimpan siswa')
    // Data ayah/ibu/wali disimpan via RPC terpisah (student_guardians, 0020) —
    // saat edit selalu dipanggil agar baris yang dikosongkan ikut di-soft-delete.
    const persistGuardians = (studentId: string) => {
      if (!editing && !values.guardians?.length) return Promise.resolve()
      return saveGuardiansMutation.mutateAsync({ studentId, rows: values.guardians ?? [] })
    }
    if (editing) {
      updateMutation.mutate(
        { id: editing.id, values },
        {
          onSuccess: (updated) => {
            persistGuardians(updated.id)
              .then(() => {
                message.success('Santri diperbarui')
                setFormOpen(false)
                // perbarui drawer bila sedang terbuka untuk siswa yang sama
                setDetail((current) => (current?.id === updated.id ? updated : current))
              })
              .catch((err: Error) =>
                message.error(err.message || 'Gagal menyimpan data orang tua'),
              )
          },
          onError,
        },
      )
    } else {
      createMutation.mutate(values, {
        onSuccess: (created) => {
          persistGuardians(created.id)
            .then(() => {
              message.success('Santri ditambahkan')
              setFormOpen(false)
            })
            .catch((err: Error) =>
              message.error(err.message || 'Santri tersimpan, tetapi data orang tua gagal disimpan'),
            )
        },
        onError,
      })
    }
  }

  /** Toast arsip dengan tombol Batalkan (pemulihan massal) */
  const showUndoToast = (ids: string[], count: number) => {
    const key = `undo-${Date.now()}`
    message.open({
      key,
      type: 'success',
      duration: 6,
      // AntD v6: message.open tidak lagi punya properti `btn` — tombol ikut di content
      content: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>{count === 1 ? '1 siswa diarsipkan' : `${count} siswa diarsipkan`}</span>
          <Button
            size="small"
            type="primary"
            onClick={() => {
              message.destroy(key)
              bulkRestoreMutation.mutate(ids, {
                onSuccess: () =>
                  message.success(count === 1 ? 'Santri dipulihkan' : `${count} siswa dipulihkan`),
                onError: (err: Error) => message.error(err.message || 'Gagal memulihkan siswa'),
              })
            }}
          >
            Batalkan
          </Button>
        </div>
      ),
    })
  }

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        message.success('Santri diarsipkan')
        // bersihkan dari seleksi massal bila siswa ini sedang dipilih
        setSelectedIds((prev) => prev.filter((sid) => sid !== id))
        setDetail((current) => (current?.id === id ? null : current))
        showUndoToast([id], 1)
      },
      onError: (err: Error) => message.error(err.message || 'Gagal mengarsipkan siswa'),
    })
  }

  const openExport = (scope: 'filtered' | 'selected') => {
    setExportScope(scope)
    setExportOpen(true)
  }

  const bulkArchive = (ids: string[]) => {
    const count = ids.length
    bulkDeleteMutation
      .mutateAsync(ids)
      .then(() => {
        setSelectedIds([])
        showUndoToast(ids, count)
      })
      .catch((err: Error) => message.error(err.message || 'Gagal mengarsipkan siswa'))
  }

  /** Generate PIN portal wali massal untuk siswa terpilih (RPC 0021) */
  const bulkGeneratePins = (ids: string[]) => {
    generatePinsMutation
      .mutateAsync(ids)
      .then((results) => {
        message.success(
          results.length === 1 ? '1 PIN berhasil dibuat' : `${results.length} PIN berhasil dibuat`,
        )
      })
      .catch((err: Error) => message.error(err.message || 'Gagal membuat PIN'))
  }

  // -------------------------------------------------------------------------
  // Menu "Lainnya" di header
  // -------------------------------------------------------------------------

  const headerMenu = useHeaderMenu({
    canWrite,
    onImport: openImport,
    onExport: () => openExport('filtered'),
    onBulkPhoto: () => setBulkPhotoOpen(true),
    onWaSettings: () => setWaSettingsOpen(true),
    onBulkCard: () => setBulkCardOpen(true),
    onOpenPromote: () => setPromoteOpen(true),
    onResetPoints: () => setResetOpen(true),
  })

  // -------------------------------------------------------------------------
  // Shortcut keyboard (juga menjadi isi palet "?")
  // -------------------------------------------------------------------------

  const isBlocked =
    !active ||
    formOpen ||
    importOpen ||
    resetOpen ||
    bulkPhotoOpen ||
    exportOpen ||
    promoteOpen ||
    moveOpen ||
    graduateOpen ||
    waOpen ||
    waSettingsOpen ||
    scanOpen ||
    cardStudents !== null ||
    bulkCardOpen ||
    detail !== null

  const shortcutItems = studentShortcuts({
    searchInputRef,
    setShowAdvanced,
    clearAllFilters,
    toggleSelectAll,
    openExport,
    openCreate,
    setImportOpen,
    setBulkPhotoOpen,
    setScanOpen,
    setBulkCardOpen,
    setWaSettingsOpen,
    onNavigateTab: setTab,
    togglePrivacy,
    handleRefresh,
    toggleShortcuts: () => shortcuts.toggle(),
    canWrite,
  })

  const shortcuts = useShortcuts({ items: shortcutItems, isBlocked })

  // -------------------------------------------------------------------------
  // Kolom tabel
  // -------------------------------------------------------------------------

  const handleTableChange: TableProps<Student>['onChange'] = (_pagination, _filters, sorter, extra) => {
    if (extra.action !== 'sort') return
    const s = Array.isArray(sorter) ? sorter[0] : sorter
    setSortBy(sortByFromTableChange(s, SORT_PAIRS))
    resetPage()
  }

  const columns = useStudentColumns({
    privacy,
    photos,
    sortBy,
    rows,
    canWrite,
    canDelete,
    onDetail: openDetail,
    onCard: (s) => setCardStudents([s]),
    onEdit: openEdit,
    onDelete: handleDelete,
    onTagClick: (t) => {
      setTag(t)
      resetPage()
    },
  })

  return (
    <TabActionsContext.Provider value={actionsHost}>
      <ShellStagger>
        <ShellItem>
          <PageHeader
            title={meta.title}
            subtitle={meta.subtitle(statsQuery.data?.total)}
            extra={<div ref={setActionsHost} style={{ display: 'flex', alignItems: 'center' }} />}
          />
        </ShellItem>
        <ShellItem>
          <Tabs
            activeKey={tab}
            onChange={setTab}
            items={STUDENT_TAB_ITEMS.filter((t) => t.key !== 'guardian' || canViewWali).map((t) => ({
              ...t,
              children:
                t.key === 'active' ? (
                  <ActiveTab
                    active={active}
                    studentsQuery={studentsQuery}
                    stats={statsQuery.data}
                    statsPending={statsQuery.isPending}
                    isRefreshing={isRefreshing}
                    shortcuts={shortcuts}
                    headerMenu={headerMenu}
                    columns={columns}
                    classesQuery={classesQuery}
                    pagination={pg.pagination}
                    search={search}
                    setSearch={setSearch}
                    status={status}
                    setStatus={setStatus}
                    gender={gender}
                    setGender={setGender}
                    classId={classId}
                    setClassId={setClassId}
                    tag={tag}
                    setTag={setTag}
                    sortBy={sortBy}
                    setSortBy={setSortBy}
                    missing={missing}
                    setMissing={setMissing}
                    pointMode={pointMode}
                    setPointMode={setPointMode}
                    showAdvanced={showAdvanced}
                    setShowAdvanced={setShowAdvanced}
                    selectedIds={selectedIds}
                    setSelectedIds={setSelectedIds}
                    privacy={privacy}
                    togglePrivacy={togglePrivacy}
                    searchInputRef={searchInputRef}
                    resetPage={resetPage}
                    clearAllFilters={clearAllFilters}
                    advFilterCount={advFilterCount}
                    filterChips={filterChips}
                    tagOptions={tagOptions}
                    allStudents={allStudents}
                    rows={rows}
                    paginatedRows={paginatedRows}
                    totalActive={totalActive}
                    isTruncated={isTruncated}
                    canWrite={canWrite}
                    noPinCount={noPinCount}
                    toggleGender={toggleGender}
                    togglePointMode={togglePointMode}
                    toggleMissing={toggleMissing}
                    handleWorstClass={handleWorstClass}
                    handleWorstCompleteness={handleWorstCompleteness}
                    handleRefresh={handleRefresh}
                    handleTableChange={handleTableChange}
                    selectedStudents={selectedStudents}
                    selectedIdSet={selectedIdSet}
                    alreadyPinned={alreadyPinned}
                    setCardStudents={setCardStudents}
                    setMoveOpen={setMoveOpen}
                    setGraduateOpen={setGraduateOpen}
                    setWaOpen={setWaOpen}
                    setScanOpen={setScanOpen}
                    openCreate={openCreate}
                    openImport={openImport}
                    openExport={openExport}
                    bulkArchive={bulkArchive}
                    bulkGeneratePins={bulkGeneratePins}
                    bulkDeleteMutation={bulkDeleteMutation}
                    generatePinsMutation={generatePinsMutation}
                  />
                ) : t.key === 'archive' ? (
                  <ArchivePage active={tab === 'archive'} />
                ) : t.key === 'guardian' ? (
                  <WaliTab active={tab === 'guardian'} />
                ) : (
                  <AlumniPage active={tab === 'alumni'} />
                ),
            }))}
          />
        </ShellItem>
      </ShellStagger>

      <StudentModals
        formOpen={formOpen}
        setFormOpen={setFormOpen}
        editing={editing}
        submitting={createMutation.isPending || updateMutation.isPending}
        onSubmit={handleSubmit}
        importOpen={importOpen}
        setImportOpen={setImportOpen}
        exportOpen={exportOpen}
        setExportOpen={setExportOpen}
        exportFilters={{
          search: debouncedSearch || undefined,
          classId,
          gender,
          status: status || undefined,
          sortBy,
          missing,
          pointMode,
        }}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        exportScope={exportScope}
        filteredCount={rows.length}
        moveOpen={moveOpen}
        setMoveOpen={setMoveOpen}
        graduateOpen={graduateOpen}
        setGraduateOpen={setGraduateOpen}
        waOpen={waOpen}
        setWaOpen={setWaOpen}
        selectedStudents={selectedStudents}
        classes={classesQuery.data ?? []}
        waSettingsOpen={waSettingsOpen}
        setWaSettingsOpen={setWaSettingsOpen}
        cardStudents={cardStudents}
        setCardStudents={setCardStudents}
        bulkCardOpen={bulkCardOpen}
        setBulkCardOpen={setBulkCardOpen}
        allStudents={allStudents}
        rows={rows}
        resetOpen={resetOpen}
        setResetOpen={setResetOpen}
        classId={classId}
        bulkPhotoOpen={bulkPhotoOpen}
        setBulkPhotoOpen={setBulkPhotoOpen}
        scanOpen={scanOpen}
        setScanOpen={setScanOpen}
        openDetail={openDetail}
        detail={detail}
        privacy={privacy}
        closeDetail={closeDetail}
        openEdit={openEdit}
        shortcuts={shortcuts}
      />

      <PromoteModal open={promoteOpen} onClose={() => setPromoteOpen(false)} />
    </TabActionsContext.Provider>
  )
}
