import { Button, Slider, Switch, Typography, theme } from 'antd'
import { SlidersOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { ModalFooter } from '../../../shared/components/ModalFooter'
import { SectionDivider } from '../../../shared/components/SectionDivider'
import { DEFAULT_LAYOUT_CONFIG, type LayoutConfig } from './layout'

interface LayoutSettingsProps {
  open: boolean
  onClose: () => void
  value: LayoutConfig
  onChange: (value: LayoutConfig) => void
}

const FONT_FIELDS: { key: keyof LayoutConfig; label: string }[] = [
  { key: 'arMainFontSize', label: 'Nama mapel Arab' },
  { key: 'arSecFontSize', label: 'Label fisik, hafalan, absensi' },
  { key: 'arValueFontSize', label: 'Angka tabel sekunder' },
  { key: 'arScaleFontSize', label: 'Label skala nilai' },
]

const WIDTH_FIELDS: { key: keyof LayoutConfig; label: string }[] = [
  { key: 'numColWidth', label: 'Kolom nomor' },
  { key: 'scoreColWidth', label: 'Kolom nilai' },
  { key: 'gradeColWidth', label: 'Kolom predikat' },
  { key: 'subjectArWidth', label: 'Kolom mapel Arab' },
  { key: 'subjectIdWidth', label: 'Kolom mapel Indonesia' },
]

export function LayoutSettings({ open, onClose, value, onChange }: LayoutSettingsProps) {
  const { token } = theme.useToken()

  const set = (key: keyof LayoutConfig, next: number | boolean) =>
    onChange({ ...value, [key]: next })

  const isModified = (Object.keys(DEFAULT_LAYOUT_CONFIG) as (keyof LayoutConfig)[]).some(
    (key) => value[key] !== DEFAULT_LAYOUT_CONFIG[key],
  )

  const sliderRow = (field: { key: keyof LayoutConfig; label: string }, unit: string, min: number, max: number) => (
    <div key={field.key} style={{ padding: '6px 0' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <Typography.Text style={{ fontSize: 12.5, color: token.colorTextSecondary }}>
          {field.label}
        </Typography.Text>
        <Typography.Text
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            color: token.colorText,
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
          }}
        >
          {value[field.key]}
          {unit}
        </Typography.Text>
      </div>
      <Slider
        min={min}
        max={max}
        step={0.5}
        value={Number(value[field.key])}
        onChange={(next) => set(field.key, next)}
        style={{ margin: '2px 0 0' }}
        tooltip={{ formatter: (next) => `${next}${unit}` }}
      />
    </div>
  )

  return (
    <AppModal
      open={open}
      onCancel={onClose}
      icon={<SlidersOutlined />}
      title="Kustomisasi Tata Letak Rapor"
      subtitle="Perubahan langsung terlihat di preview dan tersimpan di browser ini"
      size="lg"
      footer={
        <ModalFooter
          left={
            <Button
              onClick={() => onChange({ ...DEFAULT_LAYOUT_CONFIG })}
              disabled={!isModified}
            >
              Reset default
            </Button>
          }
          onOk={onClose}
          okText="Selesai"
        />
      }
    >
      <SectionDivider>Ukuran font Arab</SectionDivider>
      <div style={{ marginBottom: 18 }}>
        {FONT_FIELDS.map((field) => sliderRow(field, 'pt', 9, 22))}
      </div>

      <SectionDivider>Lebar kolom tabel</SectionDivider>
      <div style={{ marginBottom: 18 }}>
        {WIDTH_FIELDS.map((field) => sliderRow(field, '%', 4, 55))}
      </div>

      <SectionDivider>Tampilan tabel</SectionDivider>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          paddingBottom: 4,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <Typography.Text strong style={{ fontSize: 12.5 }}>
            Baris hafalan
          </Typography.Text>
          <Typography.Paragraph
            type="secondary"
            style={{ fontSize: 12, margin: '2px 0 0', lineHeight: 1.5 }}
          >
            Tampilkan baris total hafalan di tabel perkembangan hafalan.
          </Typography.Paragraph>
        </div>
        <Switch
          checked={value.showCapaianHafalan}
          onChange={(checked) => set('showCapaianHafalan', checked)}
          aria-label="Tampilkan baris total hafalan"
        />
      </div>
    </AppModal>
  )
}
