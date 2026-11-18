import { describe, expect, it } from 'vitest'
import {
  FIELDS,
  SAMPLE_COLUMNS,
  TEMPLATE_COLUMNS,
  autoMatch,
  normalizeStatusInput,
  parseDateValue,
  parseLogTable,
  parseMedicineTable,
  parseQtyValue,
  parseTimeValue,
  type Mapping,
  type ParseContext,
} from './importParse'

const TODAY = '2026-11-11'

const ctx: ParseContext = {
  today: TODAY,
  roster: [
    { id: 's1', name: 'Ahmad Fulan', registration_code: 'LPM-0001-001', class_name: '7A' },
    { id: 's2', name: 'Siti Aminah', registration_code: 'LPM-0001-002', class_name: null },
  ],
  medicines: [
    { id: 'm1', name: 'Paracetamol 500mg', unit: 'tablet' },
    { id: 'm2', name: 'Betadine', unit: 'botol' },
  ],
}

/** Pemetaan seperti langkah Mapping: deteksi otomatis dari header tabel. */
const map = (table: string[][]): Mapping => autoMatch(table[0] ?? [])

describe('parseDateValue', () => {
  it('menerima ISO dan DD/MM/YYYY', () => {
    expect(parseDateValue('2026-11-07', TODAY)).toEqual({ date: '2026-11-07' })
    expect(parseDateValue('07/11/2026', TODAY)).toEqual({ date: '2026-11-07' })
    expect(parseDateValue('7-11-2026', TODAY)).toEqual({ date: '2026-11-07' })
  })

  it('menolak tanggal masa depan & tidak valid', () => {
    expect(parseDateValue('2026-11-12', TODAY)).toHaveProperty('error')
    expect(parseDateValue('31/02/2026', TODAY)).toHaveProperty('error')
    expect(parseDateValue('besok', TODAY)).toHaveProperty('error')
    expect(parseDateValue('', TODAY)).toHaveProperty('error')
  })
})

describe('parseTimeValue', () => {
  it('menerima HH:mm, HH.mm, HHmm; kosong → 08:00', () => {
    expect(parseTimeValue('08:30')).toEqual({ time: '08:30' })
    expect(parseTimeValue('7.05')).toEqual({ time: '07:05' })
    expect(parseTimeValue('1345')).toEqual({ time: '13:45' })
    expect(parseTimeValue('')).toEqual({ time: '08:00' })
  })

  it('menolak jam tidak valid', () => {
    expect(parseTimeValue('25:00')).toHaveProperty('error')
    expect(parseTimeValue('08:75')).toHaveProperty('error')
    expect(parseTimeValue('pagi')).toHaveProperty('error')
  })
})

describe('normalizeStatusInput / parseQtyValue', () => {
  it('alias status', () => {
    expect(normalizeStatusInput('UKS')).toBe('UKS')
    expect(normalizeStatusInput('asrama')).toBe('Dormitory')
    expect(normalizeStatusInput('sembuh')).toBe('Returned')
    expect(normalizeStatusInput('')).toBe('')
    expect(normalizeStatusInput('rawat uks')).toBe('UKS')
    expect(normalizeStatusInput('halo')).toBeNull()
  })

  it('jumlah', () => {
    expect(parseQtyValue('3')).toEqual({ qty: 3 })
    expect(parseQtyValue('')).toEqual({ qty: 0 })
    expect(parseQtyValue('-1')).toHaveProperty('error')
    expect(parseQtyValue('2.5')).toHaveProperty('error')
  })
})

