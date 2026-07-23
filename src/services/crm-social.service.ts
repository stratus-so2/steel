import { auditMutation } from '@/lib/axiom/audit'
import { crmScheduledPostAlreadyPublished } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import {
  toCrmScheduledPostDTO,
  toCrmSocialConnectionDTO,
} from '@/src/mappers/crm-social.mapper'
import {
  CrmScheduledPostRepository,
  CrmScheduledPostTargetRepository,
  CrmSocialConnectionRepository,
} from '@/src/repositories/crm-social.repository'
import type {
  CreateCrmScheduledPostDTO,
  CreateCrmSocialConnectionDTO,
  UpdateCrmScheduledPostDTO,
} from '@/src/schemas/crm-social.schema'
import type {
  CrmScheduledPostDTO,
  CrmSocialConnectionDTO,
} from '@/types/crm-social'
import { assertMember } from './authz'
import { publishToSocialPlatform } from './crm-social-publisher'

export const CrmSocialConnectionService = {
  async list(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<CrmSocialConnectionDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result =
      await CrmSocialConnectionRepository.listByWorkspace(workspaceId)
    if (!result.ok) return result

    return ok(result.value.map(toCrmSocialConnectionDTO))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateCrmSocialConnectionDTO,
  ): Promise<Result<CrmSocialConnectionDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmSocialConnectionRepository.create({
      workspaceId,
      createdById: actorId,
      platform: dto.platform,
      externalAccountId: dto.externalAccountId,
      accountName: dto.accountName,
    })

    if (!result.ok) {
      auditMutation({
        entity: 'crm_social_connection',
        action: 'create',
        actorId,
        outcome: 'failure',
        reason: result.error.code,
      })
      return result
    }

    auditMutation({
      entity: 'crm_social_connection',
      action: 'create',
      actorId,
      targetId: result.value.id,
      meta: { platform: dto.platform },
    })

    return ok(toCrmSocialConnectionDTO(result.value))
  },

  async remove(
    actorId: string,
    workspaceId: string,
    connectionId: string,
  ): Promise<Result<void>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmSocialConnectionRepository.findById(
      connectionId,
      workspaceId,
    )
    if (!existing.ok) return existing

    const result = await CrmSocialConnectionRepository.remove(connectionId)
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_social_connection',
      action: 'delete',
      actorId,
      targetId: connectionId,
    })

    return ok(undefined)
  },
}

export const CrmScheduledPostService = {
  async list(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<CrmScheduledPostDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmScheduledPostRepository.listByWorkspace(workspaceId)
    if (!result.ok) return result

    return ok(result.value.map((post) => toCrmScheduledPostDTO(post)))
  },

  async getById(
    actorId: string,
    workspaceId: string,
    postId: string,
  ): Promise<Result<CrmScheduledPostDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmScheduledPostRepository.findById(
      postId,
      workspaceId,
    )
    if (!result.ok) return result

    return ok(toCrmScheduledPostDTO(result.value))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateCrmScheduledPostDTO,
  ): Promise<Result<CrmScheduledPostDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmScheduledPostRepository.create({
      workspaceId,
      createdById: actorId,
      content: dto.content,
      title: dto.title,
      scheduledFor: dto.scheduledFor,
    })
    if (!result.ok) return result

    const targets = await CrmScheduledPostTargetRepository.createMany(
      result.value.id,
      dto.platforms,
    )
    if (!targets.ok) return targets

    auditMutation({
      entity: 'crm_scheduled_post',
      action: 'create',
      actorId,
      targetId: result.value.id,
      meta: { platforms: dto.platforms },
    })

    const withTargets = await CrmScheduledPostRepository.findById(
      result.value.id,
      workspaceId,
    )
    if (!withTargets.ok) return withTargets

    return ok(toCrmScheduledPostDTO(withTargets.value))
  },

  async update(
    actorId: string,
    workspaceId: string,
    postId: string,
    dto: UpdateCrmScheduledPostDTO,
  ): Promise<Result<CrmScheduledPostDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmScheduledPostRepository.findById(
      postId,
      workspaceId,
    )
    if (!existing.ok) return existing
    if (existing.value.status === 'PUBLISHED') {
      return err(crmScheduledPostAlreadyPublished())
    }

    const result = await CrmScheduledPostRepository.update(postId, {
      content: dto.content,
      title: dto.title,
      scheduledFor: dto.scheduledFor,
    })
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_scheduled_post',
      action: 'update',
      actorId,
      targetId: postId,
      meta: { fields: Object.keys(dto) },
    })

    return ok(toCrmScheduledPostDTO(result.value))
  },

  async remove(
    actorId: string,
    workspaceId: string,
    postId: string,
  ): Promise<Result<void>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmScheduledPostRepository.findById(
      postId,
      workspaceId,
    )
    if (!existing.ok) return existing

    const result = await CrmScheduledPostRepository.softDelete(postId)
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_scheduled_post',
      action: 'delete',
      actorId,
      targetId: postId,
    })

    return ok(undefined)
  },

  async publish(
    actorId: string,
    workspaceId: string,
    postId: string,
  ): Promise<Result<CrmScheduledPostDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmScheduledPostRepository.findById(
      postId,
      workspaceId,
    )
    if (!existing.ok) return existing
    if (existing.value.status === 'PUBLISHED') {
      return err(crmScheduledPostAlreadyPublished())
    }

    let allSucceeded = true
    for (const target of existing.value.targets) {
      const publication = await publishToSocialPlatform(target.platform)
      if (publication.ok) {
        await CrmScheduledPostTargetRepository.setStatus(
          target.id,
          'PUBLISHED',
          { publishedAt: new Date() },
        )
      } else {
        allSucceeded = false
        await CrmScheduledPostTargetRepository.setStatus(target.id, 'FAILED', {
          error: publication.error,
        })
      }
    }

    const result = await CrmScheduledPostRepository.setStatus(
      postId,
      allSucceeded ? 'PUBLISHED' : 'FAILED',
      allSucceeded ? new Date() : undefined,
    )
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_scheduled_post',
      action: 'update',
      actorId,
      targetId: postId,
      meta: { published: allSucceeded },
    })

    const withTargets = await CrmScheduledPostRepository.findById(
      postId,
      workspaceId,
    )
    if (!withTargets.ok) return withTargets

    return ok(toCrmScheduledPostDTO(withTargets.value))
  },
}
