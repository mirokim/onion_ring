import { useState, useEffect } from 'react'
import { PanelLeftClose, PanelLeftOpen, Zap } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { useDebateStore } from '@/stores/debateStore'
import { useHistoryStore } from '@/stores/historyStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { Sidebar } from '@/components/Sidebar'
import { TopicInput } from '@/components/TopicInput'
import { ControlBar } from '@/components/ControlBar'
import { DebateThread } from '@/components/DebateThread'
import { UserIntervention } from '@/components/UserIntervention'
import { HistoryViewer } from '@/components/HistoryViewer'
import { cn } from '@/lib/utils'

const isMobile = Capacitor.isNativePlatform() || window.innerWidth < 768

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile)
  const status = useDebateStore((s) => s.status)
  const topic = useDebateStore((s) => s.config?.topic)
  const selectedDebateId = useHistoryStore((s) => s.selectedDebateId)
  const theme = useSettingsStore((s) => s.theme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    if (Capacitor.isNativePlatform()) {
      void StatusBar.setStyle({ style: theme === 'dark' ? Style.Dark : Style.Light })
      void StatusBar.setBackgroundColor({
        color: theme === 'dark' ? '#1a1b26' : '#f8f9fa',
      })
    }
  }, [theme])

  const isDebating = status !== 'idle'
  const isViewingHistory = selectedDebateId !== null && !isDebating

  return (
    <div className="h-screen flex bg-bg-primary text-text-primary overflow-hidden">
      {/* Sidebar backdrop (mobile overlay) */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          isMobile
            ? 'fixed left-0 top-0 bottom-0 z-50 w-72 transition-transform duration-200'
            : 'w-72 shrink-0',
          isMobile && !sidebarOpen && '-translate-x-full',
          !isMobile && !sidebarOpen && 'hidden',
          'border-r border-border bg-bg-secondary flex flex-col overflow-hidden',
        )}
      >
        <Sidebar />
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-12 border-b border-border flex items-center px-4 gap-3 shrink-0 bg-bg-secondary">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition"
          >
            {sidebarOpen ? (
              <PanelLeftClose className="w-[18px] h-[18px]" />
            ) : (
              <PanelLeftOpen className="w-[18px] h-[18px]" />
            )}
          </button>

          <div className="h-5 w-px bg-border" />

          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-accent" />
            <span className="text-sm font-bold tracking-wide text-text-primary">
              Multi-AI Debate
            </span>
          </div>

          {isDebating && (
            <>
              <div className="h-5 w-px bg-border" />
              <span className="text-xs text-text-muted truncate max-w-md">
                {topic}
              </span>
            </>
          )}
        </header>

        {/* Content */}
        {isViewingHistory ? (
          <HistoryViewer />
        ) : !isDebating ? (
          <TopicInput />
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            <ControlBar />
            <DebateThread />
            <UserIntervention />
          </div>
        )}
      </main>
    </div>
  )
}
