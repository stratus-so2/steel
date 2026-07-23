import { auditMutation } from '@/lib/axiom/audit'
import { ok, type Result } from '@/src/lib/result'
import { toCrmPersonDTO } from '@/src/mappers/crm-person.mapper'
import { CrmPersonRepository } from '@/src/repositories/crm-person.repository'
import type {
  CreateCrmPersonDTO,
  ListCrmPeopleDTO,
  UpdateCrmPersonDTO,
} from '@/src/schemas/crm-person.schema'
import type { CrmPersonDTO } from '@/types/crm-person'
import { assertMember } from './authz'

export const CrmPersonService = {
  async list(
    actorId: string,
    workspaceId: string,
    filters: ListCrmPeopleDTO,
  ): Promise<Result<CrmPersonDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmPersonRepository.listByWorkspace(workspaceId, {
      companyId: filters.companyId,
    })
    if (!result.ok) return result

    return ok(result.value.map(toCrmPersonDTO))
  },

  async getById(
    actorId: string,
    workspaceId: string,
    personId: string,
  ): Promise<Result<CrmPersonDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmPersonRepository.findById(personId, workspaceId)
    if (!result.ok) return result

    return ok(toCrmPersonDTO(result.value))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateCrmPersonDTO,
  ): Promise<Result<CrmPersonDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmPersonRepository.create({
      workspaceId,
      createdById: actorId,
      name: dto.name,
      emails: dto.emails,
      phones: dto.phones,
      city: dto.city,
      jobTitle: dto.jobTitle,
      linkedin: dto.linkedin,
      avatar: dto.avatar,
      companyId: dto.companyId,
    })

    if (!result.ok) {
      auditMutation({
        entity: 'crm_person',
        action: 'create',
        actorId,
        outcome: 'failure',
        reason: result.error.code,
      })
      return result
    }

    auditMutation({
      entity: 'crm_person',
      action: 'create',
      actorId,
      targetId: result.value.id,
    })

    return ok(toCrmPersonDTO(result.value))
  },

  async update(
    actorId: string,
    workspaceId: string,
    personId: string,
    dto: UpdateCrmPersonDTO,
  ): Promise<Result<CrmPersonDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmPersonRepository.findById(personId, workspaceId)
    if (!existing.ok) return existing

    const result = await CrmPersonRepository.update(personId, {
      name: dto.name,
      emails: dto.emails,
      phones: dto.phones,
      city: dto.city,
      jobTitle: dto.jobTitle,
      linkedin: dto.linkedin,
      avatar: dto.avatar,
      companyId: dto.companyId,
      updatedById: actorId,
    })

    if (!result.ok) {
      auditMutation({
        entity: 'crm_person',
        action: 'update',
        actorId,
        targetId: personId,
        outcome: 'failure',
        reason: result.error.code,
        meta: { fields: Object.keys(dto) },
      })
      return result
    }

    auditMutation({
      entity: 'crm_person',
      action: 'update',
      actorId,
      targetId: personId,
      meta: { fields: Object.keys(dto) },
    })

    return ok(toCrmPersonDTO(result.value))
  },

  async remove(
    actorId: string,
    workspaceId: string,
    personId: string,
  ): Promise<Result<void>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmPersonRepository.findById(personId, workspaceId)
    if (!existing.ok) return existing

    const result = await CrmPersonRepository.softDelete(personId)
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_person',
      action: 'delete',
      actorId,
      targetId: personId,
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

    return CrmPersonRepository.reorder(workspaceId, orderedIds)
  },
}
