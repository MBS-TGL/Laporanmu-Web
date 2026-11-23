import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { App, Button, type InputRef } from 'antd'
import { ShortcutsModal } from '../../shared/components/ShortcutsModal'
import { useShortcuts } from '../../shared/hooks/useShortcuts'
import { useDebounce } from '../../shared/hooks/useDebounce'
import { usePermissions } from '../../shared/hooks/useProfile'
import { useTablePagination } from '../../shared/hooks/useTablePagination'
import { formatDisplayName } from '../../shared/utils/displayName'
import {
  useAlumni,
  useBulkDeleteStudents,
  useBulkRestoreStudents,
  useBulkRevertGraduation,
  useCreateAlumni,
  useDeleteStudent,
  useExistingAlumniKeys,
  useRestoreGraduationSnapshots,
  useRestoreStudent,
  useRevertGraduation,
  useStudentPhotos,
  useUpdateAlumni,
} from './hooks'
import { fetchAlumniWithPointsHistory, type AlumniFormValues } from './api'
const DetailDrawer = lazy(() =>
  import('./components/DetailDrawer').then((m) => ({ default: m.DetailDrawer })),
)
import { ExportModal } from './components/ExportModal'
import { AlumniForm } from './components/AlumniForm'
import { AlumniImport } from './components/AlumniImport'
import { useAlumniColumns, type AlumniSort } from './components/AlumniColumns'
import { AlumniTab, alumniShortcuts } from './tabs/AlumniTab'
import type { Gender, GraduationSnapshot, Student } from './types'

