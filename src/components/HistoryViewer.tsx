import { X, MessageSquare, Clock } from 'lucide-react'
import { useHistoryStore } from '@/stores/historyStore'
import { MessageBubble } from './MessageBubble'
import { PROVIDER_LABELS, PROVIDER_COLORS, type AIProvider, type DiscussionMessage } from '@/types'
import { formatTimestampUTC } from '@/lib/utils'

const MODE_LABELS: Record<string, string> = {
  roundRobin: '라운드 로빈',
  freeDiscussion: '자유 토론',
  roleAssignment: '역할 배정',
}

export function HistoryViewer() {
  const selectedDebateId = useHistoryStore((s) => s.selectedDebateId)
  const selectedMessages = useHistoryStore((s) => s.selectedMessages)
  const debates = useHistoryStore((s) => s.debates)
  const clearSelection = useHistoryStore((s) => s.clearSelection)

  const debate = debates.find((d) => d.id === selectedDebateId)
  if (!debate) return null

  const dateStr = formatTimestampUTC(debate.createdAt, 'full')

  // Convert StoredMessage → DiscussionMessage format for MessageBubble
  const displayMessages: DiscussionMessage[] = selectedMessages.map((m) => ({
    id: m.id,
    provider: m.provider,
    content: m.content,
    round: m.round,
    timestamp: m.timestamp,
    error: m.error,
  }))

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border p-4 bg-bg-secondary shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-text-primary truncate">{debate.topic}</h3>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <span className="text-[11px] text-text-muted flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {dateStr}
              </span>
              <span className="text-[11px] text-text-muted">
                {MODE_LABELS[debate.mode] || debate.mode}
              </span>
              <span className="text-[11px] text-text-muted flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                {debate.messageCount}개 메시지
              </span>
              <span className="text-[11px] text-text-muted">
                R{debate.actualRounds}/{debate.maxRounds}
              </span>
              <div className="flex items-center gap-1">
                {debate.participants.map((p) => (
                  <div
                    key={p}
                    className="flex items-center gap-1"
                  >
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: PROVIDER_COLORS[p as AIProvider] }}
                    />
                    <span
                      className="text-[10px]"
                      style={{ color: PROVIDER_COLORS[p as AIProvider] }}
                    >
                      {PROVIDER_LABELS[p as AIProvider]}
                    </span>
                  </div>
                ))}
              </div>
              {debate.status === 'stopped' && (
                <span className="text-[10px] text-warning font-medium">중단됨</span>
              )}
            </div>
          </div>
          <button
            onClick={clearSelection}
            className="p-1.5 hover:bg-bg-hover rounded transition text-text-muted hover:text-text-primary shrink-0"
            title="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {displayMessages.length === 0 ? (
          <div className="text-center text-text-muted text-sm py-8">
            메시지가 없습니다
          </div>
        ) : (
          displayMessages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))
        )}
      </div>
    </div>
  )
}
