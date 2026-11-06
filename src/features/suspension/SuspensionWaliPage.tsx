import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Segmented,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd'
import {
  CheckCircleOutlined,
  HomeOutlined,
  PaperClipOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  rpcGetDay,
  rpcSaveLog,
  rpcSubmitTask,
  rpcValidateToken,
} from './api'
import type { WaliDayData, WaliEntries, WaliLogEntry, WaliTemplateItem, WaliTokenInfo } from './types'

const BLOCK_LABEL: Record<string, string> = {
  dinihari: '🌙 Dini Hari & Subuh (03.00–06.30)',
  pagi: '🌅 Pagi & Siang (06.30–14.45)',
  sore: '🌇 Sore & Magrib (14.45–19.00)',
  malam: '🌙 Malam (19.00–03.00)',
}

export function SuspensionWaliPage() {
  const { token = '' } = useParams()
  const [info, setInfo] = useState<WaliTokenInfo | null>(null)
  const [bootError, setBootError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // validasi token sekali di awal
  useEffect(() => {
    if (!token) return
    const timer = setTimeout(() => {
      rpcValidateToken(token)
        .then((res) => {
          setInfo(res)
          setSelectedDate(res.days[0] ?? null)
        })
        .catch((err: Error) => setBootError(err.message))
    }, 0)
    return () => clearTimeout(timer)
  }, [token])

  if (bootError) {
    return (
      <WaliShell>
        <Card style={{ maxWidth: 480, margin: '0 auto' }}>
          <Alert
            type="error"
            showIcon
            message="Tautan tidak dapat dibuka"
            description={bootError}
          />
        </Card>
      </WaliShell>
    )
  }

  if (!info) {
    return (
      <WaliShell>
        <div style={{ textAlign: 'center', padding: 64 }}>
          <Spin size="large" />
        </div>
      </WaliShell>
    )
  }

  return (
    <WaliShell>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Card>
          <div style={{ textAlign: 'center' }}>
            <SafetyCertificateOutlined style={{ fontSize: 34, color: '#1a5c35' }} />
            <Typography.Title level={4} style={{ margin: '8px 0 2px' }}>
              {info.student_name}
            </Typography.Title>
            <Typography.Text type="secondary">
              {info.class_name ?? '—'} · {info.jenjang}
            </Typography.Text>
            <div style={{ marginTop: 6 }}>
              <Tag icon={<HomeOutlined />} color="green">
                Pembinaan di Rumah: {dayjs(info.start_date).format('DD MMM')} —{' '}
                {dayjs(info.end_date).format('DD MMM YYYY')}
              </Tag>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginTop: 14 }}>
            {info.days.map((d) => (
              <Button
                key={d}
                size="small"
                type={selectedDate === d ? 'primary' : 'default'}
                onClick={() => setSelectedDate(d)}
              >
                {dayjs(d).format('DD MMM')}
              </Button>
            ))}
          </div>
        </Card>

        {selectedDate && <WaliDayPanel token={token} date={selectedDate} />}
      </Space>
    </WaliShell>
  )
}

// ------------------------------------------------------------
// Isian satu hari: checklist + tugas
// ------------------------------------------------------------
function WaliDayPanel({ token, date }: { token: string; date: string }) {
  const dayQuery = useQuery({
    queryKey: ['wali-day', token, date],
    queryFn: () => rpcGetDay(token, date),
    staleTime: 0,
  })

  if (dayQuery.isLoading) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: 32 }}>
          <Spin />
        </div>
      </Card>
    )
  }
  if (dayQuery.isError || !dayQuery.data) {
    return (
      <Card>
        <Alert type="error" showIcon message={(dayQuery.error as Error | null)?.message ?? 'Gagal memuat data hari ini'} />
      </Card>
    )
  }

  const data = dayQuery.data as WaliDayData
  const refresh = () => void dayQuery.refetch()
  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <ChecklistCard token={token} date={date} data={data} onRefresh={refresh} />
      <TasksCard token={token} data={data} onRefresh={refresh} />
    </Space>
  )
}