describe('parseLogTable', () => {
  it('memetakan kode, tanggal, obat, dan status lengkap', () => {
    const table = [
      ['kode', 'nama', 'tanggal', 'jam', 'keluhan', 'diagnosis', 'penanganan', 'obat', 'jumlah', 'status'],
      ['LPM-0001-001', 'Ahmad Fulan', '2026-11-10', '08:30', 'demam tinggi', 'suspect flu', 'kompres', 'Paracetamol 500mg', '2', 'UKS'],
    ]
    const { rows } = parseLogTable(table, map(table), ctx)
    expect(rows).toHaveLength(1)
    const r = rows[0]
    expect(r.rowStatus).toBe('siap')
    expect(r.studentId).toBe('s1')
    expect(r.className).toBe('7A')
    expect(r.matchBy).toBe('kode')
    expect(r.date).toBe('2026-11-10')
    expect(r.time).toBe('08:30')
    expect(r.medicineId).toBe('m1')
    expect(r.medicineQty).toBe(2)
    expect(r.status).toBe('UKS')
  })

  it('cocok via nama, kelas null, status kosong → Returned, tanpa obat', () => {
    const table = [
      ['nama', 'keluhan'],
      ['  siti   aminah ', 'sakit perut'],
    ]
    const { rows } = parseLogTable(table, map(table), ctx)
    const r = rows[0]
    expect(r.rowStatus).toBe('siap')
    expect(r.studentId).toBe('s2')
    expect(r.matchBy).toBe('nama')
    expect(r.className).toBeNull()
    expect(r.status).toBe('Returned')
    expect(r.medicineId).toBeNull()
    expect(r.date).toBe(TODAY) // tanggal kosong → default hari ini
  })

  it('kode tak dikenal → tak_dikenal; duplikat dalam-file terdeteksi', () => {
    const table = [
      ['kode', 'tanggal', 'jam', 'keluhan'],
      ['LPM-9999', '2026-11-10', '08:00', 'flu'],
      ['LPM-0001-001', '2026-11-10', '08:00', 'flu'],
      ['LPM-0001-001', '2026-11-10', '08:00', 'flu lagi'],
      ['LPM-0001-001', '2026-11-10', '08:00', 'flu'],
    ]
    const { rows } = parseLogTable(table, map(table), ctx)
    expect(rows[0].rowStatus).toBe('tak_dikenal')
    expect(rows[1].rowStatus).toBe('siap')
    expect(rows[2].rowStatus).toBe('siap') // keluhan berbeda = kunjungan berbeda
    expect(rows[3].rowStatus).toBe('duplikat') // konten identik dengan baris 1
  })

  it('duplikat dengan DB via existingKeys', () => {
    const table = [['kode', 'tanggal', 'jam', 'keluhan'], ['LPM-0001-001', '2026-11-10', '09:00', 'flu']]
    const { rows } = parseLogTable(table, map(table), { ...ctx, existingKeys: new Set(['s1|2026-11-10|09:00|flu']) })
    expect(rows[0].rowStatus).toBe('duplikat')
  })

  it('obat tidak ada di stok → error; jumlah invalid → error', () => {
    const table = [
      ['kode', 'tanggal', 'keluhan', 'obat', 'jumlah'],
      ['LPM-0001-001', '2026-11-10', 'flu', 'Obat misterius', '1'],
      ['LPM-0001-001', '2026-11-10', 'batuk', 'Betadine', 'x'],
    ]
    const { rows } = parseLogTable(table, map(table), ctx)
    expect(rows[0].rowStatus).toBe('error')
    expect(rows[0].error).toContain('Obat "Obat misterius"')
    expect(rows[1].rowStatus).toBe('error')
    expect(rows[1].error).toContain('Jumlah tidak valid')
  })

  it('keluhan kosong → error; baris kosong dilewati', () => {
    const table = [
      ['kode', 'keluhan'],
      ['LPM-0001-001', ''],
      [],
      ['', ''],
    ]
    const { rows, skippedRows } = parseLogTable(table, map(table), ctx)
    expect(rows[0].rowStatus).toBe('error')
    expect(skippedRows).toBeGreaterThanOrEqual(1)
  })

  it('lempar error bila kolom identitas/keluhan tidak ada', () => {
    expect(() => parseLogTable([['a', 'b'], ['1', '2']], map([['a', 'b'], ['1', '2']]), ctx)).toThrow(/identifikasi/i)
    expect(() => parseLogTable([['kode', 'x'], ['LPM-0001-001', '2']], map([['kode', 'x'], ['LPM-0001-001', '2']]), ctx)).toThrow(/keluhan/i)
  })
})

describe('parseMedicineTable', () => {
  it('baris baru & perbarui terdeteksi via nama', () => {
    const table = [
      ['nama', 'kategori', 'stok', 'satuan', 'min', 'keterangan'],
      ['Paracetamol 500mg', 'Analgesik', '120', 'tablet', '20', 'demam'],
      ['OBH Combi', '', '5', 'botol', '', ''],
    ]
    const { rows } = parseMedicineTable(table, [{ id: 'm1', name: 'Paracetamol 500mg' }])
    expect(rows[0]).toMatchObject({ name: 'Paracetamol 500mg', existingId: 'm1', rowStatus: 'perbarui', stock: 120, minStock: 20 })
    expect(rows[1]).toMatchObject({ name: 'OBH Combi', existingId: null, rowStatus: 'baru', stock: 5, unit: 'botol', minStock: 15 })
  })

  it('stok invalid, satuan asing, nama kosong → error', () => {
    const table = [
      ['nama', 'stok', 'satuan'],
      ['', '10', 'tablet'],
      ['Antalgin', 'abc', 'tablet'],
      ['Betadine', '5', 'gelas'],
    ]
    const { rows } = parseMedicineTable(table, [])
    expect(rows[0].error).toContain('Nama obat wajib')
    expect(rows[1].error).toContain('Stok tidak valid')
    expect(rows[2].error).toContain('Satuan')
  })

  it('nama ganda dalam file → error duplikat', () => {
    const table = [
      ['nama', 'stok'],
      ['Antalgin', '10'],
      ['antalgin', '20'],
    ]
    const { rows } = parseMedicineTable(table, [])
    expect(rows[0].rowStatus).toBe('baru')
    expect(rows[1].rowStatus).toBe('error')
    expect(rows[1].error).toContain('lebih dari sekali')
  })

  it('lempar error bila kolom nama/stok tidak ada', () => {
    expect(() => parseMedicineTable([['x'], ['1']], [])).toThrow(/nama/i)
    expect(() => parseMedicineTable([['nama'], ['Paracetamol']], [])).toThrow(/stok/i)
  })
})

describe('SAMPLE_COLUMNS', () => {
  it('memuat semua kolom wajib', () => {
    const requiredKeys = FIELDS.filter((f) => 'required' in f && f.required).map((f) => f.key)
    expect(requiredKeys.length).toBeGreaterThan(0)
    for (const key of requiredKeys) {
      expect(SAMPLE_COLUMNS.some((c) => c.key === key)).toBe(true)
    }
  })

  it('label = judul kolom template, key ikut TEMPLATE_COLUMNS, maksimal 7 kolom', () => {
    expect(SAMPLE_COLUMNS.length).toBeLessThanOrEqual(7)
    for (const col of SAMPLE_COLUMNS) {
      expect(TEMPLATE_COLUMNS).toContain(col.key)
      expect(FIELDS.find((f) => f.key === col.key)?.label).toBe(col.label)
    }
  })

  it('baris contoh ke-2 tidak kosong untuk kolom yang ditampilkan', () => {
    for (const col of SAMPLE_COLUMNS) {
      expect(col.values[1]).not.toBe('')
    }
  })
})
