import type {
  Prisma,
  SdApprovalStatus,
  SdBusinessCalendar,
  SdCategory,
  SdCustomFieldDefinition,
  SdEscalationRule,
  SdPhase,
  SdPhaseCategory,
  SdPhaseTransition,
  SdSettings,
  SdTicketTemplate,
  SdTicketType,
} from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { DEFAULT_SD_TICKET_PREFIXES } from '@/src/lib/servicedesk/ticket-code'
import { dbError } from './db-error'

/**
 * Leitura da configuração do ServiceDesk usada pelo motor de chamados
 * (fases, transições, matriz, SLA, calendário, catálogo, modelos,
 * departamentos, regras). As tabelas pertencem à fatia de configuração; aqui
 * só consultas — a única escrita é garantir a linha de `sd_settings` e o
 * carimbo do round-robin.
 */

export type SdSlaPolicyWithTargets = Prisma.SdSlaPolicyGetPayload<{
  include: { targets: true; calendar: true }
}>

export type SdCategoryNode = Pick<
  SdCategory,
  | 'id'
  | 'level'
  | 'parentId'
  | 'departmentId'
  | 'slaPolicyId'
  | 'ticketTypes'
  | 'active'
  | 'portalVisible'
  | 'name'
>

/** Campos com FK que o chamado referencia e precisam ser do workspace. */
export interface SdTicketRefs {
  impactId?: string | null
  urgencyId?: string | null
  priorityId?: string | null
  severityId?: string | null
  classificationId?: string | null
  solutionClassificationId?: string | null
  customerId?: string | null
  companyId?: string | null
  contactId?: string | null
  configItemId?: string | null
  departmentId?: string | null
  parentId?: string | null
}

export type SdTicketRefField = keyof SdTicketRefs

const CATEGORY_SELECT = {
  id: true,
  level: true,
  parentId: true,
  departmentId: true,
  slaPolicyId: true,
  ticketTypes: true,
  active: true,
  portalVisible: true,
  name: true,
} as const

