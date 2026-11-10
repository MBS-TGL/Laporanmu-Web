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
  disabled?: boolean
}

/** Hook pencarian santri remote (nama / kode registrasi) dengan debounce. */
function useStudentOptions(search: string) {
  const [options, setOptions] = useState<Option[]>([])
  const [loading, setLoading] = useState(false)
  const debouncedSearch = useDebounce(search)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    searchStudents(debouncedSearch)
      .then((rows) => {
        if (cancelled) return
        setOptions(rows.map((s) => ({ value: s.id, label: `${s.name} (${s.registration_code})` })))
      })
      .catch(() => {
        if (!cancelled) setOptions([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [debouncedSearch])

  return { options, loading }
}

/** Pilih satu santri dengan pencarian remote (nama / kode registrasi). */
export function StudentSelect({
  placeholder = 'Cari nama atau kode registrasi',
  initialOptions,
  disabled,
  value,
  onChange,
}: BaseProps & { value?: string; onChange?: (v: string) => void }) {
  const [search, setSearch] = useState('')
  const { options: remote, loading } = useStudentOptions(search)

  const options = useMemo(() => {
    const map = new Map<string, Option>()
    for (const o of [...(initialOptions ?? []), ...remote]) map.set(o.value, o)
    return [...map.values()]
  }, [initialOptions, remote])

  return (
    <Select
      showSearch
      filterOption={false}
      placeholder={placeholder}
      disabled={disabled}
      loading={loading}
      onSearch={setSearch}
      notFoundContent={loading ? <Spin size="small" /> : 'Tidak ditemukan'}
      options={options}
      value={value}
      onChange={onChange}
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
  const [search, setSearch] = useState('')
  const { options: remote, loading } = useStudentOptions(search)

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
      onSearch={setSearch}
      notFoundContent={loading ? <Spin size="small" /> : 'Tidak ditemukan'}
      options={options}
      value={value}
      onChange={onChange}
    />
  )
}
