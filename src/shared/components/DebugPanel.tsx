import { useState } from 'react'
import { App, Button, Drawer, Popconfirm, Space, Table, Tag, Tooltip, Typography, theme } from 'antd'
import { ClearOutlined, ExperimentOutlined, ReloadOutlined } from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { useFlag } from '../hooks/useFeatureFlags'

interface DebugQueryRow {
  key: string
  status: string
  fetching: boolean
  updatedAt: number
  count: number
}

// Panel diagnosis developer — konsumen tunggal flag `system.debug_mode`.
// Muncul sebagai tombol melayang saat flag aktif; memuat daftar isi cache
// react-query (query key, status, umur data) untuk melacak invalidasi.
export function DebugPanel() {
  const debug = useFlag('system.debug_mode', false)
  const qc = useQueryClient()
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const [open, setOpen] = useState(false)
  const [tick, setTick] = useState(0)

  if (!debug) return null

  const queries: DebugQueryRow[] = qc
    .getQueryCache()
    .getAll()
    .map((q) => ({
      key: JSON.stringify(q.queryKey),
      status: q.state.status,
      fetching: q.state.fetchStatus === 'fetching',
      updatedAt: q.state.dataUpdatedAt,
      count: q.state.dataUpdateCount,
    }))

  const columns = [
    {
      title: 'Query Key',
      dataIndex: 'key',
      render: (v: string) => (
        <Typography.Text code style={{ fontSize: 11 }} ellipsis>
          {v}
        </Typography.Text>
      ),
    },
    {
      title: 'Status',
      width: 90,
      render: (_v: unknown, row: DebugQueryRow) =>
        row.fetching ? <Tag color="processing">fetching</Tag> : <Tag>{row.status}</Tag>,
    },
    {
      title: 'Umur Data',
      width: 110,
      render: (_v: unknown, row: DebugQueryRow) =>
        row.updatedAt ? dayjs(row.updatedAt).format('HH:mm:ss') : 'belum ada',
    },
  ]

  return (
    <>
      <Tooltip title="Panel Debug Developer" placement="left">
        <Button
          type="primary"
          shape="circle"
          icon={<ExperimentOutlined />}
          aria-label="Buka panel debug developer"
          onClick={() => setOpen(true)}
          style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 1000, boxShadow: token.boxShadowSecondary }}
        />
      </Tooltip>

      <Drawer
        title="Panel Debug Developer"
        width={520}
        open={open}
        onClose={() => setOpen(false)}
        extra={
          <Space>
            <Tooltip title="Segarkan daftar">
              <Button size="small" icon={<ReloadOutlined />} onClick={() => setTick((t) => t + 1)} />
            </Tooltip>
            <Popconfirm
              title="Buang semua cache query?"
              okText="Ya, buang"
              cancelText="Batal"
              onConfirm={() => {
                qc.invalidateQueries()
                message.success('Semua cache query dibuang')
                setTick((t) => t + 1)
              }}
            >
              <Button size="small" danger icon={<ClearOutlined />}>
                Buang Cache
              </Button>
            </Popconfirm>
          </Space>
        }
      >
        <Typography.Paragraph type="secondary" style={{ fontSize: 12.5 }}>
          Isi cache react-query saat ini ({queries.length} query). Aktifkan/matikan lewat flag{' '}
          <Typography.Text code>system.debug_mode</Typography.Text> di tab Pengaturan Developer.
        </Typography.Paragraph>
        {/* key={tick} agar daftar dibaca ulang dari cache saat tombol segarkan ditekan */}
        <Table
          key={tick}
          size="small"
          rowKey="key"
          dataSource={queries}
          columns={columns}
          pagination={false}
          scroll={{ y: 480 }}
        />
      </Drawer>
    </>
  )
}
