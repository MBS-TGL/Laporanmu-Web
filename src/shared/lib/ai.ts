// Klien AI untuk Asisten AI topbar & modul AI — Groq (OpenAI-compatible) tanpa SDK.
// Butuh VITE_GROQ_API_KEY di .env.local; tanpa key, fitur AI memberi pesan ramah.

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
// Model free-tier Groq (aktif Nov 2026): 30 RPM, 1K RPD, 8K TPM, 200K TPD.
const MODEL = 'openai/gpt-oss-120b'

const APP_CONTEXT = `
IDENTITAS:
- Platform: Laporanmu (sistem informasi manajemen pondok/sekolah santri).
- Fitur: data santri & guru, poin santri (pelanggaran & prestasi), asrama, kesehatan,
  bimbingan konseling, izin keluar, skorsing, laporan gerbang, presensi & jadwal KBM,
  halaqah, rapor bulanan & semester, tahun akademik, audit log.

FAKTA PENTING (FAQ):
1. PIN santri didapatkan dari wali kelas atau musyrif.
2. Orang tua/wali cek poin & rapor dengan Kode Registrasi (REG-XXXX) + PIN di halaman "Cek Poin Santri" (route /cek).
3. Sistem poin: poin minus untuk pelanggaran, poin plus untuk prestasi; total poin terlihat di data santri.
4. Rapor diisi per kelas per periode (bulanan & semester), lalu dapat dipratinjau dan diarsipkan.
5. Role pengguna aplikasi: developer, admin, pengurus, guru.
`

const SYSTEM_PROMPT = `Kamu adalah Asisten Laporanmu yang ramah dan membantu.
ATURAN KETAT:
1. Jawab HANYA berdasarkan konteks aplikasi ini: ${APP_CONTEXT}
2. Jika data spesifik tidak ada (nama guru, nomor telepon, nilai santri tertentu), sarankan pengguna mengecek langsung di menu terkait.
3. DILARANG KERAS mengarang/asumsi nomor telepon, nama, atau angka data.
4. Jawab ringkas dengan bahasa Indonesia yang jelas; gunakan bullet (-) atau angka bila perlu.`

export interface AiChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/** Pemanggilan Groq generik — dipakai askAi dan modul AI (CBT, konseling, health, insights). */
export async function callAi(options: {
  system: string
  prompt: string
  history?: AiChatMessage[]
  maxOutputTokens?: number
}): Promise<string> {
  const apiKey = (import.meta.env as Record<string, string | undefined>).VITE_GROQ_API_KEY
  if (!apiKey) {
    return 'API Key AI belum diatur. Tambahkan **VITE_GROQ_API_KEY** di file .env.local lalu muat ulang aplikasi.'
  }

  // Format OpenAI chat: system dulu, lalu history, lalu prompt baru.
  const messages = [
    { role: 'system', content: options.system },
    ...(options.history ?? []).map((message) => ({
      role: message.role,
      content: message.content,
    })),
    { role: 'user', content: options.prompt },
  ]

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.4,
        max_tokens: options.maxOutputTokens ?? 512,
      }),
    })
    if (!response.ok) {
      let detail = ''
      try {
        const err = await response.json()
        detail = err?.error?.message ? ` — ${err.error.message}` : ''
      } catch {
        /* body bukan JSON */
      }
      if (response.status === 429) {
        return 'Layanan AI sedang membatasi permintaan (kuota free tier). Coba lagi beberapa menit.'
      }
      return `Maaf, terjadi kesalahan saat menghubungi layanan AI (kode ${response.status})${detail}`
    }
    const data = await response.json()
    const text: string = data?.choices?.[0]?.message?.content ?? ''
    return text || 'Maaf, saya belum menemukan jawabannya. Coba tanyakan dengan kalimat lain.'
  } catch {
    return 'Tidak bisa terhubung ke layanan AI. Periksa koneksi internet kamu.'
  }
}

/** Kirim prompt ke Groq dan balas teks jawaban (atau pesan kesalahan yang ramah). */
export async function askAi(prompt: string, history: AiChatMessage[] = []): Promise<string> {
  return callAi({ system: SYSTEM_PROMPT, prompt, history })
}
