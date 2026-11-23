import { useState } from 'react'
import { App, Button, Descriptions, Drawer, Input, Popconfirm, Select, Space, Tag, Typography } from 'antd'
import { DeleteOutlined, SwapOutlined, UndoOutlined } from '@ant-design/icons'
import {
  useArchiveAdmission,
  useRestoreAdmission,
  useUpdateAdmissionNotes,
  useUpdateAdmissionStage,
} from '../hooks'
import { STAGE_META, stageMeta, type Admission, type AdmissionStage } from '../types'

interface AdmissionDrawerProps {
  open: boolean
  admission: Admission | null
  canWrite: boolean
  onClose: () => void
  onConvert: (admission: Admission) => void
}

const STAGE_OPTIONS = (Object.keys(STAGE_META) as AdmissionStage[]).map((key) => ({
  value: key,
  label: STAGE_META[key].label,
}))

export function AdmissionDrawer({
  open,
  admission,
  canWrite,
  onClose,
  onConvert,
}: AdmissionDrawerProps) {
  const { message } = App.useApp()
  const [notes, setNotes] = useState('')
  const stageMutation = useUpdateAdmissionStage()
  const notesMutation = useUpdateAdmissionNotes()
  const archiveMutation = useArchiveAdmission()
  const restoreMutation = useRestoreAdmission()

  // Sinkronkan catatan saat baris/modal berganti (pola adjust-state-saat-render,
  // bukan effect, supaya tidak memicu render berantai).
  const [syncKey, setSyncKey] = useState('')
  const currentKey = admission ? `${admission.id}:${open}` : ''
  if (currentKey !== syncKey) {
    setSyncKey(currentKey)
    setNotes(admission?.notes ?? '')
  }

  if (!admission) return null

  const archived = Boolean(admission.deleted_at)
  const stage = stageMeta(admission.stage)

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="min(520px, 92vw)"
      title="Detail Pendaftar"
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {admission.full_name}
          </Typography.Title>
          <Typography.Text type="secondary">
            {admission.registration_number} · {admission.target_grade ?? 'tanpa target kelas'}
          </Typography.Text>
        </div>

        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="Tahap">
            <Tag color={stage.color}>{stage.label}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Jenis Kelamin">
            {admission.gender === 'L' ? 'Laki-laki' : admission.gender === 'P' ? 'Perempuan' : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="TTL">
            {[admission.birth_place, admission.birth_date].filter(Boolean).join(', ') || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Asal Sekolah">{admission.origin_school ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Wali">
            {admission.parent_name ?? '—'}
            {admission.parent_phone ? ` · ${admission.parent_phone}` : ''}
          </Descriptions.Item>
          <Descriptions.Item label="Alamat">{admission.address ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Terdaftar">
            {new Date(admission.created_at).toLocaleString('id-ID')}
          </Descriptions.Item>
        </Descriptions>

        {canWrite && !archived && (
          <>
            <div>
              <Typography.Text strong style={{ display: 'block', marginBottom: 6 }}>
                Ubah tahap
              </Typography.Text>
              <Select
                value={admission.stage}
                options={STAGE_OPTIONS}
                style={{ width: '100%' }}
                loading={stageMutation.isPending}
                onChange={(value) =>
                  stageMutation.mutate(
                    { id: admission.id, stage: value },
                    {
                      onSuccess: () => message.success('Tahap pendaftar diperbarui'),
                      onError: (err: Error) => message.error(err.message),
                    },
                  )
                }
              />
            </div>

            <div>
              <Typography.Text strong style={{ display: 'block', marginBottom: 6 }}>
                Catatan
              </Typography.Text>
              <Input.TextArea
                rows={3}
                value={notes}
                maxLength={2000}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan panitia PPDB"
              />
              <Button
                size="small"
                style={{ marginTop: 8 }}
                loading={notesMutation.isPending}
                onClick={() =>
                  notesMutation.mutate(
                    { id: admission.id, notes },
                    {
                      onSuccess: () => message.success('Catatan disimpan'),
                      onError: (err: Error) => message.error(err.message),
                    },
                  )
                }
              >
                Simpan Catatan
              </Button>
            </div>
          </>
        )}

        {canWrite && (
          <Space wrap>
            {!archived && (
              <Button type="primary" icon={<SwapOutlined />} onClick={() => onConvert(admission)}>
                Konversi ke Santri
              </Button>
            )}
            {!archived ? (
              <Popconfirm
                title="Arsipkan pendaftar ini?"
                description="Data tetap tersimpan di tab Arsip dan bisa dipulihkan."
                okText="Ya, Arsipkan"
                cancelText="Batal"
                onConfirm={() =>
                  archiveMutation.mutate(admission.id, {
                    onSuccess: () => {
                      message.success('Pendaftar diarsipkan')
                      onClose()
                    },
                    onError: (err: Error) => message.error(err.message),
                  })
                }
              >
                <Button danger icon={<DeleteOutlined />} loading={archiveMutation.isPending}>
                  Arsipkan
                </Button>
              </Popconfirm>
            ) : (
              <Button
                icon={<UndoOutlined />}
                loading={restoreMutation.isPending}
                onClick={() =>
                  restoreMutation.mutate(admission.id, {
                    onSuccess: () => {
                      message.success('Pendaftar dipulihkan')
                      onClose()
                    },
                    onError: (err: Error) => message.error(err.message),
                  })
                }
              >
                Pulihkan
              </Button>
            )}
          </Space>
        )}
      </Space>
    </Drawer>
  )
}
