import { create } from 'zustand'
import type {
  AIProvider,
  DiscussionConfig,
  DiscussionMessage,
  DiscussionStatus,
} from '@/types'
import { generateId } from '@/lib/utils'
import { runDebate } from '@/ai/debateEngine'
import { useSettingsStore } from './settingsStore'
import { useHistoryStore } from './historyStore'

// ── Helper: save debate to history ──

function saveToHistory(
  config: DiscussionConfig,
  messages: DiscussionMessage[],
  currentRound: number,
  status: 'completed' | 'stopped',
) {
  if (messages.length === 0) return
  void useHistoryStore.getState().saveDebate(
    {
      topic: config.topic,
      mode: config.mode,
      status,
      participants: config.participants,
      maxRounds: config.maxRounds,
      actualRounds: currentRound,
      messageCount: messages.length,
      createdAt: messages[0]!.timestamp,
    },
    messages,
    config.referenceFiles,
  )
}

interface DebateState {
  status: DiscussionStatus
  config: DiscussionConfig | null
  messages: DiscussionMessage[]
  currentRound: number
  currentTurnIndex: number
  loadingProvider: AIProvider | null
  abortController: AbortController | null

  // Pacing state
  countdown: number // >0 = auto countdown seconds, -1 = manual waiting, 0 = none
  waitingForNext: boolean
  _nextTurnResolver: (() => void) | null

  // Actions
  startDebate: (config: DiscussionConfig) => void
  pauseDebate: () => void
  resumeDebate: () => void
  stopDebate: () => void
  userIntervene: (content: string) => void
  nextTurn: () => void
  reset: () => void
}

export const useDebateStore = create<DebateState>()((set, get) => ({
  status: 'idle',
  config: null,
  messages: [],
  currentRound: 0,
  currentTurnIndex: 0,
  loadingProvider: null,
  abortController: null,
  countdown: 0,
  waitingForNext: false,
  _nextTurnResolver: null,

  startDebate: (config) => {
    // Abort any previous debate
    const prev = get().abortController
    if (prev) prev.abort()

    const controller = new AbortController()

    set({
      config,
      status: 'running',
      messages: [],
      currentRound: 1,
      currentTurnIndex: 0,
      loadingProvider: null,
      abortController: controller,
      countdown: 0,
      waitingForNext: false,
      _nextTurnResolver: null,
    })

    const { configs } = useSettingsStore.getState()

    // Launch the debate engine (fire-and-forget, updates come via callbacks)
    void runDebate(
      config,
      configs,
      {
        onMessage: (msg) => {
          set((state) => ({ messages: [...state.messages, msg] }))
        },
        onStatusChange: (status) => {
          set({ status })
          // Auto-save when debate completes naturally
          if (status === 'completed') {
            const { config: cfg, messages, currentRound } = get()
            if (cfg) saveToHistory(cfg, messages, currentRound, 'completed')
          }
        },
        onRoundChange: (round, turnIndex) => {
          set({ currentRound: round, currentTurnIndex: turnIndex })
        },
        onLoadingChange: (provider) => {
          set({ loadingProvider: provider })
        },
        onCountdownTick: (seconds) => {
          set({ countdown: seconds, waitingForNext: seconds === -1 })
        },
        waitForNextTurn: () =>
          new Promise<void>((resolve) => {
            set({ _nextTurnResolver: resolve, waitingForNext: true })
          }),
        getStatus: () => get().status,
        getMessages: () => get().messages,
      },
      controller.signal,
    )
  },

  pauseDebate: () => set({ status: 'paused' }),

  resumeDebate: () => set({ status: 'running' }),

  stopDebate: () => {
    // Save to history before stopping
    const { config, messages, currentRound } = get()
    if (config && messages.length > 0) {
      saveToHistory(config, messages, currentRound, 'stopped')
    }
    // Resolve pending manual turn if any
    const resolver = get()._nextTurnResolver
    if (resolver) resolver()
    get().abortController?.abort()
    set({
      status: 'completed',
      loadingProvider: null,
      countdown: 0,
      waitingForNext: false,
      _nextTurnResolver: null,
    })
  },

  userIntervene: (content) => {
    const msg: DiscussionMessage = {
      id: generateId(),
      provider: 'user',
      content,
      round: get().currentRound,
      timestamp: Date.now(),
    }
    set((state) => ({ messages: [...state.messages, msg] }))
  },

  nextTurn: () => {
    const resolver = get()._nextTurnResolver
    if (resolver) {
      resolver()
      set({ _nextTurnResolver: null, waitingForNext: false, countdown: 0 })
    }
  },

  reset: () => {
    // Resolve pending manual turn if any
    const resolver = get()._nextTurnResolver
    if (resolver) resolver()
    get().abortController?.abort()
    set({
      status: 'idle',
      config: null,
      messages: [],
      currentRound: 0,
      currentTurnIndex: 0,
      loadingProvider: null,
      abortController: null,
      countdown: 0,
      waitingForNext: false,
      _nextTurnResolver: null,
    })
  },
}))
