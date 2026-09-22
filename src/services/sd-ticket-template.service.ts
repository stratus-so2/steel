import type { Prisma } from '@prisma/client'
import { ok, type Result } from '@/src/lib/result'
import { toSdTicketTemplateDTO } from '@/src/mappers/sd-ticket-template.mapper'
import { SdTicketTemplateRepository } from '@/src/repositories/sd-ticket-template.repository'
import type {
  CreateSdTicketTemplateDTO,
  ListSdTicketTemplatesDTO,
  SdTicketTemplateDefaults,
  UpdateSdTicketTemplateDTO,
} from '@/src/schemas/sd-ticket-template.schema'
import type { SdTicketTemplateDTO } from '@/types/sd-config'
import { SdAccess } from './sd-access'
import { assertSdRefs, sdAdminMutation } from './sd-config-support'

function defaultsRefs(defaults: SdTicketTemplateDefaults | undefined) {
  return {
    categoryIds: [
      defaults?.categoryId,
      defaults?.subcategoryId,
      defaults?.serviceId,
    ],
    priorityIds: [defaults?.priorityId],
    impactIds: [defaults?.impactId],
    urgencyIds: [defaults?.urgencyId],
    severityIds: [defaults?.severityId],
    classificationIds: [defaults?.classificationId],
    departmentIds: [defaults?.departmentId],
  }
}

export const SdTicketTemplateService = {
  /** Solicitantes veem só os modelos ativos marcados para o portal. */
  async list(
    actorId: string,
    workspaceId: string,
    filters: ListSdTicketTemplatesDTO = { includeInactive: false },
  ): Promise<Result<SdTicketTemplateDTO[]>> {
    const ctx = await SdAccess.resolve(actorId, workspaceId)
    if (!ctx.ok) return ctx
    const rows = await SdTicketTemplateRepository.list(workspaceId, {
      ticketType: filters.ticketType,
      includeInactive: ctx.value.isAgent && filters.includeInactive,
    })
    if (!rows.ok) return rows
    const all = rows.value.map(toSdTicketTemplateDTO)
    return ok(ctx.value.isAgent ? all : all.filter((t) => t.portalVisible))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateSdTicketTemplateDTO,
  ): Promise<Result<SdTicketTemplateDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_ticket_template',
      action: 'create',
      targetId: (value) => value.id,
      meta: { ticketType: dto.ticketType },
      run: async () => {
        const refs = await assertSdRefs(workspaceId, defaultsRefs(dto.defaults))
        if (!refs.ok) return refs
        const created = await SdTicketTemplateRepository.create(workspaceId, {
          ...dto,
          defaults: dto.defaults as Prisma.InputJsonValue,
          tasks: dto.tasks as Prisma.InputJsonValue,
        })
        if (!created.ok) return created
        return ok(toSdTicketTemplateDTO(created.value))
      },
    })
  },

  async update(
    actorId: string,
    workspaceId: string,
    templateId: string,
    dto: UpdateSdTicketTemplateDTO,
  ): Promise<Result<SdTicketTemplateDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_ticket_template',
      action: 'update',
      targetId: templateId,
      meta: { fields: Object.keys(dto) },
      run: async () => {
        const existing = await SdTicketTemplateRepository.findById(
          templateId,
          workspaceId,
        )
        if (!existing.ok) return existing
        const refs = await assertSdRefs(workspaceId, defaultsRefs(dto.defaults))
        if (!refs.ok) return refs
        const updated = await SdTicketTemplateRepository.update(
          templateId,
          workspaceId,
          {
            ...dto,
            defaults: dto.defaults as Prisma.InputJsonValue | undefined,
            tasks: dto.tasks as Prisma.InputJsonValue | undefined,
          },
        )
        if (!updated.ok) return updated
        return ok(toSdTicketTemplateDTO(updated.value))
      },
    })
  },

  async remove(
    actorId: string,
    workspaceId: string,
    templateId: string,
  ): Promise<Result<void>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_ticket_template',
      action: 'delete',
      targetId: templateId,
      run: async () => {
        const existing = await SdTicketTemplateRepository.findById(
          templateId,
          workspaceId,
        )
        if (!existing.ok) return existing
        return SdTicketTemplateRepository.delete(templateId, workspaceId)
      },
    })
  },

  async reorder(
    actorId: string,
    workspaceId: string,
    orderedIds: string[],
  ): Promise<Result<void>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_ticket_template',
      action: 'update',
      meta: { reorder: orderedIds.length },
      run: () => SdTicketTemplateRepository.reorder(workspaceId, orderedIds),
    })
  },
}
