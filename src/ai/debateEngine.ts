import type {
  AIProvider,
  AIConfig,
  ApiMessage,
  DiscussionConfig,
  DiscussionMessage,
  DebateCallbacks,
  ReferenceFile,
  ContentBlock,
} from '@/types'
import { PROVIDER_LABELS } from '@/types'
import { callProvider } from './providers'
import { generateId } from '@/lib/utils'

// ── System Prompt Builders ──

function buildSystemPrompt(
  config: DiscussionConfig,
  currentProvider: AIProvider,
): string {
  const label = PROVIDER_LABELS[currentProvider]
  const participantList = config.participants
    .map((p) => PROVIDER_LABELS[p])
    .join(', ')

  const base = `당신은 "${label}"입니다. 여러 AI가 참여하는 토론에 참가하고 있습니다.
토론 주제: "${config.topic}"
참여자: ${participantList}

규칙:
- 한국어로 답변하세요.
- 간결하고 핵심적으로 답변하세요 (200~400자).
- 다른 참여자의 의견을 구체적으로 언급하며 발전시키세요.
- "[GPT]:", "[Claude]:", "[Gemini]:" 형식의 라벨은 다른 참여자의 발언입니다.
- "[User]:" 라벨은 토론을 지켜보는 사용자의 개입입니다. 사용자의 질문이나 요청에 우선적으로 응답하세요.`

  let prompt: string

  switch (config.mode) {
    case 'roundRobin':
      prompt = `${base}

토론 방식: 라운드 로빈 (순서대로 발언)
이전 발언자의 의견을 참고하여 동의/반박/보완하며 자신의 의견을 제시하세요.`
      break

    case 'freeDiscussion':
      prompt = `${base}

토론 방식: 자유 토론
다른 참여자의 의견에 자유롭게 반박, 동의, 질문, 보완을 하세요.
때로는 완전히 새로운 관점을 제시해도 좋습니다.`
      break

    case 'roleAssignment': {
      const roleConfig = config.roles.find((r) => r.provider === currentProvider)
      const role = roleConfig?.role || '중립'
      prompt = `${base}

토론 방식: 역할 배정
당신에게 배정된 역할: **${role}**
이 역할의 관점에서 일관되게 논의하세요. 역할에 충실하되 논리적으로 주장하세요.`
      break
    }

    default:
      prompt = base
  }

  // Append reference text if enabled
  if (config.useReference && config.referenceText.trim()) {
    prompt += `\n\n참고 자료:\n"""\n${config.referenceText.trim()}\n"""\n\n위 참고 자료를 바탕으로 토론하세요. 자료의 내용을 인용하거나 분석하며 논의를 전개하세요.`
  }

  // Hint about attached files
  if (config.referenceFiles.length > 0) {
    prompt += `\n\n첨부된 이미지/문서 파일이 참고 자료로 제공됩니다. 해당 자료를 분석하고 토론에 활용하세요.`
  }

  return prompt
}

// ── Build file content blocks ──

function buildFileBlocks(files: ReferenceFile[]): ContentBlock[] {
  const blocks: ContentBlock[] = []
  for (const file of files) {
    const base64Data = file.dataUrl.split(',')[1] || ''
    if (file.mimeType.startsWith('image/')) {
      blocks.push({ type: 'image', mimeType: file.mimeType, data: base64Data })
    } else if (file.mimeType === 'application/pdf') {
      blocks.push({ type: 'document', mimeType: file.mimeType, data: base64Data })
    }
  }
  return blocks
}

// ── Message Formatting ──

