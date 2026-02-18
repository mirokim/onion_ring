import type { AIProvider, ApiMessage, ProviderResponse, ContentBlock } from '@/types'
import { Capacitor } from '@capacitor/core'

// ── Helpers for multimodal content ──

/* eslint-disable @typescript-eslint/no-explicit-any */

function toOpenAIContent(content: string | ContentBlock[]): any {
  if (typeof content === 'string') return content
  const parts: any[] = []
  for (const block of content) {
    if (block.type === 'text') {
      parts.push({ type: 'text', text: block.text })
    } else if (block.type === 'image') {
      parts.push({
        type: 'image_url',
        image_url: { url: `data:${block.mimeType};base64,${block.data}` },
      })
    } else if (block.type === 'document') {
      // OpenAI does not natively support PDF — add text fallback note
      parts.push({
        type: 'text',
        text: '[PDF 파일이 첨부되었습니다. 이 프로바이더는 PDF를 직접 처리하지 못합니다. 텍스트 참고 자료를 확인해주세요.]',
      })
    }
  }
  return parts
}

function toAnthropicContent(content: string | ContentBlock[]): any {
  if (typeof content === 'string') return content
  const parts: any[] = []
  for (const block of content) {
    if (block.type === 'text') {
      parts.push({ type: 'text', text: block.text })
    } else if (block.type === 'image') {
      parts.push({
        type: 'image',
        source: { type: 'base64', media_type: block.mimeType, data: block.data },
      })
    } else if (block.type === 'document') {
      parts.push({
        type: 'document',
        source: { type: 'base64', media_type: block.mimeType, data: block.data },
      })
    }
  }
  return parts
}

function toGeminiParts(content: string | ContentBlock[]): any[] {
  if (typeof content === 'string') return [{ text: content }]
  const parts: any[] = []
  for (const block of content) {
    if (block.type === 'text') {
      parts.push({ text: block.text })
    } else if (block.type === 'image' || block.type === 'document') {
      parts.push({ inlineData: { mimeType: block.mimeType, data: block.data } })
    }
  }
  return parts
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Main dispatcher ──

export async function callProvider(
  provider: AIProvider,
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: ApiMessage[],
  signal?: AbortSignal,
): Promise<ProviderResponse> {
  if (!apiKey.trim()) {
    return { content: 'API 키가 설정되지 않았습니다.', stopReason: 'error' }
  }

  try {
    switch (provider) {
      case 'openai':
        return await callOpenAI(apiKey, model, systemPrompt, messages, signal)
      case 'anthropic':
        return await callAnthropic(apiKey, model, systemPrompt, messages, signal)
      case 'gemini':
        return await callGemini(apiKey, model, systemPrompt, messages, signal)
      default:
        return { content: `알 수 없는 프로바이더: ${String(provider)}`, stopReason: 'error' }
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { content: '요청이 취소되었습니다.', stopReason: 'error' }
    }
    const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.'
    return { content: message, stopReason: 'error' }
  }
}

// ── OpenAI ──

interface OpenAIResponse {
  choices: { message: { content: string | null } }[]
  error?: { message: string }
}

async function callOpenAI(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: ApiMessage[],
  signal?: AbortSignal,
): Promise<ProviderResponse> {
  const apiMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m) => ({
      role: m.role,
      content: toOpenAIContent(m.content),
    })),
  ]

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages: apiMessages, max_tokens: 2048 }),
    signal,
  })

  const data = (await res.json()) as OpenAIResponse
  if (data.error) throw new Error(data.error.message)

  const content = data.choices[0]?.message?.content || ''
  return { content, stopReason: 'end' }
}

// ── Anthropic ──

interface AnthropicResponse {
  content: { type: string; text?: string }[]
  error?: { message: string }
}

async function callAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: ApiMessage[],
  signal?: AbortSignal,
): Promise<ProviderResponse> {
  // Filter empty text-only messages (Anthropic requires non-empty content)
  const filteredMessages = messages
    .filter((m) =>
      typeof m.content === 'string' ? m.content.trim().length > 0 : true,
    )
    .map((m) => ({
      role: m.role,
      content: toAnthropicContent(m.content),
    }))

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  }
  if (!Capacitor.isNativePlatform()) {
    headers['anthropic-dangerous-direct-browser-access'] = 'true'
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: filteredMessages,
    }),
    signal,
  })

  const data = (await res.json()) as AnthropicResponse
  if (data.error) throw new Error(data.error.message)

  const content = data.content
    .filter((b) => b.type === 'text' && b.text)
    .map((b) => b.text!)
    .join('\n')

  return { content, stopReason: 'end' }
}

// ── Gemini ──

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[]
  error?: { message: string }
}

async function callGemini(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: ApiMessage[],
  signal?: AbortSignal,
): Promise<ProviderResponse> {
  // Map roles and convert content to Gemini parts format
  const rawContents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: toGeminiParts(m.content),
  }))

  // Merge consecutive same-role messages (Gemini requires alternating turns)
  const contents: typeof rawContents = []
  for (const msg of rawContents) {
    const prev = contents[contents.length - 1]
    if (prev && prev.role === msg.role) {
      prev.parts = [...prev.parts, ...msg.parts]
    } else {
      contents.push({ ...msg, parts: [...msg.parts] })
    }
  }

  // Ensure first message is from user (Gemini requirement)
  if (contents.length > 0 && contents[0]!.role === 'model') {
    contents.unshift({ role: 'user', parts: [{ text: '토론을 시작해주세요.' }] })
  }

  const body: Record<string, unknown> = {
    contents,
    systemInstruction: { parts: [{ text: systemPrompt }] },
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(body),
      signal,
    },
  )

  const data = (await res.json()) as GeminiResponse
  if (data.error) throw new Error(data.error.message)

  const parts = data.candidates?.[0]?.content?.parts || []
  const content = parts
    .filter((p) => p.text)
    .map((p) => p.text!)
    .join('\n')

  if (!content) {
    throw new Error('Gemini에서 빈 응답이 반환되었습니다.')
  }

  return { content, stopReason: 'end' }
}
