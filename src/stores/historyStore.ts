import { create } from 'zustand'
import { debateDB, type StoredDebate, type StoredMessage } from '@/db/debateDB'
import type { DiscussionMessage, ReferenceFile } from '@/types'
import { generateId } from '@/lib/utils'

interface HistoryState {
  debates: StoredDebate[]
  selectedDebateId: string | null
  selectedMessages: StoredMessage[]
  isLoading: boolean

  loadDebates: () => Promise<void>
  selectDebate: (id: string) => Promise<void>
  clearSelection: () => void
  deleteDebate: (id: string) => Promise<void>
  saveDebate: (
    debate: Omit<StoredDebate, 'id' | 'completedAt'>,
    messages: DiscussionMessage[],
    referenceFiles?: ReferenceFile[],
  ) => Promise<void>
}

export const useHistoryStore = create<HistoryState>()((set, get) => ({
  debates: [],
  selectedDebateId: null,
  selectedMessages: [],
  isLoading: false,

  loadDebates: async () => {
    set({ isLoading: true })
    try {
      await debateDB.init()
      const debates = debateDB.getAllDebates()
      set({ debates })
    } finally {
      set({ isLoading: false })
    }
  },

  selectDebate: async (id) => {
    set({ isLoading: true })
    try {
      await debateDB.init()
      const messages = debateDB.getMessagesByDebateId(id)
      set({ selectedDebateId: id, selectedMessages: messages })
    } finally {
      set({ isLoading: false })
    }
  },

  clearSelection: () => {
    set({ selectedDebateId: null, selectedMessages: [] })
  },

  deleteDebate: async (id) => {
    await debateDB.init()
    debateDB.deleteDebate(id)
    // If we were viewing this debate, clear selection
    if (get().selectedDebateId === id) {
      set({ selectedDebateId: null, selectedMessages: [] })
    }
    // Reload list
    await get().loadDebates()
  },

  saveDebate: async (debateInfo, messages, referenceFiles) => {
    const debateId = generateId()
    const storedDebate: StoredDebate = {
      ...debateInfo,
      id: debateId,
      completedAt: Date.now(),
    }

    const storedMessages: StoredMessage[] = messages.map((msg) => ({
      id: msg.id,
      debateId,
      provider: msg.provider,
      content: msg.content,
      round: msg.round,
      timestamp: msg.timestamp,
      error: msg.error,
    }))

    await debateDB.init()
    debateDB.insertDebate(storedDebate)
    debateDB.insertMessages(storedMessages)

    // Save reference files if provided
    if (referenceFiles && referenceFiles.length > 0) {
      for (const file of referenceFiles) {
        const base64Data = file.dataUrl.split(',')[1] || ''
        const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0))
        debateDB.insertReferenceFile({
          id: file.id,
          filename: file.filename,
          mimeType: file.mimeType,
          size: file.size,
          data: binaryData,
          textContent: file.textContent,
          uploadedAt: Date.now(),
        })
      }
    }

    // Reload list
    await get().loadDebates()
  },
}))
