import { QRCodeSVG } from 'qrcode.react'
import { RAPORT_AR_FONT } from './fonts'

interface SignatureBlockProps {
  label: string
  topLabel?: string
  nama: string
  mode: 'basah' | 'qrcode'
  qrValue?: string
  isAr?: boolean
}

export function SignatureBlock({
  label,
  topLabel,
  nama,
  mode,
  qrValue,
  isAr = false,
}: SignatureBlockProps) {
  const labelSize = isAr ? '13pt' : '10.5pt'
  const nameSize = isAr ? '14pt' : '11.5pt'

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        position: 'relative',
      }}
    >
      {topLabel && (
        <div
          style={{
            position: 'absolute',
            top: '-25px',
            left: 0,
            right: 0,
            fontSize: isAr ? '14pt' : '12pt',
            fontWeight: 600,
            color: '#111827',
            textAlign: 'center',
            lineHeight: 1.3,
            pointerEvents: 'none',
          }}
        >
          {topLabel}
        </div>
      )}

      <div
        style={{
          width: '100%',
          height: isAr ? '42px' : '40px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: labelSize,
          fontWeight: 700,
          fontFamily: isAr ? RAPORT_AR_FONT : 'inherit',
          whiteSpace: 'pre-line',
          lineHeight: isAr ? 1.2 : 1.15,
          textAlign: 'center',
          color: '#111827',
          position: 'relative',
        }}
      >
        {label}
      </div>

      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            height: '58px',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {mode === 'qrcode' && qrValue && (
            <QRCodeSVG
              value={qrValue}
              size={52}
              level="M"
              bgColor="#ffffff"
              fgColor="#111827"
              style={{ display: 'block', backgroundColor: '#fff', padding: 2 }}
            />
          )}
        </div>

        <div style={{ width: isAr ? '148px' : '128px', borderTop: '1px solid rgb(156, 163, 175)' }} />

        <div
          style={{
            width: '100%',
            fontWeight: 700,
            fontSize: nameSize,
            fontFamily: isAr ? RAPORT_AR_FONT : 'inherit',
            marginTop: '8px',
            textAlign: 'center',
            color: '#111827',
            lineHeight: isAr ? 1.35 : 1.25,
          }}
        >
          {nama || '......................'}
        </div>
      </div>
    </div>
  )
}
