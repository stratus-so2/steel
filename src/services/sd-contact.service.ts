import { auditMutation } from '@/lib/axiom/audit'
import { logger } from '@/lib/axiom/logger'
import { sdCustomerNotFound, validationError } from '@/src/errors'
import type { PermissionAction } from '@/src/lib/permissions'
import { err, ok, type Result } from '@/src/lib/result'
import {
  formatPhone,
  normalizePhone,
  whatsappCandidates,
} from '@/src/lib/servicedesk/document'
import {
  toSdContactDetailDTO,
  toSdContactDTO,
} from '@/src/mappers/sd-contact.mapper'
import {
  type SdContactLinkInput,
  SdContactRepository,
  type SdContactWriteData,
} from '@/src/repositories/sd-contact.repository'
import { SdCustomerRepository } from '@/src/repositories/sd-customer.repository'
import type {
  CreateSdContactDTO,
  ListSdContactsDTO,
  SdContactLookupDTO,
  SdContactOptionsDTO,
  UpdateSdContactDTO,
} from '@/src/schemas/sd-contact.schema'
import type { SdContactDetailDTO, SdContactDTO } from '@/types/sd-contact'
import type { SdOptionDTO, SdPage } from '@/types/sd-directory'
import { SdAccess } from './sd-access'

const RESOURCE = 'sd-contacts'

function agent(actorId: string, workspaceId: string, action: PermissionAction) {
  return SdAccess.requireAgent(actorId, workspaceId, {
    resource: RESOURCE,
    action,
  })
}

/**
 * Remove vínculos repetidos e garante um único principal (o marcado, ou o
 * primeiro da lista); depois confere que todos existem na workspace.
 */
async function resolveLinks(
  workspaceId: string,
  input: { customerId: string; isPrimary: boolean }[],
): Promise<Result<SdContactLinkInput[]>> {
  const byId = new Map<string, SdContactLinkInput>()
  for (const link of input) {
    const current = byId.get(link.customerId)
    byId.set(link.customerId, {
      customerId: link.customerId,
      isPrimary: Boolean(current?.isPrimary || link.isPrimary),
    })
  }
  const links = [...byId.values()]
  if (links.length > 0 && !links.some((l) => l.isPrimary)) {
    links[0].isPrimary = true
  }

  const existing = await SdCustomerRepository.findExistingIds(
    workspaceId,
    links.map((l) => l.customerId),
  )
  if (!existing.ok) return existing
  if (existing.value.length !== links.length) return err(sdCustomerNotFound())
  return ok(links)
}

async function assertMember(
  workspaceId: string,
  userId: string | null | undefined,
): Promise<Result<void>> {
  if (!userId) return ok(undefined)
  const member = await SdContactRepository.isWorkspaceMember(
    workspaceId,
    userId,
  )
  if (!member.ok) return member
  if (!member.value) {
    return err(
      validationError('O usuário vinculado precisa ser membro do workspace'),
    )
  }
  return ok(undefined)
}

function phones(dto: {
  phone?: string | null
  whatsapp?: string | null
}): Pick<SdContactWriteData, 'phone' | 'whatsapp'> {
  return {
    ...(dto.phone !== undefined ? { phone: normalizePhone(dto.phone) } : {}),
    ...(dto.whatsapp !== undefined
      ? { whatsapp: normalizePhone(dto.whatsapp) }
      : {}),
  }
}

