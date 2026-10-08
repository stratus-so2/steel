import type { AiScope, AiSkill } from '@prisma/client'
import { auditMutation } from '@/lib/axiom/audit'
import { forbidden, validationError } from '@/src/errors'
import { aiSkillNotFound, aiSkillSlugTaken } from '@/src/errors/app-error'
import {
  type BuiltInSkill,
  builtInSkillFromId,
  findBuiltInSkill,
} from '@/src/lib/ai/context/builtin-skills'
import { mergeSkills } from '@/src/lib/ai/context/skill-catalog'
import { findTool } from '@/src/lib/ai/tools/registry'
import { err, ok, type Result } from '@/src/lib/result'
import {
  toAiSkillDTO,
  toBuiltInAiSkillDTO,
} from '@/src/mappers/ai-skill.mapper'
import { AiSkillRepository } from '@/src/repositories/ai-skill.repository'
import type {
  CreateAiSkillDTO,
  UpdateAiSkillDTO,
} from '@/src/schemas/ai-skill.schema'
import type { AiSkillDTO, AiSkillListDTO } from '@/types/ai-skill'
import { assertMember, type MembershipContext } from './authz'

/**
 * Steel AI skills: built-ins (code, see `builtin-skills.ts`) merged with the
 * workspace's skills (OWNER/ADMIN manage) and each member's personal ones.
 * The command (`slug`) is unique per scope and can never reuse a built-in
 * one; built-ins can only be switched on/off by an admin, never edited or
 * deleted.
 */

const FORBIDDEN_WORKSPACE = 'Só administradores gerenciam skills do workspace.'

function viewerOf(actorId: string, membership: MembershipContext) {
  return { actorId, canManageWorkspace: membership.isPrivileged }
}

function validateToolNames(names: string[] | undefined): Result<true> {
  const unknown = (names ?? []).filter((name) => !findTool(name))
  if (unknown.length > 0) {
    return err(
      validationError(`Ferramenta desconhecida: ${unknown.join(', ')}`, {
        toolNames: unknown,
      }),
    )
  }
  return ok(true)
}

/** The command is free in the scope (and is not a built-in one). */
async function assertSlugFree(input: {
  workspaceId: string
  scope: AiScope
  ownerId: string | null
  slug: string
  exceptId?: string
}): Promise<Result<true>> {
  if (findBuiltInSkill(input.slug)) return err(aiSkillSlugTaken())
  const existing = await AiSkillRepository.findBySlug({
    ...input,
    builtIn: false,
  })
  if (!existing.ok) return existing
  if (existing.value && existing.value.id !== input.exceptId) {
    return err(aiSkillSlugTaken())
  }
  return ok(true)
}

/** A custom skill the actor may change: their own personal one, or (admin) a workspace one. */
function authorizeRow(
  row: AiSkill,
  actorId: string,
  membership: MembershipContext,
): Result<true> {
  if (row.builtIn) return err(aiSkillNotFound())
  if (row.scope === 'PERSONAL') {
    return row.ownerId === actorId ? ok(true) : err(aiSkillNotFound())
  }
  return membership.isPrivileged
    ? ok(true)
    : err(forbidden(FORBIDDEN_WORKSPACE))
}

/** Switches a built-in skill on/off for the workspace (override row). */
async function toggleBuiltIn(
  actorId: string,
  workspaceId: string,
  skill: BuiltInSkill,
  membership: MembershipContext,
  input: UpdateAiSkillDTO,
): Promise<Result<AiSkillDTO>> {
  const { slug } = skill
  if (!membership.isPrivileged) return err(forbidden(FORBIDDEN_WORKSPACE))
  const keys = Object.keys(input)
  if (input.enabled === undefined || keys.length !== 1) {
    return err(
      validationError('Skills embutidas só podem ser ativadas ou desativadas.'),
    )
  }

  const existing = await AiSkillRepository.findBySlug({
    workspaceId,
    scope: 'WORKSPACE',
    ownerId: null,
    slug,
    builtIn: true,
  })
  if (!existing.ok) return existing
  const saved = existing.value
    ? await AiSkillRepository.update(existing.value.id, {
        enabled: input.enabled,
      })
    : await AiSkillRepository.create({
        workspaceId,
        scope: 'WORKSPACE',
        ownerId: null,
        slug,
        name: skill.name,
        description: skill.description,
        instructions: skill.instructions,
        mode: skill.mode,
        toolNames: [...skill.toolNames],
        enabled: input.enabled,
        builtIn: true,
        createdById: actorId,
      })
  if (!saved.ok) return saved
  auditMutation({
    entity: 'ai_skill',
    action: 'update',
    actorId,
    targetId: saved.value.id,
    meta: { workspaceId, slug, builtIn: true, enabled: input.enabled },
  })
  return ok(toBuiltInAiSkillDTO(skill, saved.value, true))
}

