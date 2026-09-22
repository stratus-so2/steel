import { auditMutation } from '@/lib/axiom/audit'
import { logger } from '@/lib/axiom/logger'
import {
  sdConfigItemCycle,
  sdConfigItemNotFound,
  sdCustomerNotFound,
  sdDepartmentNotFound,
  validationError,
} from '@/src/errors'
import type { PermissionAction } from '@/src/lib/permissions'
import { err, ok, type Result } from '@/src/lib/result'
import {
  parseCiAttributeSchema,
  type SdCiAttributeDefinition,
  type SdCiAttributes,
  validateCiAttributes,
} from '@/src/lib/servicedesk/ci-attributes'
import {
  toSdConfigItemDetailDTO,
  toSdConfigItemDTO,
} from '@/src/mappers/sd-config-item.mapper'
import { SdConfigItemRepository } from '@/src/repositories/sd-config-item.repository'
import { SdConfigItemTypeRepository } from '@/src/repositories/sd-config-item-type.repository'
import { SdContactRepository } from '@/src/repositories/sd-contact.repository'
import { SdCustomerRepository } from '@/src/repositories/sd-customer.repository'
import type {
  CreateSdConfigItemDTO,
  ListSdConfigItemsDTO,
  SdConfigItemOptionsDTO,
  UpdateSdConfigItemDTO,
} from '@/src/schemas/sd-config-item.schema'
import type {
  SdConfigItemDetailDTO,
  SdConfigItemDTO,
} from '@/types/sd-config-item'
import type { SdOptionDTO, SdPage } from '@/types/sd-directory'
import { SdAccess } from './sd-access'

const RESOURCE = 'sd-config-items'

function agent(actorId: string, workspaceId: string, action: PermissionAction) {
  return SdAccess.requireAgent(actorId, workspaceId, {
    resource: RESOURCE,
    action,
  })
}

type RefInput = Pick<
  UpdateSdConfigItemDTO,
  'typeId' | 'parentId' | 'customerId' | 'departmentId' | 'ownerId'
>

/**
 * Confere as referências preenchidas (mesma workspace, não excluídas) e,
 * para `parentId`, que não forme ciclo com `itemId`. Devolve o esquema de
 * atributos do tipo informado (quando houver).
 */
async function validateRefs(
  workspaceId: string,
  dto: RefInput,
  itemId?: string,
): Promise<Result<{ schema: SdCiAttributeDefinition[] | null }>> {
  let schema: SdCiAttributeDefinition[] | null = null
  if (dto.typeId) {
    const type = await SdConfigItemTypeRepository.findById(
      dto.typeId,
      workspaceId,
    )
    if (!type.ok) return type
    schema = parseCiAttributeSchema(type.value.attributeSchema)
  }

  if (dto.parentId) {
    if (dto.parentId === itemId) return err(sdConfigItemCycle())
    const chain = await SdConfigItemRepository.listChain(
      workspaceId,
      dto.parentId,
    )
    if (!chain.ok) return chain
    if (chain.value.length === 0) return err(sdConfigItemNotFound())
    if (itemId && chain.value.some((node) => node.id === itemId)) {
      return err(sdConfigItemCycle())
    }
  }

  if (dto.customerId) {
    const found = await SdCustomerRepository.findExistingIds(workspaceId, [
      dto.customerId,
    ])
    if (!found.ok) return found
    if (found.value.length === 0) return err(sdCustomerNotFound())
  }

  if (dto.departmentId) {
    const found = await SdConfigItemRepository.departmentExists(
      workspaceId,
      dto.departmentId,
    )
    if (!found.ok) return found
    if (!found.value) return err(sdDepartmentNotFound())
  }

  if (dto.ownerId) {
    const member = await SdContactRepository.isWorkspaceMember(
      workspaceId,
      dto.ownerId,
    )
    if (!member.ok) return member
    if (!member.value) {
      return err(
        validationError('O responsável precisa ser membro do workspace'),
      )
    }
  }

  return ok({ schema })
}

