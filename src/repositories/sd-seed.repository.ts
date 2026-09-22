import type { Prisma, SdTicketType } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import type { Result } from '@/src/lib/result'
import { SD_DEFAULT_TICKET_PREFIXES } from '@/src/schemas/sd-settings.schema'
import type {
  SdSeedCatalogNode,
  SdSeedPlan,
  SdSeedScale,
} from '@/src/services/sd-seed-data'
import { sdDb } from './sd-config-db'

export type SdSeedSummary = Record<
  | 'calendars'
  | 'impacts'
  | 'urgencies'
  | 'priorities'
  | 'severities'
  | 'matrixCells'
  | 'classifications'
  | 'phases'
  | 'slaPolicies'
  | 'configItemTypes'
  | 'departments'
  | 'categories'
  | 'templates'
  | 'escalationRules'
  | 'automationRules',
  number
>

type Tx = Prisma.TransactionClient

const json = (value: unknown) => value as Prisma.InputJsonValue

/** Cria os níveis ausentes (idempotente por `level`) e devolve nível → id. */
async function seedScale(
  tx: Tx,
  workspaceId: string,
  kind: 'impact' | 'urgency' | 'priority' | 'severity',
  items: SdSeedScale[],
): Promise<{ created: number; byLevel: Map<number, string> }> {
  const where = { workspaceId }
  let created = 0
  if (kind === 'impact') {
    created = (
      await tx.sdImpact.createMany({
        data: items.map((i) => ({
          workspaceId,
          name: i.name,
          level: i.level,
          description: i.description ?? null,
        })),
        skipDuplicates: true,
      })
    ).count
  } else if (kind === 'urgency') {
    created = (
      await tx.sdUrgency.createMany({
        data: items.map((i) => ({
          workspaceId,
          name: i.name,
          level: i.level,
          description: i.description ?? null,
        })),
        skipDuplicates: true,
      })
    ).count
  } else if (kind === 'severity') {
    created = (
      await tx.sdSeverity.createMany({
        data: items.map((i) => ({
          workspaceId,
          name: i.name,
          level: i.level,
          description: i.description ?? null,
          color: i.color ?? null,
        })),
        skipDuplicates: true,
      })
    ).count
  } else {
    // Só marca a padrão se a workspace ainda não tem uma.
    const hasDefault =
      (await tx.sdPriority.count({ where: { workspaceId, isDefault: true } })) >
      0
    created = (
      await tx.sdPriority.createMany({
        data: items.map((i) => ({
          workspaceId,
          name: i.name,
          level: i.level,
          color: i.color ?? null,
          isDefault: !hasDefault && !!i.isDefault,
        })),
        skipDuplicates: true,
      })
    ).count
  }

  const select = { id: true, level: true } as const
  const rows =
    kind === 'impact'
      ? await tx.sdImpact.findMany({ where, select })
      : kind === 'urgency'
        ? await tx.sdUrgency.findMany({ where, select })
        : kind === 'priority'
          ? await tx.sdPriority.findMany({ where, select })
          : await tx.sdSeverity.findMany({ where, select })
  return { created, byLevel: new Map(rows.map((r) => [r.level, r.id])) }
}

async function seedCatalog(
  tx: Tx,
  workspaceId: string,
  nodes: SdSeedCatalogNode[],
  parentId: string | null,
  depth: number,
): Promise<number> {
  const level = (['CATEGORY', 'SUBCATEGORY', 'SERVICE'] as const)[depth]
  let count = 0
  for (const [position, node] of nodes.entries()) {
    const created = await tx.sdCategory.create({
      data: { workspaceId, parentId, level, name: node.name, position },
    })
    count += 1
    if (node.children?.length && depth < 2) {
      count += await seedCatalog(
        tx,
        workspaceId,
        node.children,
        created.id,
        depth + 1,
      )
    }
  }
  return count
}

