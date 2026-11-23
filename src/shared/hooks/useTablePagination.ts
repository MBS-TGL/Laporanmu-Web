import { useCallback, useEffect, useMemo, useState } from 'react'

export interface UseTablePaginationOptions {
  /**
   * Satuan data untuk info rentang, mis. 'siswa' → "Menampilkan 1-10 dari
   * 207 siswa". Tanpa label, info rentang tidak dirender (cocok untuk tabel
   * kecil di modal yang dulu tidak menampilkan total).
   */
  label?: string
  /** Ukuran halaman awal. Default 10. */
  defaultPageSize?: number
  /** Pilihan ukuran halaman. Default [10, 25, 50]. */
  pageSizeOptions?: number[]
  /** Sembunyikan pagination saat data muat satu halaman. Default false. */
  hideOnSinglePage?: boolean
  /** Tampilkan pemilih ukuran halaman. Default true; false untuk tabel kecil/modal. */
  showSizeChanger?: boolean
  /** Kunci localStorage untuk mengingat ukuran halaman antar-sesi (mis. 'teachers_page_size'). */
  storageKey?: string
}

/**
 * Satu sumber pagination AntD Table (lihat SKILLS.md §Tabel). Mengelola state
 * halaman/ukuran, info rentang baris berbahasa Indonesia, dan auto-clamp:
 * saat `total` menyusut (filter/hapus) dan halaman aktif melebihi halaman
 * terakhir, kembali ke halaman valid terakhir agar tabel tidak kosong.
 */
export function useTablePagination(total: number, options: UseTablePaginationOptions = {}) {
  const { label, defaultPageSize = 10, pageSizeOptions = [10, 25, 50], hideOnSinglePage = false, showSizeChanger = true, storageKey } = options
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(() => {
    if (!storageKey) return defaultPageSize
    try {
      const saved = Number(localStorage.getItem(storageKey))
      return pageSizeOptions.includes(saved) ? saved : defaultPageSize
    } catch {
      return defaultPageSize
    }
  })

  // Ingat ukuran halaman antar-sesi bila storageKey diberikan
  useEffect(() => {
    if (!storageKey) return
    try {
      localStorage.setItem(storageKey, String(pageSize))
    } catch {
      // penyimpanan penuh/tidak tersedia — ukuran tetap berlaku untuk sesi ini
    }
  }, [storageKey, pageSize])

  // Halaman valid terakhir — penyangga auto-clamp saat data menyusut.
  // Guard total > 0: tabel server-paginated mem-pass 0 sebelum data datang
  // (total asli di-override di Table), clamp tidak boleh salah picu.
  const lastPage = Math.max(1, Math.ceil(total / pageSize))

  useEffect(() => {
    if (total > 0 && page > lastPage) setPage(lastPage)
  }, [total, page, lastPage])

  // Ganti ukuran halaman selalu kembali ke halaman 1 (pola umum); AntD mengirim
  // onChange dengan pasangan (halaman, ukuran) untuk kedua jenis perubahan.
  const onChange = useCallback(
    (nextPage: number, nextSize: number) => {
      if (nextSize !== pageSize) {
        setPageSize(nextSize)
        setPage(1)
      } else {
        setPage(nextPage)
      }
    },
    [pageSize],
  )

  const setPageSizeReset = useCallback((size: number) => {
    setPageSize(size)
    setPage(1)
  }, [])

  const reset = useCallback(() => setPage(1), [])

  const pagination = useMemo(
    () => ({
      current: page,
      pageSize,
      total,
      onChange,
      showSizeChanger,
      pageSizeOptions,
      hideOnSinglePage,
      responsive: true,
      ...(label
        ? { showTotal: (t: number, range: [number, number]) => `Menampilkan ${range[0]}-${range[1]} dari ${t} ${label}` }
        : {}),
    }),
    [page, pageSize, total, onChange, showSizeChanger, pageSizeOptions, hideOnSinglePage, label],
  )

  return { page, pageSize, setPage, setPageSize: setPageSizeReset, reset, pagination }
}
