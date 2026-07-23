import type { Prisma } from '@prisma/client'
import { auditMutation } from '@/lib/axiom/audit'
import { ok, type Result } from '@/src/lib/result'
import { toCrmCompanyDTO } from '@/src/mappers/crm-company.mapper'
import { CrmCompanyRepository } from '@/src/repositories/crm-company.repository'
import type {
  CreateCrmCompanyDTO,
  ListCrmCompaniesDTO,
  UpdateCrmCompanyDTO,
} from '@/src/schemas/crm-company.schema'
import type { CrmCompanyDTO } from '@/types/crm-company'
import { assertMember } from './authz'

export const CrmCompanyService = {
  async list(
    actorId: string,
    workspaceId: string,
    filters: ListCrmCompaniesDTO,
  ): Promise<Result<CrmCompanyDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmCompanyRepository.listByWorkspace(workspaceId, {
      icp: filters.icp,
    })
    if (!result.ok) return result

    return ok(result.value.map(toCrmCompanyDTO))
  },

  async getById(
    actorId: string,
    workspaceId: string,
    companyId: string,
  ): Promise<Result<CrmCompanyDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmCompanyRepository.findById(companyId, workspaceId)
    if (!result.ok) return result

    return ok(toCrmCompanyDTO(result.value))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateCrmCompanyDTO,
  ): Promise<Result<CrmCompanyDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmCompanyRepository.create({
      workspaceId,
      createdById: actorId,
      name: dto.name,
      cnpj: dto.cnpj,
      domain: dto.domain,
      employees: dto.employees,
      linkedin: dto.linkedin,
      address: dto.address as Prisma.InputJsonValue | undefined,
      arr: dto.arr,
      icp: dto.icp,
      accountOwnerId: dto.accountOwnerId,
    })

    if (!result.ok) {
      auditMutation({
        entity: 'crm_company',
        action: 'create',
        actorId,
        outcome: 'failure',
        reason: result.error.code,
      })
      return result
    }

    auditMutation({
      entity: 'crm_company',
      action: 'create',
      actorId,
      targetId: result.value.id,
    })

    return ok(toCrmCompanyDTO(result.value))
  },

  async update(
    actorId: string,
    workspaceId: string,
    companyId: string,
    dto: UpdateCrmCompanyDTO,
  ): Promise<Result<CrmCompanyDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmCompanyRepository.findById(companyId, workspaceId)
    if (!existing.ok) return existing

    const result = await CrmCompanyRepository.update(companyId, {
      name: dto.name,
      cnpj: dto.cnpj,
      domain: dto.domain,
      employees: dto.employees,
      linkedin: dto.linkedin,
      address: dto.address as Prisma.InputJsonValue | undefined,
      arr: dto.arr,
      icp: dto.icp,
      accountOwnerId: dto.accountOwnerId,
      updatedById: actorId,
    })

    if (!result.ok) {
      auditMutation({
        entity: 'crm_company',
        action: 'update',
        actorId,
        targetId: companyId,
        outcome: 'failure',
        reason: result.error.code,
        meta: { fields: Object.keys(dto) },
      })
      return result
    }

    auditMutation({
      entity: 'crm_company',
      action: 'update',
      actorId,
      targetId: companyId,
      meta: { fields: Object.keys(dto) },
    })

    return ok(toCrmCompanyDTO(result.value))
  },

  async remove(
    actorId: string,
    workspaceId: string,
    companyId: string,
  ): Promise<Result<void>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmCompanyRepository.findById(companyId, workspaceId)
    if (!existing.ok) return existing

    const result = await CrmCompanyRepository.softDelete(companyId)
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_company',
      action: 'delete',
      actorId,
      targetId: companyId,
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

    return CrmCompanyRepository.reorder(workspaceId, orderedIds)
  },
}
