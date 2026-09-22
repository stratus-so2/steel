import { can } from '@/src/lib/permissions'
import { ok, type Result } from '@/src/lib/result'
import { toSdCannedResponseDTO } from '@/src/mappers/sd-canned-response.mapper'
import {
  pruneSdCategoryOrphans,
  toSdCategoryDTO,
  toSdCategoryTree,
} from '@/src/mappers/sd-category.mapper'
import { toSdClassificationDTO } from '@/src/mappers/sd-classification.mapper'
import { toSdCustomFieldDTO } from '@/src/mappers/sd-custom-field.mapper'
import {
  toSdDepartmentDTO,
  toSdDepartmentTree,
} from '@/src/mappers/sd-department.mapper'
import {
  toSdPhaseDTO,
  toSdPhaseFlows,
  toSdPhaseTransitionDTO,
} from '@/src/mappers/sd-phase.mapper'
import {
  toSdPriorityMatrixCellDTO,
  toSdScaleItemDTO,
} from '@/src/mappers/sd-priority.mapper'
import {
  toSdPublicSettingsDTO,
  toSdSettingsDTO,
} from '@/src/mappers/sd-settings.mapper'
import {
  toSdSlaPolicyDTO,
  toSdSlaPolicySummaryDTO,
} from '@/src/mappers/sd-sla-policy.mapper'
import { toSdTicketTemplateDTO } from '@/src/mappers/sd-ticket-template.mapper'
import { SdCannedResponseRepository } from '@/src/repositories/sd-canned-response.repository'
import { SdCategoryRepository } from '@/src/repositories/sd-category.repository'
import { SdClassificationRepository } from '@/src/repositories/sd-classification.repository'
import { SdConfigRepository } from '@/src/repositories/sd-config.repository'
import { SdCustomFieldRepository } from '@/src/repositories/sd-custom-field.repository'
import { SdDepartmentRepository } from '@/src/repositories/sd-department.repository'
import { SdPhaseRepository } from '@/src/repositories/sd-phase.repository'
import { SdPriorityRepository } from '@/src/repositories/sd-priority.repository'
import { SdSettingsRepository } from '@/src/repositories/sd-settings.repository'
import { SdSlaPolicyRepository } from '@/src/repositories/sd-sla-policy.repository'
import { SdTicketTemplateRepository } from '@/src/repositories/sd-ticket-template.repository'
import type { ListSdAgentsDTO } from '@/src/schemas/sd-config.schema'
import type {
  SdAgentDTO,
  SdConfigBootstrapDTO,
  SdMeDTO,
} from '@/types/sd-config'
import { isPrivilegedRole, resolvePermissions } from './authz'
import { SdAccess, type SdAccessContext } from './sd-access'

type Loaded<T> = {
  [K in keyof T]: T[K] extends Promise<Result<infer V>> ? V : never
}

/** Espera todas as leituras; o primeiro erro (na ordem das chaves) vence. */
async function loadAll<T extends Record<string, Promise<Result<unknown>>>>(
  tasks: T,
): Promise<Result<Loaded<T>>> {
  const keys = Object.keys(tasks)
  const results = await Promise.all(keys.map((key) => tasks[key]))
  const out: Record<string, unknown> = {}
  for (const [index, result] of results.entries()) {
    if (!result.ok) return result
    out[keys[index]] = result.value
  }
  return ok(out as Loaded<T>)
}

function toMe(ctx: SdAccessContext): SdMeDTO {
  return {
    userId: ctx.userId,
    isAgent: ctx.isAgent,
    isAdmin: ctx.isAdmin,
    departmentIds: ctx.departmentIds,
    leadDepartmentIds: ctx.leadDepartmentIds,
  }
}

