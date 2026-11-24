import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Drawer, Input } from 'antd'
import { RobotOutlined, SendOutlined } from '@ant-design/icons'
import { askAi, type AiChatMessage } from '../shared/lib/ai'
import { buildChatContext } from '../shared/lib/aiContext'
import { retrieveKnowledge, toSources, type AiSource } from '../shared/lib/aiKnowledge'
import { useFlagMap } from '../shared/hooks/useFeatureFlags'
import { useRbac } from '../shared/rbac/useRbac'

const GREETING =
  'Halo, saya **Asisten Laporanmu**. Tanyakan fitur aplikasi, poin santri, atau cara pakai Laporanmu.'

const SUGGESTIONS = [
  'Apa itu poin santri?',
  'Bagaimana orang tua cek rapor?',
  'Di mana data wali?',
  'Apa saja fitur Laporanmu?',
]

interface ChatError {
  message: string
  retry: string
}

interface ChatMessageView extends AiChatMessage {
  sources?: AiSource[]
}

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
  const [messages, setMessages] = useState<ChatMessageView[]>([{ role: 'assistant', content: GREETING }])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<ChatError | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const sendingRef = useRef(false)
  const requestIdRef = useRef(0)
  const navigate = useNavigate()
  const { role, can, isLoading: rbacLoading } = useRbac()
  const flagMap = useFlagMap()
  const contextCan = useCallback(
    (perm: string) =>
      rbacLoading && perm === 'admin:access'
        ? role === 'developer' || role === 'admin'
        : can(perm),
    [can, rbacLoading, role],
  )

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading, error, open])

  const abortOnly = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    sendingRef.current = false
  }, [])

  const cancel = useCallback(() => {
    abortOnly()
    setIsLoading(false)
  }, [abortOnly])

  useEffect(() => {
    if (!open) abortOnly()
  }, [open, abortOnly])

  useEffect(() => () => abortOnly(), [abortOnly])

  const send = async (raw: string, options: { appendUser?: boolean } = {}) => {
    const text = raw.trim()
    if (!text || sendingRef.current) return

    const requestId = ++requestIdRef.current
    const appendUser = options.appendUser ?? true
    const base = appendUser ? messages : messages.slice(0, -1)
    const history = base
      .slice(1)
      .slice(-6)
      .map((message) => ({ role: message.role, content: message.content }))

    if (appendUser) {
      setMessages((prev) => [...prev, { role: 'user', content: text }])
    }
    setInput('')
    setError(null)
    setIsLoading(true)
    sendingRef.current = true

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const knowledge = retrieveKnowledge(text, { can: contextCan, flags: flagMap })
    const context = buildChatContext({ role, flags: flagMap, can: contextCan, knowledge })
    const result = await askAi(text, { history, context, signal: controller.signal })

    if (controller.signal.aborted || requestId !== requestIdRef.current) {
      if (requestId === requestIdRef.current) {
        abortRef.current = null
        sendingRef.current = false
        setIsLoading(false)
      }
      return
    }

    abortRef.current = null
    sendingRef.current = false
    setIsLoading(false)

    if (result.ok) {
      const sources = toSources(knowledge)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: result.text, sources: sources.length > 0 ? sources : undefined },
      ])
    } else {
      setError({ message: result.message, retry: text })
    }
  }

  const retry = () => {
    if (!error || isLoading) return
    void send(error.retry, { appendUser: false })
  }

  const handleClose = () => {
    cancel()
    onClose()
  }

  const openSource = (source: AiSource) => {
    if (source.isPublic) {
      window.open(source.route, '_blank', 'noopener,noreferrer')
      return
    }
    handleClose()
    navigate(source.route)
  }

  return (
    <Drawer
      placement="right"
      open={open}
      onClose={handleClose}
      size="min(360px, 100vw)"
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
      <div
        aria-live="polite"
        style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16, background: '#f8fafc' }}
      >
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
              {message.sources && message.sources.length > 0 && (
                <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                    Sumber
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {message.sources.map((source) => (
                      <Button
                        key={source.id}
                        size="small"
                        className="ai-source-chip"
                        onClick={() => openSource(source)}
                        style={{
                          fontSize: 11.5,
                          fontWeight: 600,
                          color: '#3730a3',
                          background: '#eef2ff',
                          borderColor: '#c7d2fe',
                        }}
                      >
                        {source.title}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
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
                color: '#64748b',
                fontSize: 13,
              }}
            >
              Mengetik…
            </div>
          )}
          {error && (
            <div
              style={{
                alignSelf: 'flex-start',
                maxWidth: '90%',
                padding: '8px 12px',
                borderRadius: '14px 14px 14px 4px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                fontSize: 12.5,
                lineHeight: 1.5,
              }}
            >
              <div>{error.message}</div>
              <Button
                size="small"
                className="ai-retry-button"
                onClick={retry}
                disabled={isLoading}
                style={{ marginTop: 6, fontSize: 11.5 }}
              >
                Coba lagi
              </Button>
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
            className="ai-suggestion-chip"
            onClick={() => void send(suggestion)}
            disabled={isLoading}
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
            className="ai-chat-input"
          />
          <Button
            type="primary"
            className="ai-send-button"
            icon={<SendOutlined />}
            onClick={() => void send(input)}
            loading={isLoading}
            aria-label="Kirim"
          />
        </div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
          Jawaban AI bisa salah. Verifikasi data penting di menu terkait.
        </div>
      </div>
    </Drawer>
  )
}
