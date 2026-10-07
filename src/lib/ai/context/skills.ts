import type { AiToolContext } from '@/src/lib/ai/tools/types'

/**
 * Extension point for Steel AI skills (slash instructions such as
 * `/my-work`). The chat runtime calls these on every turn; the skills slice
 * fills them in. Until then they are inert.
 */

export interface SkillInvocation {
  /** Skill picked by an explicit "/<slug>" prefix, if any. */
  skill: { id: string; slug: string; name: string; instructions: string } | null
  /** User text with the "/<slug>" prefix removed (unchanged when no skill). */
  content: string
}

/** Resolves an explicit "/<slug>" at the start of the user message. */
export async function resolveSkillInvocation(
  _ctx: AiToolContext,
  content: string,
): Promise<SkillInvocation> {
  return { skill: null, content }
}

/**
 * Short catalog (slug + description) appended to the system prompt so the
 * model can pick a skill when the request matches one. Empty when none.
 */
export async function skillsCatalogForPrompt(
  _ctx: AiToolContext,
): Promise<string> {
  return ''
}
