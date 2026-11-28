/** Nomor telepon → digit normal (0 di awal → 62) — dipakai wa.me & API Fonnte */
export function waPhoneDigits(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.startsWith('0') ? `62${digits.slice(1)}` : digits
}

/** Nomor telepon → tautan wa.me (0 di awal → 62) */
export function waLink(phone: string, text?: string): string {
  const normalized = waPhoneDigits(phone)
  return text
    ? `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`
    : `https://wa.me/${normalized}`
}

/** Nomor cukup untuk membuka WhatsApp (minimal 9 digit setelah normalisasi) */
export function canWhatsApp(phone?: string | null): boolean {
  if (!phone) return false
  return waPhoneDigits(phone).length >= 9
}
