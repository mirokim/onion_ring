import { Pause, Play, Square, RotateCcw, SkipForward } from 'lucide-react'
import { useDebateStore } from '@/stores/debateStore'
import { PROVIDER_LABELS, PROVIDER_COLORS, type AIProvider } from '@/types'
import { cn } from '@/lib/utils'

const STATUS_LABELS: Record<string, string> = {
  running: '진행 중',
  paused: '일시 정지',
  completed: '완료',
  error: '오류',
}

export function ControlBar() {
  const status = useDebateStore((s) => s.status)
  const config = useDebateStore((s) => s.config)
  const currentRound = useDebateStore((s) => s.currentRound)
  const loadingProvider = useDebateStore((s) => s.loadingProvider)
  const countdown = useDebateStore((s) => s.countdown)
  const waitingForNext = useDebateStore((s) => s.waitingForNext)
  const pauseDebate = useDebateStore((s) => s.pauseDebate)
  const resumeDebate = useDebateStore((s) => s.resumeDebate)
  const stopDebate = useDebateStore((s) => s.stopDebate)
  const nextTurn = useDebateStore((s) => s.nextTurn)
  const reset = useDebateStore((s) => s.reset)

  const maxRounds = config?.maxRounds || 3

  return (
    <div className="h-11 border-b border-border flex items-center justify-between px-4 shrink-0 bg-bg-secondary">
      {/* Left: status info */}
      <div className="flex items-center gap-3 text-xs">
        <span className="text-text-secondary">
          라운드 <span className="text-accent font-bold">{currentRound}</span>/{maxRounds}
        </span>
        <span className="text-text-muted">·</span>
        <span
          className={cn(
            'font-medium',
            status === 'running' && 'text-success',
            status === 'paused' && 'text-warning',
            status === 'completed' && 'text-accent',
            status === 'error' && 'text-error',
          )}
        >
          {STATUS_LABELS[status] || status}
        </span>

        {/* Currently speaking indicator */}
        {loadingProvider && (
          <>
            <span className="text-text-muted">·</span>
            <span className="flex items-center gap-1.5">
              <div
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ backgroundColor: PROVIDER_COLORS[loadingProvider] }}
              />
              <span style={{ color: PROVIDER_COLORS[loadingProvider] }} className="text-xs">
                {PROVIDER_LABELS[loadingProvider]} 응답 중
              </span>
            </span>
          </>
        )}

        {/* Countdown timer */}
        {countdown > 0 && (
          <>
            <span className="text-text-muted">·</span>
            <span className="text-xs text-warning font-mono">{countdown}s</span>
          </>
        )}

        {/* Manual "Next Turn" button */}
        {waitingForNext && (
          <>
            <span className="text-text-muted">·</span>
            <button
              onClick={nextTurn}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-accent bg-accent/15 rounded-lg hover:bg-accent/25 transition animate-pulse"
            >
              <SkipForward className="w-3.5 h-3.5" />
              다음 턴
            </button>
          </>
        )}

        {/* Participant badges */}
        {config && status !== 'idle' && (
          <>
            <span className="text-text-muted">·</span>
            <div className="flex items-center gap-1">
              {config.participants.map((p: AIProvider) => (
                <div
                  key={p}
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: PROVIDER_COLORS[p] }}
                  title={PROVIDER_LABELS[p]}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Right: control buttons */}
      <div className="flex items-center gap-1">
        {status === 'running' && (
          <button
            onClick={pauseDebate}
            className="p-2.5 hover:bg-bg-hover rounded transition text-text-secondary hover:text-warning"
            title="일시 정지"
          >
            <Pause className="w-4 h-4" />
          </button>
        )}
        {status === 'paused' && (
          <button
            onClick={resumeDebate}
            className="p-2.5 hover:bg-bg-hover rounded transition text-text-secondary hover:text-success"
            title="계속하기"
          >
            <Play className="w-4 h-4" />
          </button>
        )}
        {(status === 'running' || status === 'paused') && (
          <button
            onClick={stopDebate}
            className="p-2.5 hover:bg-bg-hover rounded transition text-text-secondary hover:text-error"
            title="종료"
          >
            <Square className="w-4 h-4" />
          </button>
        )}
        {(status === 'completed' || status === 'error') && (
          <button
            onClick={reset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10 rounded-lg transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            새 토론
          </button>
        )}
      </div>
    </div>
  )
}
