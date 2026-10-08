import type { AiMemoryRefDTO } from '@/types/ai-memory'

/**
 * Names and labels of the Steel AI memory tools, in a dependency-free
 * module so the tool registry and the conversation mapper can use them
 * without importing the memory service.
 */

export const MEMORY_SAVE_TOOL_NAME = 'memory_save'
export const MEMORY_FORGET_TOOL_NAME = 'memory_forget'

export const MEMORY_TOOL_LABELS: Readonly<Record<string, string>> = {
  [MEMORY_SAVE_TOOL_NAME]: 'Salvando na memória',
  [MEMORY_FORGET_TOOL_NAME]: 'Esquecendo da memória',
}

const ACTIONS = new Set<string>(['saved', 'duplicate', 'forgotten'])

/**
 * The `memoryRef` a memory tool returns in its result data (what the
 * transcript chip shows), or null when `data` carries none.
 */
export function readMemoryRef(data: unknown): AiMemoryRefDTO | null {
  if (!data || typeof data !== 'object') return null
  const ref = (data as { memoryRef?: unknown }).memoryRef
  if (!ref || typeof ref !== 'object') return null
  const { id, scope, content, action } = ref as Record<string, unknown>
  if (
    typeof id !== 'string' ||
    (scope !== 'WORKSPACE' && scope !== 'PERSONAL') ||
    typeof content !== 'string' ||
    typeof action !== 'string' ||
    !ACTIONS.has(action)
  ) {
    return null
  }
  return { id, scope, content, action: action as AiMemoryRefDTO['action'] }
}
