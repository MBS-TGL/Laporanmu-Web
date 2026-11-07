import { useEffect, useRef, useState } from 'react'
import { Button, Drawer, Input } from 'antd'
import { RobotOutlined, SendOutlined } from '@ant-design/icons'
import { askAi, type AiChatMessage } from '../shared/lib/ai'

const GREETING =
  'Halo! 👋 Saya **Asisten Laporanmu**. Ada yang ingin ditanyakan seputar fitur aplikasi, poin santri, atau cara pakai Laporanmu?'

const SUGGESTIONS = ['Apa itu poin santri?', 'Bagaimana orang tua cek rapor?', 'Apa saja fitur Laporanmu?']

/** Render teks sederhana: baris baru jadi paragraf, **teks** jadi tebal. */
function renderRichText(text: string) {
  return text.split('\n').map((line, lineIdx) => (
    <div key={lineIdx} style={{ minHeight: line.trim() ? undefined : 8 }}>
      {line.split(/(\*\*[^*]+\*\*)/g).map((part, partIdx) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={partIdx} style={{ fontWeight: 700 }}>
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={partIdx}>{part}</span>
        ),
      )}
    </div>
  ))
}

interface ChatAssistantProps {
  open: boolean
  onClose: () => void
}

export function ChatAssistant({ open, onClose }: ChatAssistantProps) {
  const [messages, setMessages] = useState<AiChatMessage[]>([{ role: 'assistant', content: GREETING }])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading, open])

  const send = async (raw: string) => {
    const text = raw.trim()
    if (!text || isLoading) return

    // Konteks: 4 pesan terakhir
    const history = messages.slice(-4).map((m) => ({ role: m.role, content: m.content }))

    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setInput('')
    setIsLoading(true)

    const reply = await askAi(text, history)
    setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    setIsLoading(false)
  }

  return (
    <Drawer
      placement="right"
      open={open}
      onClose={onClose}
      width={360}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: '#4f46e5',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
            }}
          >
            <RobotOutlined />
          </span>
          <span style={{ fontSize: 14 }}>Asisten AI</span>
        </div>
      }
      styles={{
        body: {
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          scrollbarWidth: 'none',
        },
      }}
    >
      {/* Daftar pesan */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16, background: '#f8fafc' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.map((message, idx) => (
            <div
              key={idx}
              style={{
                alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                padding: '8px 12px',
                borderRadius: message.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                background: message.role === 'user' ? '#4f46e5' : '#fff',
                color: message.role === 'user' ? '#fff' : '#334155',
                border: message.role === 'user' ? 'none' : '1px solid #e2e8f0',
                fontSize: 13,
                lineHeight: 1.55,
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
              }}
            >
              {renderRichText(message.content)}
            </div>
          ))}
          {isLoading && (
            <div
              style={{
                alignSelf: 'flex-start',
                padding: '10px 14px',
                borderRadius: '14px 14px 14px 4px',
                background: '#fff',
                border: '1px solid #e2e8f0',
                color: '#94a3b8',
                fontSize: 13,
              }}
            >
              Mengetik…
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Saran cepat */}
      <div style={{ padding: '8px 12px 0', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {SUGGESTIONS.map((suggestion) => (
          <Button
            key={suggestion}
            size="small"
            shape="round"
            onClick={() => void send(suggestion)}
            style={{ fontSize: 11.5, fontWeight: 500, color: '#475569' }}
          >
            {suggestion}
          </Button>
        ))}
      </div>

      {/* Input */}
      <div style={{ padding: 12, borderTop: '1px solid #eef2f7' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <Input
            placeholder="Tulis pertanyaan…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPressEnter={() => void send(input)}
            disabled={isLoading}
            size="middle"
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={() => void send(input)}
            loading={isLoading}
            aria-label="Kirim"
          />
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
          Jawaban AI bisa salah — verifikasi data penting di menu terkait.
        </div>
      </div>
    </Drawer>
  )
}
