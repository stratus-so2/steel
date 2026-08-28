import { createHash } from 'node:crypto'
import { auditMutation } from '@/lib/axiom/audit'
import { crmLandingPageTemplateNotFound } from '@/src/errors'
import { getLandingPageTemplate } from '@/src/lib/landing-page-templates'
import { err, ok, type Result } from '@/src/lib/result'
import {
  toCrmLandingPageDTO,
  toCrmLandingPagePublicDTO,
  toCrmLandingPageViewDTO,
} from '@/src/mappers/crm-landing-page.mapper'
import {
  CrmLandingPageRepository,
  CrmLandingPageViewRepository,
} from '@/src/repositories/crm-landing-page.repository'
import type {
  CreateCrmLandingPageDTO,
  RecordCrmLandingPageViewDTO,
  UpdateCrmLandingPageDTO,
} from '@/src/schemas/crm-landing-page.schema'
import type {
  CrmLandingPageDTO,
  CrmLandingPagePublicDTO,
  CrmLandingPageViewDTO,
} from '@/types/crm-landing-page'
import { assertMember } from './authz'

function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex')
}

export const CrmLandingPageService = {
  async list(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<CrmLandingPageDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmLandingPageRepository.listByWorkspace(workspaceId)
    if (!result.ok) return result

    return ok(result.value.map(toCrmLandingPageDTO))
  },

  async getById(
    actorId: string,
    workspaceId: string,
    pageId: string,
  ): Promise<Result<CrmLandingPageDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmLandingPageRepository.findById(pageId, workspaceId)
    if (!result.ok) return result

    return ok(toCrmLandingPageDTO(result.value))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateCrmLandingPageDTO,
  ): Promise<Result<CrmLandingPageDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    if (!getLandingPageTemplate(dto.templateKey)) {
      auditMutation({
        entity: 'crm_landing_page',
        action: 'create',
        actorId,
        outcome: 'failure',
        reason: 'CRM_LANDING_PAGE_TEMPLATE_NOT_FOUND',
      })
      return err(crmLandingPageTemplateNotFound())
    }

    const result = await CrmLandingPageRepository.create({
      workspaceId,
      createdById: actorId,
      title: dto.title,
      templateKey: dto.templateKey,
      sections: dto.sections,
    })

    if (!result.ok) {
      auditMutation({
        entity: 'crm_landing_page',
        action: 'create',
        actorId,
        outcome: 'failure',
        reason: result.error.code,
      })
      return result
    }

    auditMutation({
      entity: 'crm_landing_page',
      action: 'create',
      actorId,
      targetId: result.value.id,
    })

    return ok(toCrmLandingPageDTO(result.value))
  },

  async update(
    actorId: string,
    workspaceId: string,
    pageId: string,
    dto: UpdateCrmLandingPageDTO,
  ): Promise<Result<CrmLandingPageDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmLandingPageRepository.findById(
      pageId,
      workspaceId,
    )
    if (!existing.ok) return existing

    // Carimba o 1º publish; despublicar não apaga o timestamp original.
    const publishedAt =
      dto.status === 'PUBLISHED' && !existing.value.publishedAt
        ? new Date()
        : undefined

    const result = await CrmLandingPageRepository.update(pageId, {
      title: dto.title,
      sections: dto.sections,
      status: dto.status,
      publishedAt,
      updatedById: actorId,
    })
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_landing_page',
      action: 'update',
      actorId,
      targetId: pageId,
      meta: { fields: Object.keys(dto) },
    })

    return ok(toCrmLandingPageDTO(result.value))
  },

  async setPublished(
    actorId: string,
    workspaceId: string,
    pageId: string,
    published: boolean,
  ): Promise<Result<CrmLandingPageDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmLandingPageRepository.findById(
      pageId,
      workspaceId,
    )
    if (!existing.ok) return existing

    const result = await CrmLandingPageRepository.setPublished(
      pageId,
      published,
    )
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_landing_page',
      action: 'update',
      actorId,
      targetId: pageId,
      meta: { published },
    })

    return ok(toCrmLandingPageDTO(result.value))
  },

  async remove(
    actorId: string,
    workspaceId: string,
    pageId: string,
  ): Promise<Result<void>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmLandingPageRepository.findById(
      pageId,
      workspaceId,
    )
    if (!existing.ok) return existing

    const result = await CrmLandingPageRepository.softDelete(pageId)
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_landing_page',
      action: 'delete',
      actorId,
      targetId: pageId,
    })

    return ok(undefined)
  },

  async reorder(
    actorId: string,
    workspaceId: string,
    orderedIds: string[],
  ): Promise<Result<void>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    return CrmLandingPageRepository.reorder(workspaceId, orderedIds)
  },

  async listViews(
    actorId: string,
    workspaceId: string,
    pageId: string,
  ): Promise<Result<CrmLandingPageViewDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const page = await CrmLandingPageRepository.findById(pageId, workspaceId)
    if (!page.ok) return page

    const result = await CrmLandingPageViewRepository.listByLandingPage(pageId)
    if (!result.ok) return result

    return ok(result.value.map(toCrmLandingPageViewDTO))
  },

  async getPublicByShareToken(
    shareToken: string,
  ): Promise<Result<CrmLandingPagePublicDTO>> {
    const result = await CrmLandingPageRepository.findByShareToken(shareToken)
    if (!result.ok) return result

    return ok(toCrmLandingPagePublicDTO(result.value))
  },

  async recordView(
    shareToken: string,
    ip: string,
    dto: RecordCrmLandingPageViewDTO,
  ): Promise<Result<void>> {
    const page = await CrmLandingPageRepository.findByShareToken(shareToken)
    if (!page.ok) return page

    const result = await CrmLandingPageViewRepository.record({
      landingPageId: page.value.id,
      viewId: dto.viewId,
      ipHash: hashIp(ip),
      durationMs: dto.durationMs,
      ctaClicks: dto.ctaClicks,
      referrer: dto.referrer,
    })
    if (!result.ok) return result

    return ok(undefined)
  },
}
