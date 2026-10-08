import { logFields } from '@/lib/axiom/log-fields'
import { logger } from '@/lib/axiom/logger'
import type { AiToolContext } from '@/src/lib/ai/tools/types'
import type { AiSkillDTO } from '@/types/ai-skill'
import {
  enabledSkillsFor,
  pickSkillBySlug,
  skillInstructionsForModel,
} from './skill-catalog'
import { parseSkillCommand } from './skill-command'

/**
 * Steel AI skills (slash instructions such as `/my-work`) in the chat
 * runtime: the explicit "/<slug>" of a message and the short catalog that
 * lets the model pick a skill by itself (via `steel_get_skill`). Both are
 * best-effort — a database failure only means "no skill this turn".
 */

export interface SkillInvocation {
  /** Skill picked by an explicit "/<slug>" prefix, if any. */
  skill: { id: string; slug: string; name: string; instructions: string } | null
  /** User text with the "/<slug>" prefix removed (unchanged when no skill). */
  content: string
}

/** Skills shown to the model at most (the catalog is a hint, not a menu). */
export const SKILLS_CATALOG_MAX = 40

/** Name of the platform tool that returns a skill's instructions. */
export const GET_SKILL_TOOL_NAME = 'steel_get_skill'

async function loadSkills(ctx: AiToolContext): Promise<AiSkillDTO[]> {
  const skills = await enabledSkillsFor(ctx.workspaceId, ctx.actorId)
  if (skills.ok) return skills.value
  logger.warn(
    'steel_ai.skills_unavailable',
    logFields({
      component: 'SteelAiSkills',
      workspaceId: ctx.workspaceId,
      message: skills.error.message,
    }),
  )
  return []
}

/** Resolves an explicit "/<slug>" at the start of the user message. */
export async function resolveSkillInvocation(
  ctx: AiToolContext,
  content: string,
): Promise<SkillInvocation> {
  const command = parseSkillCommand(content)
  if (!command) return { skill: null, content }

  const skill = pickSkillBySlug(await loadSkills(ctx), command.slug)
  if (!skill) return { skill: null, content }
  return {
    skill: {
      id: skill.id,
      slug: skill.slug,
      name: skill.name,
      instructions: skillInstructionsForModel(skill),
    },
    content: command.rest,
  }
}

/** One skill per command (the one "/<slug>" would run). */
function uniqueBySlug(skills: AiSkillDTO[]): AiSkillDTO[] {
  const out: AiSkillDTO[] = []
  for (const skill of skills) {
    if (out.some((s) => s.slug === skill.slug)) continue
    const picked = pickSkillBySlug(skills, skill.slug)
    if (picked) out.push(picked)
  }
  return out
}

/**
 * Short catalog (slug + description) appended to the system prompt so the
 * model can pick a skill when the request matches one. Empty when none.
 */
export async function skillsCatalogForPrompt(
  ctx: AiToolContext,
): Promise<string> {
  const skills = uniqueBySlug(await loadSkills(ctx)).slice(
    0,
    SKILLS_CATALOG_MAX,
  )
  if (skills.length === 0) return ''
  const lines = skills.map(
    (skill) => `- /${skill.slug} — ${skill.description.replace(/\s+/g, ' ')}`,
  )
  return [
    `Skills disponíveis (o usuário as chama com /comando). Se o pedido corresponder claramente a uma delas, chame ${GET_SKILL_TOOL_NAME} com o comando e siga as instruções que ela devolver:`,
    ...lines,
  ].join('\n')
}
