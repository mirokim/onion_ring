import { useState, useEffect } from 'react'
import { Eye, EyeOff, ChevronDown, ChevronRight, Trash2, MessageSquare, History, Sun, Moon } from 'lucide-react'
import { useSettingsStore } from '@/stores/settingsStore'
import { useHistoryStore } from '@/stores/historyStore'
import { cn, formatTimestampUTC } from '@/lib/utils'
import {
  PROVIDERS,
  PROVIDER_LABELS,
  PROVIDER_COLORS,
  MODEL_OPTIONS,
  type AIProvider,
} from '@/types'

function ProviderSection({ provider }: { provider: AIProvider }) {
  const { configs, updateConfig } = useSettingsStore()
  const config = configs[provider]
  const [showKey, setShowKey] = useState(false)
  const [expanded, setExpanded] = useState(config.enabled)

  const color = PROVIDER_COLORS[provider]
  const label = PROVIDER_LABELS[provider]

  return (
    <div className="border-b border-border">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-bg-hover transition text-left"
      >
        <div
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: config.enabled ? color : 'var(--color-text-muted)' }}
        />
        <span className="flex-1 text-sm font-medium text-text-primary">{label}</span>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-text-muted" />
        ) : (
          <ChevronRight className="w-4 h-4 text-text-muted" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-2.5">
          {/* Enable toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => updateConfig(provider, { enabled: e.target.checked })}
              className="accent-accent"
            />
            <span className="text-xs text-text-secondary">활성화</span>
          </label>

          {/* API Key */}
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              placeholder="API Key"
              value={config.apiKey}
              onChange={(e) => updateConfig(provider, { apiKey: e.target.value })}
              className={cn(
                'w-full px-2.5 py-1.5 pr-8 text-xs bg-bg-primary border rounded',
                config.enabled && !config.apiKey.trim()
                  ? 'border-error/50'
                  : 'border-border',
              )}
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
            >
              {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Model select */}
          <select
            value={config.model}
            onChange={(e) => updateConfig(provider, { model: e.target.value })}
            className="w-full px-2.5 py-1.5 text-xs bg-bg-primary border border-border rounded text-text-primary"
          >
            {MODEL_OPTIONS[provider].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}

function HistorySection() {
  const debates = useHistoryStore((s) => s.debates)
  const selectDebate = useHistoryStore((s) => s.selectDebate)
  const deleteDebate = useHistoryStore((s) => s.deleteDebate)
  const loadDebates = useHistoryStore((s) => s.loadDebates)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  useEffect(() => {
    void loadDebates()
  }, [loadDebates])

  if (debates.length === 0) {
    return (
      <div className="px-4 py-3">
        <p className="text-[11px] text-text-muted">아직 저장된 토론이 없습니다</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {debates.map((d) => {
        const dateStr = formatTimestampUTC(d.createdAt, 'short')
        return (
          <div
            key={d.id}
            className="px-4 py-2.5 hover:bg-bg-hover cursor-pointer border-b border-border/50 relative group"
            onClick={() => selectDebate(d.id)}
            onMouseEnter={() => setHoveredId(d.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <div className="text-xs text-text-primary truncate pr-6 font-medium">
              {d.topic}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-text-muted">{dateStr}</span>
              <div className="flex items-center gap-0.5">
                {d.participants.map((p) => (
                  <div
                    key={p}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: PROVIDER_COLORS[p as AIProvider] }}
                  />
                ))}
              </div>
              <span className="text-[10px] text-text-muted flex items-center gap-0.5">
                <MessageSquare className="w-2.5 h-2.5" />
                {d.messageCount}
              </span>
              {d.status === 'stopped' && (
                <span className="text-[10px] text-warning">중단</span>
              )}
            </div>

            {/* Delete button on hover */}
            {hoveredId === d.id && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  void deleteDebate(d.id)
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-error/20 rounded transition text-text-muted hover:text-error"
                title="삭제"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ThemeToggle() {
  const { theme, setTheme } = useSettingsStore()
  const isDark = theme === 'dark'
  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-bg-hover transition text-text-secondary text-xs"
    >
      {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
      <span>{isDark ? '라이트 모드' : '다크 모드'}</span>
    </button>
  )
}

export function Sidebar() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-xs font-bold tracking-widest text-text-muted uppercase">Settings</h2>
      </div>

      <div className="overflow-y-auto">
        {PROVIDERS.map((p) => (
          <ProviderSection key={p} provider={p} />
        ))}
      </div>

      {/* History Section */}
      <div className="border-t border-border flex flex-col min-h-0 flex-1">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <History className="w-3.5 h-3.5 text-text-muted" />
          <h2 className="text-xs font-bold tracking-widest text-text-muted uppercase">History</h2>
        </div>
        <HistorySection />
      </div>

      <div className="px-4 py-3 border-t border-border shrink-0 space-y-2">
        <ThemeToggle />
        <p className="text-[10px] text-text-muted leading-relaxed">
          API 키는 브라우저에 난독화되어 저장됩니다. 서버로 전송되지 않습니다.
        </p>
      </div>
    </div>
  )
}
