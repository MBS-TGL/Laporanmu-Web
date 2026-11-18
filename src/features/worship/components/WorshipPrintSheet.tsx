import { Button } from 'antd'
import { PrinterOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { AppModal } from '../../../shared/components/AppModal'
import { WORSHIP_CATEGORY_LABEL, type WorshipCategory, type WorshipItem } from '../types'

interface WorshipPrintSheetProps {
  open: boolean
  onClose: () => void
  category: WorshipCategory
  className: string
  items: Array<Pick<WorshipItem, 'id' | 'label'>>
  students: Array<{ id: string; name: string }>
  mastery: Array<{ student_id: string; item_id: string; mastered: boolean }>
}

/**
 * Modal Cetak Lembar Pantau / Sertifikat Kemahiran Ibadah Kelas.
 * Format hitam-putih formal siap cetak dokumen sekolah.
 */
export function WorshipPrintSheet({
  open,
  onClose,
  category,
  className,
  items,
  students,
  mastery,
}: WorshipPrintSheetProps) {
  const serverMap = new Map<string, boolean>()
  mastery.forEach((m) => {
    serverMap.set(`${m.student_id}:${m.item_id}`, m.mastered)
  })

  return (
    <AppModal
      title="Cetak Lembar Pantau Ibadah"
      subtitle={`Matriks penilaian resmi ${WORSHIP_CATEGORY_LABEL[category]} kelas ${className}`}
      icon={<PrinterOutlined />}
      open={open}
      onCancel={onClose}
      width={900}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose}>Tutup</Button>
          <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>
            Cetak Dokumen
          </Button>
        </div>
      }
    >
      <div className="docs-print-area" style={{ background: '#fff', color: '#000', padding: '10px 0' }}>
        <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: 8, marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 800, textTransform: 'uppercase' }}>
            LEMBAR KENDALI KEMAHIRAN IBADAH SANTRI
          </div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            KATEGORI: {WORSHIP_CATEGORY_LABEL[category].toUpperCase()} · KELAS: {className || '–'}
          </div>
          <div style={{ fontSize: 11, color: '#444' }}>
            Tanggal Cetak: {dayjs().format('DD MMMM YYYY')}
          </div>
        </div>

        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 11,
            color: '#000',
          }}
          border={1}
        >
          <thead>
            <tr style={{ background: '#f1f5f9' }}>
              <th style={{ padding: '6px 8px', width: 35, textAlign: 'center' }}>No</th>
              <th style={{ padding: '6px 8px', textAlign: 'left', minWidth: 160 }}>Nama Santri</th>
              {items.map((item) => (
                <th key={item.id} style={{ padding: '6px 4px', textAlign: 'center', width: 85, fontSize: 10 }}>
                  <div>{item.label}</div>
                </th>
              ))}
              <th style={{ padding: '6px 8px', textAlign: 'center', width: 65 }}>Capaian</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student, idx) => {
              let count = 0
              return (
                <tr key={student.id}>
                  <td style={{ padding: '5px 8px', textAlign: 'center' }}>{idx + 1}</td>
                  <td style={{ padding: '5px 8px', fontWeight: 600 }}>{student.name}</td>
                  {items.map((item) => {
                    const isMastered = serverMap.get(`${student.id}:${item.id}`) ?? false
                    if (isMastered) count += 1
                    return (
                      <td key={item.id} style={{ padding: '5px 4px', textAlign: 'center', fontSize: 12 }}>
                        {isMastered ? '✓' : '–'}
                      </td>
                    )
                  })}
                  <td style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 700 }}>
                    {count}/{items.length}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Tanda Tangan */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32, padding: '0 24px', fontSize: 12 }}>
          <div style={{ textAlign: 'center' }}>
            <div>Mengetahui,</div>
            <div style={{ fontWeight: 600 }}>Kepala Asrama / Pondok</div>
            <div style={{ height: 48 }} />
            <div>( _____________________ )</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div>Penguji / Musyrif Pembina,</div>
            <div style={{ height: 48 + 18 }} />
            <div>( _____________________ )</div>
          </div>
        </div>
      </div>
    </AppModal>
  )
}
