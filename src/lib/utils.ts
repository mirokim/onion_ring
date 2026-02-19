import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { Capacitor } from '@capacitor/core'
import { Share } from '@capacitor/share'
import type { AIProvider } from '@/types'
import { PROVIDER_LABELS } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateId(): string {
  return crypto.randomUUID()
}

export function formatTimestampUTC(ms: number, style: 'short' | 'full' = 'short'): string {
  const d = new Date(ms)
  const M = d.getUTCMonth() + 1
  const D = d.getUTCDate()
  const h = String(d.getUTCHours()).padStart(2, '0')
  const m = String(d.getUTCMinutes()).padStart(2, '0')
  if (style === 'short') return `${M}/${D} ${h}:${m}`
  const Y = d.getUTCFullYear()
  return `${Y}.${String(M).padStart(2, '0')}.${String(D).padStart(2, '0')} ${h}:${m} UTC`
}

// ── Share helpers ──

interface ShareableMessage {
  provider: AIProvider | 'user'
  content: string
  round: number
  error?: string
}

const MODE_LABELS_MAP: Record<string, string> = {
  roundRobin: '라운드 로빈',
  freeDiscussion: '자유 토론',
  roleAssignment: '역할 배정',
  battle: '결전모드',
}

export function formatDebateForShare(
  topic: string,
  mode: string,
  participants: string[],
  messages: ShareableMessage[],
  date: string,
): string {
  const lines: string[] = []

  lines.push(`📋 AI 토론 기록`)
  lines.push(``)
  lines.push(`주제: ${topic}`)
  lines.push(`모드: ${MODE_LABELS_MAP[mode] || mode}`)
  lines.push(`참여자: ${participants.map((p) => PROVIDER_LABELS[p as AIProvider] || p).join(', ')}`)
  lines.push(`일시: ${date}`)
  lines.push(``)
  lines.push(`${'─'.repeat(30)}`)
  lines.push(``)

  let lastRound = 0
  for (const msg of messages) {
    if (msg.error) continue

    if (msg.round !== lastRound) {
      if (lastRound > 0) lines.push(``)
      lines.push(`── 라운드 ${msg.round} ──`)
      lines.push(``)
      lastRound = msg.round
    }

    const label = msg.provider === 'user'
      ? '👤 사용자'
      : `🤖 ${PROVIDER_LABELS[msg.provider as AIProvider] || msg.provider}`

    lines.push(`[${label}]`)
    lines.push(msg.content)
    lines.push(``)
  }

  lines.push(`${'─'.repeat(30)}`)
  lines.push(`Onion Ring - AI 토론 앱으로 생성됨`)

  return lines.join('\n')
}

export async function shareText(title: string, text: string): Promise<'shared' | 'copied' | 'failed'> {
  // 1) Native Capacitor Share (Android/iOS — opens native share sheet: KakaoTalk, email, SMS, etc.)
  if (Capacitor.isNativePlatform()) {
    try {
      await Share.share({
        title,
        text,
        dialogTitle: title,
      })
      return 'shared'
    } catch {
      // User cancelled or share failed — fall through to clipboard
    }
  }

  // 2) Web Share API (desktop Chrome, etc.)
  if (navigator.share) {
    try {
      await navigator.share({ title, text })
      return 'shared'
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return 'failed'
      }
    }
  }

  // 3) Fallback: clipboard
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'failed'
  }
}