/** Jejak siswa yang telah graduated: daftar alumni + profil + edit + pembatalan kelulusan */
export function AlumniPage({ active }: { active: boolean }) {
  const { message } = App.useApp()
  const { canWrite, canDelete } = usePermissions()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 350)
  const [gender, setGender] = useState<Gender | undefined>()
  const [year, setYear] = useState<number | undefined>()
  const [lastClassId, setLastClassId] = useState<string | undefined>()
  const [sortBy, setSortBy] = useState<AlumniSort>('graduated_desc')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [privacy, setPrivacy] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportScope, setExportScope] = useState<'filtered' | 'selected'>('filtered')
  const [editing, setEditing] = useState<Student | null>(null)
  const [detail, setDetail] = useState<Student | null>(null)
  const [pointsHistoryIds, setPointsHistoryIds] = useState<Set<string>>(new Set())

  const searchInputRef = useRef<InputRef>(null)

  const alumniQuery = useAlumni()

  const existingKeysQuery = useExistingAlumniKeys(formOpen)
  const revertMutation = useRevertGraduation()
  const bulkRevertMutation = useBulkRevertGraduation()
  const restoreSnapshotsMutation = useRestoreGraduationSnapshots()
  const deleteMutation = useDeleteStudent()
  const bulkDeleteMutation = useBulkDeleteStudents()
  const restoreMutation = useRestoreStudent()
  const bulkRestoreMutation = useBulkRestoreStudents()
  const createAlumniMutation = useCreateAlumni()
  const updateAlumniMutation = useUpdateAlumni()

  const allAlumni = useMemo(() => alumniQuery.data?.data ?? [], [alumniQuery.data])
  // Total dari server — untuk mendeteksi daftar terpotong batas 1000
  const totalAlumni = alumniQuery.data?.total ?? 0
  const isTruncated = totalAlumni > allAlumni.length

  // Identifikasi alumni yang memiliki riwayat laporan poin
  useEffect(() => {
    if (allAlumni.length === 0) {
      setPointsHistoryIds(new Set())
      return
    }

    // Alumni dengan total_points !== 0 sudah pasti punya riwayat
    const nonZeroIds = allAlumni.filter((s) => (s.total_points ?? 0) !== 0).map((s) => s.id)
    const zeroIds = allAlumni.filter((s) => (s.total_points ?? 0) === 0).map((s) => s.id)

    let cancelled = false
    void fetchAlumniWithPointsHistory(zeroIds).then((historyZeroSet) => {
      if (cancelled) return
      const combined = new Set([...nonZeroIds, ...historyZeroSet])
      setPointsHistoryIds(combined)
    })

    return () => {
      cancelled = true
    }
  }, [allAlumni])

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const selectedStudents = useMemo(
    () => allAlumni.filter((s) => selectedIdSet.has(s.id)),
    [allAlumni, selectedIdSet],
  )

  const rows = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    const data = allAlumni.filter((s) => {
      if (
        q &&
        !`${s.name} ${s.registration_code} ${s.nisn ?? ''} ${s.last_class?.name ?? s.classes?.name ?? ''}`
          .toLowerCase()
          .includes(q)
      )
        return false
      if (gender && s.gender !== gender) return false
      if (year && s.graduation_year !== year) return false
      if (lastClassId && s.last_class_id !== lastClassId) return false
      return true
    })

    const cmpName = (a: Student, b: Student) => a.name.localeCompare(b.name, 'id')
    const cmpGraduated = (a: Student, b: Student) =>
      (b.graduated_at ?? '').localeCompare(a.graduated_at ?? '') || cmpName(a, b)
    const cmpYear = (a: Student, b: Student) =>
      (b.graduation_year ?? 0) - (a.graduation_year ?? 0) || cmpGraduated(a, b)
    const cmpPoints = (a: Student, b: Student) => b.total_points - a.total_points || cmpName(a, b)

    const comparators: Record<AlumniSort, (a: Student, b: Student) => number> = {
      name_asc: cmpName,
      name_desc: (a, b) => cmpName(b, a),
      graduated_desc: cmpGraduated,
      graduated_asc: (a, b) => cmpGraduated(b, a),
      year_desc: cmpYear,
      year_asc: (a, b) => cmpYear(b, a),
      points_desc: cmpPoints,
      points_asc: (a, b) => cmpPoints(b, a),
    }
    return [...data].sort(comparators[sortBy])
  }, [allAlumni, debouncedSearch, gender, year, lastClassId, sortBy])

  const pg = useTablePagination(rows.length, { label: 'alumni', defaultPageSize: 15 })

  const paginatedRows = useMemo(
    () => rows.slice((pg.page - 1) * pg.pageSize, pg.page * pg.pageSize),
    [rows, pg.page, pg.pageSize],
  )

  // A1: Ambil foto on-demand hanya untuk baris yang tampil (hindari payload base64 massal).
  const visibleIds = useMemo(() => paginatedRows.map((r) => r.id), [paginatedRows])
  const photosQuery = useStudentPhotos(visibleIds)
  const photos = photosQuery.data ?? {}

  const resetPage = pg.reset

  const clearAllFilters = () => {
    setSearch('')
    setGender(undefined)
    setYear(undefined)
    setLastClassId(undefined)
    setSortBy('graduated_desc')
    setSelectedIds([])
    resetPage()
  }

  const allFilteredSelected = rows.length > 0 && rows.every((r) => selectedIdSet.has(r.id))

  const toggleSelectAll = () => {
    // Memilih semua baris HASIL FILTER (lintas halaman) — bukan hanya halaman aktif
    const filteredIds = rows.map((r) => r.id)
    const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIdSet.has(id))
    setSelectedIds(
      allSelected
        ? selectedIds.filter((id) => !filteredIds.includes(id))
        : Array.from(new Set([...selectedIds, ...filteredIds])),
    )
  }

  const openExport = (scope: 'filtered' | 'selected') => {
    setExportScope(scope)
    setExportOpen(true)
  }

  const openEdit = (student: Student) => {
    setEditing(student)
    setFormOpen(true)
  }

  const togglePrivacy = () => {
    const next = !privacy
    setPrivacy(next)
    message.info(
      next ? 'Mode privasi diaktifkan — Data sensitif disembunyikan' : 'Mode privasi dinonaktifkan',
    )
  }

  const handleRevert = (student: Student) => {
    revertMutation.mutate(student.id, {
      onSuccess: () => {
        message.success(`${formatDisplayName(student.name)} dikembalikan menjadi siswa aktif`)
        setSelectedIds((prev) => prev.filter((id) => id !== student.id))
        setDetail((current) => (current?.id === student.id ? null : current))
      },
      onError: (err: Error) => message.error(err.message || 'Gagal membatalkan kelulusan'),
    })
  }

  const openAddAlumni = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openImport = () => {
    setImportOpen(true)
  }

  const handleSubmitAlumni = (values: AlumniFormValues) => {
    if (editing) {
      updateAlumniMutation.mutate(
        { id: editing.id, values },
        {
          onSuccess: (updated) => {
            message.success('Data alumni berhasil diperbarui')
            setFormOpen(false)
            setEditing(null)
            setDetail((current) => (current?.id === updated.id ? updated : current))
          },
          onError: (err: Error) => message.error(err.message || 'Gagal memperbarui alumni'),
        },
      )
    } else {
      createAlumniMutation.mutate(values, {
        onSuccess: () => {
          message.success('Alumni baru berhasil ditambahkan')
          setFormOpen(false)
          setEditing(null)
        },
        onError: (err: Error) => message.error(err.message || 'Gagal menambahkan alumni'),
      })
    }
  }

  /** Toast undo pembatalan massal — pulihkan jejak kelulusan dari snapshot sebelum revert */
  const showRevertUndoToast = (snapshots: GraduationSnapshot[]) => {
    const count = snapshots.length
    const key = `undo-revert-${Date.now()}`
    message.open({
      key,
      type: 'success',
      duration: 6,
      // AntD v6: message.open tidak lagi punya properti `btn` — tombol ikut di content
      content: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>
            {count === 1 ? '1 alumni dikembalikan' : `${count} alumni dikembalikan menjadi siswa aktif`}
          </span>
          <Button
            size="small"
            type="primary"
            loading={restoreSnapshotsMutation.isPending}
            onClick={() => {
              message.destroy(key)
              restoreSnapshotsMutation.mutate(snapshots, {
                onSuccess: () =>
                  message.success(
                    count === 1 ? 'Kelulusan dipulihkan' : `${count} kelulusan dipulihkan`,
                  ),
                onError: (err: Error) => message.error(err.message || 'Gagal memulihkan kelulusan'),
              })
            }}
          >
            Batalkan
          </Button>
        </div>
      ),
    })
  }

  const bulkRevert = () => {
    const count = selectedStudents.length
    if (count === 0) return
    // Snapshot jejak kelulusan sebelum revert — dipakai tombol "Batalkan" di toast
    const snapshots: GraduationSnapshot[] = selectedStudents.map((s) => ({
      id: s.id,
      graduated_at: s.graduated_at,
      graduation_year: s.graduation_year,
      last_class_id: s.last_class_id,
    }))
    bulkRevertMutation
      .mutateAsync(snapshots.map((s) => s.id))
      .then(() => {
        setSelectedIds([])
        showRevertUndoToast(snapshots)
      })
      .catch((err: Error) => message.error(err.message || 'Gagal membatalkan kelulusan'))
  }

  /** Toast undo penghapusan (arsip) massal */
  const showBulkDeleteUndoToast = (ids: string[], count: number) => {
    const key = `undo-bulk-delete-${Date.now()}`
    message.open({
      key,
      type: 'success',
      duration: 6,
      content: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>{count === 1 ? '1 alumni diarsipkan' : `${count} alumni diarsipkan`}</span>
          <Button
            size="small"
            type="primary"
            onClick={() => {
              message.destroy(key)
              bulkRestoreMutation.mutate(ids, {
                onSuccess: () =>
                  message.success(count === 1 ? 'Alumni dipulihkan' : `${count} alumni dipulihkan`),
                onError: (err: Error) => message.error(err.message || 'Gagal memulihkan alumni'),
              })
            }}
          >
            Batalkan
          </Button>
        </div>
      ),
    })
  }

  /** Toast undo penghapusan (arsip) single */
  const showSingleDeleteUndoToast = (id: string, name: string) => {
    const key = `undo-single-delete-${Date.now()}`
    message.open({
      key,
      type: 'success',
      duration: 6,
      content: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>{`${formatDisplayName(name)} diarsipkan`}</span>
          <Button
            size="small"
            type="primary"
            onClick={() => {
              message.destroy(key)
              restoreMutation.mutate(id, {
                onSuccess: () => message.success('Alumni dipulihkan'),
                onError: (err: Error) => message.error(err.message || 'Gagal memulihkan alumni'),
              })
            }}
          >
            Batalkan
          </Button>
        </div>
      ),
    })
  }

  const handleDelete = (student: Student) => {
    deleteMutation.mutate(student.id, {
      onSuccess: () => {
        setSelectedIds((prev) => prev.filter((id) => id !== student.id))
        setDetail((current) => (current?.id === student.id ? null : current))
        showSingleDeleteUndoToast(student.id, student.name)
      },
      onError: (err: Error) => message.error(err.message || 'Gagal menghapus alumni'),
    })
  }

  const bulkDelete = () => {
    const ids = selectedIds
    const count = ids.length
    if (count === 0) return
    bulkDeleteMutation
      .mutateAsync(ids)
      .then(() => {
        setSelectedIds([])
        showBulkDeleteUndoToast(ids, count)
      })
      .catch((err: Error) => message.error(err.message || 'Gagal menghapus alumni'))
  }

  const columns = useAlumniColumns({
    privacy,
    photos,
    pointsHistoryIds,
    sortBy,
    canWrite,
    canDelete,
    revertMutation,
    deleteMutation,
    onDetail: setDetail,
    onRevert: handleRevert,
    onDelete: handleDelete,
  })

  const isBlocked = !active || exportOpen || detail !== null || formOpen

  const shortcutItems = alumniShortcuts({
    searchInputRef,
    setShowAdvanced,
    clearAllFilters,
    toggleSelectAll,
    openExport,
    togglePrivacy,
    refetchAlumni: alumniQuery.refetch,
    toggleShortcuts: () => shortcuts.toggle(),
  })

  const shortcuts = useShortcuts({ items: shortcutItems, isBlocked })

  return (
    <div>
      <AlumniTab
        active={active}
        alumniQuery={alumniQuery}
        allAlumni={allAlumni}
        rows={rows}
        paginatedRows={paginatedRows}
        columns={columns}
        pagination={pg.pagination}
        search={search}
        setSearch={setSearch}
        debouncedSearch={debouncedSearch}
        gender={gender}
        setGender={setGender}
        year={year}
        setYear={setYear}
        lastClassId={lastClassId}
        setLastClassId={setLastClassId}
        sortBy={sortBy}
        setSortBy={setSortBy}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        privacy={privacy}
        togglePrivacy={togglePrivacy}
        showAdvanced={showAdvanced}
        setShowAdvanced={setShowAdvanced}
        searchInputRef={searchInputRef}
        resetPage={resetPage}
        clearAllFilters={clearAllFilters}
        toggleSelectAll={toggleSelectAll}
        allFilteredSelected={allFilteredSelected}
        pointsHistoryIds={pointsHistoryIds}
        isTruncated={isTruncated}
        totalAlumni={totalAlumni}
        canWrite={canWrite}
        canDelete={canDelete}
        openAddAlumni={openAddAlumni}
        openImport={openImport}
        openExport={openExport}
        bulkRevert={bulkRevert}
        bulkDelete={bulkDelete}
        bulkRevertMutation={bulkRevertMutation}
        bulkDeleteMutation={bulkDeleteMutation}
        shortcuts={shortcuts}
      />

      <AlumniForm
        open={formOpen}
        editingAlumni={editing}
        submitting={createAlumniMutation.isPending || updateAlumniMutation.isPending}
        existingStudents={existingKeysQuery.data ?? []}
        onCancel={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        onSubmit={handleSubmitAlumni}
      />

      <AlumniImport
        open={importOpen}
        onClose={() => setImportOpen(false)}
      />

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        filters={{
          status: 'graduated',
          search: debouncedSearch || undefined,
          gender,
          graduationYear: year,
          lastClassId,
          sortBy,
        }}
        selectedIds={selectedIds}
        defaultScope={exportScope}
        filteredCount={rows.length}
      />

      {detail !== null && (
        <Suspense fallback={null}>
          <DetailDrawer
            open={!!detail}
            student={detail}
            isPrivacyMode={privacy}
            onClose={() => setDetail(null)}
            onEdit={(student) => {
              setDetail(null)
              openEdit(student)
            }}
          />
        </Suspense>
      )}

      <ShortcutsModal open={shortcuts.isOpen} onClose={shortcuts.close} sections={shortcuts.sections} />
    </div>
  )
}
