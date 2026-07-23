import { auditMutation } from '@/lib/axiom/audit'
import { ok, type Result } from '@/src/lib/result'
import {
  toCrmMailingListDTO,
  toCrmMailingListMemberDTO,
} from '@/src/mappers/crm-email-marketing.mapper'
import {
  CrmMailingListMemberRepository,
  CrmMailingListRepository,
} from '@/src/repositories/crm-mailing-list.repository'
import type {
  AddCrmMailingListMemberDTO,
  CreateCrmMailingListDTO,
  UpdateCrmMailingListDTO,
} from '@/src/schemas/crm-mailing-list.schema'
import type {
  CrmMailingListDTO,
  CrmMailingListMemberDTO,
} from '@/types/crm-email-marketing'
import { assertMember } from './authz'

export const CrmMailingListService = {
  async list(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<CrmMailingListDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmMailingListRepository.listByWorkspace(workspaceId)
    if (!result.ok) return result

    return ok(result.value.map(toCrmMailingListDTO))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateCrmMailingListDTO,
  ): Promise<Result<CrmMailingListDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmMailingListRepository.create({
      workspaceId,
      createdById: actorId,
      name: dto.name,
      description: dto.description,
    })

    if (!result.ok) {
      auditMutation({
        entity: 'crm_mailing_list',
        action: 'create',
        actorId,
        outcome: 'failure',
        reason: result.error.code,
      })
      return result
    }

    auditMutation({
      entity: 'crm_mailing_list',
      action: 'create',
      actorId,
      targetId: result.value.id,
    })

    return ok(toCrmMailingListDTO(result.value))
  },

  async update(
    actorId: string,
    workspaceId: string,
    listId: string,
    dto: UpdateCrmMailingListDTO,
  ): Promise<Result<CrmMailingListDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmMailingListRepository.findById(
      listId,
      workspaceId,
    )
    if (!existing.ok) return existing

    const result = await CrmMailingListRepository.update(listId, {
      name: dto.name,
      description: dto.description,
    })
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_mailing_list',
      action: 'update',
      actorId,
      targetId: listId,
      meta: { fields: Object.keys(dto) },
    })

    return ok(toCrmMailingListDTO(result.value))
  },

  async remove(
    actorId: string,
    workspaceId: string,
    listId: string,
  ): Promise<Result<void>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmMailingListRepository.findById(
      listId,
      workspaceId,
    )
    if (!existing.ok) return existing

    const result = await CrmMailingListRepository.softDelete(listId)
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_mailing_list',
      action: 'delete',
      actorId,
      targetId: listId,
    })

    return ok(undefined)
  },

  async listMembers(
    actorId: string,
    workspaceId: string,
    listId: string,
  ): Promise<Result<CrmMailingListMemberDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const list = await CrmMailingListRepository.findById(listId, workspaceId)
    if (!list.ok) return list

    const result = await CrmMailingListMemberRepository.listByList(listId)
    if (!result.ok) return result

    return ok(result.value.map(toCrmMailingListMemberDTO))
  },

  async addMember(
    actorId: string,
    workspaceId: string,
    listId: string,
    dto: AddCrmMailingListMemberDTO,
  ): Promise<Result<CrmMailingListMemberDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const list = await CrmMailingListRepository.findById(listId, workspaceId)
    if (!list.ok) return list

    const result = await CrmMailingListMemberRepository.add({
      mailingListId: listId,
      email: dto.email,
      name: dto.name,
      personId: dto.personId,
    })
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_mailing_list',
      action: 'update',
      actorId,
      targetId: listId,
      meta: { memberAdded: dto.email },
    })

    return ok(toCrmMailingListMemberDTO(result.value))
  },

  async removeMember(
    actorId: string,
    workspaceId: string,
    listId: string,
    memberId: string,
  ): Promise<Result<void>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const list = await CrmMailingListRepository.findById(listId, workspaceId)
    if (!list.ok) return list

    const result = await CrmMailingListMemberRepository.remove(memberId)
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_mailing_list',
      action: 'update',
      actorId,
      targetId: listId,
      meta: { memberRemoved: memberId },
    })

    return ok(undefined)
  },
}
