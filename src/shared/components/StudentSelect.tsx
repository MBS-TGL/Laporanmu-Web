import { useEffect, useMemo, useState } from 'react'
import { Select, Spin } from 'antd'
import { useDebounce } from '../hooks/useDebounce'
import { searchStudents } from '../../features/students/api'

interface Option {
  value: string
  label: string
}

interface BaseProps {
  placeholder?: string
  /** Opsi awal agar nilai terpilih tetap tampil labelnya saat edit */
  initialOptions?: Option[]
  /** Daftar tetap (mis. anggota kelompok musyrif) — mematikan pencarian remote. */
  fixedOptions?: Option[]
  disabled?: boolean
}

/** Pencarian santri remote (nama / kode registrasi) dengan debounce.
 *  setLoading dilakukan di handler onSearch (event), bukan di body effect —
 *  react-hooks/set-state-in-effect melarang setState sinkron di body effect. */
function useStudentOptions() {
  const [search, setSearch] = useState('')
  const [options, setOptions] = useState<Option[]>([])
  const [loading, setLoading] = useState(true)
  const debouncedSearch = useDebounce(search)

  useEffect(() => {
    let cancelled = false
    searchStudents(debouncedSearch)
      .then((rows) => {
        if (cancelled) return
        setOptions(rows.map((s) => ({ value: s.id, label: `${s.name} (${s.registration_code})` })))
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setOptions([])
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [debouncedSearch])

  const onSearch = (v: string) => {
    setLoading(true)
    setSearch(v)
  }

  return { options, loading, onSearch }
}

/** Pilih satu santri dengan pencarian remote (nama / kode registrasi). */
export function StudentSelect({
  placeholder = 'Cari nama atau kode registrasi',
  initialOptions,
  fixedOptions,
  disabled,
  value,
  onChange,
}: BaseProps & { value?: string; onChange?: (v: string) => void }) {
  const { options: remote, loading, onSearch } = useStudentOptions()

  const options = useMemo(() => {
    const map = new Map<string, Option>()
    const sources: Option[][] = fixedOptions ? [initialOptions ?? [], fixedOptions] : [initialOptions ?? [], remote]
    for (const o of sources.flat()) map.set(o.value, o)
    return [...map.values()]
  }, [fixedOptions, initialOptions, remote])

  return (
    <Select
      showSearch
      // fixedOptions = daftar kecil (anggota kelompok) → filter lokal, tanpa remote
      filterOption={fixedOptions ? undefined : false}
      optionFilterProp={fixedOptions ? 'label' : undefined}
      placeholder={placeholder}
      disabled={disabled}
      loading={fixedOptions ? false : loading}
      onSearch={fixedOptions ? undefined : onSearch}
      notFoundContent={fixedOptions ? 'Tidak ditemukan' : loading ? <Spin size="small" /> : 'Tidak ditemukan'}
      options={options}
      value={value}
      onChange={onChange}
      style={{ width: '100%' }}
    />
  )
}

/** Pilih banyak santri sekaligus (anggota halaqah / ekskul, dst.). */
export function StudentMultiSelect({
  placeholder = 'Cari dan pilih beberapa santri',
  initialOptions,
  disabled,
  value,
  onChange,
}: BaseProps & { value?: string[]; onChange?: (v: string[]) => void }) {
  const { options: remote, loading, onSearch } = useStudentOptions()

  const options = useMemo(() => {
    const map = new Map<string, Option>()
    for (const o of [...(initialOptions ?? []), ...remote]) map.set(o.value, o)
    return [...map.values()]
  }, [initialOptions, remote])

  return (
    <Select
      mode="multiple"
      showSearch
      filterOption={false}
      placeholder={placeholder}
      disabled={disabled}
      loading={loading}
      onSearch={onSearch}
      notFoundContent={loading ? <Spin size="small" /> : 'Tidak ditemukan'}
      options={options}
      value={value}
      onChange={onChange}
      style={{ width: '100%' }}
    />
  )
}
