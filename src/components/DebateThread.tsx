import { useEffect, useRef } from 'react'
import { useDebateStore } from '@/stores/debateStore'
import { MessageBubble } from './MessageBubble'
import { PROVIDER_LABELS, PROVIDER_COLORS, type AIProvider } from '@/types'

function TypingIndicator({ provider }: { provider: AIProvider }) {
  const color = PROVIDER_COLORS[provider]
  const label = PROVIDER_LABELS[provider]

  return (
    <div className="flex gap-3">
      <div className="w-1 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <div className="py-1">
        <span className="text-xs font-semibold" style={{ color }}>
          {label}
        </span>
        <div className="flex items-center gap-1 mt-1.5">
          <div className="typing-dot w-1.5 h-1.5 rounded-full bg-text-muted" />
          <div className="typing-dot w-1.5 h-1.5 rounded-full bg-text-muted" />
          <div className="typing-dot w-1.5 h-1.5 rounded-full bg-text-muted" />
        </div>
      </div>
    </div>
  )
}

export function DebateThread() {
  const messages = useDebateStore((s) => s.messages)
  const loadingProvider = useDebateStore((s) => s.loadingProvider)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll on new messages
  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }
  }, [messages.length, loadingProvider])

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
      {messages.length === 0 && !loadingProvider && (
        <div className="flex items-center justify-center h-full text-text-muted text-sm">
          토론이 시작되면 여기에 대화가 표시됩니다
        </div>
      )}

      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}

      {loadingProvider && <TypingIndicator provider={loadingProvider} />}
    </div>
  )
}
