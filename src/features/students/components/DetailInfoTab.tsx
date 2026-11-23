import type { ReactNode } from 'react'
import { Button, Divider, Empty, Tag, Tooltip, Typography } from 'antd'
import dayjs from 'dayjs'
import { IdcardOutlined, WhatsAppOutlined } from '@ant-design/icons'
import { GENDER_LABEL } from '../status'
import type { GuardianRelation, Student, StudentGuardian } from '../types'

const MASK = '••••••'

const GUARDIAN_RELATION_LABEL: Record<GuardianRelation, string> = {
  father: 'Ayah',
  mother: 'Ibu',
  guardian: 'Wali',
}

/** Judul section memakai Divider bawaan AntD (orientasi kiri) */
function SectionTitle({ children, extra }: { children: ReactNode; extra?: ReactNode }) {
  return (
    <Divider titlePlacement="left" orientationMargin={0} style={{ margin: '24px 0 14px', borderColor: '#eef2f7' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14.5, fontWeight: 700, color: '#0f172a' }}>{children}</span>
        {extra}
      </span>
    </Divider>
  )
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14.5, fontWeight: 500, color: '#0f172a' }}>{children}</div>
    </div>
  )
}

interface DetailInfoTabProps {
  student: Student
  isPrivacyMode: boolean
  gridCols: string
  canEditData: boolean
  goEdit: () => void
  openWa: () => void
  saveVcf: () => void
  guardians: StudentGuardian[]
  guardiansSuccess: boolean
  tags: string[]
}