function ChecklistCard({
  token,
  date,
  data,
  onRefresh,
}: {
  token: string
  date: string
  data: WaliDayData
  onRefresh: () => void
}) {
  const { message } = App.useApp()
  const [entries, setEntries] = useState<WaliEntries>({})
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(data.log?.updated_at ?? null)

  const hydratedAt = data.log?.updated_at
  // isi ulang form ketika data log berubah dari server — dijalankan
  // asinkron agar tidak ada setState sinkron di dalam effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setEntries((data.log?.entries ?? {}) as WaliEntries)
      setNote(data.log?.note_optional ?? '')
      setSavedAt(hydratedAt ?? null)
    }, 0)
    return () => clearTimeout(timer)
  }, [hydratedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  const blocks = useMemo(() => {
    const order: WaliTemplateItem['block_key'][] = ['dinihari', 'pagi', 'sore', 'malam']
    return order
      .map((block) => ({ block, items: data.templates.filter((t) => t.block_key === block) }))
      .filter((g) => g.items.length > 0)
  }, [data.templates])

  const setEntry = (key: string, patch: Partial<WaliLogEntry>) =>
    setEntries((prev) => ({ ...prev, [key]: { ...(prev[key] ?? {}), ...patch } }))

  const handleSave = async () => {
    setSaving(true)
    try {
      await rpcSaveLog(token, date, entries, note)
      setSavedAt(new Date().toISOString())
      message.success('Checklist harian tersimpan')
      onRefresh()
    } catch (err) {
      message.error((err as Error).message || 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card
      title={`Checklist Harian — ${dayjs(date).format('dddd, DD MMMM YYYY')}`}
      extra={
        savedAt && (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            <CheckCircleOutlined style={{ color: '#10b981' }} /> Terakhir disimpan{' '}
            {dayjs(savedAt).format('HH:mm')}
          </Typography.Text>
        )
      }
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {blocks.map(({ block, items }) => (
          <div key={block}>
            <Typography.Text strong style={{ display: 'block', marginBottom: 6 }}>
              {BLOCK_LABEL[block]}
            </Typography.Text>
            <Space direction="vertical" size={6} style={{ width: '100%' }}>
              {items.map((item) => {
                const entry = entries[item.item_key] ?? {}
                if (item.input_type === 'check') {
                  return (
                    <div
                      key={item.id}
                      onClick={() => canInteract() && setEntry(item.item_key, { checked: !entry.checked })}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: `1px solid ${entry.checked ? '#86efac' : '#e2e8f0'}`,
                        background: entry.checked ? '#f0fdf4' : '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      <CheckCircleOutlined
                        style={{ color: entry.checked ? '#16a34a' : '#cbd5e1', fontSize: 16 }}
                      />
                      <Typography.Text style={{ fontSize: 13 }}>{item.label_id}</Typography.Text>
                    </div>
                  )
                }
                if (item.input_type === 'choice') {
                  return (
                    <div key={item.id} style={{ padding: '4px 0' }}>
                      <Typography.Text style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>
                        {item.label_id}
                      </Typography.Text>
                      <Segmented
                        value={(entry.value as string) ?? ''}
                        onChange={(v) => setEntry(item.item_key, { value: v as string })}
                        options={item.options.map((o) => ({ value: o, label: o }))}
                      />
                    </div>
                  )
                }
                if (item.input_type === 'surah') {
                  return (
                    <div key={item.id}>
                      <Typography.Text style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>
                        {item.label_id}
                      </Typography.Text>
                      <Space.Compact style={{ width: '100%' }}>
                        <Input
                          placeholder="Nama surah"
                          value={entry.surah ?? ''}
                          onChange={(e) => setEntry(item.item_key, { surah: e.target.value })}
                        />
                        <Input
                          placeholder="Ayat"
                          style={{ width: 110 }}
                          value={entry.ayat ?? ''}
                          onChange={(e) => setEntry(item.item_key, { ayat: e.target.value })}
                        />
                      </Space.Compact>
                    </div>
                  )
                }
                if (item.input_type === 'wafa') {
                  return (
                    <div key={item.id}>
                      <Typography.Text style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>
                        {item.label_id}
                      </Typography.Text>
                      <Space.Compact style={{ width: '100%' }}>
                        <Input
                          placeholder="Jilid"
                          style={{ width: 110 }}
                          value={entry.wafa_jilid ?? ''}
                          onChange={(e) => setEntry(item.item_key, { wafa_jilid: e.target.value })}
                        />
                        <Input
                          placeholder="Halaman"
                          value={entry.wafa_halaman ?? ''}
                          onChange={(e) => setEntry(item.item_key, { wafa_halaman: e.target.value })}
                        />
                      </Space.Compact>
                    </div>
                  )
                }
                // text & tugas_ref
                return (
                  <Input
                    key={item.id}
                    placeholder={item.label_id}
                    value={entry.text ?? ''}
                    onChange={(e) => setEntry(item.item_key, { text: e.target.value })}
                    maxLength={200}
                  />
                )
              })}
            </Space>
          </div>
        ))}

        <Form layout="vertical">
          <Form.Item label="Catatan tambahan (opsional)" style={{ marginBottom: 12 }}>
            <Input.TextArea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              placeholder="Catatan untuk musyrif / pembina"
            />
          </Form.Item>
          <Button type="primary" loading={saving} onClick={() => void handleSave()} block size="large">
            Simpan Checklist Hari Ini
          </Button>
        </Form>
      </Space>
    </Card>
  )
}

function canInteract(): boolean {
  return true
}

// ------------------------------------------------------------
// Tugas + kirim bukti
// ------------------------------------------------------------
function TasksCard({
  token,
  data,
  onRefresh,
}: {
  token: string
  data: WaliDayData
  onRefresh: () => void
}) {
  const { message } = App.useApp()
  const [openTask, setOpenTask] = useState<string | null>(null)
  const [photos, setPhotos] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)

  const submissions = useMemo(
    () => new Map(data.submissions.map((s) => [s.task_id, s])),
    [data.submissions],
  )

  const handlePick = async (taskId: string, file: File) => {
    try {
      const { compressImage } = await import('../../shared/utils/imageCompress')
      const compressed = await compressImage(file)
      setPhotos((prev) => (prev.length >= 6 ? prev : [...prev, compressed]))
    } catch (err) {
      message.error((err as Error).message)
    }
    void taskId
  }

  const handleSend = async (taskId: string) => {
    if (photos.length === 0 && !note.trim()) {
      message.warning('Lampirkan minimal satu foto atau tulis catatan')
      return
    }
    setSending(true)
    try {
      await rpcSubmitTask(token, taskId, photos, note)
      message.success('Bukti tugas terkirim — menunggu penilaian guru')
      setOpenTask(null)
      setPhotos([])
      setNote('')
      onRefresh()
    } catch (err) {
      message.error((err as Error).message || 'Gagal mengirim bukti')
    } finally {
      setSending(false)
    }
  }

  if (data.tasks.length === 0) {
    return (
      <Card title="Tugas dari Guru">
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada tugas khusus" />
      </Card>
    )
  }

  return (
    <Card title="Tugas dari Guru">
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {data.tasks.map((task) => {
          const sub = submissions.get(task.id)
          const isOpen = openTask === task.id
          return (
            <Card key={task.id} size="small" type="inner" title={`${task.subject} — ${task.title}`}>
              {task.description && (
                <Typography.Paragraph type="secondary" style={{ fontSize: 12.5 }}>
                  {task.description}
                </Typography.Paragraph>
              )}
              {task.due_date && (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Tenggat: {dayjs(task.due_date).format('DD MMM YYYY')}
                </Typography.Text>
              )}

              {sub && (
                <div style={{ margin: '8px 0' }}>
                  {sub.status === 'dinilai' ? (
                    <Tag color="green">Dinilai: {sub.score}/100</Tag>
                  ) : (
                    <Tag color="orange">Menunggu penilaian ({sub.photo_count} foto)</Tag>
                  )}
                  {sub.teacher_comment && (
                    <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 6 }}>
                      Komentar guru: {sub.teacher_comment}
                    </Typography.Paragraph>
                  )}
                </div>
              )}

              {isOpen && (
                <Space direction="vertical" size="small" style={{ width: '100%', marginTop: 8 }}>
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 12px',
                      border: '1px dashed #94a3b8',
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontSize: 12.5,
                    }}
                  >
                    <PaperClipOutlined />
                    Pilih foto bukti (maks 6, otomatis dikompres)
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? [])
                        void (async () => {
                          for (const f of files) {
                            if (photos.length >= 6) break
                            await handlePick(task.id, f)
                          }
                        })()
                      }}
                    />
                  </label>
                  {photos.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {photos.map((p, i) => (
                        <img
                          key={i}
                          src={p}
                          alt={`Foto ${i + 1}`}
                          style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8 }}
                        />
                      ))}
                    </div>
                  )}
                  <Input.TextArea
                    rows={2}
                    placeholder="Catatan (opsional)"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={300}
                  />
                  <Button
                    type="primary"
                    loading={sending}
                    onClick={() => void handleSend(task.id)}
                    disabled={photos.length === 0 && !note.trim()}
                  >
                    Kirim Bukti
                  </Button>
                </Space>
              )}

              <div style={{ marginTop: 8 }}>
                <Button size="small" type="dashed" onClick={() => setOpenTask(isOpen ? null : task.id)}>
                  {isOpen ? 'Tutup' : sub ? 'Tambah / Perbarui Bukti' : 'Kirim Bukti'}
                </Button>
              </div>
            </Card>
          )
        })}
      </Space>
    </Card>
  )
}

function WaliShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(160deg, #f0fdf4 0%, #f8fafc 45%, #f8fafc 100%)',
        padding: '24px 16px',
      }}
    >
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <img src="/favicon.svg" alt="Logo" width={44} height={44} style={{ marginBottom: 6 }} />
          <Typography.Title level={4} style={{ margin: 0 }}>
            Pembinaan di Rumah
          </Typography.Title>
          <Typography.Text type="secondary">Portal Wali Santri — Laporanmu</Typography.Text>
        </div>
        {children}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Halaman khusus wali — jangan bagikan tautan ini ke orang lain
          </Typography.Text>
        </div>
      </div>
    </div>
  )
}
