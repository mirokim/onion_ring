import type { StateStorage } from 'zustand/middleware'

const OBFUSCATION_KEY = 'onion-ring-salt-2025'

function obfuscateApiKey(key: string): string {
  if (!key) return ''
  try {
    const encoded = btoa(unescape(encodeURIComponent(key)))
    let result = ''
    for (let i = 0; i < encoded.length; i++) {
      result += String.fromCharCode(
        encoded.charCodeAt(i) ^ OBFUSCATION_KEY.charCodeAt(i % OBFUSCATION_KEY.length),
      )
    }
    return 'enc:' + btoa(result)
  } catch {
    return key
  }
}

function deobfuscateApiKey(stored: string): string {
  if (!stored || !stored.startsWith('enc:')) return stored
  try {
    const decoded = atob(stored.slice(4))
    let result = ''
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(
        decoded.charCodeAt(i) ^ OBFUSCATION_KEY.charCodeAt(i % OBFUSCATION_KEY.length),
      )
    }
    return decodeURIComponent(escape(atob(result)))
  } catch {
    return stored
  }
}

export const secureStorage: StateStorage = {
  getItem: (name: string): string | null => {
    const raw = localStorage.getItem(name)
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw)
      if (parsed?.state?.configs) {
        for (const provider of ['openai', 'anthropic', 'gemini', 'xai']) {
          if (parsed.state.configs[provider]?.apiKey) {
            parsed.state.configs[provider].apiKey = deobfuscateApiKey(
              parsed.state.configs[provider].apiKey,
            )
          }
        }
      }
      return JSON.stringify(parsed)
    } catch {
      return raw
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      const parsed = JSON.parse(value)
      if (parsed?.state?.configs) {
        for (const provider of ['openai', 'anthropic', 'gemini', 'xai']) {
          if (parsed.state.configs[provider]?.apiKey) {
            parsed.state.configs[provider].apiKey = obfuscateApiKey(
              parsed.state.configs[provider].apiKey,
            )
          }
        }
      }
      localStorage.setItem(name, JSON.stringify(parsed))
    } catch {
      localStorage.setItem(name, value)
    }
  },
  removeItem: (name: string): void => {
    localStorage.removeItem(name)
  },
}
