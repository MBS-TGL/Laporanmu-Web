import { Input, InputNumber, Space } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { WORSHIP_CATEGORY_LABEL, type WorshipCategory, type WorshipFormValues } from '../types'

interface WorshipItemModalProps {
  open: boolean
  onClose: () => void
  category: WorshipCategory
  values: WorshipFormValues
  setValues: React.Dispatch<React.SetStateAction<WorshipFormValues>>
  loading: boolean
  onSubmit: () => void
}

/**
 * Modal tambah butir pembinaan ibadah baru (per kategori aktif).
 */
export function WorshipItemModal({
  open,
  onClose,
  category,
  values,
  setValues,
  loading,
  onSubmit,
}: WorshipItemModalProps) {
  return (
    <AppModal
      title={`Tambah Butir ${WORSHIP_CATEGORY_LABEL[category]}`}
      subtitle="Butir standar atau materi khusus pembinaan asrama sekolah."
      icon={<PlusOutlined />}
      open={open}
      onCancel={onClose}
      size="sm"
      destroyOnHidden
      onOk={onSubmit}
      okText="Tambah Butir"
      okButtonProps={{ loading }}
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
            Nama Butir
          </div>
          <Input
            placeholder="Misal: Sholat Subuh berjamaah tepat waktu"
            value={values.label}
            maxLength={80}
            onChange={(e) => setValues((v) => ({ ...v, label: e.target.value }))}
            onPressEnter={onSubmit}
            autoFocus
          />
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
            Urutan Tampil
          </div>
          <InputNumber
            min={0}
            max={9999}
            value={values.sort_order}
            onChange={(v) => setValues((prev) => ({ ...prev, sort_order: Number(v ?? 0) }))}
            style={{ width: '100%' }}
          />
        </div>
      </Space>
    </AppModal>
  )
}
