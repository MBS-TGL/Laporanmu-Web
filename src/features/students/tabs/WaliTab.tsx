import { useMemo, useRef, useState } from 'react'
import { App, Button, Card, Empty, Input, Space, Table, Tag, Tooltip, theme, type InputRef, type TableColumnsType } from 'antd'
import {
  CopyOutlined,
  MessageOutlined,
  ReloadOutlined,
  SearchOutlined,
  SyncOutlined,
  ThunderboltOutlined,
  UserOutlined,
  WhatsAppOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { StatChip } from '../../../shared/components/StatChip'
import { ShortcutsModal } from '../../../shared/components/ShortcutsModal'
import { useTabActions } from '../../../shared/components/ActionsSlot'
import { useShortcuts, type ShortcutItem } from '../../../shared/hooks/useShortcuts'
import { useDebounce } from '../../../shared/hooks/useDebounce'
import { useStudentDetail } from '../useStudentDetail'
import { fetchGuardianFamilies, type GuardianFamilyRow } from '../api'
import type { GuardianRelation } from '../types'

const RELATION_LABEL: Record<GuardianRelation, string> = {
  father: 'Ayah',
  mother: 'Ibu',
  guardian: 'Wali',
}

const RELATION_COLOR: Record<GuardianRelation, string> = {
  father: 'blue',
  mother: 'magenta',
  guardian: 'purple',
}

interface FamilyGroup {
  key: string
  name: string
  relations: GuardianRelation[]
  phone: string | null
  occupation: string | null
  students: { id: string; name: string; registration_code: string | null; class_name: string | null }[]
}

/** Gabungkan baris guardian per keluarga: grup by no. HP (digit), fallback nama. */
function groupGuardianFamilies(rows: GuardianFamilyRow[]): FamilyGroup[] {
  const groups = new Map<string, FamilyGroup>()
  for (const row of rows) {
    const name = row.name?.trim()
    if (!name) continue
    const phoneDigits = row.phone?.replace(/\D/g, '') ?? ''
    const key = phoneDigits.length >= 8 ? `hp:${phoneDigits}` : `nama:${name.toLowerCase()}`
    const existing = groups.get(key)
    if (existing) {
      if (!existing.relations.includes(row.relation)) existing.relations.push(row.relation)
      if (!existing.phone && row.phone) existing.phone = row.phone
      if (!existing.occupation && row.occupation) existing.occupation = row.occupation
      if (row.student && !existing.students.some((s) => s.id === row.student!.id)) {
        existing.students.push(row.student)
      }
    } else {
      groups.set(key, {
        key,
        name,
        relations: [row.relation],
        phone: row.phone,
        occupation: row.occupation,
        students: row.student ? [row.student] : [],
      })
    }
  }
  return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name, 'id'))
}

