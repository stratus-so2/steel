import { auditMutation } from '@/lib/axiom/audit'
import { ok, type Result } from '@/src/lib/result'
import { toCrmProductDTO } from '@/src/mappers/crm-product.mapper'
import { CrmProductRepository } from '@/src/repositories/crm-product.repository'
import type {
  CreateCrmProductDTO,
  ListCrmProductsDTO,
  UpdateCrmProductDTO,
} from '@/src/schemas/crm-product.schema'
import type { CrmProductDTO } from '@/types/crm-product'
import { assertMember } from './authz'

export const CrmProductService = {
  async list(
    actorId: string,
    workspaceId: string,
    filters: ListCrmProductsDTO,
  ): Promise<Result<CrmProductDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmProductRepository.listByWorkspace(workspaceId, {
      active: filters.active,
    })
    if (!result.ok) return result

    return ok(result.value.map(toCrmProductDTO))
  },

  async getById(
    actorId: string,
    workspaceId: string,
    productId: string,
  ): Promise<Result<CrmProductDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmProductRepository.findById(productId, workspaceId)
    if (!result.ok) return result

    return ok(toCrmProductDTO(result.value))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateCrmProductDTO,
  ): Promise<Result<CrmProductDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmProductRepository.create({
      workspaceId,
      createdById: actorId,
      name: dto.name,
      sku: dto.sku,
      description: dto.description,
      unitPrice: dto.unitPrice,
      currency: dto.currency,
      billingType: dto.billingType,
      active: dto.active,
    })

    if (!result.ok) {
      auditMutation({
        entity: 'crm_product',
        action: 'create',
        actorId,
        outcome: 'failure',
        reason: result.error.code,
      })
      return result
    }

    auditMutation({
      entity: 'crm_product',
      action: 'create',
      actorId,
      targetId: result.value.id,
    })

    return ok(toCrmProductDTO(result.value))
  },

  async update(
    actorId: string,
    workspaceId: string,
    productId: string,
    dto: UpdateCrmProductDTO,
  ): Promise<Result<CrmProductDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmProductRepository.findById(productId, workspaceId)
    if (!existing.ok) return existing

    const result = await CrmProductRepository.update(productId, {
      name: dto.name,
      sku: dto.sku,
      description: dto.description,
      unitPrice: dto.unitPrice,
      currency: dto.currency,
      billingType: dto.billingType,
      active: dto.active,
      updatedById: actorId,
    })

    if (!result.ok) {
      auditMutation({
        entity: 'crm_product',
        action: 'update',
        actorId,
        targetId: productId,
        outcome: 'failure',
        reason: result.error.code,
        meta: { fields: Object.keys(dto) },
      })
      return result
    }

    auditMutation({
      entity: 'crm_product',
      action: 'update',
      actorId,
      targetId: productId,
      meta: { fields: Object.keys(dto) },
    })

    return ok(toCrmProductDTO(result.value))
  },

  async remove(
    actorId: string,
    workspaceId: string,
    productId: string,
  ): Promise<Result<void>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmProductRepository.findById(productId, workspaceId)
    if (!existing.ok) return existing

    const result = await CrmProductRepository.softDelete(productId)
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_product',
      action: 'delete',
      actorId,
      targetId: productId,
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

    return CrmProductRepository.reorder(workspaceId, orderedIds)
  },
}
