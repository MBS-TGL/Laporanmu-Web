// Klien AI untuk Asisten AI topbar — Gemini via REST tanpa SDK.
// Butuh VITE_GEMINI_API_KEY di .env.local; tanpa key, asisten memberi pesan ramah.

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models'
const MODEL = 'gemini-2.0-flash'

const APP_CONTEXT = `
IDENTITAS:
- Platform: Laporanmu (sistem informasi manajemen pondok/sekolah santri).
- Fitur: data santri & guru, poin santri (pelanggaran & prestasi), asrama, kesehatan,
  bimbingan konseling, izin pulang, skorsing, gerbang santri, presensi & jadwal KBM,
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

/** Pemanggilan Gemini generik — dipakai askAi dan modul AI Insights. */
export async function callGemini(options: {
  system: string
  prompt: string
  history?: AiChatMessage[]
  maxOutputTokens?: number
}): Promise<string> {
  const apiKey = (import.meta.env as Record<string, string | undefined>).VITE_GEMINI_API_KEY
  if (!apiKey) {
    return 'API Key AI belum diatur. Tambahkan **VITE_GEMINI_API_KEY** di file .env.local lalu muat ulang aplikasi.'
  }

  const contents = [
    ...(options.history ?? []).map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }],
    })),
    { role: 'user', parts: [{ text: options.prompt }] },
  ]

  try {
    const response = await fetch(
      `${GEMINI_API_URL}/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: options.system }] },
          generationConfig: { temperature: 0.4, maxOutputTokens: options.maxOutputTokens ?? 512 },
        }),
      },
    )
    if (!response.ok) {
      return `Maaf, terjadi kesalahan saat menghubungi layanan AI (kode ${response.status}).`
    }
    const data = await response.json()
    const text: string = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? ''
    return text || 'Maaf, saya belum menemukan jawabannya. Coba tanyakan dengan kalimat lain.'
  } catch {
    return 'Tidak bisa terhubung ke layanan AI. Periksa koneksi internet kamu.'
  }
}

/** Kirim prompt ke Gemini dan balas teks jawaban (atau pesan kesalahan yang ramah). */
export async function askAi(prompt: string, history: AiChatMessage[] = []): Promise<string> {
  return callGemini({ system: SYSTEM_PROMPT, prompt, history })
}
