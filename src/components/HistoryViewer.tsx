import { useState } from 'react'
import { X, MessageSquare, Clock, Share2, Copy, Check } from 'lucide-react'
import { useHistoryStore } from '@/stores/historyStore'
import { MessageBubble } from './MessageBubble'
import { PROVIDER_LABELS, PROVIDER_COLORS, type AIProvider, type DiscussionMessage } from '@/types'
import { formatTimestampUTC, formatDebateForShare, shareText } from '@/lib/utils'

const MODE_LABELS: Record<string, string> = {
  roundRobin: '라운드 로빈',
  freeDiscussion: '자유 토론',
  roleAssignment: '역할 배정',
  battle: '결전모드',
}

export function HistoryViewer() {
  const selectedDebateId = useHistoryStore((s) => s.selectedDebateId)
  const selectedMessages = useHistoryStore((s) => s.selectedMessages)
  const debates = useHistoryStore((s) => s.debates)
  const clearSelection = useHistoryStore((s) => s.clearSelection)
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'shared' | 'failed'>('idle')

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
    messageType: m.messageType as DiscussionMessage['messageType'],
    roleName: m.roleName,
  }))

  const handleShare = async () => {
    const text = formatDebateForShare(
      debate.topic,
      debate.mode,
      debate.participants,
      selectedMessages.map((m) => ({
        provider: m.provider,
        content: m.content,
        round: m.round,
        error: m.error,
      })),
      dateStr,
    )

    const result = await shareText(`AI 토론: ${debate.topic}`, text)
    setShareStatus(result)

    if (result !== 'failed') {
      setTimeout(() => setShareStatus('idle'), 2500)
    }
  }

  const handleCopy = async () => {
    const text = formatDebateForShare(
      debate.topic,
      debate.mode,
      debate.participants,
      selectedMessages.map((m) => ({
        provider: m.provider,
        content: m.content,
        round: m.round,
        error: m.error,
      })),
      dateStr,
    )

    try {
      await navigator.clipboard.writeText(text)
      setShareStatus('copied')
      setTimeout(() => setShareStatus('idle'), 2500)
    } catch {
      setShareStatus('failed')
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border p-4 bg-bg-secondary/60 backdrop-blur-sm shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-text-primary truncate">{debate.topic}</h3>
            <div className="flex items-center gap-2.5 mt-2 flex-wrap">
              <span className="text-[10px] text-text-muted flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {dateStr}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-surface text-text-muted font-medium">
                {MODE_LABELS[debate.mode] || debate.mode}
              </span>
              <span className="text-[10px] text-text-muted flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                {debate.messageCount}
              </span>
              <span className="text-[10px] text-text-muted font-medium">
                R{debate.actualRounds}/{debate.maxRounds}
              </span>
              <div className="flex items-center gap-1.5">
                {debate.participants.map((p) => (
                  <div key={p} className="flex items-center gap-1">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: PROVIDER_COLORS[p as AIProvider] }}
                    />
                    <span
                      className="text-[10px] font-medium"
                      style={{ color: PROVIDER_COLORS[p as AIProvider] }}
                    >
                      {PROVIDER_LABELS[p as AIProvider]}
                    </span>
                  </div>
                ))}
              </div>
              {debate.status === 'stopped' && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-warning/15 text-warning font-semibold">중단됨</span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Copy button */}
            <button
              onClick={() => void handleCopy()}
              className="p-1.5 hover:bg-bg-hover rounded-lg transition text-text-muted hover:text-text-primary"
              title="클립보드에 복사"
            >
              {shareStatus === 'copied' ? (
                <Check className="w-4 h-4 text-success" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>

            {/* Share button */}
            <button
              onClick={() => void handleShare()}
              className="p-1.5 hover:bg-bg-hover rounded-lg transition text-text-muted hover:text-accent"
              title="공유 (이메일, 카카오톡 등)"
            >
              {shareStatus === 'shared' ? (
                <Check className="w-4 h-4 text-success" />
              ) : (
                <Share2 className="w-4 h-4" />
              )}
            </button>

            {/* Close button */}
            <button
              onClick={clearSelection}
              className="p-1.5 hover:bg-bg-hover rounded-lg transition text-text-muted hover:text-text-primary"
              title="닫기"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Share feedback toast */}
        {shareStatus !== 'idle' && shareStatus !== 'failed' && (
          <div className="mt-2 text-[11px] text-success font-medium animate-fade-in-up">
            {shareStatus === 'copied' && '✓ 클립보드에 복사되었습니다'}
            {shareStatus === 'shared' && '✓ 공유되었습니다'}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {displayMessages.length === 0 ? (
          <div className="text-center text-text-muted text-sm py-12">
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
