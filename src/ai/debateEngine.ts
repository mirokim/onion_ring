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
import { PROVIDER_LABELS, ROLE_OPTIONS, ROLE_DESCRIPTIONS } from '@/types'
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
- "[User]:" 라벨은 토론을 지켜보는 사용자의 개입입니다. 사용자의 질문이나 요청에 우선적으로 응답하세요.

정확성 및 신뢰성 원칙 (반드시 준수):
- 사실 관계를 언급할 때는 반드시 출처를 밝히거나 링크를 제공하세요.
- 사실, 이름, 도구, 기능, 날짜, 통계, 인용구, 출처 또는 예시를 절대 지어내지 마세요.
- 모르는 정보에 대해서는 말을 지어내지 말고 반드시 "모릅니다" 또는 "확인이 필요합니다"라고 답하세요. 모른다고 말하는 것이 틀린 답보다 낫습니다.
- 항상 현재 기준 최신 정보를 기반으로 답변하세요. 오래된 정보는 그 시점을 명시하세요.
- 명시적으로 요청받지 않는 한 과장, 설득, 추측 또는 스토리텔링을 피하세요.
- 사용자의 의도, 제약 조건, 선호도 또는 목표를 추론하지 마세요. 불확실하면 추측 대신 질문하세요.
- 확신도가 95% 미만인 정보는 불확실성을 명확히 밝히세요. 예: "확인이 필요합니다", "정보가 부족합니다", "~로 알고 있으나 검증이 필요합니다".`

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
      const roleLabel = roleConfig?.role || '중립'

      // Look up detailed description from ROLE_DESCRIPTIONS
      const roleOption = ROLE_OPTIONS.find((r) => r.label === roleLabel)
      const roleDescription = roleOption
        ? ROLE_DESCRIPTIONS[roleOption.value] || ''
        : ''

      prompt = `${base}

토론 방식: 역할 배정
당신에게 배정된 역할: **${roleLabel}**
${roleDescription}
이 역할의 관점과 말투를 일관되게 유지하며 논의하세요.`
      break
    }

    case 'battle': {
      const isJudge = config.judgeProvider === currentProvider
      if (isJudge) {
        const debaters = config.participants
          .filter((p) => p !== config.judgeProvider)
          .map((p) => PROVIDER_LABELS[p])
          .join(' vs ')
        prompt = `${base}

토론 방식: 결전모드 (심판)
당신은 이 토론의 **심판**입니다. 토론에 직접 참여하지 않습니다.
대결 구도: ${debaters}

각 라운드가 끝나면 다음 형식으로 평가하세요:

📊 **라운드 [N] 평가**

| 참여자 | 점수 (10점 만점) | 평가 |
|--------|-----------------|------|
| [AI이름] | X점 | 한줄 평가 |

💬 **심판 코멘트**: 이번 라운드의 핵심 쟁점과 각 참여자의 강점/약점을 분석하세요.
🏆 **라운드 승자**: [AI이름]

채점 기준: 논리성(3점), 근거의 질(3점), 반박력(2점), 설득력(2점)

최종 라운드에서는 추가로:
🏅 **최종 승자**: [AI이름]
📝 **종합 평가**: 전체 토론을 종합적으로 평가하고 각 참여자의 전체 성적을 정리하세요.`
      } else {
        const debaters = config.participants
          .filter((p) => p !== config.judgeProvider)
          .map((p) => PROVIDER_LABELS[p])
        const opponents = debaters.filter((n) => n !== label).join(', ')
        const judgeName = config.judgeProvider
          ? PROVIDER_LABELS[config.judgeProvider]
          : '심판'

        // Check if this debater has a role assigned
        const roleConfig = config.roles.find((r) => r.provider === currentProvider)
        const roleLabel = roleConfig?.role
        const roleOption = roleLabel ? ROLE_OPTIONS.find((r) => r.label === roleLabel) : null
        const roleDescription = roleOption ? ROLE_DESCRIPTIONS[roleOption.value] || '' : ''
        const roleSection = roleLabel && roleLabel !== '중립'
          ? `\n\n당신의 캐릭터: **${roleLabel}**\n${roleDescription}\n이 캐릭터의 말투와 성격을 유지하면서 토론하세요.`
          : ''

        prompt = `${base}

토론 방식: 결전모드 (토론자)
이것은 경쟁 토론입니다. 상대방: ${opponents}
심판: ${judgeName} (매 라운드 채점)

