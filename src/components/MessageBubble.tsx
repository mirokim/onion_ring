import type { AIProvider, DiscussionMessage } from '@/types'
import { PROVIDER_LABELS, PROVIDER_COLORS } from '@/types'
import { cn } from '@/lib/utils'

interface Props {
  message: DiscussionMessage
}

export function MessageBubble({ message }: Props) {
  const isUser = message.provider === 'user'
  const isError = !!message.error
  const color = isUser ? '#e0af68' : PROVIDER_COLORS[message.provider as AIProvider]
  const label = isUser ? 'You' : PROVIDER_LABELS[message.provider as AIProvider]

  return (
    <div className={cn('flex gap-3 group', isError && 'opacity-60')}>
      {/* Color bar */}
      <div
        className="w-1 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />

      {/* Content */}
      <div className="min-w-0 flex-1 py-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold" style={{ color }}>
            {label}
          </span>
          <span className="text-[10px] text-text-muted">
            R{message.round}
          </span>
          {isError && (
            <span className="text-[10px] text-error font-medium">오류</span>
          )}
        </div>
        <div className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">
          {message.content}
        </div>
      </div>
    </div>
  )
}
