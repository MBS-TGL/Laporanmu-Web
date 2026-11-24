import { useState } from 'react'
import { App, Button, Select, Tooltip } from 'antd'
import { AppstoreOutlined, SettingOutlined } from '@ant-design/icons'
import { useFlag } from '../shared/hooks/useFeatureFlags'
import { useProfile } from '../shared/hooks/useProfile'
import { useEntityScope } from '../features/entities/hooks'
import { EntityModal } from '../features/entities/EntityModal'

/**
 * P5b Multi-entity — switcher lembaga di Topbar.
 * Hanya tampil bila flag system.multi_entity aktif DAN ada > 1 entity;
 * dengan satu entity (default) UI tidak berubah sama sekali.
 * Kelola Entity hanya untuk developer/admin (RLS entities menegakkan).
 */
interface EntitySwitcherProps {
  /** Blok penuh di drawer/sidebar (ada label, select selebar kontainer). */
  fullWidth?: boolean
}

export function EntitySwitcher({ fullWidth = false }: EntitySwitcherProps) {
  const { message } = App.useApp()
  const enabled = useFlag('system.multi_entity')
  const { profile } = useProfile()
  const { entities, entityId, switchEntity } = useEntityScope()
  const [manageOpen, setManageOpen] = useState(false)

  const isAdmin = profile?.role === 'developer' || profile?.role === 'admin'

  if (!enabled || entities.length === 0) return null
  const switchable = entities.filter((e) => e.is_active)

  return (
    <>
      <div
        style={
          fullWidth
            ? {
                display: 'flex',
                alignItems: 'flex-end',
                gap: 6,
                padding: '10px 12px',
                borderBottom: '1px solid #eef2f7',
                flexShrink: 0,
              }
            : { display: 'contents' }
        }
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          {fullWidth && (
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: '#94a3b8',
                marginBottom: 4,
              }}
            >
              Lembaga
            </div>
          )}
          <Select
            size="small"
            value={entityId ?? undefined}
            loading={entities.length === 0}
            onChange={(id) => {
              switchEntity(id)
              message.success(`Beralih ke ${entities.find((e) => e.id === id)?.name ?? 'entity'}`)
            }}
            options={switchable.map((e) => ({ value: e.id, label: e.name }))}
            prefix={<AppstoreOutlined style={{ color: '#64748b', fontSize: 12 }} />}
            // Topbar: menyusut saat ruang mepet (nama terpotong elipsis).
            // Drawer: memenuhi lebar kontainer karena ruangnya lega.
            style={fullWidth ? { width: '100%' } : { width: 180, flexShrink: 0 }}
            aria-label="Pilih entity lembaga"
          />
        </div>
        {isAdmin && (
          <Tooltip title="Kelola entity">
            <Button
              type="text"
              size="small"
              icon={<SettingOutlined style={{ fontSize: 13 }} />}
              onClick={() => setManageOpen(true)}
              aria-label="Kelola entity"
              style={{ width: 28, height: 28, color: '#64748b', flexShrink: 0 }}
            />
          </Tooltip>
        )}
      </div>
      <EntityModal open={manageOpen} onClose={() => setManageOpen(false)} currentId={entityId} />
    </>
  )
}