목표: 심판에게 높은 점수를 받아 승리하세요.
- 강력한 논거와 구체적 근거를 제시하세요.
- 상대방의 약점을 정확히 지적하고 반박하세요.
- 논리성, 근거의 질, 반박력, 설득력이 채점 기준입니다.
- 심판의 이전 피드백을 반영하여 전략을 조정하세요.${roleSection}`
      }
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
    const judgeTag = msg.messageType === 'judge-evaluation' ? ' (심판 평가)' : ''
    const text = `${prefix}${judgeTag}: ${msg.content}`

    // Build content blocks for this message
    const msgFileBlocks = msg.files && msg.files.length > 0
      ? buildFileBlocks(msg.files)
      : []

    // Inject reference files into the first user-role message of the first call
    const extraBlocks = index === 0 ? [...fileBlocks, ...msgFileBlocks] : msgFileBlocks

    if (extraBlocks.length > 0) {
      return { role: 'user', content: [{ type: 'text' as const, text }, ...extraBlocks] }
    }

    return { role: 'user', content: text }
  })
}

// ── Judge-specific message builder ──

function buildJudgeApiMessages(
  allMessages: DiscussionMessage[],
  currentRound: number,
  judgeProvider: AIProvider,
): ApiMessage[] {
  // Include all non-judge messages for context
  const relevantMessages = allMessages.filter((msg) => msg.provider !== judgeProvider || msg.messageType === 'judge-evaluation')
  const recent = relevantMessages.slice(-20)

  if (recent.length === 0) {
    return [{ role: 'user', content: `라운드 ${currentRound}의 토론을 평가해주세요.` }]
  }

  const messages: ApiMessage[] = recent.map((msg) => {
    // Judge's own previous evaluations → assistant role
    if (msg.provider === judgeProvider) {
      return { role: 'assistant', content: msg.content }
    }

    const label = msg.provider === 'user'
      ? 'User'
      : PROVIDER_LABELS[msg.provider as AIProvider]
    return {
      role: 'user',
      content: `[${label}] (라운드 ${msg.round}): ${msg.content}`,
    }
  })

  messages.push({
    role: 'user',
    content: `위 토론 내용을 바탕으로 라운드 ${currentRound}을 평가해주세요.${currentRound === allMessages[0]?.round ? '' : ` (총 ${allMessages.filter((m) => m.round === currentRound && m.provider !== judgeProvider && m.provider !== 'user').length}명의 토론자 발언 완료)`}`,
  })

  return messages
}

// ── Sleep utility ──

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ── Pacing helper ──

async function doPacing(
  config: DiscussionConfig,
  callbacks: DebateCallbacks,
  signal: AbortSignal,
): Promise<boolean> {
  if (signal.aborted) return false

  if (config.pacing.mode === 'manual') {
    callbacks.onCountdownTick(-1)
    await callbacks.waitForNextTurn()
    if (signal.aborted) return false
    if (callbacks.getStatus() !== 'running') return false
    callbacks.onCountdownTick(0)
  } else {
    const totalSeconds = config.pacing.autoDelaySeconds
    for (let s = totalSeconds; s > 0; s--) {
      if (signal.aborted) return false
      while (callbacks.getStatus() === 'paused') {
        await sleep(500)
        if (signal.aborted) return false
      }
      if (callbacks.getStatus() !== 'running') return false
      callbacks.onCountdownTick(s)
      await sleep(1000)
    }
    callbacks.onCountdownTick(0)
  }

  return true
}

// ── Wait while paused helper ──

async function waitWhilePaused(
  callbacks: DebateCallbacks,
  signal: AbortSignal,
): Promise<boolean> {
  while (callbacks.getStatus() === 'paused') {
    await sleep(500)
    if (signal.aborted) return false
  }
  return callbacks.getStatus() === 'running'
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

  // Battle mode: separate debaters from judge
  const isBattleMode = config.mode === 'battle' && !!config.judgeProvider
  const turnParticipants = isBattleMode
    ? config.participants.filter((p) => p !== config.judgeProvider)
    : config.participants

  // Helper: get role name for a provider
  const getRoleName = (provider: AIProvider): string | undefined => {
    if (config.mode === 'battle' && config.judgeProvider === provider) {
      return '심판'
    }
    if (config.mode === 'roleAssignment' || config.mode === 'battle') {
      const rc = config.roles.find((r) => r.provider === provider)
      if (rc?.role && rc.role !== '중립') return rc.role
    }
    return undefined
  }

  callbacks.onStatusChange('running')

  for (let round = 1; round <= config.maxRounds; round++) {
    // ── Debater turns ──
    for (let turnIndex = 0; turnIndex < turnParticipants.length; turnIndex++) {
      // Check abort
      if (signal.aborted) return

      // Wait while paused
      if (!await waitWhilePaused(callbacks, signal)) return

      const provider = turnParticipants[turnIndex]!
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
        roleName: getRoleName(provider),
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
          if (!await waitWhilePaused(callbacks, signal)) return
          consecutiveErrors = 0
        }
      } else {
        consecutiveErrors = 0
      }

      // ── Pacing between turns ──
      if (!await doPacing(config, callbacks, signal)) return
    }

    // ── Judge turn (battle mode only) ──
    if (isBattleMode && config.judgeProvider) {
      if (signal.aborted) return
      if (!await waitWhilePaused(callbacks, signal)) return

      const judgeProvider = config.judgeProvider
      const judgeConfig = providerConfigs[judgeProvider]

      if (judgeConfig && judgeConfig.apiKey.trim()) {
        callbacks.onLoadingChange(judgeProvider)

        const judgeSystemPrompt = buildSystemPrompt(config, judgeProvider)
        const judgeMessages = buildJudgeApiMessages(
          callbacks.getMessages(),
          round,
          judgeProvider,
        )

        const judgeResponse = await callProvider(
          judgeProvider,
          judgeConfig.apiKey,
          judgeConfig.model,
          judgeSystemPrompt,
          judgeMessages,
          signal,
        )

        if (signal.aborted) return
        callbacks.onLoadingChange(null)

        const isError = judgeResponse.stopReason === 'error'
        const judgeMessage: DiscussionMessage = {
          id: generateId(),
          provider: judgeProvider,
          content: judgeResponse.content,
          round,
          timestamp: Date.now(),
          error: isError ? judgeResponse.content : undefined,
          messageType: 'judge-evaluation',
          roleName: '심판',
        }

        callbacks.onMessage(judgeMessage)

        if (!isError) {
          providersFirstCallDone.add(judgeProvider)
        }

        if (isError) {
          consecutiveErrors++
          if (consecutiveErrors >= 2) {
            callbacks.onStatusChange('paused')
            if (!await waitWhilePaused(callbacks, signal)) return
            consecutiveErrors = 0
          }
        } else {
          consecutiveErrors = 0
        }

        // Pacing after judge turn
        if (!await doPacing(config, callbacks, signal)) return
      }
    }
  }

  callbacks.onLoadingChange(null)
  callbacks.onStatusChange('completed')
}
