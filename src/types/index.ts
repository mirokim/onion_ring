// ── App Types ──

export type ThemeId = 'light' | 'dark'

// ── Provider Types ──

export type AIProvider = 'openai' | 'anthropic' | 'gemini'

export interface AIConfig {
  provider: AIProvider
  apiKey: string
  model: string
  enabled: boolean
}

// ── Discussion Types ──

export type DiscussionMode = 'roundRobin' | 'freeDiscussion' | 'roleAssignment'
export type DiscussionStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error'

export interface RoleConfig {
  provider: AIProvider
  role: string
}

export type PacingMode = 'auto' | 'manual'

export interface PacingConfig {
  mode: PacingMode
  autoDelaySeconds: number // 5, 10, 15, 30
}

export interface ReferenceFile {
  id: string
  filename: string
  mimeType: string
  size: number
  dataUrl: string        // data:image/png;base64,... format
  textContent?: string   // extracted text for text-only fallback
}

export interface DiscussionConfig {
  mode: DiscussionMode
  topic: string
  maxRounds: number
  participants: AIProvider[]
  roles: RoleConfig[]
  referenceText: string
  useReference: boolean
  referenceFiles: ReferenceFile[]
  pacing: PacingConfig
}

export interface DiscussionMessage {
  id: string
  provider: AIProvider | 'user'
  content: string
  round: number
  timestamp: number
  error?: string
}

// ── API Types ──

export interface TextContent { type: 'text'; text: string }
export interface ImageContent { type: 'image'; mimeType: string; data: string }
export interface DocumentContent { type: 'document'; mimeType: string; data: string }
export type ContentBlock = TextContent | ImageContent | DocumentContent

export interface ApiMessage {
  role: string
  content: string | ContentBlock[]
}

export interface ProviderResponse {
  content: string
  stopReason: 'end' | 'error'
}

// ── Debate Engine Callbacks ──

export interface DebateCallbacks {
  onMessage: (msg: DiscussionMessage) => void
  onStatusChange: (status: DiscussionStatus) => void
  onRoundChange: (round: number, turnIndex: number) => void
  onLoadingChange: (provider: AIProvider | null) => void
  onCountdownTick: (secondsRemaining: number) => void
  waitForNextTurn: () => Promise<void>
  getStatus: () => DiscussionStatus
  getMessages: () => DiscussionMessage[]
}

// ── Constants ──

export const PROVIDERS: AIProvider[] = ['openai', 'anthropic', 'gemini']

export const PROVIDER_LABELS: Record<AIProvider, string> = {
  openai: 'GPT',
  anthropic: 'Claude',
  gemini: 'Gemini',
}

export const PROVIDER_COLORS: Record<AIProvider, string> = {
  openai: '#a6e3a1',
  anthropic: '#cba6f7',
  gemini: '#89b4fa',
}

export const DEFAULT_MODELS: Record<AIProvider, string> = {
  openai: 'gpt-4.1',
  anthropic: 'claude-sonnet-4-5-20250929',
  gemini: 'gemini-2.5-flash',
}

export const MODEL_OPTIONS: Record<AIProvider, string[]> = {
  openai: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'o4-mini'],
  anthropic: ['claude-sonnet-4-5-20250929', 'claude-sonnet-4-20250514', 'claude-haiku-4-20250414'],
  gemini: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
}

export const ROLE_OPTIONS = [
  { value: 'pro', label: '찬성' },
  { value: 'con', label: '반대' },
  { value: 'neutral', label: '중립' },
  { value: 'optimist', label: '낙관론자' },
  { value: 'realist', label: '현실론자' },
  { value: 'devil', label: '악마의 변호인' },
] as const