/** Atributos contra o esquema do tipo; sem tipo, só descarta os vazios. */
function resolveAttributes(
  schema: SdCiAttributeDefinition[] | null,
  values: Record<string, unknown>,
  options: { dropUnknown?: boolean } = {},
): Result<SdCiAttributes> {
  if (!schema) {
    const out: SdCiAttributes = {}
    for (const [key, value] of Object.entries(values)) {
      if (
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        (typeof value === 'string' && value.trim() !== '')
      ) {
        out[key] = value
      }
    }
    return ok(out)
  }
  const result = validateCiAttributes(schema, values, options)
  if (!result.ok) {
    return err(validationError('Atributos inválidos', result.issues))
  }
  return ok(result.value)
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

export const SdConfigItemService = {
  async list(
    actorId: string,
    workspaceId: string,
    filters: ListSdConfigItemsDTO,
  ): Promise<Result<SdPage<SdConfigItemDTO>>> {
    const ctx = await agent(actorId, workspaceId, 'VIEW')
    if (!ctx.ok) return ctx

    const result = await SdConfigItemRepository.list(workspaceId, filters)
    if (!result.ok) return result

    return ok({
      items: result.value.items.map(toSdConfigItemDTO),
      total: result.value.total,
      page: filters.page,
      pageSize: filters.pageSize,
    })
  },

  async get(
    actorId: string,
    workspaceId: string,
    itemId: string,
  ): Promise<Result<SdConfigItemDetailDTO>> {
    const ctx = await agent(actorId, workspaceId, 'VIEW')
    if (!ctx.ok) return ctx

    const item = await SdConfigItemRepository.findById(itemId, workspaceId)
    if (!item.ok) return item

    const [ancestors, children, tickets] = await Promise.all([
      item.value.parentId
        ? SdConfigItemRepository.listChain(workspaceId, item.value.parentId)
        : Promise.resolve(ok([])),
      SdConfigItemRepository.listChildren(workspaceId, itemId),
      SdConfigItemRepository.listRecentTickets(workspaceId, itemId),
    ])
    if (!ancestors.ok) return ancestors
    if (!children.ok) return children
    if (!tickets.ok) return tickets

    return ok(
      toSdConfigItemDetailDTO(
        item.value,
        ancestors.value,
        children.value,
        tickets.value,
      ),
    )
  },

  /** Busca leve para o seletor de CI (opcionalmente só de um cliente). */
  async options(
    actorId: string,
    workspaceId: string,
    query: SdConfigItemOptionsDTO,
  ): Promise<Result<SdOptionDTO[]>> {
    const ctx = await agent(actorId, workspaceId, 'VIEW')
    if (!ctx.ok) return ctx

    const rows = await SdConfigItemRepository.options(workspaceId, query)
    if (!rows.ok) return rows

    return ok(
      rows.value.map((row) => {
        const parts = [
          row.code,
          row.type?.name ?? null,
          row.customer?.name ?? null,
        ].filter(Boolean)
        return {
          id: row.id,
          label: row.name,
          sublabel: parts.length ? parts.join(' · ') : null,
        }
      }),
    )
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateSdConfigItemDTO,
  ): Promise<Result<SdConfigItemDTO>> {
    const ctx = await agent(actorId, workspaceId, 'CREATE')
    if (!ctx.ok) return ctx

    const refs = await validateRefs(workspaceId, dto)
    if (!refs.ok) return refs
    const attributes = resolveAttributes(refs.value.schema, dto.attributes)
    if (!attributes.ok) return attributes

    // TODO(servicedesk-integração): validar `dto.customFields` com
    // `validateSdCustomFieldValues(definitions, values, …)` (CONFIG_ITEM).
    const result = await SdConfigItemRepository.create({
      workspaceId,
      createdById: actorId,
      name: dto.name,
      typeId: dto.typeId,
      parentId: dto.parentId,
      code: dto.code,
      status: dto.status,
      criticality: dto.criticality,
      customerId: dto.customerId,
      departmentId: dto.departmentId,
      ownerId: dto.ownerId,
      serialNumber: dto.serialNumber,
      manufacturer: dto.manufacturer,
      model: dto.model,
      location: dto.location,
      ipAddress: dto.ipAddress,
      purchasedAt: dto.purchasedAt,
      warrantyUntil: dto.warrantyUntil,
      attributes: attributes.value,
      customFields: dto.customFields,
      notes: dto.notes,
    })
    if (!result.ok) {
      auditMutation({
        entity: 'sd_config_item',
        action: 'create',
        actorId,
        outcome: 'failure',
        reason: result.error.code,
      })
      return result
    }

    auditMutation({
      entity: 'sd_config_item',
      action: 'create',
      actorId,
      targetId: result.value.id,
      meta: { workspaceId },
    })
    logger.info('servicedesk.config_item.created', {
      workspaceId,
      configItemId: result.value.id,
      typeId: result.value.typeId,
    })
    return ok(toSdConfigItemDTO(result.value))
  },

  async update(
    actorId: string,
    workspaceId: string,
    itemId: string,
    dto: UpdateSdConfigItemDTO,
  ): Promise<Result<SdConfigItemDTO>> {
    const ctx = await agent(actorId, workspaceId, 'EDIT')
    if (!ctx.ok) return ctx

    const existing = await SdConfigItemRepository.findById(itemId, workspaceId)
    if (!existing.ok) return existing

    // O esquema vale para o tipo final (novo ou o atual).
    const typeId = dto.typeId !== undefined ? dto.typeId : existing.value.typeId
    const typeChanged =
      dto.typeId !== undefined && dto.typeId !== existing.value.typeId
    const needsSchema = dto.attributes !== undefined || typeChanged

    const refs = await validateRefs(
      workspaceId,
      {
        typeId: needsSchema ? typeId : undefined,
        parentId: dto.parentId,
        customerId: dto.customerId,
        departmentId: dto.departmentId,
        ownerId: dto.ownerId,
      },
      itemId,
    )
    if (!refs.ok) return refs

    let attributes: SdCiAttributes | undefined
    if (dto.attributes !== undefined) {
      const resolved = resolveAttributes(refs.value.schema, dto.attributes)
      if (!resolved.ok) return resolved
      attributes = resolved.value
    } else if (typeChanged && refs.value.schema) {
      // Troca de tipo: aproveita o que couber no novo esquema.
      const resolved = resolveAttributes(
        refs.value.schema,
        asRecord(existing.value.attributes),
        { dropUnknown: true },
      )
      if (!resolved.ok) return resolved
      attributes = resolved.value
    }

    // TODO(servicedesk-integração): validar `dto.customFields` com
    // `validateSdCustomFieldValues(definitions, values, …)` (CONFIG_ITEM).
    const result = await SdConfigItemRepository.update(itemId, {
      name: dto.name,
      typeId: dto.typeId,
      parentId: dto.parentId,
      code: dto.code,
      status: dto.status,
      criticality: dto.criticality,
      customerId: dto.customerId,
      departmentId: dto.departmentId,
      ownerId: dto.ownerId,
      serialNumber: dto.serialNumber,
      manufacturer: dto.manufacturer,
      model: dto.model,
      location: dto.location,
      ipAddress: dto.ipAddress,
      purchasedAt: dto.purchasedAt,
      warrantyUntil: dto.warrantyUntil,
      attributes,
      customFields: dto.customFields,
      notes: dto.notes,
    })
    if (!result.ok) return result

    auditMutation({
      entity: 'sd_config_item',
      action: 'update',
      actorId,
      targetId: itemId,
      meta: { workspaceId, fields: Object.keys(dto) },
    })
    return ok(toSdConfigItemDTO(result.value))
  },

  async remove(
    actorId: string,
    workspaceId: string,
    itemId: string,
  ): Promise<Result<void>> {
    const ctx = await agent(actorId, workspaceId, 'DELETE')
    if (!ctx.ok) return ctx

    const existing = await SdConfigItemRepository.findById(itemId, workspaceId)
    if (!existing.ok) return existing

    const result = await SdConfigItemRepository.softDelete(
      itemId,
      existing.value.parentId,
    )
    if (!result.ok) return result

    auditMutation({
      entity: 'sd_config_item',
      action: 'delete',
      actorId,
      targetId: itemId,
      meta: { workspaceId },
    })
    return ok(undefined)
  },
}
