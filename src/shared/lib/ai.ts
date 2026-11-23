// Klien AI untuk Asisten AI topbar & modul AI.
// Panggilan diteruskan ke Edge Function `ai-proxy` supaya API key provider
// TIDAK pernah ikut terkompilasi ke bundle browser.

import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

// Model free-tier Groq (aktif Nov 2026): 30 RPM, 1K RPD, 8K TPM, 200K TPD.
export const MODEL = 'openai/gpt-oss-120b'

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
  try {
    const { data, error } = await supabase.functions.invoke('ai-proxy', {
      body: {
        system: options.system,
        prompt: options.prompt,
        history: options.history ?? [],
        maxOutputTokens: options.maxOutputTokens ?? 512,
        model: MODEL,
      },
    })

    if (error) {
      let detail = ''
      if (error instanceof FunctionsHttpError && error.context instanceof Response) {
        try {
          const body = (await error.context.json()) as { error?: string }
          detail = body.error ?? ''
        } catch {
          /* body bukan JSON */
        }
      }
      if (!detail && /failed to send|network|fetch/i.test(error.message ?? '')) {
        return 'Tidak bisa terhubung ke layanan AI. Periksa koneksi internet kamu.'
      }
      return `Maaf, layanan AI tidak dapat diakses${detail ? `: ${detail}` : ''}.`
    }

    const text = (data as { text?: string } | null)?.text ?? ''
    return text || 'Maaf, saya belum menemukan jawabannya. Coba tanyakan dengan kalimat lain.'
  } catch {
    return 'Tidak bisa terhubung ke layanan AI. Periksa koneksi internet kamu.'
  }
}

/** Kirim prompt ke Groq dan balas teks jawaban (atau pesan kesalahan yang ramah). */
export async function askAi(prompt: string, history: AiChatMessage[] = []): Promise<string> {
  return callAi({ system: SYSTEM_PROMPT, prompt, history })
}
