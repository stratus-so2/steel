import type { AiToolContext } from '@/src/lib/ai/tools/types'

/**
 * Extension point for Steel AI memory (workspace + personal facts). The chat
 * runtime appends this to the system prompt on every turn; the memory slice
 * fills it in (honoring WorkspaceAiSettings.memoryEnabled). Inert until then.
 */
export async function memoryForPrompt(_ctx: AiToolContext): Promise<string> {
  return ''
}
