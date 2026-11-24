import { supabase } from '../../lib/supabase'

export interface SppPushPayload {
  studentIds: string[]
  componentName: string
  period: string
  amount: number
}

/**
 * Kirim notifikasi web push ke santri saat tagihan SPP baru digenerate.
 * Bersifat fire-and-forget: kegagalan pengiriman push tidak boleh menggagalkan
 * transaksi pembuatan kewajiban SPP di database.
 */
export async function sendSppObligationPush(payload: SppPushPayload): Promise<void> {
  if (!payload.studentIds || payload.studentIds.length === 0) return

  const formattedAmount = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(payload.amount)

  const title = `Tagihan Baru: ${payload.componentName}`
  const body = `Tagihan periode ${payload.period} sebesar ${formattedAmount} telah diterbitkan. Buka portal untuk melihat rincian.`

  try {
    await supabase.functions.invoke('push-send', {
      body: {
        title,
        body,
        url: '/portal',
        kind: 'spp',
        studentIds: payload.studentIds,
      },
    })
  } catch {
    // Fire-and-forget: kegagalan push tidak menggagalkan proses keuangan
  }
}
