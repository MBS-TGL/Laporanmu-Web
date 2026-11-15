import { useMemo, useState } from 'react'
import { Empty, Segmented } from 'antd'
import type { Schedule } from '../types'
import { buildGrid, buildSubjectColors, fmtTime, splitClass } from './scheduleLayout'

/**
 * Tampilan jadwal bergaya PDF waka kurikulum: satu blok per hari
 * (baris = jam pelajaran, kolom = kelas). Layar lebar menampilkan 2 hari
 * berdampingan. Cetak/PDF memakai lembar terpisah (schedulePrint.ts).
 */

type Props = {
  schedules: Schedule[]
  /** Hari (1=Senin…7=Minggu) yang ingin ditampilkan, berurutan */
  days: { value: number; label: string }[]
  todayDay: number
  onCellClick?: (s: Schedule) => void
  /** Semua jadwal tanpa filter, agar warna mapel tetap konsisten saat difilter */
  colorSource?: Schedule[]
  /** Set id jadwal yang mengalami bentrok / tabrakan */
  conflictIds?: Set<string>
  /** Map id jadwal ke penjelasan bentrok */
  conflictInfoMap?: Map<string, string[]>
}

const CSS = `
.sg-bar { display: flex; justify-content: flex-end; margin-bottom: 12px; }
.sg-days { display: grid; grid-template-columns: repeat(auto-fit, minmax(560px, 1fr)); gap: 16px; align-items: start; }
.sg-day { border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; background: #fff; }
.sg-dayhead { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: 1px solid #eef0f3; background: #fafbfc; }
.sg-dayhead span { font-weight: 700; font-size: 15px; }
.sg-dayhead em { font-style: normal; font-size: 11px; font-weight: 600; color: #4f46e5; background: #eef2ff; border-radius: 999px; padding: 1px 8px; }
.sg-dayhead small { margin-left: auto; color: #94a3b8; font-size: 12px; }
.sg-scroll { overflow-x: auto; }
.sg-t { width: 100%; min-width: 520px; border-collapse: collapse; table-layout: fixed; }
.sg-t th { font-size: 11.5px; font-weight: 700; color: #334155; padding: 8px 4px; border-bottom: 1px solid #e5e7eb; text-align: center; }
.sg-t th small { display: block; font-weight: 400; color: #94a3b8; font-size: 10px; }
.sg-t td { padding: 3px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
.sg-t tr:last-child td { border-bottom: 0; }
.sg-time { width: 86px; font-size: 11.5px; font-weight: 600; color: #64748b; text-align: center; font-variant-numeric: tabular-nums; white-space: nowrap; }
.sg-lab { background: #f1f5f9; color: #64748b; font-size: 10.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; text-align: center; padding: 4px; }
.sg-c { position: relative; border-left: 3px solid; border-radius: 6px; padding: 5px 8px; min-height: 34px; display: flex; flex-direction: column; justify-content: center; overflow: hidden; }
.sg-c + .sg-c { margin-top: 2px; }
.sg-c b { font-size: 12px; font-weight: 600; line-height: 1.25; color: #1e293b; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.sg-c span { font-size: 10.5px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px; }
.sg-c.has-conflict { border-left-color: #ef4444 !important; background: #fff1f2 !important; box-shadow: 0 0 0 1px #fecdd3; }
.sg-conflict-badge { display: inline-flex; align-items: center; gap: 3px; font-size: 9.5px; font-weight: 700; color: #b91c1c; background: #fee2e2; border-radius: 4px; padding: 1px 4px; margin-top: 2px; width: fit-content; }
.sg-click { cursor: pointer; transition: box-shadow .12s, transform .12s; }
.sg-click:hover { box-shadow: 0 2px 8px rgba(79, 70, 229, .28); transform: translateY(-1px); }
`

export function GridView({
  schedules,
  days,
  todayDay,
  onCellClick,
  colorSource,
  conflictIds,
  conflictInfoMap,
}: Props) {
  const [mode, setMode] = useState<'subject' | 'teacher'>('subject')
  const colors = useMemo(() => buildSubjectColors(colorSource ?? schedules), [colorSource, schedules])
  const { classCols, blocks } = useMemo(() => buildGrid(schedules, days), [schedules, days])

  if (blocks.length === 0 || classCols.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada jadwal KBM" />
  }

  return (
    <div>
      <style>{CSS}</style>
      <div className="sg-bar">
        <Segmented
          size="small"
          value={mode}
          onChange={(v) => setMode(v as 'subject' | 'teacher')}
          options={[
            { label: 'Mapel saja', value: 'subject' },
            { label: 'Mapel + guru', value: 'teacher' },
          ]}
        />
      </div>

      <div className="sg-days">
        {blocks.map((b) => (
          <section key={b.value} className="sg-day">
            <header className="sg-dayhead">
              <span>{b.label}</span>
              {b.value === todayDay && <em>Hari ini</em>}
              <small>{b.slots.filter((s) => s.kind === 'lesson').length} jam pelajaran</small>
            </header>
            <div className="sg-scroll">
              <table className="sg-t">
                <thead>
                  <tr>
                    <th className="sg-time">Waktu</th>
                    {classCols.map((c) => {
                      const { code, sub } = splitClass(c.name)
                      return (
                        <th key={c.id}>
                          {code}
                          {sub && <small>{sub}</small>}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {b.slots.map((slot) => (
                    <tr key={slot.key}>
                      <td className="sg-time">
                        {fmtTime(slot.start)}–{fmtTime(slot.end)}
                      </td>
                      {slot.kind === 'fixed' ? (
                        <td className="sg-lab" colSpan={classCols.length}>
                          {slot.label}
                        </td>
                      ) : (
                        classCols.map((c) => {
                          const items = b.cells.get(`${slot.key}|${c.id}`) ?? []
                          return (
                            <td key={c.id}>
                                {items.map((s) => {
                                  const name = s.subjects?.name ?? '-'
                                  const col = colors.get(name)
                                  const teacher = s.teachers?.name
                                  const isConflict = conflictIds?.has(s.id)
                                  const conflictReasons = conflictInfoMap?.get(s.id)
                                  const conflictTooltip = conflictReasons ? conflictReasons.join(' • ') : undefined

                                  return (
                                    <div
                                      key={s.id}
                                      className={`sg-c${isConflict ? ' has-conflict' : ''}${onCellClick ? ' sg-click' : ''}`}
                                      style={{
                                        background: isConflict ? undefined : col?.bg ?? '#f8fafc',
                                        borderLeftColor: isConflict ? undefined : col?.bar ?? '#cbd5e1',
                                      }}
                                      title={
                                        conflictTooltip
                                          ? `[TABRAKAN] ${conflictTooltip}`
                                          : [name, teacher, s.room].filter(Boolean).join(' · ')
                                      }
                                      onClick={() => onCellClick?.(s)}
                                    >
                                      <b>{name}</b>
                                      {mode === 'teacher' && teacher && <span>{teacher}</span>}
                                      {isConflict && (
                                        <div className="sg-conflict-badge">
                                          ⚠️ Tabrakan
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                            </td>
                          )
                        })
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