export const SdSeedRepository = {
  /**
   * Aplica o plano numa transação. Idempotente: calendários, políticas,
   * classificações, modelos, regras e departamentos por nome; escalas por
   * nível; matriz por célula; fases por tipo (tipo que já tem fases fica
   * como está); catálogo de exemplo só se a workspace não tem categorias.
   */
  async apply(
    workspaceId: string,
    actorId: string,
    plan: SdSeedPlan,
  ): Promise<Result<SdSeedSummary>> {
    return sdDb('Failed to seed ServiceDesk defaults', () =>
      prisma.$transaction(
        async (tx) => {
          const summary: SdSeedSummary = {
            calendars: 0,
            impacts: 0,
            urgencies: 0,
            priorities: 0,
            severities: 0,
            matrixCells: 0,
            classifications: 0,
            phases: 0,
            slaPolicies: 0,
            configItemTypes: 0,
            departments: 0,
            categories: 0,
            templates: 0,
            escalationRules: 0,
            automationRules: 0,
          }

          // Calendários
          const calendars = await tx.sdBusinessCalendar.findMany({
            where: { workspaceId },
            select: { id: true, name: true, isDefault: true },
          })
          const calendarIds = new Map(calendars.map((c) => [c.name, c.id]))
          let hasDefaultCalendar = calendars.some((c) => c.isDefault)
          for (const calendar of plan.calendars) {
            if (calendarIds.has(calendar.name)) continue
            const created = await tx.sdBusinessCalendar.create({
              data: {
                workspaceId,
                name: calendar.name,
                timezone: calendar.timezone,
                schedule: json(calendar.schedule),
                holidays: json(calendar.holidays),
                is24x7: calendar.is24x7,
                isDefault: calendar.isDefault && !hasDefaultCalendar,
              },
            })
            hasDefaultCalendar ||= created.isDefault
            calendarIds.set(calendar.name, created.id)
            summary.calendars += 1
          }

          // Escalas + matriz
          const impacts = await seedScale(
            tx,
            workspaceId,
            'impact',
            plan.impacts,
          )
          const urgencies = await seedScale(
            tx,
            workspaceId,
            'urgency',
            plan.urgencies,
          )
          const priorities = await seedScale(
            tx,
            workspaceId,
            'priority',
            plan.priorities,
          )
          const severities = await seedScale(
            tx,
            workspaceId,
            'severity',
            plan.severities,
          )
          summary.impacts = impacts.created
          summary.urgencies = urgencies.created
          summary.priorities = priorities.created
          summary.severities = severities.created

          const cells = plan.matrix.flatMap((cell) => {
            const impactId = impacts.byLevel.get(cell.impactLevel)
            const urgencyId = urgencies.byLevel.get(cell.urgencyLevel)
            const priorityId = priorities.byLevel.get(cell.priorityLevel)
            return impactId && urgencyId && priorityId
              ? [{ workspaceId, impactId, urgencyId, priorityId }]
              : []
          })
          summary.matrixCells = (
            await tx.sdPriorityMatrix.createMany({
              data: cells,
              skipDuplicates: true,
            })
          ).count

          // Classificações
          const classifications = await tx.sdClassification.findMany({
            where: { workspaceId },
            select: { kind: true, name: true },
          })
          const existingClassifications = new Set(
            classifications.map((c) => `${c.kind}:${c.name}`),
          )
          const missingClassifications = plan.classifications.filter(
            (c) => !existingClassifications.has(`${c.kind}:${c.name}`),
          )
          summary.classifications = (
            await tx.sdClassification.createMany({
              data: missingClassifications.map((c, position) => ({
                workspaceId,
                kind: c.kind,
                name: c.name,
                color: c.color,
                position: position + classifications.length,
              })),
            })
          ).count

          // Fases (por tipo)
          for (const [ticketType, phases] of Object.entries(plan.phases) as [
            SdTicketType,
            SdSeedPlan['phases'][SdTicketType],
          ][]) {
            const existing = await tx.sdPhase.count({
              where: { workspaceId, ticketType },
            })
            if (existing > 0) continue
            summary.phases += (
              await tx.sdPhase.createMany({
                data: phases.map((p, position) => ({
                  workspaceId,
                  ticketType,
                  name: p.name,
                  color: p.color,
                  category: p.category,
                  completionPercent: p.completionPercent,
                  position,
                  isInitial: !!p.isInitial,
                  pausesSla: !!p.pausesSla,
                  requiresApproval: !!p.requiresApproval,
                  requiredFields: p.requiredFields ?? [],
                })),
              })
            ).count
          }

          // Políticas de SLA
          const policies = await tx.sdSlaPolicy.findMany({
            where: { workspaceId },
            select: { id: true, name: true, isDefault: true },
          })
          const policyNames = new Set(policies.map((p) => p.name))
          let defaultPolicyId = policies.find((p) => p.isDefault)?.id ?? null
          for (const [index, policy] of plan.slaPolicies.entries()) {
            if (policyNames.has(policy.name)) continue
            const isDefault = policy.isDefault && !defaultPolicyId
            const created = await tx.sdSlaPolicy.create({
              data: {
                workspaceId,
                name: policy.name,
                description: policy.description,
                calendarId: calendarIds.get(policy.calendarName) ?? null,
                conditions: json(policy.conditions),
                isDefault,
                position: policies.length + index,
                targets: {
                  create: policy.targets.flatMap((t) => {
                    const priorityId = priorities.byLevel.get(t.priorityLevel)
                    return priorityId
                      ? [
                          {
                            priorityId,
                            firstResponseMinutes: t.firstResponseMinutes,
                            resolutionMinutes: t.resolutionMinutes,
                          },
                        ]
                      : []
                  }),
                },
              },
            })
            if (isDefault) defaultPolicyId = created.id
            summary.slaPolicies += 1
          }

          // Tipos de CI
          summary.configItemTypes = (
            await tx.sdConfigItemType.createMany({
              data: plan.configItemTypes.map((t, position) => ({
                workspaceId,
                name: t.name,
                icon: t.icon,
                color: t.color,
                attributeSchema: json(t.attributeSchema),
                position,
              })),
              skipDuplicates: true,
            })
          ).count

          // Departamentos
          const actorIsMember =
            (await tx.membership.count({
              where: { workspaceId, userId: actorId },
            })) > 0
          let serviceDeskId: string | null = null
          for (const [position, dept] of plan.departments.entries()) {
            let root = await tx.sdDepartment.findFirst({
              where: {
                workspaceId,
                parentId: null,
                name: dept.name,
                deletedAt: null,
              },
              select: { id: true },
            })
            if (!root) {
              root = await tx.sdDepartment.create({
                data: {
                  workspaceId,
                  name: dept.name,
                  description: dept.description,
                  color: dept.color,
                  position,
                },
                select: { id: true },
              })
              summary.departments += 1
              if (dept.actorIsLead && actorIsMember) {
                await tx.sdDepartmentMember.create({
                  data: {
                    departmentId: root.id,
                    userId: actorId,
                    isLead: true,
                  },
                })
              }
            }
            if (dept.actorIsLead) serviceDeskId = root.id
            for (const [childPosition, child] of dept.children.entries()) {
              const exists = await tx.sdDepartment.count({
                where: {
                  workspaceId,
                  parentId: root.id,
                  name: child.name,
                  deletedAt: null,
                },
              })
              if (exists > 0) continue
              await tx.sdDepartment.create({
                data: {
                  workspaceId,
                  parentId: root.id,
                  name: child.name,
                  description: child.description,
                  color: child.color,
                  position: childPosition,
                },
              })
              summary.departments += 1
            }
          }

          // Catálogo de exemplo
          if ((await tx.sdCategory.count({ where: { workspaceId } })) === 0) {
            summary.categories = await seedCatalog(
              tx,
              workspaceId,
              plan.catalog,
              null,
              0,
            )
          }

          // Modelos
          const templates = await tx.sdTicketTemplate.findMany({
            where: { workspaceId },
            select: { ticketType: true, name: true },
          })
          const templateKeys = new Set(
            templates.map((t) => `${t.ticketType}:${t.name}`),
          )
          const missingTemplates = plan.templates.filter(
            (t) => !templateKeys.has(`${t.ticketType}:${t.name}`),
          )
          summary.templates = (
            await tx.sdTicketTemplate.createMany({
              data: missingTemplates.map((t, position) => ({
                workspaceId,
                ticketType: t.ticketType,
                name: t.name,
                description: t.description,
                defaults: json(t.defaults),
                tasks: json(t.tasks),
                portalVisible: t.portalVisible,
                position,
              })),
            })
          ).count

          // Regras
          const escalations = new Set(
            (
              await tx.sdEscalationRule.findMany({
                where: { workspaceId },
                select: { name: true },
              })
            ).map((r) => r.name),
          )
          summary.escalationRules = (
            await tx.sdEscalationRule.createMany({
              data: plan.escalationRules
                .filter((r) => !escalations.has(r.name))
                .map((r, position) => ({
                  workspaceId,
                  name: r.name,
                  trigger: r.trigger,
                  conditions: json(r.conditions),
                  actions: json(r.actions),
                  position,
                })),
            })
          ).count

          const automations = new Set(
            (
              await tx.sdAutomationRule.findMany({
                where: { workspaceId },
                select: { name: true },
              })
            ).map((r) => r.name),
          )
          summary.automationRules = (
            await tx.sdAutomationRule.createMany({
              data: plan.automationRules
                .filter((r) => !automations.has(r.name))
                .map((r, position) => ({
                  workspaceId,
                  name: r.name,
                  description: r.description,
                  event: r.event,
                  conditions: json(r.conditions),
                  actions: json(r.actions),
                  position,
                })),
            })
          ).count

          // Configuração geral: padrões só onde ainda está vazio.
          const settings = await tx.sdSettings.upsert({
            where: { workspaceId },
            create: { workspaceId, ticketPrefixes: SD_DEFAULT_TICKET_PREFIXES },
            update: {},
          })
          await tx.sdSettings.update({
            where: { workspaceId },
            data: {
              defaultDepartmentId:
                settings.defaultDepartmentId ?? serviceDeskId,
              defaultSlaPolicyId:
                settings.defaultSlaPolicyId ?? defaultPolicyId,
            },
          })

          return summary
        },
        { timeout: 60_000, maxWait: 10_000 },
      ),
    )
  },
}
