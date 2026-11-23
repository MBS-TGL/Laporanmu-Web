import { useMemo, useState } from 'react'
import { App, DatePicker, Form, Select } from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import { AppModal } from '../../../shared/components/AppModal'
import { useAcademicYearsBrief, useClasses } from '../../classes/hooks'
import { useGenerateSppObligations, useSppComponents } from '../hooks'
import { monthRange } from '../sppUtil'
import type { SppComponent } from '../types'

interface GenerateObligationsModalProps {
  open: boolean
  onClose: () => void
  /** Komponen yang dipilih dari tabel (bisa sudah terisi). */
  component?: SppComponent | null
}

/**
 * Generate kewajiban massal dari satu komponen: pilih kelas target
 * (atau semua kelas se-tingkat sesuai komponen), rentang bulan untuk
 * frekuensi bulanan, dan jatuh tempo. Duplikat otomatis dilewati.
 */
export function GenerateObligationsModal({ open, onClose, component }: GenerateObligationsModalProps) {
  const { message } = App.useApp()
  const yearsQuery = useAcademicYearsBrief()
  const activeYear = yearsQuery.data?.find((y) => y.is_active) ?? yearsQuery.data?.[0]
  const classesQuery = useClasses({ page: 1, pageSize: 200, academicYearId: activeYear?.id })
  const componentsQuery = useSppComponents(activeYear?.id)
  const generate = useGenerateSppObligations()

  const [componentId, setComponentId] = useState<string | undefined>(component?.id)
  const [classId, setClassId] = useState<string | undefined>(undefined)
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null)
  /** Jatuh tempo; portal santri & wali menampilkannya, jadi harus bisa diisi. */
  const [dueDate, setDueDate] = useState<Dayjs | null>(dayjs().date(10))

  const selected = useMemo(
    () => componentsQuery.data?.find((c) => c.id === (componentId ?? component?.id)) ?? null,
    [componentsQuery.data, componentId, component],
  )

  const periods = useMemo(() => {
    if (!selected || selected.frequency !== 'bulanan') return ['']
    if (!range) return []
    return monthRange(range[0].format('YYYY-MM'), range[1].format('YYYY-MM'))
  }, [selected, range])

  const classOptions = useMemo(
    () => (classesQuery.data?.data ?? []).map((c) => ({ value: c.id, label: c.name })),
    [classesQuery.data],
  )

  const handleOk = async () => {
    if (!selected || !activeYear) {
      message.warning('Pilih komponen terlebih dahulu')
      return
    }
    if (selected.frequency === 'bulanan' && periods.length === 0) {
      message.warning('Pilih rentang bulan terlebih dahulu')
      return
    }
    try {
      const created = await generate.mutateAsync({
        componentId: selected.id,
        academicYearId: activeYear.id,
        amount: selected.amount,
        grade: selected.grade,
        classId,
        periods,
        dueDate: dueDate ? dueDate.format('YYYY-MM-DD') : null,
      })
      message.success(`${created} kewajiban dibuat (duplikat dilewati)`)
      onClose()
    } catch (err) {
      message.error((err as Error).message)
    }
  }

  return (
    <AppModal
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      okText="Buat Kewajiban"
      okButtonProps={{ loading: generate.isPending }}
      title="Buat Kewajiban Massal"
      subtitle="Kewajiban dibuat untuk setiap santri aktif pada kelas target"
      width={520}
      destroyOnHidden
      maskClosable={false}
    >
      <Form layout="vertical" requiredMark={false}>
        <Form.Item label="Komponen biaya" required>
          <Select
            showSearch
            placeholder="Pilih komponen"
            value={selected?.id}
            loading={componentsQuery.isPending}
            onChange={(v) => setComponentId(v)}
            options={(componentsQuery.data ?? []).map((c) => ({
              value: c.id,
              label: `${c.name} · ${new Intl.NumberFormat('id-ID').format(c.amount)}`,
            }))}
            filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
          />
        </Form.Item>

        {selected?.frequency === 'bulanan' && (
          <Form.Item label="Rentang bulan" required extra={`${periods.length} periode akan dibuat per santri`}>
            <DatePicker.RangePicker
              picker="month"
              style={{ width: '100%' }}
              value={range}
              onChange={(v) => setRange(v as [Dayjs, Dayjs] | null)}
            />
          </Form.Item>
        )}

        <Form.Item
          label="Jatuh tempo"
          extra="Tampil di portal santri dan portal wali. Kosongkan bila tidak ada tenggat."
        >
          <DatePicker
            style={{ width: '100%' }}
            format="DD MMM YYYY"
            value={dueDate}
            onChange={(d) => setDueDate(d)}
            allowClear
          />
        </Form.Item>

        <Form.Item
          label="Kelas target"
          extra={selected?.grade ? `Komponen menyasar tingkat ${selected.grade} — semua kelas se-tingkat bila dibiarkan kosong` : 'Kosong = semua kelas (semua santri aktif)'}
        >
          <Select
            showSearch
            allowClear
            placeholder="Semua kelas"
            value={classId}
            loading={classesQuery.isPending}
            onChange={setClassId}
            options={classOptions}
            filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
          />
        </Form.Item>
      </Form>
    </AppModal>
  )
}
