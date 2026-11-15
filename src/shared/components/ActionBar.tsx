import { Fragment, type ReactNode } from 'react'
import { Button, Popconfirm, Tag, theme, Tooltip } from 'antd'
import { AnimatePresence, motion } from 'motion/react'
import { CloseOutlined } from '@ant-design/icons'
import { bulkBarTransition, bulkBarVariants } from '../motion'

export interface BulkActionItem {
  key: string
  label: string
  icon?: ReactNode
  /** 'danger' untuk aksi destruktif (arsip/hapus permanen); default netral */
  variant?: 'default' | 'danger'
  tooltip?: string
  /** Jika diisi, tombol dibungkus Popconfirm dengan cancelText "Batal" */
  confirm?: {
    title: ReactNode
    description?: ReactNode
    okText?: string
  }
  onClick: () => void
  /** Hanya di tombol pemicu — jangan dobel dengan okButtonProps */
  loading?: boolean
  /** Pengganti render kondisional {canWrite && ...} */
  hidden?: boolean
}

interface ActionBarProps {
  count: number
  onClear: () => void
  actions: BulkActionItem[]
}

/**
 * Bar aksi massal melayang di bawah layar — template dari StudentsPage,
 * dipakai halaman list lain yang punya row selection.
 * API data-driven: ukuran (small), varian (default/danger), Popconfirm,
 * dan posisi loading dikunci di sini agar seragam di semua halaman.
 * Entrance/exit via AnimatePresence; x: '-50%' menggantikan transform inline
 * agar posisi terpusat tetap dipegang motion (bukan style statis).
 */
export function ActionBar({ count, onClear, actions }: ActionBarProps) {
  const { token } = theme.useToken()
  const items = actions.filter((a) => !a.hidden)

  return (
    <AnimatePresence initial={false}>
      {count > 0 && items.length > 0 && (
        <motion.div
          key="bulk-bar"
          className="bulk-bar"
          variants={bulkBarVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={bulkBarTransition}
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 12px',
            borderRadius: 14,
            background: token.colorBgContainer,
            border: `1px solid ${token.colorBorderSecondary}`,
            boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
          }}
        >
          <Tag color="processing" style={{ borderRadius: 999, fontWeight: 700, marginInlineEnd: 2 }}>
            {count}
          </Tag>
          <span style={{ color: token.colorTextSecondary, fontSize: 13 }}>Dipilih</span>
          {items.map((action) => {
            const button = (
              <Button
                size="small"
                danger={action.variant === 'danger'}
                icon={action.icon}
                loading={action.loading}
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            )
            const wrapped = action.tooltip ? (
              <Tooltip title={action.tooltip} key={action.key}>
                {button}
              </Tooltip>
            ) : (
              button
            )
            if (!action.confirm) return <Fragment key={action.key}>{wrapped}</Fragment>
            return (
              <Popconfirm
                key={action.key}
                title={action.confirm.title}
                description={action.confirm.description}
                okText={action.confirm.okText}
                cancelText="Batal"
                onConfirm={action.onClick}
              >
                {wrapped}
              </Popconfirm>
            )
          })}
          <Button
            size="small"
            type="text"
            style={{ color: token.colorTextQuaternary }}
            icon={<CloseOutlined />}
            onClick={onClear}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
