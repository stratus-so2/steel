import { auditMutation } from '@/lib/axiom/audit'
import {
  crmScheduledPostAlreadyPublished,
  crmSocialNotConfigured,
  crmSocialOauthFailed,
  crmSocialStateInvalid,
} from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import { encryptToken, isTokenCryptoConfigured } from '@/src/lib/social/crypto'
import {
  createOauthState,
  verifyOauthState,
} from '@/src/lib/social/oauth-state'
import { createPkcePair } from '@/src/lib/social/pkce'
import { getProvider } from '@/src/lib/social/providers'
import { socialCallbackUrl } from '@/src/lib/social/redirect'
import {
  toCrmScheduledPostDTO,
  toCrmSocialConnectionDTO,
} from '@/src/mappers/crm-social.mapper'
import {
  CrmScheduledPostRepository,
  CrmScheduledPostTargetRepository,
  CrmSocialConnectionRepository,
} from '@/src/repositories/crm-social.repository'
import { WorkspaceRepository } from '@/src/repositories/workspace.repository'
import type {
  CRM_SOCIAL_PLATFORMS,
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

  /** Monta a URL de autorização OAuth do provedor. */
  async beginConnect(
    actorId: string,
    workspaceId: string,
    platform: (typeof CRM_SOCIAL_PLATFORMS)[number],
  ): Promise<Result<{ authorizeUrl: string; pkceVerifier: string | null }>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    if (!isTokenCryptoConfigured()) return err(crmSocialNotConfigured())

    const provider = getProvider(platform)
    if (!provider.isConfigured()) return err(crmSocialNotConfigured())

    const workspace = await WorkspaceRepository.findById(workspaceId)
    if (!workspace.ok) return workspace
    if (!workspace.value) return err(crmSocialOauthFailed())

    const state = createOauthState(workspaceId, workspace.value.slug, platform)
    const redirectUri = socialCallbackUrl(platform)

    const pkce = provider.usesPkce ? createPkcePair() : null

    const authorizeUrl = provider.buildAuthorizeUrl({
      redirectUri,
      state,
      codeChallenge: pkce?.challenge,
    })

    return ok({ authorizeUrl, pkceVerifier: pkce?.verifier ?? null })
  },

  /** Troca o code por tokens, resolve a conta e persiste a conexão. */
  async completeConnect(
    actorId: string,
    state: string,
    code: string,
    pkceVerifier: string | null,
  ): Promise<
    Result<{
      workspaceSlug: string
      platform: (typeof CRM_SOCIAL_PLATFORMS)[number]
    }>
  > {
    const verified = verifyOauthState(state)
    if (!verified.ok) return err(crmSocialStateInvalid())
    const { workspaceId, slug, platform } = verified.value

    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const provider = getProvider(platform)
    if (!provider.isConfigured()) return err(crmSocialNotConfigured())

    const redirectUri = socialCallbackUrl(platform)

    const tokens = await provider.exchangeCode({
      code,
      redirectUri,
      codeVerifier: pkceVerifier ?? undefined,
    })
    if (!tokens.ok) return tokens

    const account = await provider.fetchAccount(tokens.value)
    if (!account.ok) return account

    const workspace = await WorkspaceRepository.findById(workspaceId)
    if (!workspace.ok) return workspace
    if (!workspace.value) return err(crmSocialOauthFailed())

    const override = account.value.accessTokenOverride

    const result = await CrmSocialConnectionRepository.upsertOAuthConnection({
      workspaceId,
      createdById: actorId,
      platform,
      externalAccountId: account.value.externalId,
      accountName: account.value.name,
      accessToken: encryptToken(
        override ? override.accessToken : tokens.value.accessToken,
      ),
      refreshToken: tokens.value.refreshToken
        ? encryptToken(tokens.value.refreshToken)
        : null,
      tokenExpiresAt: override ? override.expiresAt : tokens.value.expiresAt,
      scope: tokens.value.scope,
    })
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_social_connection',
      action: 'update',
      actorId,
      targetId: result.value.id,
      meta: { platform, via: 'oauth' },
    })

    return ok({ workspaceSlug: slug, platform })
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
      const publication = await publishToSocialPlatform(
        actorId,
        workspaceId,
        target.platform,
        existing.value.content,
      )
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
