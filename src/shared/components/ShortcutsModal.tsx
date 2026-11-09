import { useMemo, useState } from 'react'
import { Empty, Input, theme } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { AppModal } from './AppModal'
import { IconBox } from './IconBox'
import type { ShortcutSection } from '../hooks/useShortcuts'

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)

function formatKey(key: string): string {
  if (isMac && key === 'Ctrl') return '⌘'
  return key
}

interface KbdProps {
  children: string
  /** Terang di atas baris aktif berlatar colorPrimary */
  inverted?: boolean
}

/** Chip tombol keyboard kecil — juga dipakai menu dropdown lain */
export function Kbd({ children, inverted = false }: KbdProps) {
  const { token } = theme.useToken()
  return (
    <span
      style={{
        display: 'inline-block',
        minWidth: 22,
        padding: '1px 6px',
        borderRadius: 6,
        border: `1px solid ${inverted ? 'rgba(255, 255, 255, 0.45)' : token.colorBorder}`,
        background: inverted ? 'rgba(255, 255, 255, 0.15)' : token.colorFillQuaternary,
        fontSize: 11,
        fontWeight: 600,
        lineHeight: '18px',
        textAlign: 'center',
        color: inverted ? '#fff' : token.colorTextSecondary,
      }}
    >
      {children}
    </span>
  )
}

interface ShortcutsModalProps {
  open: boolean
  onClose: () => void
  sections: ShortcutSection[]
}

/** Palet shortcut yang bisa dicari (dibuka dengan tombol `?`) */
export function ShortcutsModal({ open, onClose, sections }: ShortcutsModalProps) {
  const { token } = theme.useToken()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const flat = useMemo(() => {
    const q = query.trim().toLowerCase()
    const result: { item: ShortcutSection['items'][number]; group: string }[] = []
    for (const section of sections) {
      for (const item of section.items) {
        if (!q) {
          result.push({ item, group: section.group })
          continue
        }
        const haystack = `${item.label} ${item.description ?? ''} ${item.keys.join(' ')}`.toLowerCase()
        if (haystack.includes(q)) result.push({ item, group: section.group })
      }
    }
    return result
  }, [sections, query])

  const runItem = (index: number) => {
    const entry = flat[index]
    if (!entry) return
    onClose()
    entry.item.run()
  }

  const divider = `1px solid ${token.colorBorderSecondary}`

  return (
    <AppModal
      open={open}
      onCancel={onClose}
      footer={null}
      closable={false}
      width={560}
      destroyOnHidden
      styles={{
        body: {
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          maxHeight: 'calc(100dvh - 220px)',
        },
      }}
    >
      <Input
        autoFocus
        variant='borderless'
        prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
        suffix={<Kbd>Esc</Kbd>}
        placeholder='Cari shortcut...'
        allowClear
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setActiveIndex(0)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActiveIndex((i) => Math.min(i + 1, flat.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActiveIndex((i) => Math.max(i - 1, 0))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            runItem(activeIndex)
          }
        }}
        style={{ flexShrink: 0, padding: '12px 16px', fontSize: 14, borderBottom: divider }}
      />

      <div
        style={{
          flex: '1 1 auto',
          minHeight: 0,
          overflowY: 'auto',
          scrollbarWidth: 'none',
          padding: '10px 8px 4px',
        }}
      >
        {flat.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description='Shortcut tidak ditemukan' />
        ) : (
          flat.map((entry, index) => {
            const showGroup = index === 0 || flat[index - 1].group !== entry.group
            const active = index === activeIndex
            return (
              <div key={`${entry.group}-${entry.item.label}`}>
                {showGroup && (
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: token.colorTextTertiary,
                      margin: '8px 6px 6px',
                    }}
                  >
                    {entry.group}
                  </div>
                )}
                <div
                  ref={(el) => {
                    if (active && el) el.scrollIntoView({ block: 'nearest' })
                  }}
                  onClick={() => runItem(index)}
                  onMouseEnter={() => setActiveIndex(index)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    marginBottom: 4,
                    borderRadius: 10,
                    cursor: 'pointer',
                    background: active ? token.colorPrimary : token.colorFillQuaternary,
                    color: active ? '#fff' : undefined,
                  }}
                >
                  {active ? (
                    <span
                      style={{
                        width: 30,
                        height: 30,
                        flexShrink: 0,
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: 14,
                      }}
                    >
                      {entry.item.icon}
                    </span>
                  ) : entry.item.icon ? (
                    <IconBox icon={entry.item.icon} size={30} />
                  ) : (
                    <span style={{ width: 30, flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                      {entry.item.label}
                    </div>
                    {entry.item.description && (
                      <div
                        style={{
                          fontSize: 12,
                          color: active ? 'rgba(255, 255, 255, 0.8)' : token.colorTextSecondary,
                        }}
                      >
                        {entry.item.description}
                      </div>
                    )}
                  </div>
                  <span style={{ display: 'inline-flex', gap: 4, flexShrink: 0 }}>
                    {entry.item.keys.map((k) => (
                      <Kbd key={k} inverted={active}>
                        {formatKey(k)}
                      </Kbd>
                    ))}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>

      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '8px 16px',
          borderTop: divider,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
          <span style={{ fontSize: 12, color: token.colorTextSecondary }}>pilih</span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <Kbd>↵</Kbd>
          <span style={{ fontSize: 12, color: token.colorTextSecondary }}>jalankan</span>
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 12,
            color: token.colorTextTertiary,
          }}
        >
          Tekan ? untuk toggle
        </span>
      </div>
    </AppModal>
  )
}
