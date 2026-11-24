import {
  DASHBOARD_ITEM,
  NAV_GROUPS,
  filterNavGroups,
  filterNavItems,
  type CanFn,
} from '../constants/navItems'
import type { AiKnowledgeEntry } from './aiKnowledge'

export interface ChatContextOptions {
  role?: string | null
  flags?: Record<string, boolean>
  can?: CanFn
  knowledge?: AiKnowledgeEntry[]
}

const PUBLIC_PAGES = [
  '- Cek Wali Santri (/check): wali masuk dengan kode registrasi dan PIN.',
  '- Verifikasi Rapor (/verify): cek keaslian rapor dengan ID santri.',
  '- Login (/login): halaman masuk untuk staf.',
]

export function buildChatContext({
  role,
  flags,
  can,
  knowledge = [],
}: ChatContextOptions): string {
  const dashboard = filterNavItems([DASHBOARD_ITEM], role, flags, can)
  const groups = filterNavGroups(NAV_GROUPS, role, flags, can)

  const menuLines = [
    ...dashboard.map((item) => `- [Utama] ${item.label} (${item.to}): ${item.desc}`),
    ...groups.flatMap((group) =>
      group.items.map((item) => `- [${group.label}] ${item.label} (${item.to}): ${item.desc}`),
    ),
  ]

  const knowledgeLines =
    knowledge.length > 0
      ? knowledge.map((entry) => {
          const route = entry.route ? `\nRute: ${entry.route}` : ''
          return `### ${entry.title}\n${entry.answer}${route}`
        })
      : ['Tidak ada panduan khusus yang cocok. Gunakan daftar menu di atas.']

  return [
    'IDENTITAS:',
    'Laporanmu adalah sistem informasi manajemen pondok/sekolah santri.',
    '',
    'MENU YANG TERLIHAT UNTUK PENGGUNA INI:',
    ...menuLines,
    '',
    'HALAMAN PUBLIK:',
    ...PUBLIC_PAGES,
    '',
    'PANDUAN RELEVAN:',
    ...knowledgeLines,
    '',
    'CATATAN:',
    'Menu dan route di luar daftar ini tidak tersedia untuk pengguna. Data pribadi seperti nama, nomor HP, alamat, dan nilai hanya bisa dilihat di menu terkait.',
  ].join('\n')
}
