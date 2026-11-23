import type { ChangeEvent, RefObject, ReactNode } from 'react'
import { Progress, Tag, Tooltip, Typography } from 'antd'
import { BookOutlined, CameraOutlined, CheckOutlined, HomeOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { StatusTag } from '../../../shared/components/StatusTag'
import { STUDENT_STATUS_META } from '../status'
import type { Student } from '../types'

const MASK = '••••••'

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('')
}

function StatPill({ icon, label, value, color }: { icon: ReactNode; label: string; value: ReactNode; color: string }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        borderRadius: 13,
        background: '#f8fafc',
        border: '1px solid #eef2f7',
      }}
    >
      <span
        style={{
          width: 36,
          height: 36,
          borderRadius: 11,
          background: `${color}14`,
          color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {value}
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>{label}</div>
      </div>
    </div>
  )
}

interface DetailHeaderProps {
  student: Student
  studentPhoto: string | null | undefined
  isPrivacyMode: boolean
  tags: string[]
  points: number
  canWrite: boolean
  missingFields: string[]
  completeness: number
  photoInputRef: RefObject<HTMLInputElement | null>
  onPhotoUpload: (e: ChangeEvent<HTMLInputElement>) => void
}

// ── Header low: identitas + ring kelengkapan + ringkasan domisili ──
export function DetailHeader({ student, studentPhoto, isPrivacyMode, tags, points, canWrite, missingFields, completeness, photoInputRef, onPhotoUpload }: DetailHeaderProps) {
  const mask = (value: string | null) => (isPrivacyMode && value ? MASK : (value ?? '-'))
  const copyable = (value: string | null) =>
    value && !isPrivacyMode ? { text: value, tooltips: ['Salin', 'Tersalin'] as [string, string] } : false

  return (
    <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #eef2f7', background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div
          style={{
            width: 68,
            height: 68,
            borderRadius: 16,
            overflow: 'hidden',
            background: '#eef2ff',
            color: '#4f46e5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 26,
            fontWeight: 700,
            flexShrink: 0,
            cursor: canWrite && !isPrivacyMode ? 'pointer' : 'default',
            position: 'relative',
          }}
          onClick={() => canWrite && !isPrivacyMode && photoInputRef.current?.click()}
          title={canWrite && !isPrivacyMode ? 'Klik untuk mengganti foto' : undefined}
        >
          {studentPhoto && !isPrivacyMode ? (
            <img src={studentPhoto} alt={student.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            isPrivacyMode ? '*' : initials(student.name)
          )}
          {canWrite && !isPrivacyMode && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(15, 23, 42, 0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0,
                transition: 'opacity 0.2s',
                color: '#fff',
                fontSize: 20,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '1'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0'
              }}
            >
              <CameraOutlined />
            </div>
          )}
        </div>
        <input
          type="file"
          ref={photoInputRef}
          accept="image/*"
          style={{ display: 'none' }}
          onChange={onPhotoUpload}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: '-0.01em',
              color: '#0f172a',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {isPrivacyMode ? MASK : student.name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
            <StatusTag color={STUDENT_STATUS_META[student.status].color} icon={STUDENT_STATUS_META[student.status].icon}>
              {STUDENT_STATUS_META[student.status].label}
            </StatusTag>
            <Typography.Text type="secondary" copyable={copyable(student.registration_code)} style={{ fontSize: 13.5 }}>
              {mask(student.registration_code)}
            </Typography.Text>
          </div>
          {tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
              {tags.map((t) => (
                  <Tag key={t} style={{ borderRadius: 7, fontSize: 11.5, lineHeight: '18px', padding: '0 8px', marginInlineEnd: 0 }}>
                  {t}
                </Tag>
              ))}
            </div>
          )}
        </div>

        <Tooltip title={missingFields.length > 0 ? `Belum lengkap: ${missingFields.join(', ')}` : 'Semua data sudah lengkap'}>
          <Progress
            type="circle"
            percent={completeness}
            size={64}
            strokeColor="#4f46e5"
            strokeWidth={10}
            format={(p) => (p === 100 ? <CheckOutlined style={{ color: '#16a34a' }} /> : <span style={{ fontSize: 14, fontWeight: 700 }}>{p}%</span>)}
          />
        </Tooltip>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <StatPill icon={<ThunderboltOutlined />} label="Total Poin" value={points > 0 ? `+${points}` : points} color={points < 0 ? '#ef4444' : '#10b981'} />
        <StatPill icon={<BookOutlined />} label="Kelas" value={student.classes?.name ?? student.last_class?.name ?? '-'} color="#4f46e5" />
        <StatPill icon={<HomeOutlined />} label="Asrama" value={student.dorms?.name ?? 'Tanpa asrama'} color="#0ea5e9" />
      </div>
    </div>
  )
}