export function DetailInfoTab({ student, isPrivacyMode, gridCols, canEditData, goEdit, openWa, saveVcf, guardians, guardiansSuccess, tags }: DetailInfoTabProps) {
  const mask = (value: string | null) => (isPrivacyMode && value ? MASK : (value ?? '-'))
  const copyable = (value: string | null) =>
    value && !isPrivacyMode ? { text: value, tooltips: ['Salin', 'Tersalin'] as [string, string] } : false

  const ttl = [student.birth_place, student.birth_date ? dayjs(student.birth_date).format('DD MMM YYYY') : null]
    .filter(Boolean)
    .join(', ')

  return (
    <div>
      <SectionTitle>Profil Pribadi</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: '16px 24px' }}>
        <InfoRow label="NISN">
          <Typography.Text copyable={copyable(student.nisn)} style={{ fontSize: 14.5 }}>
            {mask(student.nisn)}
          </Typography.Text>
        </InfoRow>
        <InfoRow label="NIS">
          <Typography.Text copyable={copyable(student.nis)} style={{ fontSize: 14.5 }}>
            {mask(student.nis)}
          </Typography.Text>
        </InfoRow>
        <InfoRow label="NIK">
          <Typography.Text copyable={copyable(student.nik)} style={{ fontSize: 14.5 }}>
            {mask(student.nik)}
          </Typography.Text>
        </InfoRow>
        <InfoRow label="Jenis Kelamin">{student.gender ? GENDER_LABEL[student.gender] : '-'}</InfoRow>
        <InfoRow label="Agama">{mask(student.religion)}</InfoRow>
        <InfoRow label="Tempat, Tanggal Lahir">{mask(ttl)}</InfoRow>
        {student.nickname && <InfoRow label="Nama Panggilan">{mask(student.nickname)}</InfoRow>}
        {student.status === 'graduated' && (
          <InfoRow label="Tahun Lulus">
            {student.graduation_year ?? '-'}
            {student.last_class?.name ? ` · ${student.last_class.name}` : ''}
          </InfoRow>
        )}
        {student.promoted_at && (
          <InfoRow label="Riwayat Kenaikan">
            Dipromosikan {dayjs(student.promoted_at).format('DD MMM YYYY')}
          </InfoRow>
        )}
      </div>

      <SectionTitle
        extra={
          <span style={{ display: 'inline-flex', gap: 6 }}>
            <Tooltip
              title={isPrivacyMode ? 'Mode privasi aktif' : student.phone ? 'Kirim laporan via WhatsApp' : 'Nomor HP belum tersedia'}
            >
              <span>
                <Button
                  icon={<WhatsAppOutlined />}
                  disabled={!student.phone || isPrivacyMode}
                  onClick={openWa}
                  style={
                    student.phone && !isPrivacyMode
                      ? { color: '#059669', borderColor: '#a7f3d0' }
                      : undefined
                  }
                >
                  Kirim WA
                </Button>
              </span>
            </Tooltip>
            <Button icon={<IdcardOutlined />} onClick={saveVcf}>
              Simpan Kontak VCF
            </Button>
          </span>
        }
      >
        Wali &amp; Kontak
      </SectionTitle>
      {student.guardian_name || student.phone ? (
        <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: '16px 24px' }}>
          <InfoRow label="Nama Wali">{mask(student.guardian_name)}</InfoRow>
          <InfoRow label="Hubungan">{student.guardian_relation ?? '-'}</InfoRow>
          <InfoRow label="No. HP / WhatsApp">
            <Typography.Text copyable={copyable(student.phone)} style={{ fontSize: 14.5 }}>
              {mask(student.phone)}
            </Typography.Text>
          </InfoRow>
        </div>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ fontSize: 13.5 }}>Data wali belum tersedia</span>}>
          {canEditData && (
            <Button type="primary" onClick={goEdit}>
              Lengkapi Data
            </Button>
          )}
        </Empty>
      )}

      {guardiansSuccess && guardians.length > 0 && (
        <>
          <SectionTitle>Orang Tua</SectionTitle>
          <div style={{ display: 'grid', gap: 10 }}>
            {guardians.map((g) => (
              <div
                key={g.id}
                style={{
                  padding: '10px 14px',
                  borderRadius: 12,
                  background: '#f8fafc',
                  border: '1px solid #eef2f7',
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: '#64748b',
                    marginBottom: 8,
                  }}
                >
                  {GUARDIAN_RELATION_LABEL[g.relation]}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: '10px 24px' }}>
                  <InfoRow label="Nama">{mask(g.name)}</InfoRow>
                  <InfoRow label="No. HP">
                    <Typography.Text copyable={copyable(g.phone)} style={{ fontSize: 14.5 }}>
                      {mask(g.phone)}
                    </Typography.Text>
                  </InfoRow>
                  <InfoRow label="Pendidikan">{g.education ?? '-'}</InfoRow>
                  <InfoRow label="Pekerjaan">{g.occupation ?? '-'}</InfoRow>
                  <InfoRow label="Penghasilan / bulan">{g.income_range ?? '-'}</InfoRow>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <SectionTitle>Alamat &amp; Domisili</SectionTitle>
      {student.address || student.dorms?.name ? (
        <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: '16px 24px' }}>
          <InfoRow label="Alamat">{mask(student.address)}</InfoRow>
          <InfoRow label="Asrama">{student.dorms?.name ?? 'Tanpa asrama'}</InfoRow>
        </div>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ fontSize: 13.5 }}>Data alamat belum tersedia</span>}>
          {canEditData && (
            <Button type="primary" onClick={goEdit}>
              Lengkapi Data
            </Button>
          )}
        </Empty>
      )}

      {(student.kk_number ||
        student.child_status ||
        student.child_number != null ||
        student.siblings_count != null ||
        student.home_phone ||
        student.origin_school ||
        student.origin_graduation_year != null ||
        student.admitted_at ||
        student.uniform_size) && (
        <>
          <SectionTitle>Data Lainnya</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: '16px 24px' }}>
            <InfoRow label="No. KK">
              <Typography.Text copyable={copyable(student.kk_number)} style={{ fontSize: 14.5 }}>
                {mask(student.kk_number)}
              </Typography.Text>
            </InfoRow>
            <InfoRow label="Status Anak">{student.child_status ?? '-'}</InfoRow>
            <InfoRow label="Anak Ke">{student.child_number ?? '-'}</InfoRow>
            <InfoRow label="Jumlah Saudara">{student.siblings_count ?? '-'}</InfoRow>
            <InfoRow label="Telepon Rumah">{mask(student.home_phone)}</InfoRow>
            <InfoRow label="Ukuran Seragam">{student.uniform_size ?? '-'}</InfoRow>
            <InfoRow label="Sekolah Asal">{student.origin_school ?? '-'}</InfoRow>
            <InfoRow label="Tahun Lulus Sekolah Asal">
              {student.origin_graduation_year ?? '-'}
            </InfoRow>
            <InfoRow label="Tanggal Diterima">
              {student.admitted_at ? dayjs(student.admitted_at).format('DD MMMM YYYY') : '-'}
            </InfoRow>
          </div>
        </>
      )}

      {tags.length > 0 && (
        <>
          <SectionTitle>Info Khusus</SectionTitle>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {tags.map((t) => (
              <Tag key={t} style={{ borderRadius: 8, padding: '2px 10px' }}>
                {t}
              </Tag>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