export const SdTicketContextRepository = {
  /** Linha de `sd_settings` do workspace, criada com os padrões se faltar. */
  async ensureSettings(workspaceId: string): Promise<Result<SdSettings>> {
    try {
      const row = await prisma.sdSettings.upsert({
        where: { workspaceId },
        update: {},
        create: { workspaceId, ticketPrefixes: DEFAULT_SD_TICKET_PREFIXES },
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to ensure ServiceDesk settings', error))
    }
  },

  async listPhases(
    workspaceId: string,
    ticketType: SdTicketType,
  ): Promise<Result<SdPhase[]>> {
    try {
      const rows = await prisma.sdPhase.findMany({
        where: { workspaceId, ticketType, active: true },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      })
      return ok(rows)
    } catch (error) {
      return err(dbError('Failed to list ServiceDesk phases', error))
    }
  },

  async findPhase(
    workspaceId: string,
    phaseId: string,
  ): Promise<Result<SdPhase | null>> {
    try {
      const row = await prisma.sdPhase.findFirst({
        where: { id: phaseId, workspaceId },
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to find ServiceDesk phase', error))
    }
  },

  /** Fase inicial do tipo (`isInitial`), senão a primeira NEW, senão a primeira. */
  async findInitialPhase(
    workspaceId: string,
    ticketType: SdTicketType,
  ): Promise<Result<SdPhase | null>> {
    try {
      const phases = await prisma.sdPhase.findMany({
        where: { workspaceId, ticketType, active: true },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      })
      return ok(
        phases.find((p) => p.isInitial) ??
          phases.find((p) => p.category === 'NEW') ??
          phases[0] ??
          null,
      )
    } catch (error) {
      return err(dbError('Failed to find ServiceDesk initial phase', error))
    }
  },

  async findFirstPhaseByCategory(
    workspaceId: string,
    ticketType: SdTicketType,
    category: SdPhaseCategory,
  ): Promise<Result<SdPhase | null>> {
    try {
      const row = await prisma.sdPhase.findFirst({
        where: { workspaceId, ticketType, category, active: true },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to find ServiceDesk phase', error))
    }
  },

  /** Transições cadastradas para o tipo (vazio = fluxo livre). */
  async listTransitions(
    workspaceId: string,
    ticketType: SdTicketType,
  ): Promise<Result<SdPhaseTransition[]>> {
    try {
      const rows = await prisma.sdPhaseTransition.findMany({
        where: { workspaceId, fromPhase: { ticketType } },
      })
      return ok(rows)
    } catch (error) {
      return err(dbError('Failed to list ServiceDesk transitions', error))
    }
  },

  async findMatrixPriorityId(
    workspaceId: string,
    impactId: string,
    urgencyId: string,
  ): Promise<Result<string | null>> {
    try {
      const row = await prisma.sdPriorityMatrix.findFirst({
        where: { workspaceId, impactId, urgencyId },
        select: { priorityId: true },
      })
      return ok(row?.priorityId ?? null)
    } catch (error) {
      return err(dbError('Failed to read ServiceDesk priority matrix', error))
    }
  },

  async findPriorityLevel(
    workspaceId: string,
    priorityId: string,
  ): Promise<Result<number | null>> {
    try {
      const row = await prisma.sdPriority.findFirst({
        where: { id: priorityId, workspaceId },
        select: { level: true },
      })
      return ok(row?.level ?? null)
    } catch (error) {
      return err(dbError('Failed to find ServiceDesk priority', error))
    }
  },

  /** Prioridade marcada como padrão (`isDefault`), se houver. */
  async findDefaultPriorityId(
    workspaceId: string,
  ): Promise<Result<string | null>> {
    try {
      const row = await prisma.sdPriority.findFirst({
        where: { workspaceId, isDefault: true },
        orderBy: { level: 'asc' },
        select: { id: true },
      })
      return ok(row?.id ?? null)
    } catch (error) {
      return err(dbError('Failed to find ServiceDesk default priority', error))
    }
  },

  /** Prioridade de peso imediatamente acima (escalonamento "aumentar prioridade"). */
  async findNextPriorityId(
    workspaceId: string,
    currentLevel: number | null,
  ): Promise<Result<string | null>> {
    try {
      const row = await prisma.sdPriority.findFirst({
        where: {
          workspaceId,
          ...(currentLevel === null ? {} : { level: { gt: currentLevel } }),
        },
        orderBy: { level: currentLevel === null ? 'desc' : 'asc' },
        select: { id: true },
      })
      return ok(row?.id ?? null)
    } catch (error) {
      return err(dbError('Failed to find ServiceDesk priority', error))
    }
  },

  async findCategory(
    workspaceId: string,
    id: string,
  ): Promise<Result<SdCategoryNode | null>> {
    try {
      const row = await prisma.sdCategory.findFirst({
        where: { id, workspaceId },
        select: CATEGORY_SELECT,
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to find ServiceDesk category', error))
    }
  },

  async listActiveSlaPolicies(
    workspaceId: string,
  ): Promise<Result<SdSlaPolicyWithTargets[]>> {
    try {
      const rows = await prisma.sdSlaPolicy.findMany({
        where: { workspaceId, active: true },
        include: { targets: true, calendar: true },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      })
      return ok(rows)
    } catch (error) {
      return err(dbError('Failed to list ServiceDesk SLA policies', error))
    }
  },

  async findSlaPolicy(
    workspaceId: string,
    id: string,
  ): Promise<Result<SdSlaPolicyWithTargets | null>> {
    try {
      const row = await prisma.sdSlaPolicy.findFirst({
        where: { id, workspaceId },
        include: { targets: true, calendar: true },
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to find ServiceDesk SLA policy', error))
    }
  },

  async findDefaultCalendar(
    workspaceId: string,
  ): Promise<Result<SdBusinessCalendar | null>> {
    try {
      const row = await prisma.sdBusinessCalendar.findFirst({
        where: { workspaceId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to find ServiceDesk calendar', error))
    }
  },

  async findTemplate(
    workspaceId: string,
    id: string,
  ): Promise<Result<SdTicketTemplate | null>> {
    try {
      const row = await prisma.sdTicketTemplate.findFirst({
        where: { id, workspaceId },
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to find ServiceDesk template', error))
    }
  },

  async listTicketCustomFields(
    workspaceId: string,
  ): Promise<Result<SdCustomFieldDefinition[]>> {
    try {
      const rows = await prisma.sdCustomFieldDefinition.findMany({
        where: { workspaceId, entity: 'TICKET', active: true },
        orderBy: { position: 'asc' },
      })
      return ok(rows)
    } catch (error) {
      return err(dbError('Failed to list ServiceDesk custom fields', error))
    }
  },

  async findDepartment(
    workspaceId: string,
    id: string,
  ): Promise<
    Result<{ id: string; name: string; parentId: string | null } | null>
  > {
    try {
      const row = await prisma.sdDepartment.findFirst({
        where: { id, workspaceId, deletedAt: null, active: true },
        select: { id: true, name: true, parentId: true },
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to find ServiceDesk department', error))
    }
  },

  async listDepartmentLeadIds(departmentId: string): Promise<Result<string[]>> {
    try {
      const rows = await prisma.sdDepartmentMember.findMany({
        where: { departmentId, isLead: true },
        orderBy: { createdAt: 'asc' },
        select: { userId: true },
      })
      return ok(rows.map((r) => r.userId))
    } catch (error) {
      return err(dbError('Failed to list ServiceDesk department leads', error))
    }
  },

  async isDepartmentMember(
    departmentId: string,
    userId: string,
  ): Promise<Result<boolean>> {
    try {
      const count = await prisma.sdDepartmentMember.count({
        where: { departmentId, userId },
      })
      return ok(count > 0)
    } catch (error) {
      return err(
        dbError('Failed to check ServiceDesk department member', error),
      )
    }
  },

  /**
   * Round-robin: o membro do departamento que recebeu há mais tempo (nunca
   * recebeu primeiro), carimbando `lastAssignedAt` na mesma transação.
   */
  async pickRoundRobinAssignee(
    departmentId: string,
    now: Date,
  ): Promise<Result<string | null>> {
    try {
      const userId = await prisma.$transaction(async (tx) => {
        const next = await tx.sdDepartmentMember.findFirst({
          where: { departmentId },
          orderBy: [
            { lastAssignedAt: { sort: 'asc', nulls: 'first' } },
            { createdAt: 'asc' },
          ],
        })
        if (!next) return null
        await tx.sdDepartmentMember.update({
          where: { id: next.id },
          data: { lastAssignedAt: now },
        })
        return next.userId
      })
      return ok(userId)
    } catch (error) {
      return err(dbError('Failed to pick ServiceDesk round-robin agent', error))
    }
  },

  async countSolutionClassifications(
    workspaceId: string,
    ticketType: SdTicketType,
  ): Promise<Result<number>> {
    try {
      const count = await prisma.sdClassification.count({
        where: {
          workspaceId,
          kind: 'SOLUTION',
          active: true,
          OR: [
            { ticketTypes: { isEmpty: true } },
            { ticketTypes: { has: ticketType } },
          ],
        },
      })
      return ok(count)
    } catch (error) {
      return err(dbError('Failed to count ServiceDesk classifications', error))
    }
  },

  async findLatestApprovalStatus(
    ticketId: string,
  ): Promise<Result<SdApprovalStatus | null>> {
    try {
      const row = await prisma.sdTicketApproval.findFirst({
        where: { ticketId, status: { not: 'CANCELED' } },
        orderBy: { createdAt: 'desc' },
        select: { status: true },
      })
      return ok(row?.status ?? null)
    } catch (error) {
      return err(dbError('Failed to read ServiceDesk approvals', error))
    }
  },

  async countSignatures(ticketId: string): Promise<Result<number>> {
    try {
      return ok(await prisma.sdTicketSignature.count({ where: { ticketId } }))
    } catch (error) {
      return err(dbError('Failed to count ServiceDesk signatures', error))
    }
  },

  /** Campos cujo id não existe no workspace (lista vazia = tudo certo). */
  async findMissingRefs(
    workspaceId: string,
    refs: SdTicketRefs,
  ): Promise<Result<SdTicketRefField[]>> {
    const ws = { workspaceId }
    const checks: Record<
      SdTicketRefField,
      ((id: string) => Promise<unknown>) | undefined
    > = {
      impactId: (id) => prisma.sdImpact.findFirst({ where: { id, ...ws } }),
      urgencyId: (id) => prisma.sdUrgency.findFirst({ where: { id, ...ws } }),
      priorityId: (id) => prisma.sdPriority.findFirst({ where: { id, ...ws } }),
      severityId: (id) => prisma.sdSeverity.findFirst({ where: { id, ...ws } }),
      classificationId: (id) =>
        prisma.sdClassification.findFirst({
          where: { id, ...ws, kind: 'TICKET' },
        }),
      solutionClassificationId: (id) =>
        prisma.sdClassification.findFirst({
          where: { id, ...ws, kind: 'SOLUTION' },
        }),
      customerId: (id) =>
        prisma.sdCustomer.findFirst({ where: { id, ...ws, deletedAt: null } }),
      companyId: (id) =>
        prisma.sdCustomer.findFirst({ where: { id, ...ws, deletedAt: null } }),
      contactId: (id) =>
        prisma.sdContact.findFirst({ where: { id, ...ws, deletedAt: null } }),
      configItemId: (id) =>
        prisma.sdConfigItem.findFirst({
          where: { id, ...ws, deletedAt: null },
        }),
      departmentId: (id) =>
        prisma.sdDepartment.findFirst({
          where: { id, ...ws, deletedAt: null, active: true },
        }),
      parentId: (id) =>
        prisma.sdTicket.findFirst({ where: { id, ...ws, deletedAt: null } }),
    }
    try {
      const entries = Object.entries(refs).filter(
        (entry): entry is [SdTicketRefField, string] =>
          typeof entry[1] === 'string' && entry[1].length > 0,
      )
      const found = await Promise.all(
        entries.map(([field, id]) => checks[field]?.(id) ?? null),
      )
      return ok(entries.filter((_, i) => !found[i]).map(([field]) => field))
    } catch (error) {
      return err(dbError('Failed to validate ServiceDesk references', error))
    }
  },

  /** Ids (dentre `userIds`) que NÃO são membros do workspace. */
  async findNonMembers(
    workspaceId: string,
    userIds: string[],
  ): Promise<Result<string[]>> {
    const unique = Array.from(new Set(userIds))
    if (unique.length === 0) return ok([])
    try {
      const rows = await prisma.membership.findMany({
        where: { workspaceId, userId: { in: unique } },
        select: { userId: true },
      })
      const members = new Set(rows.map((r) => r.userId))
      return ok(unique.filter((id) => !members.has(id)))
    } catch (error) {
      return err(dbError('Failed to check workspace members', error))
    }
  },

  async findUserNames(
    userIds: string[],
  ): Promise<Result<Map<string, { name: string; email: string }>>> {
    const unique = Array.from(new Set(userIds))
    if (unique.length === 0) return ok(new Map())
    try {
      const rows = await prisma.user.findMany({
        where: { id: { in: unique } },
        select: { id: true, name: true, email: true },
      })
      return ok(
        new Map(rows.map((r) => [r.id, { name: r.name, email: r.email }])),
      )
    } catch (error) {
      return err(dbError('Failed to read user names', error))
    }
  },

  async findWorkspace(
    workspaceId: string,
  ): Promise<Result<{ id: string; name: string; slug: string } | null>> {
    try {
      const row = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { id: true, name: true, slug: true },
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to find workspace', error))
    }
  },

  /** Primeiro OWNER (autor de registros criados por automação sem ator). */
  async findWorkspaceOwnerId(
    workspaceId: string,
  ): Promise<Result<string | null>> {
    try {
      const row = await prisma.membership.findFirst({
        where: { workspaceId, role: 'OWNER' },
        orderBy: { createdAt: 'asc' },
        select: { userId: true },
      })
      return ok(row?.userId ?? null)
    } catch (error) {
      return err(dbError('Failed to find workspace owner', error))
    }
  },

  /** Workspaces com o módulo SERVICE_DESK habilitado (tick do worker). */
  async listEnabledWorkspaceIds(): Promise<Result<string[]>> {
    try {
      const rows = await prisma.workspaceModuleAccess.findMany({
        where: {
          module: 'SERVICE_DESK',
          enabled: true,
          workspace: { status: 'ACTIVE' },
        },
        select: { workspaceId: true },
        orderBy: { workspaceId: 'asc' },
      })
      return ok(rows.map((r) => r.workspaceId))
    } catch (error) {
      return err(dbError('Failed to list ServiceDesk workspaces', error))
    }
  },

  async listActiveEscalationRules(
    workspaceId: string,
  ): Promise<Result<SdEscalationRule[]>> {
    try {
      const rows = await prisma.sdEscalationRule.findMany({
        where: { workspaceId, active: true },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      })
      return ok(rows)
    } catch (error) {
      return err(dbError('Failed to list ServiceDesk escalation rules', error))
    }
  },
}
