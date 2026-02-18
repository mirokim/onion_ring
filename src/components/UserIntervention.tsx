import { useState } from 'react'
import { Send } from 'lucide-react'
import { useDebateStore } from '@/stores/debateStore'

export function UserIntervention() {
  const status = useDebateStore((s) => s.status)
  const userIntervene = useDebateStore((s) => s.userIntervene)
  const [input, setInput] = useState('')

  const disabled = status !== 'running' && status !== 'paused'
  const canSend = !disabled && input.trim().length > 0

  const handleSend = () => {
    if (!canSend) return
    userIntervene(input.trim())
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="border-t border-border p-3 shrink-0 bg-bg-secondary">
      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            disabled
              ? status === 'completed'
                ? '토론이 완료되었습니다'
                : '토론이 시작되면 개입할 수 있습니다'
              : '토론에 개입하기... (Enter로 전송)'
          }
          disabled={disabled}
          className="flex-1 px-3 py-2 text-sm bg-bg-primary border border-border rounded-lg resize-none focus:outline-none focus:border-accent transition disabled:opacity-50 disabled:cursor-not-allowed"
          rows={1}
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          className="px-3 py-2 bg-accent text-bg-primary rounded-lg hover:bg-accent-hover disabled:opacity-30 disabled:cursor-not-allowed transition shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
