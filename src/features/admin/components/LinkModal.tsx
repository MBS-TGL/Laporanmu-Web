import { useState } from 'react'
import { Alert, App, Button, Form, Input, Segmented, Select, Space, theme, Tooltip, Typography } from 'antd'
import { CopyOutlined, LinkOutlined, UserAddOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { ModalFooter } from '../../../shared/components/ModalFooter'
import { useRoleMeta, roleMetaOf } from '../usersMeta'
import { logAudit } from '../../../shared/utils/auditLogger'
import { useCreateStaffUser, useSetTeacherLink } from '../hooks'
import type { AdminProfile } from '../types'
import type { CreateStaffUserResult, TeacherLinkBrief } from '../api'

/** Target modal hubungkan: dari sisi akun (pilih guru) atau sisi guru (pilih akun). */
export interface LinkTarget {
  profile: AdminProfile | null
  teacher: TeacherLinkBrief | null
}

interface LinkFormValues {
  pick?: string
  email?: string
  name?: string
  role?: string
  password?: string
}

/** Password acak yang mudah dibaca: tanpa karakter ambigu (0/O, 1/l/I). */
function generatePassword(length = 12): string {
  const charset = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*'
  const values = crypto.getRandomValues(new Uint32Array(length))
  return [...values].map((v) => charset[v % charset.length]).join('')
}

/** Baris kredensial di kartu hasil: label kecil (ciri label tabel aplikasi), nilai monospace agar karakter ambigu terbaca. */
function CredentialRow({
  label,
  value,
  onCopy,
}: {
  label: string
  value: string
  onCopy: () => void
}) {
  const { token } = theme.useToken()
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '4px 12px',
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 600, color: token.colorTextSecondary, letterSpacing: 0.4 }}>
        {label}
      </span>
      <Space size={4}>
        <code style={{ fontFamily: token.fontFamilyCode, fontSize: 13, wordBreak: 'break-all', color: token.colorText }}>
          {value}
        </code>
        <Tooltip title={`Salin ${label.toLowerCase()}`}>
          <Button
            type="text"
            size="small"
            icon={<CopyOutlined />}
            aria-label={`Salin ${label.toLowerCase()}`}
            onClick={onCopy}
          />
        </Tooltip>
      </Space>
    </div>
  )
}

