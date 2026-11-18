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
export function EntitySwitcher({ isMobile }: { isMobile: boolean }) {
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
        style={{ width: isMobile ? 120 : 180, flexShrink: 0 }}
        aria-label="Pilih entity lembaga"
      />
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
      <EntityModal open={manageOpen} onClose={() => setManageOpen(false)} currentId={entityId} />
    </>
  )
}
