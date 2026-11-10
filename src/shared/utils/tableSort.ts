type SortOrder = 'ascend' | 'descend' | null

/** 'ascend'/'descend' untuk header kolom `key` berdasarkan state sortBy + peta pasangan [asc, desc] */
export function columnSortOrder<S extends string>(
  sortBy: S | undefined,
  key: string,
  pairs: Record<string, readonly [S, S]>,
): SortOrder {
  const pair = pairs[key]
  if (!pair) return null
  if (sortBy === pair[0]) return 'ascend'
  if (sortBy === pair[1]) return 'descend'
  return null
}

/** Konversi hasil onChange tabel antd → nilai sortBy (undefined bila sort dihapus/kolom tak dikenal) */
export function sortByFromTableChange<S extends string>(
  sorter: { order?: SortOrder; column?: { key?: string | number | bigint } | null },
  pairs: Record<string, readonly [S, S]>,
): S | undefined {
  const key = sorter.column?.key
  if (!sorter.order || key === undefined || key === null) return undefined
  const pair = pairs[String(key)]
  if (!pair) return undefined
  return sorter.order === 'ascend' ? pair[0] : pair[1]
}
