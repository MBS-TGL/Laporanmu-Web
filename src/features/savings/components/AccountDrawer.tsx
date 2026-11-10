import { Avatar, Button, Drawer, Empty, List, Space, Tag, Typography, theme } from 'antd'
import { FallOutlined, RiseOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { formatRupiah } from '../api'
import { useSavingsTxns } from '../hooks'
import type { SavingsAccount, SavingsTxn } from '../types'

interface AccountDrawerProps {
  open: boolean
  account: SavingsAccount | null
  onClose: () => void
  onDeposit: (account: SavingsAccount) => void
  onWithdraw: (account: SavingsAccount) => void
}

export function AccountDrawer({ open, account, onClose, onDeposit, onWithdraw }: AccountDrawerProps) {
  const { token } = theme.useToken()
  const txnsQuery = useSavingsTxns(open ? account?.id : undefined)
  const txns = txnsQuery.data ?? []

  return (
    <Drawer
      title="Buku Tabungan"
      open={open}
      onClose={onClose}
      width={460}
      destroyOnHidden
    >
      {account && (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: 14,
              borderRadius: 14,
              background: `linear-gradient(135deg, ${token.colorPrimaryBg}, ${token.colorBgContainer})`,
              marginBottom: 16,
            }}
          >
            <Avatar size={44} style={{ background: token.colorPrimary, fontWeight: 700, flexShrink: 0 }}>
              {(account.students?.name ?? '?').charAt(0).toUpperCase()}
            </Avatar>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{account.students?.name}</div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {account.students?.registration_code}
                {account.students?.classes?.name ? ` · ${account.students.classes.name}` : ''}
              </Typography.Text>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: token.colorTextTertiary }}>Saldo</div>
              <div style={{ fontWeight: 800, fontSize: 17, color: token.colorSuccess }}>
                {formatRupiah(account.balance)}
              </div>
            </div>
          </div>

          <Space style={{ marginBottom: 16 }} wrap>
            <Button
              type="primary"
              icon={<RiseOutlined />}
              disabled={account.status === 'closed'}
              onClick={() => onDeposit(account)}
            >
              Setor
            </Button>
            <Button
              icon={<FallOutlined />}
              disabled={account.status === 'closed' || account.balance <= 0}
              onClick={() => onWithdraw(account)}
            >
              Tarik
            </Button>
            {account.status === 'closed' && <Tag color="default">Rekening ditutup</Tag>}
          </Space>

          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Riwayat transaksi (terbaru dulu)
          </Typography.Text>
          <List
            style={{ marginTop: 6 }}
            loading={txnsQuery.isPending}
            dataSource={txns}
            locale={{
              emptyText: (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada transaksi" />
              ),
            }}
            renderItem={(t: SavingsTxn) => {
              const isDeposit = t.kind === 'deposit'
              return (
                <List.Item>
                  <List.Item.Meta
                    avatar={
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 10,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: isDeposit ? token.colorSuccessBg : token.colorErrorBg,
                          color: isDeposit ? token.colorSuccess : token.colorError,
                          flexShrink: 0,
                        }}
                      >
                        {isDeposit ? <RiseOutlined /> : <FallOutlined />}
                      </div>
                    }
                    title={
                      <span style={{ fontWeight: 600, color: isDeposit ? token.colorSuccess : token.colorError }}>
                        {isDeposit ? '+' : '−'}
                        {formatRupiah(t.amount)}
                      </span>
                    }
                    description={
                      <span style={{ fontSize: 12, color: token.colorTextTertiary }}>
                        {dayjs(t.occurred_at).format('DD MMM YYYY')} · Saldo{' '}
                        {formatRupiah(t.balance_after)}
                        {t.note ? ` · ${t.note}` : ''}
                        {t.profiles?.name ? ` · oleh ${t.profiles.name}` : ''}
                      </span>
                    }
                  />
                </List.Item>
              )
            }}
          />
        </>
      )}
    </Drawer>
  )
}