// Modal hubungkan guru ↔ akun (dua arah), pola AppModal:
// - Dari sisi AKUN : pilih guru yang belum terhubung (jalur existing).
// - Dari sisi GURU : default "Buat akun baru" (email/nama/role via Edge
//   Function `create-user` — akun langsung ter-link ke guru), dengan opsi
//   kedua "Pilih akun existing" bila memang ada akun yang belum terhubung.
export function LinkModal({
  target,
  profiles,
  unlinkedTeachers,
  linkedProfileIds,
  myRole,
  onClose,
}: {
  target: LinkTarget
  profiles: AdminProfile[]
  unlinkedTeachers: TeacherLinkBrief[]
  linkedProfileIds: Set<string>
  myRole: string | null
  onClose: () => void
}) {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const linkMutation = useSetTeacherLink()
  const createMutation = useCreateStaffUser()
  const [form] = Form.useForm<LinkFormValues>()

  // Sisi guru: mode utama = buat akun baru; existing hanya relevan bila ada
  // akun yang belum terhubung guru mana pun.
  const [mode, setMode] = useState<'create' | 'existing'>(
    target.teacher && unlinkedAccountsFor(target).length > 0 ? 'existing' : 'create',
  )
  const [created, setCreated] = useState<(CreateStaffUserResult & { typedPassword: string | null }) | null>(null)
  const [pick, setPick] = useState<string | undefined>()

  /** Akun yang bisa dipilih dari sisi guru: belum terhubung siapa pun, atau akun milik guru itu sendiri. */
  function unlinkedAccountsFor(t: LinkTarget): AdminProfile[] {
    return profiles.filter((p) => !linkedProfileIds.has(p.id) || p.id === t.teacher?.profile_id)
  }

  const roleMetas = useRoleMeta()
  const roleOptions = roleMetas.filter(
    (r) => r.value !== 'pending' && (r.value !== 'developer' || myRole === 'developer'),
  ).map((r) => ({ value: r.value, label: r.label }))

  const submitExisting = () => {
    const teacherId = target.profile ? pick : target.teacher?.id
    const profileId = target.profile?.id ?? pick
    if (!teacherId || !profileId) {
      message.warning(target.profile ? 'Pilih guru yang akan dihubungkan' : 'Pilih akun tujuan')
      return
    }
    const oldTeacher = target.teacher ?? undefined
    linkMutation.mutate(
      { teacherId, profileId },
      {
        onSuccess: () => {
          message.success('Guru berhasil dihubungkan ke akun')
          void logAudit({
            action: 'UPDATE',
            source: 'SECURITY',
            tableName: 'teachers',
            recordId: teacherId,
            oldData: { profile_id: oldTeacher?.profile_id ?? null },
            newData: { profile_id: profileId },
          })
          onClose()
        },
        onError: (err: Error) => message.error(err.message || 'Gagal menghubungkan guru'),
      },
    )
  }

  const submitCreate = async () => {
    const values = await form.validateFields()
    const password = values.password?.trim()
    createMutation.mutate(
      {
        email: values.email!.trim(),
        name: values.name!.trim(),
        role: values.role ?? 'teacher',
        teacherId: target.teacher?.id,
        sendInvite: !password,
        password: password || undefined,
      },
      {
        onSuccess: (result) => {
          message.success(`Akun untuk ${result.email} dibuat`)
          void logAudit({
            action: 'INSERT',
            source: 'AUTH',
            tableName: 'profiles',
            recordId: result.userId,
            newData: {
              email: result.email,
              role: result.role,
              teacher_id: target.teacher?.id ?? null,
              invited: !password,
              password_manual: Boolean(password),
            },
          })
          // Simpan password yang diketik/diacak untuk layar sukses (tidak dikirim balik oleh server)
          setCreated({ ...result, typedPassword: password || null })
        },
        onError: (err: Error) => message.error(err.message || 'Gagal membuat akun'),
      },
    )
  }

  // ── Tampilan hasil: kredensial siap dibagikan ──
  // Satu titik fokus: kartu kredensial yang akan dibagikan. Penjelasan cukup
  // satu kalimat di atasnya (judul modal sudah menyatakan sukses, tidak perlu
  // banner Alert hijau yang mengulanginya). Salin per baris untuk berbagi
  // sebagian, tombol footer untuk menyalin semuanya sekaligus.
  if (created) {
    const hasPassword = Boolean(created.typedPassword)

    const copyText = async (text: string, successMsg: string) => {
      try {
        await navigator.clipboard.writeText(text)
        message.success(successMsg)
      } catch {
        message.error('Gagal menyalin — salin manual dari kartu di atas')
      }
    }

    const hasCredential = hasPassword || created.actionLink
    const footer = hasCredential ? (
      <ModalFooter
        onCancel={onClose}
        cancelText="Selesai"
        okText={hasPassword ? 'Salin Kredensial' : 'Salin Link'}
        okIcon={<CopyOutlined />}
        onOk={
          hasPassword
            ? () =>
                void copyText(
                  `Email: ${created.email}\nPassword: ${created.typedPassword}`,
                  'Kredensial disalin ke clipboard',
                )
            : () => void copyText(created.actionLink!, 'Link disalin ke clipboard')
        }
      />
    ) : (
      <ModalFooter okText="Selesai" onOk={onClose} />
    )

    return (
      <AppModal
        open
        onCancel={onClose}
        footer={footer}
        title="Akun Berhasil Dibuat"
        subtitle={`${created.email} · ${roleMetaOf(created.role).label}`}
        icon={<UserAddOutlined />}
      >
        <div style={{ marginTop: 4 }}>
          <Typography.Paragraph type="secondary" style={{ fontSize: 13.5, marginBottom: 12 }}>
            {hasPassword
              ? 'Bagikan email & password berikut ke guru untuk login pertama kali. Password bisa diganti guru lewat email pemulihan di menu Pengguna.'
              : created.actionLink
                ? 'Bagikan tautan berikut ke guru untuk mengatur password pertama kali.'
                : 'Link set-password tidak tersedia. Gunakan aksi kirim email pemulihan di tabel Pengguna.'}
          </Typography.Paragraph>

          {hasCredential ? (
            <div
              style={{
                border: `1px solid ${token.colorBorderSecondary}`,
                borderRadius: 10,
                padding: '12px 16px',
                background: token.colorFillQuaternary,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {hasPassword ? (
                <>
                  <CredentialRow
                    label="Email"
                    value={created.email}
                    onCopy={() => void copyText(created.email, 'Email disalin ke clipboard')}
                  />
                  <CredentialRow
                    label="Password"
                    value={created.typedPassword!}
                    onCopy={() => void copyText(created.typedPassword!, 'Password disalin ke clipboard')}
                  />
                </>
              ) : (
                <CredentialRow
                  label="Tautan set-password"
                  value={created.actionLink!}
                  onCopy={() => void copyText(created.actionLink!, 'Link disalin ke clipboard')}
                />
              )}
              {!hasPassword && created.actionLink && (
                <Button icon={<LinkOutlined />} href={created.actionLink} target="_blank" style={{ alignSelf: 'flex-start' }}>
                  Buka Link
                </Button>
              )}
            </div>
          ) : (
            <Alert type="warning" showIcon message="Tidak ada kredensial untuk dibagikan" />
          )}
        </div>
      </AppModal>
    )
  }

  // ── Dari sisi akun: pilih guru ──
  if (target.profile) {
    return (
      <AppModal
        open
        onCancel={onClose}
        onOk={submitExisting}
        okText="Hubungkan"
        okButtonProps={{ loading: linkMutation.isPending }}
        title={`Hubungkan guru ke ${target.profile.name}`}
        subtitle="Pilih guru yang belum punya akun, lalu hubungkan"
        icon={<LinkOutlined />}
      >
        <Select
          placeholder="Pilih guru yang belum terhubung"
          style={{ width: '100%', marginTop: 8 }}
          value={pick}
          onChange={setPick}
          showSearch
          optionFilterProp="label"
          options={unlinkedTeachers.map((t) => ({
            value: t.id,
            label: `${t.name}${t.nbm ? ` (${t.nbm})` : ''}`,
          }))}
          notFoundContent="Semua guru sudah terhubung"
        />
        <Alert
          type="info"
          showIcon
          style={{ marginTop: 12 }}
          message="Keterhubungan dipakai untuk atribusi presensi guru, beban mengajar, dan integritas data."
        />
      </AppModal>
    )
  }

  // ── Dari sisi guru: buat akun baru (default) atau pilih akun existing ──
  const hasExistingChoice = unlinkedAccountsFor(target).length > 0
  return (
    <AppModal
      open
      onCancel={onClose}
      onOk={mode === 'create' ? submitCreate : submitExisting}
      okText={mode === 'create' ? 'Buat & Hubungkan' : 'Hubungkan'}
      okButtonProps={{
        loading: mode === 'create' ? createMutation.isPending : linkMutation.isPending,
      }}
      title={`Akun untuk ${target.teacher?.name ?? ''}`}
      subtitle={mode === 'create' ? 'Akun auth baru dibuat via Edge Function, guru langsung terhubung' : undefined}
      icon={<UserAddOutlined />}
    >
      <Space direction="vertical" size={12} style={{ width: '100%', marginTop: 8 }}>
        {hasExistingChoice && (
          <Segmented
            block
            value={mode}
            onChange={(v) => setMode(v as 'create' | 'existing')}
            options={[
              { value: 'create', label: 'Buat akun baru', icon: <UserAddOutlined /> },
              { value: 'existing', label: 'Akun existing', icon: <LinkOutlined /> },
            ]}
          />
        )}
        {mode === 'create' ? (
          <Form form={form} layout="vertical">
            <Form.Item
              name="email"
              label="Email"
              initialValue={target.teacher?.email ?? ''}
              rules={[
                { required: true, message: 'Email wajib diisi' },
                { type: 'email', message: 'Format email tidak valid' },
              ]}
            >
              <Input placeholder="nama@sekolah.sch.id" maxLength={120} />
            </Form.Item>
            <Form.Item
              name="name"
              label="Nama"
              initialValue={target.teacher?.name ?? ''}
              rules={[{ required: true, message: 'Nama wajib diisi' }]}
            >
              <Input maxLength={80} />
            </Form.Item>
            <Form.Item name="role" label="Role" initialValue="teacher" rules={[{ required: true }]}>
              <Select options={roleOptions} />
            </Form.Item>
            <Form.Item
              name="password"
              label="Password (opsional)"
              extra="Kosongkan untuk membuat link set-password. Isi (min 8 karakter) agar guru langsung bisa login."
              rules={[{ min: 8, message: 'Password minimal 8 karakter' }]}
            >
              <Input.Password
                placeholder="Kosongkan = pakai link set-password"
                autoComplete="new-password"
                maxLength={72}
                addonAfter={
                  <Button
                    type="text"
                    size="small"
                    onClick={() => form.setFieldValue('password', generatePassword())}
                  >
                    Acak
                  </Button>
                }
              />
            </Form.Item>
          </Form>
        ) : (
          <Select
            placeholder="Pilih akun pengguna"
            style={{ width: '100%' }}
            value={pick}
            onChange={setPick}
            showSearch
            optionFilterProp="label"
            options={unlinkedAccountsFor(target).map((p) => ({ value: p.id, label: `${p.name} (${p.email})` }))}
            notFoundContent="Semua akun sudah terhubung"
          />
        )}
        <Alert
          type="info"
          showIcon
          message="Keterhubungan dipakai untuk atribusi presensi guru, beban mengajar, dan integritas data."
        />
      </Space>
    </AppModal>
  )
}
