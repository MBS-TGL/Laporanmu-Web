import type {
  DistributeResult,
  DistribPreviewRow,
  DistribRoom,
  DistribStudent,
} from './types'

/**
 * Algoritma distribusi otomatis santri ke kamar — pure & deterministik
 * (tanpa akses DB) agar mudah dites dan bisa di-preview (dry-run) di UI.
 *
 * Fase berurutan, kamar diisi urut nama sampai slotnya habis:
 * 1. Santri L → kamar `male` → lanjut `mixed`
 * 2. Santri P → kamar `female` → lanjut `mixed`
 * 3. Sisa (santri tanpa gender / yang tak kebagian kamar gendernya) → kamar apa pun
 *
 * Santri yang masih tidak kebagian slot dikembalikan di `unplaced`.
 */

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)

export function distributeStudents(
  rooms: DistribRoom[],
  students: DistribStudent[],
): DistributeResult {
  const assignments = new Map<string, string[]>()
  const placed = new Set<string>()
  // Sisa slot per kamar — occupied diambil dari data live saat preview dibuat
  const remaining = new Map<string, number>(
    rooms.map((r) => [r.id, Math.max(0, r.capacity - r.occupied)]),
  )

  const fill = (pool: DistribStudent[], roomFilter: (room: DistribRoom) => boolean) => {
    const ordered = rooms.filter(roomFilter).sort(byName)
    let idx = 0
    for (const student of pool) {
      if (placed.has(student.id)) continue
      // Lompati kamar yang sudah penuh
      while (idx < ordered.length && (remaining.get(ordered[idx].id) ?? 0) <= 0) idx++
      if (idx >= ordered.length) continue // slot fase ini habis — coba fase berikutnya
      const room = ordered[idx]
      remaining.set(room.id, (remaining.get(room.id) ?? 0) - 1)
      const ids = assignments.get(room.id)
      if (ids) ids.push(student.id)
      else assignments.set(room.id, [student.id])
      placed.add(student.id)
    }
  }

  const male = students.filter((s) => s.gender === 'L').sort(byName)
  const female = students.filter((s) => s.gender === 'P').sort(byName)

  fill(male, (r) => r.gender === 'male')
  fill(male, (r) => r.gender === 'mixed')
  fill(female, (r) => r.gender === 'female')
  fill(female, (r) => r.gender === 'mixed')
  fill(students, () => true)

  const preview: DistribPreviewRow[] = rooms
    .filter((r) => assignments.has(r.id))
    .map((r) => {
      const incoming = assignments.get(r.id)!.length
      return {
        roomId: r.id,
        roomName: r.name,
        occupiedBefore: r.occupied,
        incoming,
        occupiedAfter: r.occupied + incoming,
        capacity: r.capacity,
      }
    })
    .sort((a, b) => a.roomName.localeCompare(b.roomName))

  return {
    assignments: [...assignments].map(([roomId, studentIds]) => ({ roomId, studentIds })),
    preview,
    unplaced: students.filter((s) => !placed.has(s.id)).sort(byName),
  }
}
