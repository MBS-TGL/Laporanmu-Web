import { describe, expect, it } from 'vitest'
import { distributeStudents } from './dormDistribute'
import type { DistribRoom, DistribStudent } from './types'

const room = (
  id: string,
  name: string,
  gender: DistribRoom['gender'],
  capacity: number,
  occupied = 0,
): DistribRoom => ({ id, name, gender, capacity, occupied })

const student = (id: string, name: string, gender: DistribStudent['gender']): DistribStudent => ({
  id,
  name,
  gender,
})

describe('distributeStudents', () => {
  it('mengisi kamar urut nama sampai penuh lalu lanjut kamar berikutnya', () => {
    const rooms = [room('r2', 'Zaskia', 'male', 2), room('r1', 'Alif', 'male', 2)]
    const students = ['S1', 'S2', 'S3', 'S4', 'S5'].map((id, i) => student(id, `Santri ${i + 1}`, 'L'))
    const result = distributeStudents(rooms, students)

    // Alif (nama lebih awal) diisi dulu
    const alif = result.assignments.find((a) => a.roomId === 'r1')
    const zaskia = result.assignments.find((a) => a.roomId === 'r2')
    expect(alif?.studentIds).toEqual(['S1', 'S2'])
    expect(zaskia?.studentIds).toEqual(['S3', 'S4'])
    expect(result.unplaced.map((s) => s.id)).toEqual(['S5'])
    expect(result.preview).toEqual([
      { roomId: 'r1', roomName: 'Alif', occupiedBefore: 0, incoming: 2, occupiedAfter: 2, capacity: 2 },
      { roomId: 'r2', roomName: 'Zaskia', occupiedBefore: 0, incoming: 2, occupiedAfter: 2, capacity: 2 },
    ])
  })

  it('menghitung sisa slot dari occupied yang sudah ada', () => {
    const rooms = [room('r1', 'Alif', 'male', 4, 3)]
    const result = distributeStudents(rooms, [student('s1', 'A', 'L'), student('s2', 'B', 'L')])
    expect(result.assignments.find((a) => a.roomId === 'r1')?.studentIds).toEqual(['s1'])
    expect(result.unplaced.map((s) => s.id)).toEqual(['s2'])
    expect(result.preview[0]).toMatchObject({ occupiedBefore: 3, incoming: 1, occupiedAfter: 4 })
  })

  it('menghormati gender: P tidak masuk kamar male, fallback ke mixed', () => {
    const rooms = [room('r1', 'Putra Room', 'male', 5), room('r2', 'Mix Room', 'mixed', 2)]
    const result = distributeStudents(rooms, [student('p1', 'Aisyah', 'P'), student('p2', 'Khadijah', 'P')])
    // kamar male dilewati, keduanya masuk mix
    expect(result.assignments).toEqual([{ roomId: 'r2', studentIds: ['p1', 'p2'] }])
  })

  it('L mengisi male dulu, kelebihan masuk mixed', () => {
    const rooms = [
      room('r1', 'Male A', 'male', 1),
      room('r2', 'Mix A', 'mixed', 2),
    ]
    const result = distributeStudents(rooms, ['l1', 'l2', 'l3'].map((id, i) => student(id, `L${i}`, 'L')))
    expect(result.assignments.find((a) => a.roomId === 'r1')?.studentIds).toEqual(['l1'])
    expect(result.assignments.find((a) => a.roomId === 'r2')?.studentIds).toEqual(['l2', 'l3'])
    expect(result.unplaced).toHaveLength(0)
  })

  it('santri tanpa gender ditempatkan di fase terakhir ke kamar mana pun', () => {
    const rooms = [room('r1', 'Male A', 'male', 1), room('r2', 'Female A', 'female', 1)]
    const result = distributeStudents(rooms, [student('u1', 'Tanpa Gender', null)])
    // Fase terakhir mengisi urut nama kamar: "Female A" < "Male A"
    expect(result.assignments.find((a) => a.roomId === 'r2')?.studentIds).toEqual(['u1'])
    expect(result.unplaced).toHaveLength(0)
  })

  it('kamar over-capacity (occupied > capacity) dilewati', () => {
    const rooms = [room('r1', 'Over', 'male', 2, 3), room('r2', 'Ok', 'male', 2, 1)]
    const result = distributeStudents(rooms, ['s1', 's2'].map((id, i) => student(id, `S${i}`, 'L')))
    expect(result.assignments).toEqual([{ roomId: 'r2', studentIds: ['s1'] }])
    expect(result.unplaced.map((s) => s.id)).toEqual(['s2'])
  })

  it('campuran L, P, dan tanpa gender tersebar benar', () => {
    const rooms = [
      room('m1', 'Male 1', 'male', 1),
      room('f1', 'Female 1', 'female', 1),
      room('x1', 'Mix 1', 'mixed', 2),
    ]
    const students = [
      student('l1', 'Ali', 'L'),
      student('l2', 'Umar', 'L'),
      student('p1', 'Aisyah', 'P'),
      student('u1', 'NoGender', null),
    ]
    const result = distributeStudents(rooms, students)
    expect(result.unplaced).toHaveLength(0)
    const idsOf = (roomId: string) => result.assignments.find((a) => a.roomId === roomId)?.studentIds ?? []
    expect(idsOf('m1')).toEqual(['l1']) // Ali
    expect(idsOf('f1')).toEqual(['p1']) // Aisyah
    expect(idsOf('x1')).toHaveLength(2) // Umar + NoGender
    // Semua student unik ditempatkan tepat satu kali
    const all = result.assignments.flatMap((a) => a.studentIds)
    expect(new Set(all).size).toBe(4)
  })

  it('tanpa kamar tersedia → semua santri unplaced', () => {
    const rooms = [room('r1', 'Full', 'male', 2, 2)]
    const result = distributeStudents(rooms, [student('s1', 'A', 'L')])
    expect(result.assignments).toEqual([])
    expect(result.preview).toEqual([])
    expect(result.unplaced.map((s) => s.id)).toEqual(['s1'])
  })
})
