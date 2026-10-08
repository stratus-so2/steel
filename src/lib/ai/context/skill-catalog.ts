import type { AiSkill } from '@prisma/client'
import { ok, type Result } from '@/src/lib/result'
import {
  toAiSkillDTO,
  toBuiltInAiSkillDTO,
} from '@/src/mappers/ai-skill.mapper'
import { AiSkillRepository } from '@/src/repositories/ai-skill.repository'
import type { AiSkillDTO, AiSkillKindDTO } from '@/types/ai-skill'
import { BUILT_IN_SKILLS } from './builtin-skills'

/**
 * Merges the built-in skills (code) with the rows the actor can see:
 * built-ins first (their `enabled` from the workspace override row), then
 * workspace skills, then the actor's personal ones — each by name.
 * Kept free of the tool registry so the `steel_get_skill` tool can use it.
 */
export function mergeSkills(
  rows: AiSkill[],
  viewer: { actorId: string; canManageWorkspace: boolean },
): AiSkillDTO[] {
  const overrides = new Map(
    rows
      .filter((row) => row.builtIn && row.scope === 'WORKSPACE')
      .map((row) => [row.slug, row]),
  )
  const custom = rows.filter((row) => !row.builtIn)
  return [
    ...BUILT_IN_SKILLS.map((skill) =>
      toBuiltInAiSkillDTO(
        skill,
        overrides.get(skill.slug) ?? null,
        viewer.canManageWorkspace,
      ),
    ),
    ...custom
      .filter((row) => row.scope === 'WORKSPACE')
      .map((row) => toAiSkillDTO(row, viewer)),
    ...custom
      .filter((row) => row.scope === 'PERSONAL')
      .map((row) => toAiSkillDTO(row, viewer)),
  ]
}

/** Enabled skills the actor can invoke (permission flags are irrelevant). */
export async function enabledSkillsFor(
  workspaceId: string,
  actorId: string,
): Promise<Result<AiSkillDTO[]>> {
  const rows = await AiSkillRepository.listVisible(workspaceId, actorId)
  if (!rows.ok) return rows
  return ok(
    mergeSkills(rows.value, { actorId, canManageWorkspace: false }).filter(
      (skill) => skill.enabled,
    ),
  )
}

const PRECEDENCE: Record<AiSkillKindDTO, number> = {
  PERSONAL: 0,
  WORKSPACE: 1,
  BUILT_IN: 2,
}

/** The skill a "/<slug>" means: personal, then workspace, then built-in. */
export function pickSkillBySlug(
  skills: AiSkillDTO[],
  slug: string,
): AiSkillDTO | null {
  const matches = skills.filter((skill) => skill.slug === slug)
  matches.sort((a, b) => PRECEDENCE[a.kind] - PRECEDENCE[b.kind])
  return matches[0] ?? null
}

/** Instructions plus the tool hint, as the model reads them. */
export function skillInstructionsForModel(skill: AiSkillDTO): string {
  return skill.toolNames.length > 0
    ? `${skill.instructions}\nFerramentas sugeridas: ${skill.toolNames.join(', ')}.`
    : skill.instructions
}
