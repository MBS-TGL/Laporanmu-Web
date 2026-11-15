import { useMemo, useState } from 'react'
import { Collapse, Checkbox, Empty, Input, Tag, Tooltip, theme } from 'antd'
import { LockOutlined } from '@ant-design/icons'
import { MODULE_REGISTRY, type RbacModuleMeta, type RbacActionMeta } from '../../../shared/rbac/permissions'
import { useDebounce } from '../../../shared/hooks/useDebounce'

interface RolesMatrixProps {
  /** Permission efektif role saat ini (override DB ?? default kode). */
  value: Set<string>
  onChange: (next: Set<string>) => void
  /** Role terkunci (developer): matrix hanya dibaca. */
  locked?: boolean
}

/**
 * Matrix permission per modul — grup collapsible per modul, checkbox per aksi,
 * select-all per modul di header grup. Sumber daftar modul & aksi = MODULE_REGISTRY.
 * Pencarian menyaring modul/aksi dan otomatis membuka semua hasil yang cocok.
 */
export function RolesMatrix({ value, onChange, locked = false }: RolesMatrixProps) {
  const { token } = theme.useToken()

  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 300)
  const q = debouncedQuery.trim().toLowerCase()

  // Modul tampil bila label/key modul cocok (semua aksi ikut) atau ada aksi yang cocok.
  const visible = useMemo(() => {
    if (!q) return MODULE_REGISTRY.map((m) => ({ module: m, actions: m.actions }))
    const out: { module: RbacModuleMeta; actions: RbacActionMeta[] }[] = []
    for (const m of MODULE_REGISTRY) {
      if (m.label.toLowerCase().includes(q) || m.key.includes(q)) {
        out.push({ module: m, actions: m.actions })
        continue
      }
      const actions = m.actions.filter((a) => a.label.toLowerCase().includes(q) || `${m.key}:${a.key}`.includes(q))
      if (actions.length > 0) out.push({ module: m, actions })
    }
    return out
  }, [q])

  // defaultActiveKey dipakai saat mount; Collapse di-remount per ganti q (key di bawah)
  // sehingga hasil pencarian tampil terbuka semua dan hapus pencarian kembali ke modul pertama —
  // tanpa setState di effect (larangan lint react-hooks/set-state-in-effect).
  const defaultOpen = useMemo(() => MODULE_REGISTRY.slice(0, 1).map((m) => m.key), [])

  const togglePerm = (perm: string, checked: boolean) => {
    const next = new Set(value)
    if (checked) next.add(perm)
    else next.delete(perm)
    onChange(next)
  }

  const toggleModule = (moduleKey: string, actions: RbacActionMeta[], checked: boolean) => {
    const next = new Set(value)
    for (const action of actions) {
      const perm = `${moduleKey}:${action.key}`
      if (checked) next.add(perm)
      else next.delete(perm)
    }
    onChange(next)
  }

  return (
    <div>
      <Input.Search
        allowClear
        placeholder="Cari permission (mis. Absensi, students:create)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ marginBottom: 12 }}
        aria-label="Cari permission"
      />
      {visible.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <span>
              Tidak ada permission yang cocok
              <br />
              <span style={{ color: token.colorTextSecondary, fontSize: 12 }}>Coba kata kunci lain atau hapus pencarian</span>
            </span>
          }
          style={{ margin: '24px 0' }}
        />
      ) : (
        <Collapse
          ghost
          key={q ? `q:${q}` : 'browse'}
          defaultActiveKey={q ? visible.map((v) => v.module.key) : defaultOpen}
          items={visible.map(({ module, actions }) => {
            const perms = actions.map((a) => `${module.key}:${a.key}`)
            const checkedCount = perms.filter((p) => value.has(p)).length
            const allChecked = checkedCount === perms.length
            return {
              key: module.key,
              label: (
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox
                    checked={allChecked}
                    indeterminate={checkedCount > 0 && !allChecked}
                    disabled={locked}
                    onChange={(e) => toggleModule(module.key, actions, e.target.checked)}
                    aria-label={`Pilih semua ${module.label}`}
                  />
                  <span style={{ fontWeight: 600 }}>{module.label}</span>
                  <Tag
                    color={checkedCount === perms.length ? 'success' : checkedCount > 0 ? 'processing' : 'default'}
                    style={{ borderRadius: 6, fontSize: 11, lineHeight: '16px', marginInlineEnd: 0 }}
                  >
                    {checkedCount}/{perms.length}
                  </Tag>
                </div>
              ),
              children: (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8, paddingLeft: 4 }}>
                  {actions.map((action) => {
                    const perm = `${module.key}:${action.key}`
                    return (
                      <Checkbox
                        key={perm}
                        checked={value.has(perm)}
                        disabled={locked}
                        onChange={(e) => togglePerm(perm, e.target.checked)}
                      >
                        <Tooltip title={perm}>
                          <span>{action.label}</span>
                        </Tooltip>
                      </Checkbox>
                    )
                  })}
                </div>
              ),
            }
          })}
          style={{ background: token.colorBgContainer }}
        />
      )}
    </div>
  )
}

/** Ikon kunci untuk role terkunci — dipakai sidebar RolesPage. */
export function LockedRoleIcon() {
  return (
    <Tooltip title="Role developer terkunci: selalu mendapat semua permission">
      <LockOutlined style={{ color: '#9333ea', fontSize: 12 }} />
    </Tooltip>
  )
}