/** Tab "Hub Wali" — wali agregat per keluarga (RLS: developer/admin/pengurus). */
export function WaliTab({ active }: { active: boolean }) {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 350)
  const searchInputRef = useRef<InputRef>(null)

  const { open: openStudentDetail } = useStudentDetail()
  const familiesQuery = useQuery({
    queryKey: ['guardian-families'],
    queryFn: fetchGuardianFamilies,
    enabled: active,
  })

  const families = useMemo(() => groupGuardianFamilies(familiesQuery.data ?? []), [familiesQuery.data])

  const rows = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    if (!q) return families
    return families.filter((f) =>
      `${f.name} ${f.phone ?? ''} ${f.students.map((s) => `${s.name} ${s.class_name ?? ''}`).join(' ')}`
        .toLowerCase()
        .includes(q),
    )
  }, [families, debouncedSearch])

  const withPhoneCount = families.filter((f) => f.phone).length
  const childCount = new Set(families.flatMap((f) => f.students.map((s) => s.id))).size

  const copyPhone = (phone: string) => {
    void navigator.clipboard
      .writeText(phone)
      .then(() => message.success('Nomor disalin'))
      .catch(() => message.error('Gagal menyalin nomor'))
  }

  const shortcutItems: ShortcutItem[] = [
    {
      keys: ['Ctrl', 'K'],
      label: 'Fokus ke search',
      group: 'Navigasi',
      icon: <SearchOutlined />,
      run: () => searchInputRef.current?.focus(),
    },
    {
      keys: ['R'],
      label: 'Muat ulang data',
      group: 'Tampilan',
      icon: <ReloadOutlined />,
      run: () => void familiesQuery.refetch(),
    },
    {
      keys: ['?'],
      label: 'Toggle palet shortcut',
      group: 'Tampilan',
      icon: <ThunderboltOutlined />,
      run: () => shortcuts.toggle(),
    },
  ]

  const shortcuts = useShortcuts({ items: shortcutItems, isBlocked: !active })

  const columns: TableColumnsType<FamilyGroup> = [
    {
      title: 'Wali',
      dataIndex: 'name',
      key: 'name',
      render: (_, row) => (
        <Space size={4} wrap>
          <span style={{ fontWeight: 600 }}>{row.name}</span>
          {row.relations.map((r) => (
            <Tag key={r} color={RELATION_COLOR[r]} style={{ borderRadius: 6 }}>
              {RELATION_LABEL[r]}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: 'No. HP',
      dataIndex: 'phone',
      key: 'phone',
      width: 200,
      render: (_, row) => {
        const waOk = /^0[1-9]\d{7,}$/.test((row.phone ?? '').replace(/\D/g, ''))
        return (
          <Space size={0}>
            <span>{row.phone ?? <span style={{ color: token.colorTextQuaternary }}>—</span>}</span>
            {row.phone && (
              <Tooltip title="Salin nomor">
                <Button type="text" size="small" icon={<CopyOutlined />} onClick={() => copyPhone(row.phone!)} />
              </Tooltip>
            )}
            <Tooltip title={waOk ? 'Buka WhatsApp' : 'Nomor HP belum tersedia'}>
              <span>
                <Button
                  type="text"
                  size="small"
                  disabled={!waOk}
                  icon={<WhatsAppOutlined />}
                  onClick={() =>
                    waOk &&
                    window.open(
                      `https://wa.me/${row.phone!.replace(/\D/g, '').replace(/^0/, '62')}`,
                      '_blank',
                      'noopener',
                    )
                  }
                />
              </span>
            </Tooltip>
          </Space>
        )
      },
    },
    {
      title: 'Pekerjaan',
      dataIndex: 'occupation',
      key: 'occupation',
      width: 150,
      responsive: ['lg'],
      render: (v: string | null) => v || '—',
    },
    {
      title: 'Anak',
      key: 'students',
      render: (_, row) =>
        row.students.length > 0 ? (
          <Space size={4} wrap>
            {row.students.map((s) => (
              <Button
                key={s.id}
                type="link"
                size="small"
                style={{ padding: 0, height: 'auto' }}
                onClick={() => openStudentDetail(s.id)}
              >
                {s.name}
                {s.class_name ? ` · ${s.class_name}` : ''}
              </Button>
            ))}
          </Space>
        ) : (
          <span style={{ color: token.colorTextQuaternary }}>—</span>
        ),
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 90,
      responsive: ['md'],
      render: (_, row) => {
        const firstStudent = row.students[0]
        if (!firstStudent) return <span style={{ color: token.colorTextQuaternary }}>—</span>
        return (
          <Tooltip title="Buka detail siswa">
            <Button type="text" icon={<UserOutlined />} onClick={() => openStudentDetail(firstStudent.id)} />
          </Tooltip>
        )
      },
    },
  ]

  // Aksi halaman di ujung kanan tab bar — pola sama dengan tab lain (judul & subtitle dirender shell)
  const tabActions = useTabActions(
    active,
    <Space wrap>
      <Tooltip title="Muat ulang (R)">
        <Button icon={<SyncOutlined spin={familiesQuery.isFetching} />} onClick={() => void familiesQuery.refetch()} />
      </Tooltip>
      <Tooltip title="Shortcut keyboard (?)">
        <Button icon={<QuestionCircleOutlined />} onClick={shortcuts.open} />
      </Tooltip>
    </Space>,
  )

  return (
    <div>
      {tabActions}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <StatChip
          icon={<UserOutlined />}
          label="Wali Unik"
          value={families.length}
          color="indigo"
          loading={familiesQuery.isPending}
          hideIfZero
          onClick={() => setSearch('')}
        />
        <StatChip
          icon={<MessageOutlined />}
          label="Ada No. HP"
          value={withPhoneCount}
          color="emerald"
          loading={familiesQuery.isPending}
          hideIfZero
        />
        <StatChip
          icon={<UserOutlined />}
          label="Anak Tercatat"
          value={childCount}
          color="sky"
          loading={familiesQuery.isPending}
          hideIfZero
        />
      </div>

      <Card>
        <div style={{ marginBottom: 14 }}>
          <Input
            ref={searchInputRef}
            placeholder="Cari nama wali / no. HP / nama anak…"
            prefix={<SearchOutlined />}
            allowClear
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 420 }}
          />
        </div>

        <Table<FamilyGroup>
          rowKey="key"
          columns={columns}
          dataSource={rows}
          loading={familiesQuery.isPending}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  familiesQuery.isError
                    ? 'Gagal memuat data wali (periksa koneksi / hak akses)'
                    : families.length > 0
                      ? 'Tidak ada wali yang cocok dengan pencarian'
                      : 'Belum ada data wali — isi data ayah/ibu/wali di form siswa'
                }
              />
            ),
          }}
          pagination={rows.length > 10 ? { showTotal: (t) => `Total ${t} wali` } : false}
          scroll={{ x: true }}
        />
      </Card>

      <ShortcutsModal open={shortcuts.isOpen} onClose={shortcuts.close} sections={shortcuts.sections} />
    </div>
  )
}
