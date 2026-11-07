import { useMemo, useRef, useState } from 'react'
import { Empty, Input, theme } from 'antd'
import { SearchOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { AppModal } from './AppModal'
import { IconBox } from './IconBox'
import type { ShortcutSection } from '../hooks/usePageShortcuts'

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)

function formatKey(key: string): string {
  if (isMac && key === 'Ctrl') return '⌘'
  return key
}

/** Chip tombol keyboard kecil — juga dipakai menu dropdown lain */
export function Kbd({ children }: { children: string }) {
  const { token } = theme.useToken()
  return (
    <span
      style={{
        display: 'inline-block',
        minWidth: 22,
        padding: '1px 6px',
        borderRadius: 6,
        border: `1px solid ${token.colorBorder}`,
        background: token.colorFillQuaternary,
        fontSize: 11,
        fontWeight: 600,
        lineHeight: '18px',
        textAlign: 'center',
        color: token.colorTextSecondary,
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
  const listRef = useRef<HTMLDivElement>(null)

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

  return (
    <AppModal
      open={open}
      onCancel={onClose}
      footer={null}
      width={560}
      destroyOnHidden
      icon={<ThunderboltOutlined />}
      title="Shortcut Keyboard"
      subtitle="Tekan ? untuk membuka atau menutup palet ini"
      styles={{ body: { maxHeight: 'calc(100dvh - 260px)', overflowY: 'auto', scrollbarWidth: 'none', paddingRight: 4 } }}
    >
      <Input
        autoFocus
        prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
        placeholder="Cari shortcut..."
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
        style={{ marginBottom: 12 }}
      />

      {flat.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Shortcut tidak ditemukan" />
      ) : (
        <div ref={listRef}>
          {flat.map((entry, index) => {
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
                      margin: '12px 4px 6px',
                    }}
                  >
                    {entry.group}
                  </div>
                )}
                <div
                  onClick={() => runItem(index)}
                  onMouseEnter={() => setActiveIndex(index)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: 10,
                    cursor: 'pointer',
                    background: active ? token.colorPrimaryBg : 'transparent',
                  }}
                >
                  {entry.item.icon ? (
                    <IconBox icon={entry.item.icon} size={30} />
                  ) : (
                    <span style={{ width: 30, flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{entry.item.label}</div>
                    {entry.item.description && (
                      <div style={{ fontSize: 12, color: token.colorTextSecondary }}>
                        {entry.item.description}
                      </div>
                    )}
                  </div>
                  <span style={{ display: 'inline-flex', gap: 4, flexShrink: 0 }}>
                    {entry.item.keys.map((k) => (
                      <Kbd key={k}>{formatKey(k)}</Kbd>
                    ))}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </AppModal>
  )
}
