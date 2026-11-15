import { useCallback, useEffect, useRef, useState } from 'react'

interface DetectedBarcode {
  rawValue: string
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>
}
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike

/** Beep pendek via WebAudio — tanpa file audio */
export function scannerBeep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 1046
    gain.gain.setValueAtTime(0.08, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.2)
    osc.onended = () => void ctx.close()
  } catch {
    // audio opsional
  }
}

/** Beep gagal — nada rendah, durasi lebih panjang */
export function scannerBeepFail() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 240
    gain.gain.setValueAtTime(0.12, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.3)
    osc.onended = () => void ctx.close()
  } catch {
    // audio opsional
  }
}

/** Getar singkat saat scan sukses */
export function scannerVibrate() {
  try {
    navigator.vibrate?.(80)
  } catch {
    // opsional
  }
}

interface UseQrScannerOptions {
  /** true = buka kamera & jalankan loop deteksi */
  active: boolean
  /** Dipanggil setiap QR terbaca dari kamera */
  onDetect: (raw: string) => void
  /** true = hentikan sementara deteksi (mis. kartu hasil sedang tampil) */
  paused?: boolean
  /** Jeda minimal antar pembacaan teks yang sama (ms) */
  cooldownMs?: number
  /** Kamera spesifik yang dipilih (dari daftar `devices`) */
  deviceId?: string
}

/**
 * Kamera + decoder QR hybrid multidevice — SATU implementasi untuk semua
 * fitur scan aplikasi (gate, absensi, izin — lihat SKILLS.md §Skill 4):
 * `BarcodeDetector` native bila tersedia (Android/Chrome — cepat),
 * fallback jsQR (~10 KB, dynamic import) untuk iOS Safari/Huawei/dll.
 */
export function useQrScanner({
  active,
  onDetect,
  paused = false,
  cooldownMs = 3000,
  deviceId,
}: UseQrScannerOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [cameraState, setCameraState] = useState<'starting' | 'on' | 'error'>('starting')
  const [cameraError, setCameraError] = useState('')
  const [engine, setEngine] = useState<'native' | 'jsqr' | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [torchSupported, setTorchSupported] = useState(false)
  const [torchOn, setTorchOn] = useState(false)

  const onDetectRef = useRef(onDetect)
  useEffect(() => {
    onDetectRef.current = onDetect
  }, [onDetect])

  const pausedRef = useRef(paused)
  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  const refreshDevices = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices()
      setDevices(list.filter((d) => d.kind === 'videoinput'))
    } catch {
      // Enumerasi gagal — pilihan kamera tidak kritis
    }
  }, [])

  const toggleTorch = useCallback(async () => {
    const stream = videoRef.current?.srcObject as MediaStream | null
    const track = stream?.getVideoTracks()[0]
    if (!track) return
    try {
      const next = !torchOn
      await track.applyConstraints({ advanced: [{ torch: next }] } as unknown as MediaTrackConstraints)
      setTorchOn(next)
    } catch {
      // Torch tidak didukung kamera aktif — abaikan
    }
  }, [torchOn])

  useEffect(() => {
    if (!active) return

    const videoEl = videoRef.current
    let cancelled = false
    let raf: number | null = null
    let lastTick = 0
    let lastRead = { raw: '', at: 0 }

    let detector: BarcodeDetectorLike | null = null
    type JsqrFn = (data: Uint8ClampedArray, w: number, h: number, o?: object) => { rawValue?: string } | null
    let jsqrFn: JsqrFn | null = null

    const canvas = document.createElement('canvas')
    const ctx2d = canvas.getContext('2d', { willReadFrequently: true })

    const ensureDetector = async (): Promise<BarcodeDetectorLike | null> => {
      if (detector) return detector
      const Ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector
      if (!Ctor) return null
      try {
        detector = new Ctor({ formats: ['qr_code'] })
        return detector
      } catch {
        return null
      }
    }

    const ensureJsqr = async (): Promise<JsqrFn> => {
      if (jsqrFn) return jsqrFn
      const mod = await import('jsqr')
      jsqrFn = mod.default as JsqrFn
      return jsqrFn
    }

    const detectWithJsqr = async (video: HTMLVideoElement): Promise<DetectedBarcode[]> => {
      const fn = await ensureJsqr()
      if (!ctx2d) return []
      const scale = Math.min(1, 480 / video.videoWidth)
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
      ctx2d.drawImage(video, 0, 0, canvas.width, canvas.height)
      const img = ctx2d.getImageData(0, 0, canvas.width, canvas.height)
      const res = fn(img.data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' })
      return res?.rawValue ? [{ rawValue: res.rawValue }] : []
    }

    const tick = async (ts: number) => {
      if (cancelled) return
      raf = requestAnimationFrame(tick)
      if (ts - lastTick < 180 || pausedRef.current) return
      lastTick = ts
      const video = videoRef.current
      if (!video || video.readyState < 2 || !video.videoWidth) return
      try {
        let codes: DetectedBarcode[] = []
        const det = await ensureDetector()
        if (det) codes = await det.detect(video)
        else codes = await detectWithJsqr(video)
        const raw = codes[0]?.rawValue
        if (!raw) return
        const now = Date.now()
        if (lastRead.raw === raw && now - lastRead.at < cooldownMs) return
        lastRead = { raw, at: now }
        onDetectRef.current(raw)
      } catch {
        // frame gagal decode — abaikan, frame berikutnya dicoba lagi
      }
    }

    const detectTorch = () => {
      const stream = videoRef.current?.srcObject as MediaStream | null
      const track = stream?.getVideoTracks()[0]
      const caps = track?.getCapabilities?.() as { torch?: boolean } | undefined
      setTorchSupported(Boolean(caps?.torch))
      setTorchOn(false)
    }

    const start = async () => {
      setCameraState('starting')
      setCameraError('')
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraState('error')
        setEngine(null)
        setCameraError('Browser ini tidak mendukung kamera. Gunakan input manual.')
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: deviceId
            ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
            : { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        const el = videoRef.current
        if (!el) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        el.srcObject = stream
        await el.play().catch(() => undefined)
        setEngine((await ensureDetector()) ? 'native' : 'jsqr')
        setCameraState('on')
        void refreshDevices()
        detectTorch()
        raf = requestAnimationFrame(tick)
      } catch (err) {
        if (cancelled) return
        setCameraState('error')
        setEngine(null)
        const name = err instanceof Error ? err.name : ''
        if (name === 'NotAllowedError') {
          setCameraError('Izin kamera ditolak. Aktifkan izin kamera di browser, atau gunakan input manual.')
        } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
          setCameraError('Kamera tidak ditemukan di perangkat ini. Gunakan input manual.')
        } else {
          setCameraError('Kamera gagal dibuka. Gunakan input manual di bawah.')
        }
      }
    }

    void start()

    return () => {
      cancelled = true
      if (raf !== null) cancelAnimationFrame(raf)
      const stream = videoEl?.srcObject as MediaStream | null
      stream?.getTracks().forEach((t) => t.stop())
      if (videoEl) videoEl.srcObject = null
    }
    // deviceId masuk dependensi agar ganti kamera memicu restart stream
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, deviceId])

  return {
    videoRef,
    cameraState,
    cameraError,
    setCameraState,
    setCameraError,
    engine,
    devices,
    refreshDevices,
    torchSupported,
    torchOn,
    toggleTorch,
  }
}
