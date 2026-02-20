import { useState, useEffect } from 'react'
import { Eye, EyeOff, Trash2, MessageSquare, History, Sun, Moon, Settings, X } from 'lucide-react'
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

// ── Settings Modal (AI Provider Configuration) ──

function SettingsModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-bg-secondary border border-border rounded-2xl shadow-2xl overflow-hidden z-10 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <Settings className="w-4 h-4 text-text-muted" />
            <h2 className="text-sm font-bold text-text-primary">AI 설정</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-bg-hover rounded-lg transition text-text-muted hover:text-text-primary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Provider List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {PROVIDERS.map((p) => (
            <ProviderCard key={p} provider={p} />
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border shrink-0">
          <p className="text-[10px] text-text-muted leading-relaxed">
            API 키는 브라우저에 난독화되어 저장됩니다.
          </p>
        </div>
      </div>
    </div>
  )
}

function ProviderCard({ provider }: { provider: AIProvider }) {
  const { configs, updateConfig } = useSettingsStore()
  const config = configs[provider]
  const [showKey, setShowKey] = useState(false)

  const color = PROVIDER_COLORS[provider]
  const label = PROVIDER_LABELS[provider]

  return (
    <div className={cn(
      'rounded-xl border p-4 space-y-3 transition',
      config.enabled ? 'border-border bg-bg-surface' : 'border-border/50 bg-bg-primary/50',
    )}>
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className={cn('w-2.5 h-2.5 rounded-full shrink-0 transition-all', config.enabled && 'ring-2 ring-offset-1 ring-offset-bg-surface')}
            style={{ backgroundColor: config.enabled ? color : 'var(--color-text-muted)' }}
          />
          <span className="text-sm font-semibold text-text-primary">{label}</span>
          {config.enabled && config.apiKey.trim() && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-success/15 text-success font-medium">ON</span>
          )}
        </div>

        {/* Enable toggle */}
        <div className={cn(
          'relative w-9 h-5 rounded-full transition-colors cursor-pointer',
          config.enabled ? 'bg-accent' : 'bg-bg-hover',
        )}
          onClick={() => updateConfig(provider, { enabled: !config.enabled })}
        >
          <div className={cn(
            'absolute top-[3px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-transform',
            config.enabled ? 'translate-x-[19px]' : 'translate-x-[3px]',
          )} />
        </div>
      </div>

      {config.enabled && (
        <>
          {/* API Key */}
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              placeholder="API Key"
              value={config.apiKey}
              onChange={(e) => updateConfig(provider, { apiKey: e.target.value })}
              className={cn(
                'w-full px-3 py-2 pr-9 text-xs bg-bg-primary border rounded-lg transition focus:outline-none focus:ring-1',
                config.enabled && !config.apiKey.trim()
                  ? 'border-error/40 focus:ring-error/40'
                  : 'border-border focus:ring-accent/40 focus:border-accent/40',
              )}
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition"
            >
              {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Model select */}
          <select
            value={config.model}
            onChange={(e) => updateConfig(provider, { model: e.target.value })}
            className="w-full px-3 py-2 text-xs bg-bg-primary border border-border rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/40"
          >
            {MODEL_OPTIONS[provider].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  )
}

// ── History Section ──

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
      <div className="px-5 py-10 text-center">
        <History className="w-8 h-8 text-text-muted/30 mx-auto mb-3" />
        <p className="text-xs text-text-muted">아직 저장된 토론이 없습니다</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-1">
      {debates.map((d) => {
        const dateStr = formatTimestampUTC(d.createdAt, 'short')
        return (
          <div
            key={d.id}
            className="px-3 py-2.5 hover:bg-bg-hover cursor-pointer rounded-lg relative group mb-0.5 transition"
            onClick={() => selectDebate(d.id)}
            onMouseEnter={() => setHoveredId(d.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <div className="text-xs text-text-primary truncate pr-6 font-medium leading-relaxed">
              {d.mode === 'artworkEval' && <span className="mr-1">🎨</span>}
              {d.topic}
            </div>
            <div className="flex items-center gap-2 mt-1.5">
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
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-warning/15 text-warning font-medium">중단</span>
              )}
            </div>

            {/* Delete button on hover */}
            {hoveredId === d.id && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  void deleteDebate(d.id)
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-error/15 rounded-lg transition text-text-muted hover:text-error"
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

// ── Theme Toggle ──

function ThemeToggle() {
  const { theme, setTheme } = useSettingsStore()
  const isDark = theme === 'dark'
  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-bg-hover transition text-text-secondary text-xs"
    >
      {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
      <span>{isDark ? '라이트 모드' : '다크 모드'}</span>
    </button>
  )
}

// ── Provider Status Summary (compact badges for sidebar header) ──

function ProviderStatusBadges() {
  const configs = useSettingsStore((s) => s.configs)
  const enabledCount = PROVIDERS.filter((p) => configs[p].enabled && configs[p].apiKey.trim()).length

  return (
    <div className="flex items-center gap-1.5">
      {PROVIDERS.map((p) => {
        const c = configs[p]
        const active = c.enabled && c.apiKey.trim()
        return (
          <div
            key={p}
            className={cn('w-2 h-2 rounded-full transition-all', active && 'ring-1 ring-offset-1 ring-offset-bg-secondary')}
            style={{ backgroundColor: active ? PROVIDER_COLORS[p] : 'var(--color-border)' }}
            title={`${PROVIDER_LABELS[p]}: ${active ? 'ON' : 'OFF'}`}
          />
        )
      })}
      <span className="text-[10px] text-text-muted ml-0.5">{enabledCount}/{PROVIDERS.length}</span>
    </div>
  )
}

// ── Main Sidebar ──

export function Sidebar() {
  const [showSettings, setShowSettings] = useState(false)

  return (
    <>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Safe area spacer for status bar */}
        <div className="shrink-0 bg-bg-secondary safe-area-top" />

        {/* Settings button + Provider status */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
          <ProviderStatusBadges />
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-bg-hover transition text-text-muted hover:text-text-primary text-xs"
          >
            <Settings className="w-3.5 h-3.5" />
            <span className="font-medium">설정</span>
          </button>
        </div>

        {/* History Section: now takes all main space */}
        <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
          <div className="px-5 py-3 flex items-center gap-2 shrink-0">
            <History className="w-3.5 h-3.5 text-text-muted" />
            <h2 className="text-[11px] font-semibold tracking-wider text-text-muted uppercase">토론 기록</h2>
          </div>
          <HistorySection />
        </div>

        <div className="px-4 py-2.5 border-t border-border shrink-0">
          <ThemeToggle />
        </div>

        {/* Safe area spacer for home bar */}
        <div className="shrink-0 bg-bg-secondary safe-area-bottom" />
      </div>

      {/* Settings Modal */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </>
  )
}
