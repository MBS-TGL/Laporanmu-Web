import { describe, expect, it } from 'vitest'
import {
  buildSavedGrid,
  computeGridChanges,
  getGridStatus,
  gridToRecapRows,
  nextGridStatus,
  setGridCell,
  summarizeGrid,
} from './grid'
import { buildTeacherRecap } from './recap'
import type { TeacherAttendance, TeacherAttendanceStatus } from './types'

const row = (
  teacher_id: string,
  date: string,
  status: TeacherAttendanceStatus,
  note: string | null = null,
): TeacherAttendance =>
  ({
    id: `${teacher_id}-${date}`,
    teacher_id,
    date,
    status,
    note,
    created_by: null,
    created_at: '',
    updated_at: '',
  })

describe('buildSavedGrid', () => {
  it('memetakan status dan catatan per guru/tanggal', () => {
    const saved = buildSavedGrid([
      row('t1', '2026-11-02', 'hadir'),
      row('t1', '2026-11-03', 'izin', 'keperluan keluarga'),
      row('t2', '2026-11-02', 'sakit'),
    ])

    expect(saved.status.get('t1')?.get(2)).toBe('hadir')
    expect(saved.status.get('t1')?.get(3)).toBe('izin')
    expect(saved.note.get('t1')?.get(3)).toBe('keperluan keluarga')
    expect(saved.status.get('t2')?.get(2)).toBe('sakit')
  })
})

describe('setGridCell', () => {
  const saved = buildSavedGrid([row('t1', '2026-11-02', 'hadir')])

  it('membuat draf untuk sel baru', () => {
    const drafts = setGridCell({}, saved, 't1', 3, 'sakit')
    expect(drafts.t1?.[3]).toBe('sakit')
  })

  it('menghapus draf bila status sama dengan data tersimpan', () => {
    const drafts = setGridCell({ t1: { 2: 'sakit' } }, saved, 't1', 2, 'hadir')
    expect(drafts.t1).toBeUndefined()
  })

  it('menandai penghapusan untuk sel tersimpan', () => {
    const drafts = setGridCell({}, saved, 't1', 2, null)
    expect(drafts.t1?.[2]).toBeNull()
  })

  it('tidak menyimpan penanda hapus untuk sel yang belum pernah tercatat', () => {
    const drafts = setGridCell({}, saved, 't1', 9, null)
    expect(drafts.t1).toBeUndefined()
  })
})

describe('nextGridStatus', () => {
  it('bersiklus H → S → I → T → kosong', () => {
    expect(nextGridStatus(undefined)).toBe('hadir')
    expect(nextGridStatus('hadir')).toBe('sakit')
    expect(nextGridStatus('sakit')).toBe('izin')
    expect(nextGridStatus('izin')).toBe('tugas_luar')
    expect(nextGridStatus('tugas_luar')).toBeNull()
  })
})

describe('computeGridChanges', () => {
  it('membuat upsert dan mempertahankan catatan lama', () => {
    const saved = buildSavedGrid([row('t1', '2026-11-02', 'hadir', 'dinas luar')])
    const { upserts, deletes, dirtyCount } = computeGridChanges(
      { t1: { 2: 'sakit', 3: 'hadir' } },
      saved,
      2026,
      11,
    )

    expect(dirtyCount).toBe(2)
    expect(deletes).toHaveLength(0)
    expect(upserts).toEqual([
      { teacher_id: 't1', date: '2026-11-02', status: 'sakit', note: 'dinas luar' },
      { teacher_id: 't1', date: '2026-11-03', status: 'hadir', note: null },
    ])
  })

  it('menghasilkan target hapus untuk sel yang dikosongkan', () => {
    const saved = buildSavedGrid([row('t1', '2026-11-02', 'hadir')])
    const { upserts, deletes, dirtyCount } = computeGridChanges(
      { t1: { 2: null } },
      saved,
      2026,
      11,
    )

    expect(upserts).toHaveLength(0)
    expect(deletes).toEqual([{ teacher_id: 't1', date: '2026-11-02' }])
    expect(dirtyCount).toBe(1)
  })
})

describe('summarizeGrid', () => {
  it('menghitung status dan sel hari kerja yang belum tercatat', () => {
    const saved = buildSavedGrid([
      row('t1', '2026-11-02', 'hadir'),
      row('t2', '2026-11-02', 'izin'),
    ])
    const summary = summarizeGrid(['t1', 't2'], saved, { t2: { 3: 'tugas_luar' } }, 2026, 11)

    expect(summary.hadir).toBe(1)
    expect(summary.izin).toBe(1)
    expect(summary.tugasLuar).toBe(1)
    expect(summary.recorded).toBe(3)
    expect(summary.unrecorded).toBeGreaterThan(0)
  })
})

describe('gridToRecapRows', () => {
  it('menggabungkan data tersimpan dengan draf dan mengabaikan sel kosong', () => {
    const saved = buildSavedGrid([row('t1', '2026-11-02', 'hadir')])
    const recap = buildTeacherRecap(gridToRecapRows(saved, { t1: { 2: null, 3: 'izin' } }, 2026, 11))

    const entry = recap.entries.get('t1')
    expect(entry).toMatchObject({ hadir: 0, izin: 1, recorded: 1 })
    expect(getGridStatus(saved, { t1: { 2: null } }, 't1', 2)).toBeUndefined()
  })
})