function buildApiMessages(
  allMessages: DiscussionMessage[],
  currentProvider: AIProvider,
  referenceFiles: ReferenceFile[],
  isFirstCall: boolean,
): ApiMessage[] {
  const recent = allMessages.slice(-15)
  const fileBlocks = isFirstCall && referenceFiles.length > 0
    ? buildFileBlocks(referenceFiles)
    : []

  // If this is the first message (no history), add the topic as initial prompt
  if (recent.length === 0) {
    const text = '토론을 시작해주세요. 주제에 대한 당신의 의견을 먼저 제시하세요.'
    if (fileBlocks.length > 0) {
      return [{ role: 'user', content: [{ type: 'text', text }, ...fileBlocks] }]
    }
    return [{ role: 'user', content: text }]
  }

  return recent.map((msg, index) => {
    if (msg.provider === currentProvider) {
      return { role: 'assistant', content: msg.content }
    }

    const label = msg.provider === 'user'
      ? 'User'
      : PROVIDER_LABELS[msg.provider as AIProvider]
    const prefix = msg.provider === 'user' ? '[User]' : `[${label}]`
    const text = `${prefix}: ${msg.content}`

    // Inject reference files into the first user-role message of the first call
    if (index === 0 && fileBlocks.length > 0) {
      return { role: 'user', content: [{ type: 'text' as const, text }, ...fileBlocks] }
    }

    return { role: 'user', content: text }
  })
}

// ── Sleep utility ──

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ── Main Debate Engine ──

export async function runDebate(
  config: DiscussionConfig,
  providerConfigs: Record<AIProvider, AIConfig>,
  callbacks: DebateCallbacks,
  signal: AbortSignal,
): Promise<void> {
  let consecutiveErrors = 0
  const providersFirstCallDone = new Set<AIProvider>()

  callbacks.onStatusChange('running')

  for (let round = 1; round <= config.maxRounds; round++) {
    for (let turnIndex = 0; turnIndex < config.participants.length; turnIndex++) {
      // Check abort
      if (signal.aborted) return

      // Wait while paused
      while (callbacks.getStatus() === 'paused') {
        await sleep(500)
        if (signal.aborted) return
      }

      // Check if stopped externally
      if (callbacks.getStatus() !== 'running') return

      const provider = config.participants[turnIndex]!
      const providerConfig = providerConfigs[provider]

      // Skip if provider not configured
      if (!providerConfig || !providerConfig.apiKey.trim()) {
        continue
      }

      callbacks.onRoundChange(round, turnIndex)
      callbacks.onLoadingChange(provider)

      // Build prompt and messages
      const isFirstCall = !providersFirstCallDone.has(provider)
      const systemPrompt = buildSystemPrompt(config, provider)
      const apiMessages = buildApiMessages(
        callbacks.getMessages(),
        provider,
        config.referenceFiles,
        isFirstCall,
      )

      // Call the AI
      const response = await callProvider(
        provider,
        providerConfig.apiKey,
        providerConfig.model,
        systemPrompt,
        apiMessages,
        signal,
      )

      // If aborted during the call, exit gracefully
      if (signal.aborted) return

      callbacks.onLoadingChange(null)

      // Create message
      const isError = response.stopReason === 'error'
      const message: DiscussionMessage = {
        id: generateId(),
        provider,
        content: response.content,
        round,
        timestamp: Date.now(),
        error: isError ? response.content : undefined,
      }

      callbacks.onMessage(message)

      // Mark first call done (only on success)
      if (!isError) {
        providersFirstCallDone.add(provider)
      }

      // Track consecutive errors
      if (isError) {
        consecutiveErrors++
        if (consecutiveErrors >= 2) {
          callbacks.onStatusChange('paused')
          while (callbacks.getStatus() === 'paused') {
            await sleep(500)
            if (signal.aborted) return
          }
          if (callbacks.getStatus() !== 'running') return
          consecutiveErrors = 0
        }
      } else {
        consecutiveErrors = 0
      }

      // ── Pacing between turns ──
      if (!signal.aborted) {
        if (config.pacing.mode === 'manual') {
          callbacks.onCountdownTick(-1)
          await callbacks.waitForNextTurn()
          if (signal.aborted) return
          if (callbacks.getStatus() !== 'running') return
          callbacks.onCountdownTick(0)
        } else {
          const totalSeconds = config.pacing.autoDelaySeconds
          for (let s = totalSeconds; s > 0; s--) {
            if (signal.aborted) return
            while (callbacks.getStatus() === 'paused') {
              await sleep(500)
              if (signal.aborted) return
            }
            if (callbacks.getStatus() !== 'running') return
            callbacks.onCountdownTick(s)
            await sleep(1000)
          }
          callbacks.onCountdownTick(0)
        }
      }
    }
  }

  callbacks.onLoadingChange(null)
  callbacks.onStatusChange('completed')
}
