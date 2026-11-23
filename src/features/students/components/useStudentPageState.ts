import { useMemo, useState } from 'react'
import type { FilterChip } from '../../../shared/components/FilterChips'
import { useDebounce } from '../../../shared/hooks/useDebounce'
import { useTablePagination } from '../../../shared/hooks/useTablePagination'
import { matchesStudentList } from '../filterStudents'
import {
  useClassesBrief,
  useStudentPhotos,
  useStudentStats,
  useStudents,
  useDormsBrief as useDorms,
} from '../hooks'
import { STUDENT_STATUS_META } from '../status'
import { SORT_OPTIONS, MISSING_OPTIONS, POINT_OPTIONS } from '../tabs/ActiveTab'
import type {
  Gender,
  MissingField,
  PointMode,
  SortOption,
  Student,
  StudentStatus,
} from '../types'

/**
 * State, query, dan memo turunan tab Santri Aktif.
 * Handler UI & mutasi tetap di StudentsPage — hook ini hanya data + turunannya.
 */
export function useStudentPageState({
  initialClassId,
  initialDormId,
}: {
  /** Deep-link dari halaman lain (mis. ClassDrawer "Kelola santri"), dibaca sekali saat mount */
  initialClassId?: string
  /** Deep-link asrama dari halaman lain (mis. DetailDrawer asrama), dibaca sekali saat mount */
  initialDormId?: string
} = {}) {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 350)
  const [classId, setClassId] = useState<string | undefined>(initialClassId)
  const [dormId, setDormId] = useState<string | undefined>(initialDormId)
  const [tag, setTag] = useState<string | undefined>()
  const [gender, setGender] = useState<Gender | undefined>()
  // Default hanya aktif — lulus/pindah/keluar tetap bisa dilihat lewat tab "Semua"
  const [status, setStatus] = useState<StudentStatus | ''>('active')
  const [sortBy, setSortBy] = useState<SortOption | undefined>()
  const [missing, setMissing] = useState<MissingField | undefined>()
  const [pointMode, setPointMode] = useState<PointMode | undefined>()
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [privacy, setPrivacy] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [bulkPhotoOpen, setBulkPhotoOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportScope, setExportScope] = useState<'filtered' | 'selected'>('filtered')
  const [moveOpen, setMoveOpen] = useState(false)
  const [graduateOpen, setGraduateOpen] = useState(false)
  const [waOpen, setWaOpen] = useState(false)
  const [waSettingsOpen, setWaSettingsOpen] = useState(false)
  /** 'selection' = kartu untuk semua siswa terpilih; Student = kartu satu siswa dari aksi baris */
  const [cardStudents, setCardStudents] = useState<Student[] | null>(null)
  const [bulkCardOpen, setBulkCardOpen] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)
  const [editing, setEditing] = useState<Student | null>(null)
  const [detail, setDetail] = useState<Student | null>(null)

  const classesQuery = useClassesBrief()
  const dormsQuery = useDorms()
  const statsQuery = useStudentStats()

  // Pola Esceha.id: fetch semua santri aktif SEKALI (volume ratusan), lalu
  // filter + sort + paginate di memori — klik sort/filter terasa instan
  // karena tidak ada round-trip jaringan per klik.
  const studentsQuery = useStudents({ page: 1, pageSize: 1000 })
  const allStudents = useMemo(() => studentsQuery.data?.data ?? [], [studentsQuery.data])
  const isRefreshing = studentsQuery.isFetching || statsQuery.isFetching

  // Total dari server — untuk mendeteksi daftar terpotong batas 1000
  const totalActive = studentsQuery.data?.total ?? 0
  const isTruncated = totalActive > allStudents.length

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const selectedStudents = useMemo(
    () => allStudents.filter((s) => selectedIdSet.has(s.id)),
    [allStudents, selectedIdSet],
  )
  const alreadyPinned = selectedStudents.filter((s) => s.has_pin ?? !!s.pin).length

  // D2: Kumpulan seluruh tag siswa untuk filter lanjutan
  const tagOptions = useMemo(() => {
    const set = new Set<string>()
    for (const s of allStudents) {
      for (const t of s.tags ?? []) set.add(t)
    }
    return Array.from(set).sort().map((t) => ({ value: t, label: t }))
  }, [allStudents])

  // D1: Jumlah siswa aktif yang belum punya PIN portal wali
  const noPinCount = useMemo(
    () => allStudents.filter((s) => s.status === 'active' && !(s.has_pin ?? !!s.pin)).length,
    [allStudents],
  )

  const rows = useMemo(() => {
    const data = allStudents.filter((s) =>
      matchesStudentList(s, {
        search: debouncedSearch,
        classId,
        dormId,
        tag,
        gender,
        status: status || undefined,
        missing,
        pointMode,
      }),
    )

    const cmpName = (a: Student, b: Student) => a.name.localeCompare(b.name, 'id')
    // numeric: true agar kelas urut alami (8A < 9A < 10A, bukan 10A < 8A)
    const cmpClass = (a: Student, b: Student) =>
      (a.classes?.name ?? '').localeCompare(b.classes?.name ?? '', 'id', { numeric: true }) ||
      cmpName(a, b)
    const cmpStatus = (a: Student, b: Student) =>
      STUDENT_STATUS_META[a.status].label.localeCompare(
        STUDENT_STATUS_META[b.status].label,
        'id',
      ) || cmpName(a, b)
    const cmpPoints = (a: Student, b: Student) =>
      a.total_points - b.total_points || cmpName(a, b)
    const cmpUpdated = (a: Student, b: Student) =>
      (b.updated_at ?? '').localeCompare(a.updated_at ?? '') || cmpName(a, b)

    const comparators: Record<SortOption, (a: Student, b: Student) => number> = {
      name_asc: cmpName,
      name_desc: (a, b) => cmpName(b, a),
      class_asc: cmpClass,
      class_desc: (a, b) => cmpClass(b, a),
      status_asc: cmpStatus,
      status_desc: (a, b) => cmpStatus(b, a),
      points_asc: cmpPoints,
      points_desc: (a, b) => cmpPoints(b, a),
      updated_desc: cmpUpdated,
      graduated_desc: (a, b) =>
        (b.graduated_at ?? '').localeCompare(a.graduated_at ?? '') || cmpName(a, b),
      graduated_asc: (a, b) =>
        (a.graduated_at ?? '').localeCompare(b.graduated_at ?? '') || cmpName(a, b),
      year_desc: (a, b) => (b.graduation_year ?? 0) - (a.graduation_year ?? 0) || cmpName(a, b),
      year_asc: (a, b) => (a.graduation_year ?? 0) - (b.graduation_year ?? 0) || cmpName(a, b),
    }
    return [...data].sort(comparators[sortBy ?? 'name_asc'])
  }, [allStudents, debouncedSearch, classId, dormId, tag, gender, status, missing, pointMode, sortBy])

  const pg = useTablePagination(rows.length, { label: 'siswa' })

  // Pagination client-side — slice dari hasil filter+sort di memori
  const paginatedRows = useMemo(
    () => rows.slice((pg.page - 1) * pg.pageSize, pg.page * pg.pageSize),
    [rows, pg.page, pg.pageSize],
  )

  // A1: Ambil foto on-demand hanya untuk baris yang tampil (hindari payload base64 massal).
  const visibleIds = useMemo(() => paginatedRows.map((r) => r.id), [paginatedRows])
  const photosQuery = useStudentPhotos(visibleIds)
  const photos = photosQuery.data ?? {}

  const resetPage = pg.reset

  // Jumlah filter lanjutan aktif — badge di tombol "Lainnya"
  const advFilterCount = useMemo(
    () => [classId, dormId, tag, sortBy, missing, pointMode].filter(Boolean).length,
    [classId, dormId, tag, sortBy, missing, pointMode],
  )

  // Chip filter aktif — bisa dihapus satu per satu
  const filterChips = useMemo<FilterChip[]>(() => {
    const chips: { key: string; label: string; onClear: () => void }[] = []
    if (debouncedSearch.trim())
      chips.push({
        key: 'search',
        label: `Cari: "${debouncedSearch.trim()}"`,
        onClear: () => {
          setSearch('')
          resetPage()
        },
      })
    if (classId) {
      const name = classesQuery.data?.find((c) => c.id === classId)?.name
      chips.push({
        key: 'class',
        label: `Kelas: ${name ?? classId}`,
        onClear: () => {
          setClassId(undefined)
          resetPage()
        },
      })
    }
    if (dormId) {
      const name = dormsQuery.data?.find((d) => d.id === dormId)?.name
      chips.push({
        key: 'dorm',
        label: `Asrama: ${name ?? dormId}`,
        onClear: () => {
          setDormId(undefined)
          resetPage()
        },
      })
    }
    if (tag) {
      chips.push({
        key: 'tag',
        label: `Label: ${tag}`,
        onClear: () => {
          setTag(undefined)
          resetPage()
        },
      })
    }
    if (sortBy) {
      const label = SORT_OPTIONS.find((o) => o.value === sortBy)?.label
      chips.push({
        key: 'sort',
        label: `Urut: ${label ?? sortBy}`,
        onClear: () => {
          setSortBy(undefined)
          resetPage()
        },
      })
    }
    if (missing)
      chips.push({
        key: 'missing',
        label: MISSING_OPTIONS.find((o) => o.value === missing)?.label ?? '',
        onClear: () => {
          setMissing(undefined)
          resetPage()
        },
      })
    if (pointMode)
      chips.push({
        key: 'points',
        label: POINT_OPTIONS.find((o) => o.value === pointMode)?.label ?? '',
        onClear: () => {
          setPointMode(undefined)
          resetPage()
        },
      })
    return chips
  }, [debouncedSearch, classId, dormId, tag, sortBy, missing, pointMode, classesQuery.data, dormsQuery.data])

  // Sinkron dengan toggleSelectAll & dropdown pilihan tabel: semua baris hasil filter
  const allFilteredSelected = useMemo(
    () => rows.length > 0 && rows.every((r) => selectedIdSet.has(r.id)),
    [rows, selectedIdSet],
  )

  return {
    // Filter state
    search, setSearch, debouncedSearch,
    classId, setClassId, dormId, setDormId, tag, setTag,
    gender, setGender, status, setStatus,
    sortBy, setSortBy, missing, setMissing, pointMode, setPointMode,
    showAdvanced, setShowAdvanced, selectedIds, setSelectedIds, privacy, setPrivacy,
    // Modal & seleksi
    formOpen, setFormOpen, importOpen, setImportOpen,
    resetOpen, setResetOpen, bulkPhotoOpen, setBulkPhotoOpen,
    exportOpen, setExportOpen, exportScope, setExportScope,
    moveOpen, setMoveOpen, graduateOpen, setGraduateOpen,
    waOpen, setWaOpen, waSettingsOpen, setWaSettingsOpen,
    cardStudents, setCardStudents, bulkCardOpen, setBulkCardOpen,
    scanOpen, setScanOpen, editing, setEditing, detail, setDetail,
    // Query
    classesQuery, statsQuery, studentsQuery,
    // Data turunan
    allStudents, isRefreshing, totalActive, isTruncated,
    selectedIdSet, selectedStudents, alreadyPinned,
    tagOptions, noPinCount, rows, pg, paginatedRows, photos,
    resetPage, advFilterCount, filterChips, allFilteredSelected,
  }
}
