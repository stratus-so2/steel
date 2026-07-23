import { auditMutation } from '@/lib/axiom/audit'
import { ok, type Result } from '@/src/lib/result'
import {
  toCrmCustomFieldDefinitionDTO,
  toCrmCustomFieldValueDTO,
} from '@/src/mappers/crm-custom-field.mapper'
import {
  CrmCustomFieldDefinitionRepository,
  CrmCustomFieldValueRepository,
} from '@/src/repositories/crm-custom-field.repository'
import type {
  CreateCrmCustomFieldDTO,
  ListCrmCustomFieldsDTO,
  UpdateCrmCustomFieldDTO,
} from '@/src/schemas/crm-custom-field.schema'
import type {
  CrmCustomFieldDefinitionDTO,
  CrmCustomFieldValueDTO,
} from '@/types/crm-custom-field'
import { assertMember } from './authz'

export const CrmCustomFieldDefinitionService = {
  async list(
    actorId: string,
    workspaceId: string,
    filters: ListCrmCustomFieldsDTO,
  ): Promise<Result<CrmCustomFieldDefinitionDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmCustomFieldDefinitionRepository.listByWorkspace(
      workspaceId,
      { entity: filters.entity },
    )
    if (!result.ok) return result

    return ok(result.value.map(toCrmCustomFieldDefinitionDTO))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateCrmCustomFieldDTO,
  ): Promise<Result<CrmCustomFieldDefinitionDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmCustomFieldDefinitionRepository.create({
      workspaceId,
      createdById: actorId,
      entity: dto.entity,
      key: dto.key,
      label: dto.label,
      type: dto.type,
      options: dto.options,
      required: dto.required,
    })

    if (!result.ok) {
      auditMutation({
        entity: 'crm_custom_field_definition',
        action: 'create',
        actorId,
        outcome: 'failure',
        reason: result.error.code,
      })
      return result
    }

    auditMutation({
      entity: 'crm_custom_field_definition',
      action: 'create',
      actorId,
      targetId: result.value.id,
    })

    return ok(toCrmCustomFieldDefinitionDTO(result.value))
  },

  async update(
    actorId: string,
    workspaceId: string,
    definitionId: string,
    dto: UpdateCrmCustomFieldDTO,
  ): Promise<Result<CrmCustomFieldDefinitionDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmCustomFieldDefinitionRepository.findById(
      definitionId,
      workspaceId,
    )
    if (!existing.ok) return existing

    const result = await CrmCustomFieldDefinitionRepository.update(
      definitionId,
      { ...dto, updatedById: actorId },
    )
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_custom_field_definition',
      action: 'update',
      actorId,
      targetId: definitionId,
      meta: { fields: Object.keys(dto) },
    })

    return ok(toCrmCustomFieldDefinitionDTO(result.value))
  },

  async remove(
    actorId: string,
    workspaceId: string,
    definitionId: string,
  ): Promise<Result<void>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmCustomFieldDefinitionRepository.findById(
      definitionId,
      workspaceId,
    )
    if (!existing.ok) return existing

    const result =
      await CrmCustomFieldDefinitionRepository.softDelete(definitionId)
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_custom_field_definition',
      action: 'delete',
      actorId,
      targetId: definitionId,
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

    return CrmCustomFieldDefinitionRepository.reorder(workspaceId, orderedIds)
  },
}

export const CrmCustomFieldValueService = {
  async listByRecord(
    actorId: string,
    workspaceId: string,
    recordId: string,
  ): Promise<Result<CrmCustomFieldValueDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmCustomFieldValueRepository.listByRecord(recordId)
    if (!result.ok) return result

    return ok(result.value.map(toCrmCustomFieldValueDTO))
  },

  async setValue(
    actorId: string,
    workspaceId: string,
    definitionId: string,
    recordId: string,
    value: string | number | boolean | null,
  ): Promise<Result<CrmCustomFieldValueDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const definition = await CrmCustomFieldDefinitionRepository.findById(
      definitionId,
      workspaceId,
    )
    if (!definition.ok) return definition

    const result = await CrmCustomFieldValueRepository.upsert(
      definitionId,
      recordId,
      value,
    )
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_custom_field_definition',
      action: 'update',
      actorId,
      targetId: definitionId,
      meta: { recordId },
    })

    return ok(toCrmCustomFieldValueDTO(result.value))
  },
}