export const SdConfigService = {
  /**
   * Pacote único para a UI de chamados (`GET servicedesk/config`). Itens
   * inativos vêm junto (com `active: false`) para exibir valores antigos.
   * Solicitantes recebem só o que o portal mostra: categorias/modelos/campos
   * visíveis e ativos, departamentos sem membros, sem respostas prontas nem
   * políticas de SLA.
   */
  async bootstrap(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<SdConfigBootstrapDTO>> {
    const access = await SdAccess.resolve(actorId, workspaceId)
    if (!access.ok) return access
    const ctx = access.value
    const agent = ctx.isAgent

    const loaded = await loadAll({
      settings: SdSettingsRepository.getOrCreate(workspaceId),
      departments: SdDepartmentRepository.list(workspaceId, {
        includeInactive: agent,
      }),
      categories: SdCategoryRepository.list(workspaceId, {
        includeInactive: agent,
      }),
      classifications: SdClassificationRepository.list(workspaceId, {
        includeInactive: true,
      }),
      impacts: SdPriorityRepository.list('impact', workspaceId),
      urgencies: SdPriorityRepository.list('urgency', workspaceId),
      priorities: SdPriorityRepository.list('priority', workspaceId),
      severities: SdPriorityRepository.list('severity', workspaceId),
      matrix: SdPriorityRepository.listMatrix(workspaceId),
      phases: SdPhaseRepository.list(workspaceId, { includeInactive: true }),
      transitions: SdPhaseRepository.listTransitions(workspaceId),
      customFields: SdCustomFieldRepository.list(workspaceId, {
        includeInactive: agent,
      }),
      templates: SdTicketTemplateRepository.list(workspaceId, {
        includeInactive: agent,
      }),
      canned: agent
        ? SdCannedResponseRepository.list(workspaceId)
        : Promise.resolve(ok([])),
      policies: agent
        ? SdSlaPolicyRepository.list(workspaceId)
        : Promise.resolve(ok([])),
    })
    if (!loaded.ok) return loaded
    const {
      settings,
      departments,
      categories,
      classifications,
      impacts,
      urgencies,
      priorities,
      severities,
      matrix,
      phases,
      transitions,
      customFields,
      templates,
      canned,
      policies,
    } = loaded.value

    const departmentDtos = departments
      .map(toSdDepartmentDTO)
      .map((d) => (agent ? d : { ...d, members: [] }))
    const categoryDtos = categories.map(toSdCategoryDTO)
    const visibleCategories = agent
      ? categoryDtos
      : pruneSdCategoryOrphans(categoryDtos.filter((c) => c.portalVisible))
    const fieldDtos = customFields.map(toSdCustomFieldDTO)
    const templateDtos = templates.map(toSdTicketTemplateDTO)

    return ok({
      me: toMe(ctx),
      settings: toSdPublicSettingsDTO(toSdSettingsDTO(settings)),
      departments: toSdDepartmentTree(departmentDtos),
      categories: toSdCategoryTree(visibleCategories),
      classifications: classifications.map(toSdClassificationDTO),
      impacts: impacts.map((r) => toSdScaleItemDTO('impact', r)),
      urgencies: urgencies.map((r) => toSdScaleItemDTO('urgency', r)),
      priorities: priorities.map((r) => toSdScaleItemDTO('priority', r)),
      severities: severities.map((r) => toSdScaleItemDTO('severity', r)),
      priorityMatrix: matrix.map(toSdPriorityMatrixCellDTO),
      phases: toSdPhaseFlows(
        phases.map(toSdPhaseDTO),
        transitions.map(toSdPhaseTransitionDTO),
      ),
      customFields: agent
        ? fieldDtos
        : fieldDtos.filter((f) => f.visibleInPortal),
      templates: agent
        ? templateDtos
        : templateDtos.filter((t) => t.portalVisible),
      cannedResponses: canned.map(toSdCannedResponseDTO),
      slaPolicies: policies.map((p) =>
        toSdSlaPolicySummaryDTO(toSdSlaPolicyDTO(p)),
      ),
    })
  },

  /** Contexto do usuário no ServiceDesk (`GET servicedesk/me`). */
  async me(actorId: string, workspaceId: string): Promise<Result<SdMeDTO>> {
    const ctx = await SdAccess.resolve(actorId, workspaceId)
    if (!ctx.ok) return ctx
    return ok(toMe(ctx.value))
  },

  /**
   * Agentes (admins + membros de departamentos ativos) com seus
   * departamentos, para os seletores de responsável. `includeRequesters`
   * traz também os demais membros (seletor de membros dos departamentos).
   */
  async agents(
    actorId: string,
    workspaceId: string,
    filters: ListSdAgentsDTO = { includeRequesters: false },
  ): Promise<Result<SdAgentDTO[]>> {
    const ctx = await SdAccess.requireAgent(actorId, workspaceId)
    if (!ctx.ok) return ctx

    const members = await SdConfigRepository.listWorkspaceMembers(workspaceId)
    if (!members.ok) return members

    const agents = members.value.map((m): SdAgentDTO => {
      const permissions = resolvePermissions(m.role, m.profile)
      const isAdmin =
        isPrivilegedRole(m.role) ||
        (permissions !== null && can(permissions, 'sd-settings', 'EDIT'))
      return {
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        image: m.user.image,
        isAdmin,
        isAgent: isAdmin || m.departments.length > 0,
        departments: m.departments,
      }
    })
    return ok(
      filters.includeRequesters ? agents : agents.filter((a) => a.isAgent),
    )
  },
}
