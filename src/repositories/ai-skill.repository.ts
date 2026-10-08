import type { AiConversationMode, AiScope, AiSkill } from '@prisma/client'
import { aiSkillNotFound } from '@/src/errors/app-error'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export interface AiSkillCreateInput {
  workspaceId: string
  scope: AiScope
  ownerId: string | null
  slug: string
  name: string
  description: string
  instructions: string
  mode: AiConversationMode | null
  toolNames: string[]
  enabled: boolean
  builtIn?: boolean
  createdById: string
}

export type AiSkillUpdateInput = Partial<
  Pick<
    AiSkill,
    | 'slug'
    | 'name'
    | 'description'
    | 'instructions'
    | 'mode'
    | 'toolNames'
    | 'enabled'
  >
>

/** Steel AI skills (soft-deleted rows are never returned). */
export const AiSkillRepository = {
  /**
   * Every skill the actor can see: the workspace ones (including built-in
   * overrides) and the actor's own personal ones.
   */
  async listVisible(
    workspaceId: string,
    actorId: string,
  ): Promise<Result<AiSkill[]>> {
    try {
      const rows = await prisma.aiSkill.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          OR: [{ scope: 'WORKSPACE' }, { scope: 'PERSONAL', ownerId: actorId }],
        },
        orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
      })
      return ok(rows)
    } catch (error) {
      return err(dbError('Failed to list AI skills', error))
    }
  },

  async findById(id: string, workspaceId: string): Promise<Result<AiSkill>> {
    try {
      const row = await prisma.aiSkill.findFirst({
        where: { id, workspaceId, deletedAt: null },
      })
      return row ? ok(row) : err(aiSkillNotFound())
    } catch (error) {
      return err(dbError('Failed to find AI skill', error))
    }
  },

  /**
   * Active skill with `slug` in one scope: the workspace's (custom or
   * built-in override) or one user's personal ones.
   */
  async findBySlug(input: {
    workspaceId: string
    scope: AiScope
    ownerId: string | null
    slug: string
    builtIn: boolean
  }): Promise<Result<AiSkill | null>> {
    try {
      const row = await prisma.aiSkill.findFirst({
        where: {
          workspaceId: input.workspaceId,
          scope: input.scope,
          slug: input.slug,
          builtIn: input.builtIn,
          deletedAt: null,
          ...(input.scope === 'PERSONAL' && { ownerId: input.ownerId }),
        },
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to find AI skill by slug', error))
    }
  },

  async create(data: AiSkillCreateInput): Promise<Result<AiSkill>> {
    try {
      const row = await prisma.aiSkill.create({ data })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to create AI skill', error))
    }
  },

  async update(id: string, data: AiSkillUpdateInput): Promise<Result<AiSkill>> {
    try {
      const row = await prisma.aiSkill.update({ where: { id }, data })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to update AI skill', error))
    }
  },

  async softDelete(id: string): Promise<Result<AiSkill>> {
    try {
      const row = await prisma.aiSkill.update({
        where: { id },
        data: { deletedAt: new Date() },
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to delete AI skill', error))
    }
  },
}