export const SdContactService = {
  async list(
    actorId: string,
    workspaceId: string,
    filters: ListSdContactsDTO,
  ): Promise<Result<SdPage<SdContactDTO>>> {
    const ctx = await agent(actorId, workspaceId, 'VIEW')
    if (!ctx.ok) return ctx

    const result = await SdContactRepository.list(workspaceId, filters)
    if (!result.ok) return result

    return ok({
      items: result.value.items.map(toSdContactDTO),
      total: result.value.total,
      page: filters.page,
      pageSize: filters.pageSize,
    })
  },

  async get(
    actorId: string,
    workspaceId: string,
    contactId: string,
  ): Promise<Result<SdContactDetailDTO>> {
    const ctx = await agent(actorId, workspaceId, 'VIEW')
    if (!ctx.ok) return ctx

    const contact = await SdContactRepository.findById(contactId, workspaceId)
    if (!contact.ok) return contact

    const tickets = await SdContactRepository.listRecentTickets(
      workspaceId,
      contactId,
    )
    if (!tickets.ok) return tickets

    return ok(toSdContactDetailDTO(contact.value, tickets.value))
  },

  /** Busca leve para o seletor, opcionalmente só contatos de um cliente. */
  async options(
    actorId: string,
    workspaceId: string,
    query: SdContactOptionsDTO,
  ): Promise<Result<SdOptionDTO[]>> {
    const ctx = await agent(actorId, workspaceId, 'VIEW')
    if (!ctx.ok) return ctx

    const rows = await SdContactRepository.options(workspaceId, query)
    if (!rows.ok) return rows

    return ok(
      rows.value.map((row) => {
        const parts = [
          row.jobTitle,
          row.customers[0]?.customer.name ?? null,
          row.email ?? (row.whatsapp ? formatPhone(row.whatsapp) : null),
        ].filter(Boolean)
        return {
          id: row.id,
          label: row.name,
          sublabel: parts.length ? parts.join(' · ') : null,
        }
      }),
    )
  },

  /**
   * Contato ativo pelo WhatsApp (com/sem o nono dígito) ou e-mail — contexto
   * de sistema, sem ator (webhook do WhatsApp do ServiceDesk, e-mail de
   * entrada). `null` quando nenhum casa.
   */
  async findByChannel(
    workspaceId: string,
    channel: { whatsapp?: string | null; email?: string | null },
  ): Promise<Result<SdContactDTO | null>> {
    const result = await SdContactRepository.findByChannel(workspaceId, {
      whatsapp: whatsappCandidates(channel.whatsapp),
      email: channel.email?.trim() || undefined,
    })
    if (!result.ok) return result
    return ok(result.value ? toSdContactDTO(result.value) : null)
  },

  /** `findByChannel` para agentes (rota `contacts/lookup`). */
  async lookup(
    actorId: string,
    workspaceId: string,
    query: SdContactLookupDTO,
  ): Promise<Result<SdContactDTO | null>> {
    const ctx = await agent(actorId, workspaceId, 'VIEW')
    if (!ctx.ok) return ctx
    return SdContactService.findByChannel(workspaceId, query)
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateSdContactDTO,
  ): Promise<Result<SdContactDTO>> {
    const ctx = await agent(actorId, workspaceId, 'CREATE')
    if (!ctx.ok) return ctx

    const links = await resolveLinks(workspaceId, dto.customers)
    if (!links.ok) return links
    const member = await assertMember(workspaceId, dto.userId)
    if (!member.ok) return member

    // TODO(servicedesk-integração): validar `dto.customFields` com
    // `validateSdCustomFieldValues(definitions, values, …)` (entidade CONTACT).
    const result = await SdContactRepository.create(
      {
        workspaceId,
        createdById: actorId,
        name: dto.name,
        jobTitle: dto.jobTitle,
        email: dto.email,
        ...phones(dto),
        userId: dto.userId,
        notes: dto.notes,
        customFields: dto.customFields,
        active: dto.active,
      },
      links.value,
    )
    if (!result.ok) {
      auditMutation({
        entity: 'sd_contact',
        action: 'create',
        actorId,
        outcome: 'failure',
        reason: result.error.code,
      })
      return result
    }

    auditMutation({
      entity: 'sd_contact',
      action: 'create',
      actorId,
      targetId: result.value.id,
      meta: { workspaceId, customers: links.value.length },
    })
    logger.info('servicedesk.contact.created', {
      workspaceId,
      contactId: result.value.id,
    })
    return ok(toSdContactDTO(result.value))
  },

  async update(
    actorId: string,
    workspaceId: string,
    contactId: string,
    dto: UpdateSdContactDTO,
  ): Promise<Result<SdContactDTO>> {
    const ctx = await agent(actorId, workspaceId, 'EDIT')
    if (!ctx.ok) return ctx

    const existing = await SdContactRepository.findById(contactId, workspaceId)
    if (!existing.ok) return existing

    let links: SdContactLinkInput[] | undefined
    if (dto.customers) {
      const resolved = await resolveLinks(workspaceId, dto.customers)
      if (!resolved.ok) return resolved
      links = resolved.value
    }
    if (dto.userId && dto.userId !== existing.value.userId) {
      const member = await assertMember(workspaceId, dto.userId)
      if (!member.ok) return member
    }

    // TODO(servicedesk-integração): validar `dto.customFields` com
    // `validateSdCustomFieldValues(definitions, values, …)` (entidade CONTACT).
    const result = await SdContactRepository.update(
      contactId,
      {
        name: dto.name,
        jobTitle: dto.jobTitle,
        email: dto.email,
        ...phones(dto),
        userId: dto.userId,
        notes: dto.notes,
        customFields: dto.customFields,
        active: dto.active,
      },
      links,
    )
    if (!result.ok) return result

    auditMutation({
      entity: 'sd_contact',
      action: 'update',
      actorId,
      targetId: contactId,
      meta: { workspaceId, fields: Object.keys(dto) },
    })
    return ok(toSdContactDTO(result.value))
  },

  async remove(
    actorId: string,
    workspaceId: string,
    contactId: string,
  ): Promise<Result<void>> {
    const ctx = await agent(actorId, workspaceId, 'DELETE')
    if (!ctx.ok) return ctx

    const existing = await SdContactRepository.findById(contactId, workspaceId)
    if (!existing.ok) return existing

    const result = await SdContactRepository.softDelete(contactId)
    if (!result.ok) return result

    auditMutation({
      entity: 'sd_contact',
      action: 'delete',
      actorId,
      targetId: contactId,
      meta: { workspaceId },
    })
    return ok(undefined)
  },
}
