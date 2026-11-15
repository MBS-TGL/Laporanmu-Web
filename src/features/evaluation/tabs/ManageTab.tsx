import { useState } from 'react'
import { App, Button, Popconfirm, Space, Table, Tag, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  DeleteOutlined,
  EditOutlined,
  KeyOutlined,
  PlusOutlined,
  ReloadOutlined,
  StopOutlined,
} from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { ShellItem } from '../../../shared/components/ShellMotion'
import { useTabActions } from '../../../shared/components/ActionsSlot'
import { usePermissions } from '../../../shared/hooks/useProfile'
import {
  useActivateInstrumentToken,
  useCreateInstrument,
  useDeleteInstrument,
  useInstruments,
  useRevokeInstrumentToken,
  useUpdateInstrumentQuestions,
} from '../hooks'
import { generateInstrumentToken } from '../api'
import { INSTRUMENT_KIND_LABEL, type Instrument } from '../types'
import { InstrumentModal } from '../components/InstrumentModal'
import { QuestionsEditorModal } from '../components/QuestionsEditorModal'

/** Tab Kelola: daftar angket, penerbitan token, sunting pertanyaan. */
export function ManageTab({ active }: { active: boolean }) {
  const { message } = App.useApp()
  const { canWrite } = usePermissions()
  const instrumentsQuery = useInstruments()
  const activateToken = useActivateInstrumentToken()
  const revokeToken = useRevokeInstrumentToken()
  const deleteInstrument = useDeleteInstrument()
  const createInstrument = useCreateInstrument()
  const updateQuestions = useUpdateInstrumentQuestions()

  const [createOpen, setCreateOpen] = useState(false)
  const [questionsEdit, setQuestionsEdit] = useState<Instrument | null>(null)
  const [tokenModal, setTokenModal] = useState<{ display: string; expiresAt: string } | null>(null)

  const handleActivate = async (instrument: Instrument) => {
    try {
      const tk = await generateInstrumentToken()
      await activateToken.mutateAsync({
        instrumentId: instrument.id,
        tokenHash: tk.hash,
        tokenPrefix: tk.prefix,
        tokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      setTokenModal({
        display: tk.display,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleString('id-ID'),
      })
    } catch (err) {
      message.error((err as Error).message)
    }
  }

  const columns: ColumnsType<Instrument> = [
    { title: 'Judul', render: (_, i) => i.title },
    { title: 'Jenis', width: 110, render: (_, i) => <Tag color="geekblue">{INSTRUMENT_KIND_LABEL[i.kind]}</Tag> },
    { title: 'Kelas', width: 140, render: (_, i) => i.class?.name ?? '-' },
    {
      title: 'Status',
      width: 110,
      render: (_, i) =>
        i.is_published && i.token_expires_at && new Date(i.token_expires_at) > new Date() ? (
          <Tag color="green">Terbit</Tag>
        ) : (
          <Tag>Draft</Tag>
        ),
    },
    { title: 'Pertanyaan', width: 100, align: 'right', render: (_, i) => i.questions.length },
  ]

  if (canWrite) {
    columns.push({
      title: '',
      key: 'aksi',
      width: 170,
      render: (_, i) => (
        <Space size={0}>
          {i.is_published ? (
            <Popconfirm
              title="Cabut token angket?"
              okText="Ya, Cabut"
              cancelText="Batal"
              okButtonProps={{ loading: revokeToken.isPending }}
              onConfirm={async () => {
                try {
                  await revokeToken.mutateAsync(i.id)
                  message.success('Token dicabut')
                } catch (err) {
                  message.error((err as Error).message)
                }
              }}
            >
              <Button type="text" size="small" icon={<StopOutlined />} title="Cabut token" />
            </Popconfirm>
          ) : (
            <Button
              type="text"
              size="small"
              icon={<KeyOutlined />}
              title="Terbitkan & aktifkan token"
              onClick={() => void handleActivate(i)}
            />
          )}
          <Button type="text" size="small" icon={<EditOutlined />} title="Sunting pertanyaan" onClick={() => setQuestionsEdit(i)} />
          <Popconfirm
            title="Arsipkan angket ini?"
            okText="Ya, Arsipkan"
            cancelText="Batal"
            okButtonProps={{ loading: deleteInstrument.isPending }}
            onConfirm={async () => {
              try {
                await deleteInstrument.mutateAsync(i.id)
                message.success('Angket diarsipkan')
              } catch (err) {
                message.error((err as Error).message)
              }
            }}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} title="Arsipkan angket" />
          </Popconfirm>
        </Space>
      ),
    })
  }

  const node = (
    <Space size={8} wrap>
      <Tooltip title="Muat ulang">
        <Button icon={<ReloadOutlined />} onClick={() => void instrumentsQuery.refetch()} />
      </Tooltip>
      <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)} disabled={!canWrite}>
        Buat Angket
      </Button>
    </Space>
  )
  const actions = useTabActions(active, node)

  return (
    <ShellItem>
      <Table<Instrument>
        rowKey="id"
        size="middle"
        loading={instrumentsQuery.isPending}
        columns={columns}
        dataSource={instrumentsQuery.data ?? []}
        pagination={{ pageSize: 10, showSizeChanger: false, showTotal: (t) => `${t} angket` }}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: 'Belum ada angket. Buat dari template AKPD/Sosiometri/MBTI/EDOM.' }}
      />

      <InstrumentModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={async (values) => {
          try {
            await createInstrument.mutateAsync({ values, createdBy: null })
            message.success('Angket dibuat')
            setCreateOpen(false)
          } catch (err) {
            message.error((err as Error).message)
          }
        }}
      />
      <QuestionsEditorModal
        open={questionsEdit !== null}
        instrument={questionsEdit}
        onClose={() => setQuestionsEdit(null)}
        onSave={async (questions) => {
          if (!questionsEdit) return
          try {
            await updateQuestions.mutateAsync({ id: questionsEdit.id, questions })
            message.success('Pertanyaan diperbarui')
            setQuestionsEdit(null)
          } catch (err) {
            message.error((err as Error).message)
          }
        }}
      />
      <AppModal
        open={tokenModal !== null}
        onCancel={() => setTokenModal(null)}
        footer={null}
        title="Token Angket Aktif"
        subtitle="Tampilkan sekali ini — token lengkap tidak disimpan"
        icon={<KeyOutlined />}
        width={480}
      >
        {tokenModal && (
          <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
            <Typography.Text type="secondary" style={{ fontSize: 12.5, display: 'block', marginBottom: 8 }}>
              Santri buka halaman <b>/survey</b>, masukkan token ini, lalu NIS atau kode registrasi.
            </Typography.Text>
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: '0.08em',
                fontVariantNumeric: 'tabular-nums',
                background: 'rgba(0,0,0,0.04)',
                borderRadius: 12,
                padding: '14px 16px',
                marginBottom: 12,
              }}
            >
              {tokenModal.display}
            </div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Berlaku sampai {tokenModal.expiresAt}
            </Typography.Text>
          </div>
        )}
      </AppModal>
      {actions}
    </ShellItem>
  )
}
