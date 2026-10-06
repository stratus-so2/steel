import type { AiConversationModeDTO } from '@/types/steel-ai'

/**
 * Hands the first prompt from the welcome screen to the chat screen. The
 * welcome screen creates the conversation and navigates; the chat screen
 * takes the prompt exactly once (reading removes it) and starts the stream,
 * so a remount or a reload never sends it twice. sessionStorage survives a
 * hard navigation; the in-memory copy covers browsers where storage throws.
 */
export interface SteelAiPendingPrompt {
  content: string
  mode: AiConversationModeDTO
}

const KEY_PREFIX = 'steel-ai:pending-prompt:'
const memory = new Map<string, SteelAiPendingPrompt>()

export function stashSteelAiPrompt(
  conversationId: string,
  prompt: SteelAiPendingPrompt,
) {
  memory.set(conversationId, prompt)
  try {
    window.sessionStorage.setItem(
      `${KEY_PREFIX}${conversationId}`,
      JSON.stringify(prompt),
    )
  } catch {
    // Private mode / blocked storage: the in-memory copy is enough for a
    // client-side navigation.
  }
}

function readStored(conversationId: string): unknown {
  try {
    const key = `${KEY_PREFIX}${conversationId}`
    const raw = window.sessionStorage.getItem(key)
    if (raw === null) return null
    window.sessionStorage.removeItem(key)
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function takeSteelAiPrompt(
  conversationId: string,
): SteelAiPendingPrompt | null {
  const stored = readStored(conversationId)
  const inMemory = memory.get(conversationId) ?? null
  memory.delete(conversationId)
  const candidate = (stored ?? inMemory) as Partial<SteelAiPendingPrompt> | null
  if (
    !candidate ||
    typeof candidate.content !== 'string' ||
    !candidate.content.trim()
  ) {
    return null
  }
  return {
    content: candidate.content,
    mode: candidate.mode === 'AGENT' ? 'AGENT' : 'EXPLORE',
  }
}