export const AiSkillService = {
  /** Built-ins, workspace skills and the actor's personal ones. */
  async list(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<AiSkillListDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership
    const rows = await AiSkillRepository.listVisible(workspaceId, actorId)
    if (!rows.ok) return rows
    return ok({
      skills: mergeSkills(rows.value, viewerOf(actorId, membership.value)),
      canManageWorkspace: membership.value.isPrivileged,
    })
  },

  async create(
    actorId: string,
    workspaceId: string,
    input: CreateAiSkillDTO,
  ): Promise<Result<AiSkillDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership
    if (input.scope === 'WORKSPACE' && !membership.value.isPrivileged) {
      return err(forbidden(FORBIDDEN_WORKSPACE))
    }
    const tools = validateToolNames(input.toolNames)
    if (!tools.ok) return tools
    const ownerId = input.scope === 'PERSONAL' ? actorId : null
    const free = await assertSlugFree({
      workspaceId,
      scope: input.scope,
      ownerId,
      slug: input.slug,
    })
    if (!free.ok) return free

    const created = await AiSkillRepository.create({
      workspaceId,
      scope: input.scope,
      ownerId,
      slug: input.slug,
      name: input.name,
      description: input.description,
      instructions: input.instructions,
      mode: input.mode,
      toolNames: input.toolNames,
      enabled: input.enabled,
      createdById: actorId,
    })
    if (!created.ok) return created
    auditMutation({
      entity: 'ai_skill',
      action: 'create',
      actorId,
      targetId: created.value.id,
      meta: { workspaceId, scope: input.scope, slug: input.slug },
    })
    return ok(toAiSkillDTO(created.value, viewerOf(actorId, membership.value)))
  },

  /** `skillId` may be `builtin:<slug>` (only `enabled`, admins only). */
  async update(
    actorId: string,
    workspaceId: string,
    skillId: string,
    input: UpdateAiSkillDTO,
  ): Promise<Result<AiSkillDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const builtIn = builtInSkillFromId(skillId)
    if (builtIn) {
      return toggleBuiltIn(
        actorId,
        workspaceId,
        builtIn,
        membership.value,
        input,
      )
    }

    const row = await AiSkillRepository.findById(skillId, workspaceId)
    if (!row.ok) return row
    const allowed = authorizeRow(row.value, actorId, membership.value)
    if (!allowed.ok) return allowed
    const tools = validateToolNames(input.toolNames)
    if (!tools.ok) return tools
    if (input.slug !== undefined && input.slug !== row.value.slug) {
      const free = await assertSlugFree({
        workspaceId,
        scope: row.value.scope,
        ownerId: row.value.ownerId,
        slug: input.slug,
        exceptId: row.value.id,
      })
      if (!free.ok) return free
    }

    const updated = await AiSkillRepository.update(skillId, input)
    if (!updated.ok) return updated
    auditMutation({
      entity: 'ai_skill',
      action: 'update',
      actorId,
      targetId: skillId,
      meta: {
        workspaceId,
        scope: row.value.scope,
        fields: Object.keys(input),
      },
    })
    return ok(toAiSkillDTO(updated.value, viewerOf(actorId, membership.value)))
  },

  async delete(
    actorId: string,
    workspaceId: string,
    skillId: string,
  ): Promise<Result<{ id: string }>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership
    if (builtInSkillFromId(skillId)) {
      return err(
        forbidden(
          'Skills embutidas não podem ser excluídas — desative-a se não quiser usá-la.',
        ),
      )
    }
    const row = await AiSkillRepository.findById(skillId, workspaceId)
    if (!row.ok) return row
    const allowed = authorizeRow(row.value, actorId, membership.value)
    if (!allowed.ok) return allowed

    const deleted = await AiSkillRepository.softDelete(skillId)
    if (!deleted.ok) return deleted
    auditMutation({
      entity: 'ai_skill',
      action: 'delete',
      actorId,
      targetId: skillId,
      meta: { workspaceId, scope: row.value.scope, slug: row.value.slug },
    })
    return ok({ id: skillId })
  },
}
