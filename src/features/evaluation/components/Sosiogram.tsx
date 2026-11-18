import { useMemo } from 'react'
import { Typography, theme } from 'antd'
import type { InstrumentResponse } from '../types'
import type { SociometryResult } from '../analysis'

interface SosiogramProps {
  responses: InstrumentResponse[]
  result: SociometryResult
  /** Peta id → nama santri (termasuk yang dipilih tapi belum merespons). */
  nameById?: Map<string, string>
}

/**
 * Sosiogram SVG sederhana: santri diposisikan melingkar, garis
 * menghubungkan pilihan; garis hijau tebal = saling memilih (mutual).
 */
export function Sosiogram({ responses, result, nameById }: SosiogramProps) {
  const { token } = theme.useToken()

  const nodes = useMemo(() => {
    const ids = new Set<string>()
    for (const r of responses) ids.add(r.student_id)
    for (const r of responses) {
      for (const q of Object.values(r.answers)) {
        if (Array.isArray(q)) q.forEach((v) => typeof v === 'string' && ids.add(v))
        else if (typeof q === 'string') ids.add(q)
      }
    }
    const list = [...ids]
    const R = 140
    const cx = 200
    const cy = 175
    return list.map((id, i) => {
      const angle = (i / list.length) * 2 * Math.PI - Math.PI / 2
      const name = responses.find((r) => r.student?.id === id)?.student?.name ?? nameById?.get(id) ?? id
      return {
        id,
        name,
        x: cx + R * Math.cos(angle),
        y: cy + R * Math.sin(angle),
        received: result.received.get(id) ?? 0,
      }
    })
  }, [responses, result, nameById])

  const edges = useMemo(() => {
    const out: { x1: number; y1: number; x2: number; y2: number; mutual: boolean }[] = []
    const pos = new Map(nodes.map((n) => [n.id, n]))
    for (const r of responses) {
      for (const value of Object.values(r.answers)) {
        for (const target of Array.isArray(value) ? value : typeof value === 'string' ? [value] : []) {
          const from = pos.get(r.student_id)
          const to = pos.get(target)
          if (!from || !to || from === to) continue
          out.push({ x1: from.x, y1: from.y, x2: to.x, y2: to.y, mutual: false })
        }
      }
    }
    // tandai mutual (pasangan muncul dua arah)
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        if (out[i].x1 === out[j].x2 && out[i].y1 === out[j].y2 && out[i].x2 === out[j].x1 && out[i].y2 === out[j].y1) {
          out[i].mutual = true
          out[j].mutual = true
        }
      }
    }
    return out
  }, [nodes, responses])

  if (nodes.length === 0) {
    return <Typography.Text type="secondary">Belum ada data untuk sosiogram.</Typography.Text>
  }

  return (
    <div>
      <svg viewBox="0 0 400 350" style={{ width: '100%', maxWidth: 480, margin: '0 auto', display: 'block' }}>
        {edges.map((e, i) => (
          <line
            key={i}
            x1={e.x1}
            y1={e.y1}
            x2={e.x2}
            y2={e.y2}
            stroke={e.mutual ? token.colorSuccess : token.colorBorder}
            strokeWidth={e.mutual ? 2.5 : 1}
            opacity={e.mutual ? 0.9 : 0.6}
          />
        ))}
        {nodes.map((n) => (
          <g key={n.id}>
            <circle
              cx={n.x}
              cy={n.y}
              r={14 + Math.min(n.received, 6) * 1.5}
              fill={n.received > 0 ? token.colorPrimaryBg : token.colorFillQuaternary}
              stroke={n.received > 0 ? token.colorPrimary : token.colorBorder}
              strokeWidth={1.5}
            />
            <text
              x={n.x}
              y={n.y + 4}
              textAnchor="middle"
              fontSize={10}
              fontWeight={700}
              fill={token.colorText}
            >
              {n.name.split(' ').slice(0, 2).map((w) => w[0]).join('')}
            </text>
            <text x={n.x} y={n.y + 30} textAnchor="middle" fontSize={9} fill={token.colorTextSecondary}>
              {n.name.split(' ').slice(0, 2).join(' ')}
            </text>
          </g>
        ))}
      </svg>
      <div style={{ display: 'flex', gap: 14, fontSize: 12, color: token.colorTextSecondary, justifyContent: 'center' }}>
        <span>
          <span style={{ display: 'inline-block', width: 18, height: 2, background: token.colorSuccess, verticalAlign: 'middle' }} /> Saling memilih
        </span>
        <span>
          <span style={{ display: 'inline-block', width: 18, height: 1, background: token.colorBorder, verticalAlign: 'middle' }} /> Pilihan satu arah
        </span>
      </div>
    </div>
  )
}
