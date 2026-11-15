import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, App, Button, Card, Col, Form, Grid, Input, InputNumber, Popconfirm, Row, Select, Space, Spin, Tag, Tooltip, theme } from 'antd'
import { SafetyCertificateOutlined, PlusOutlined, EditOutlined, DeleteOutlined, UndoOutlined } from '@ant-design/icons'
import { motion } from 'motion/react'
import { swapTransition, swapVariants } from '../../shared/motion'
import { AppModal } from '../../shared/components/AppModal'
import { StatusTag } from '../../shared/components/StatusTag'
import { roleMetaOf, ROLE_META } from './usersMeta'
import {
  useRoles,
  useRolePermissionMap,
  useRoleUserCounts,
  useSaveRolePermissions,
  useResetRoleToDefault,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
  effectivePermissions,
  type RbacRole,
} from './rbac'
import { defaultPermissionsForRole, permissionSummary } from '../../shared/rbac/permissions'
import { RolesMatrix, LockedRoleIcon } from './components/RolesMatrix'

// Preset warna tag AntD yang dipakai aplikasi — role baru hanya boleh
// memilih dari sini agar badge role konsisten dengan seluruh UI.
const ROLE_COLORS = ['purple', 'geekblue', 'blue', 'cyan', 'green', 'gold', 'orange', 'volcano', 'red', 'magenta', 'default']

/** Role statis bila tabel roles belum ada (migrasi 0039 belum jalan) — matrix tetap bisa dibaca. */
const FALLBACK_ROLES: RbacRole[] = ROLE_META.map((m, i) => ({
  key: m.value,
  label: m.label,
  color: m.color,
  description: null,
  sort_order: (i + 1) * 10,
  is_locked: m.value === 'developer',
}))

interface RoleFormValues {
  key: string
  label: string
  color: string
  description?: string
  sort_order?: number
}

function RoleFormModal({
  open,
  editing,
  onClose,
}: {
  open: boolean
  editing: RbacRole | null
  onClose: () => void
}) {
  const [form] = Form.useForm<RoleFormValues>()
  const createMutation = useCreateRole()
  const updateMutation = useUpdateRole()

  // Reset form setiap kali modal dibuka — nilai edit diisi dari role terpilih
  useEffect(() => {
    if (open) {
      form.resetFields()
      if (editing) {
        form.setFieldsValue({
          key: editing.key,
          label: editing.label,
          color: editing.color,
          description: editing.description ?? undefined,
          sort_order: editing.sort_order,
        })
      } else {
        form.setFieldsValue({ color: 'default', sort_order: 100 })
      }
    }
  }, [open, editing, form])

  const mutation = editing ? updateMutation : createMutation

  const submit = async () => {
    const values = await form.validateFields()
    if (editing) {
      await updateMutation.mutateAsync({
        key: editing.key,
        updates: { label: values.label, color: values.color, description: values.description ?? null, sort_order: values.sort_order },
      })
    } else {
      await createMutation.mutateAsync({
        key: values.key.trim(),
        label: values.label.trim(),
        color: values.color,
        description: values.description ?? null,
        sort_order: values.sort_order ?? 100,
      })
    }
    onClose()
  }

  return (
    <AppModal
      open={open}
      title={editing ? 'Edit Role' : 'Tambah Role'}
      subtitle="Identitas role yang tampil di badge, filter, dan matrix permission"
      icon={<SafetyCertificateOutlined />}
      onCancel={onClose}
      onOk={submit}
      okButtonProps={{ loading: mutation.isPending }}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item
          name="key"
          label="Key"
          rules={[
            { required: true, message: 'Key wajib diisi' },
            { pattern: /^[a-z][a-z0-9_]*$/, message: 'Huruf kecil, angka, dan garis bawah saja (diawali huruf)' },
          ]}
          extra="Tidak bisa diubah setelah dibuat. Dipakai profiles.role di database."
        >
          <Input disabled={!!editing} placeholder="mis. operator_perpustakaan" maxLength={40} />
        </Form.Item>
        <Form.Item name="label" label="Label" rules={[{ required: true, message: 'Label wajib diisi' }]}>
          <Input placeholder="mis. Operator Perpustakaan" maxLength={40} />
        </Form.Item>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="color" label="Warna Badge" rules={[{ required: true }]}>
              <Select
                options={ROLE_COLORS.map((c) => ({
                  value: c,
                  label: <StatusTag color={c}>{c === 'default' ? 'Netral' : c}</StatusTag>,
                }))}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="sort_order" label="Urutan" tooltip="Semakin kecil, semakin atas di daftar">
              <InputNumber min={1} max={999} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="description" label="Deskripsi">
          <Input.TextArea rows={2} placeholder="Keterangan singkat cakupan role ini" maxLength={160} />
        </Form.Item>
      </Form>
    </AppModal>
  )
}

/**
 * Tab Roles & Permission — kelola daftar role dan matrix permission
 * per modul. Layout dua kolom: daftar role (kiri) + matrix (kanan).
 * Override tersimpan di tabel role_permissions; role tanpa override
 * memakai default kode (shared/rbac/permissions.ts).
 */
export function RolesPage() {
  const { message, modal } = App.useApp()
  const { token } = theme.useToken()
  const screens = Grid.useBreakpoint()

  const rolesQuery = useRoles()
  const permMapQuery = useRolePermissionMap()
  const userCountsQuery = useRoleUserCounts()
  const saveMutation = useSaveRolePermissions()
  const resetMutation = useResetRoleToDefault()
  const deleteMutation = useDeleteRole()

  const tablesReady = !rolesQuery.isError
  const roles = useMemo(() => (rolesQuery.data && rolesQuery.data.length > 0 ? rolesQuery.data : FALLBACK_ROLES), [rolesQuery.data])

  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [draft, setDraft] = useState<Set<string>>(new Set())
  const [dirty, setDirty] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<RbacRole | null>(null)
  const matrixRef = useRef<HTMLDivElement>(null)

  const selectedRole = roles.find((r) => r.key === selectedKey) ?? roles[0] ?? null
  const permRows = permMapQuery.data

  // Draft mengikuti role terpilih / data terbaru — hanya saat belum ada editan.
  // Disesuaikan saat render (pola "adjust state when props change"), bukan di effect,
  // agar tidak kena react-hooks/set-state-in-effect.
  const [draftSrc, setDraftSrc] = useState<{ role: RbacRole | null; rows: typeof permRows; dirty: boolean }>({
    role: null,
    rows: undefined,
    dirty: false,
  })
  if (selectedRole !== draftSrc.role || permRows !== draftSrc.rows || dirty !== draftSrc.dirty) {
    setDraftSrc({ role: selectedRole, rows: permRows, dirty })
    if (selectedRole && !dirty) setDraft(effectivePermissions(selectedRole.key, permRows))
  }

  const userCounts = userCountsQuery.data ?? {}

  const switchRole = (key: string) => {
    if (key === selectedRole?.key) return
    const doSwitch = () => {
      setSelectedKey(key)
      setDirty(false)
      // Layar sempit: matrix ada di bawah daftar role — bawa ke sana agar pilihan terlihat.
      if (screens.lg === false) {
        matrixRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
    if (dirty) {
      modal.confirm({
        title: 'Buang perubahan?',
        content: 'Perubahan permission pada role ini belum disimpan. Pindah role akan membuangnya.',
        okText: 'Ya, Buang & Pindah',
        cancelText: 'Batal',
        onOk: doSwitch,
      })
    } else {
      doSwitch()
    }
  }

  const save = async () => {
    if (!selectedRole) return
    await saveMutation.mutateAsync({ roleKey: selectedRole.key, permissions: [...draft] })
    setDirty(false)
    message.success(`Permission role ${selectedRole.label} tersimpan`)
  }

  const resetDefault = async () => {
    if (!selectedRole) return
    await resetMutation.mutateAsync(selectedRole.key)
    setDraft(new Set(defaultPermissionsForRole(selectedRole.key)))
    setDirty(false)
    message.success(`Role ${selectedRole.label} dikembalikan ke default`)
  }

  const removeRole = async () => {
    if (!selectedRole) return
    try {
      await deleteMutation.mutateAsync(selectedRole.key)
      setSelectedKey(null)
      message.success(`Role ${selectedRole.label} dihapus`)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Gagal menghapus role')
    }
  }

  const confirmReset = () => {
    if (!selectedRole) return
    modal.confirm({
      title: `Reset role ${selectedRole.label} ke default?`,
      content: 'Permission akan dikembalikan ke set default bawaan aplikasi.',
      okText: 'Ya, Reset',
      cancelText: 'Batal',
      onOk: resetDefault,
    })
  }

  const canManageRole = tablesReady && !!selectedRole && !selectedRole.is_locked

  if (rolesQuery.isPending) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
        <Spin size="large" />
      </div>
    )
  }

  const summary = permissionSummary(draft)

  return (
    <div>
      {!tablesReady && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Tabel RBAC belum tersedia"
          description="Jalankan migrasi 0039_rbac_roles.sql di Supabase untuk mengaktifkan penyimpanan role & permission. Untuk sekarang matrix ditampilkan read-only dari default aplikasi."
        />
      )}

      <Row gutter={[16, 16]}>
        {/* ── Daftar role ── */}
        <Col xs={24} lg={6}>
          <Card
            size="small"
            styles={{ body: { display: 'flex', flexDirection: 'column', gap: 6 } }}
            title="Role"
          >
            {roles.map((role) => {
              const meta = roleMetaOf(role.key)
              const isActive = selectedRole?.key === role.key
              const permCount = effectivePermissions(role.key, permRows).size
              return (
                <button
                  key={role.key}
                  type="button"
                  onClick={() => switchRole(role.key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    padding: '8px 10px',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    fontSize: 13,
                    borderRadius: 10,
                    border: `1px solid ${isActive ? token.colorPrimary : token.colorBorderSecondary}`,
                    background: isActive ? token.colorPrimaryBg : 'transparent',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s, background 0.2s',
                  }}
                >
                  <StatusTag color={meta.color} icon={meta.icon}>
                    {role.label}
                  </StatusTag>
                  <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, color: token.colorTextSecondary, fontSize: 12 }}>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {permCount} perm · {userCounts[role.key] ?? 0} user
                    </span>
                    {role.is_locked && <LockedRoleIcon />}
                  </span>
                </button>
              )
            })}
            {/* Aksi role selalu terlihat — alasan disabled ditulis, bukan disembunyikan. */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                marginTop: 4,
                paddingTop: 10,
                borderTop: `1px solid ${token.colorBorderSecondary}`,
              }}
            >
              <Button
                type="primary"
                icon={<PlusOutlined />}
                disabled={!tablesReady}
                onClick={() => {
                  setEditingRole(null)
                  setFormOpen(true)
                }}
                block
              >
                Tambah Role
              </Button>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  icon={<EditOutlined />}
                  disabled={!canManageRole}
                  style={{ flex: 1 }}
                  aria-label={selectedRole ? `Edit role ${selectedRole.label}` : 'Edit role'}
                  onClick={() => {
                    setEditingRole(selectedRole)
                    setFormOpen(true)
                  }}
                >
                  Edit
                </Button>
                <Popconfirm
                  title={`Hapus role ${selectedRole?.label ?? ''}?`}
                  description="Role tanpa pengguna saja yang bisa dihapus."
                  okText="Ya, Hapus"
                  cancelText="Batal"
                  onConfirm={removeRole}
                >
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    disabled={!canManageRole}
                    loading={deleteMutation.isPending}
                    style={{ flex: 1 }}
                    aria-label={selectedRole ? `Hapus role ${selectedRole.label}` : 'Hapus role'}
                  >
                    Hapus
                  </Button>
                </Popconfirm>
              </div>
              {tablesReady && selectedRole?.is_locked && (
                <span style={{ fontSize: 12, lineHeight: 1.5, color: token.colorTextSecondary }}>
                  Role terkunci: permission selalu aktif dan tidak bisa diubah.
                </span>
              )}
            </div>
          </Card>
        </Col>

        {/* ── Matrix permission ── */}
        <Col xs={24} lg={18}>
          <Card
            ref={matrixRef}
            size="small"
            style={{ scrollMarginTop: 64 }}
            title={selectedRole ? `Permission: ${selectedRole.label}` : 'Permission'}
          >
            {selectedRole ? (
              <>
                {/* Ganti role: konten baru fade-up singkat tanpa menunggu exit (pola InsightsPage). */}
                <motion.div
                  key={selectedRole.key}
                  variants={swapVariants}
                  initial="initial"
                  animate="animate"
                  transition={swapTransition}
                >
                  {selectedRole.description && (
                    <p style={{ marginTop: 0, color: token.colorTextSecondary, fontSize: 13 }}>{selectedRole.description}</p>
                  )}
                  <RolesMatrix
                    value={draft}
                    onChange={(next) => {
                      setDraft(next)
                      setDirty(true)
                    }}
                    locked={!tablesReady || selectedRole.is_locked}
                  />
                </motion.div>

                {/* Footer aksi menempel di bawah viewport selama matrix terlihat;
                    di mobile naik 56px agar tidak tertimpa BottomNav (pola MainLayout). */}
                <div
                  style={{
                    position: 'sticky',
                    bottom: !screens.lg ? 56 : 0,
                    zIndex: 5,
                    margin: '16px -12px -12px',
                    padding: '10px 12px',
                    background: token.colorBgContainer,
                    borderTop: `1px solid ${token.colorBorderSecondary}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <Space wrap size={8}>
                    <Tooltip title={`${summary.checked} dari ${summary.total} permission aktif`}>
                      <span style={{ display: 'inline-flex', cursor: 'help' }}>
                        <Tag style={{ borderRadius: 6, marginInlineEnd: 0, fontVariantNumeric: 'tabular-nums' }}>
                          {summary.checked}/{summary.total}
                        </Tag>
                      </span>
                    </Tooltip>
                    {dirty && (
                      <Tag color="warning" style={{ borderRadius: 6, marginInlineEnd: 0 }}>
                        Belum disimpan
                      </Tag>
                    )}
                  </Space>
                  {selectedRole.is_locked ? (
                    <span style={{ fontSize: 12, color: token.colorTextSecondary }}>Hanya baca</span>
                  ) : (
                    <Space wrap>
                      <Button
                        icon={<UndoOutlined />}
                        disabled={!tablesReady || (!dirty && !effectiveRoleDiffersFromDefault(selectedRole.key, permRows))}
                        onClick={confirmReset}
                      >
                        Reset Default
                      </Button>
                      <Button type="primary" disabled={!dirty} loading={saveMutation.isPending} onClick={save}>
                        Simpan
                      </Button>
                    </Space>
                  )}
                </div>
              </>
            ) : (
              <Alert type="info" showIcon message="Pilih role di kiri untuk mengatur permission-nya." />
            )}
          </Card>
        </Col>
      </Row>

      <RoleFormModal open={formOpen} editing={editingRole} onClose={() => setFormOpen(false)} />
    </div>
  )
}

/** Reset Default hanya aktif saat override DB benar-benar berbeda dari default kode. */
function effectiveRoleDiffersFromDefault(
  roleKey: string,
  rows: { role_key: string; permission: string }[] | undefined,
): boolean {
  const effective = [...effectivePermissions(roleKey, rows)].sort()
  const defaults = [...defaultPermissionsForRole(roleKey)].sort()
  if (effective.length !== defaults.length) return true
  return effective.some((p, i) => p !== defaults[i])
}
