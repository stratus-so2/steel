import { createId } from '@paralleldrive/cuid2'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import type {
  SdRecurringTicketRunWithTicket,
  SdRecurringTicketWithRelations,
} from '@/src/repositories/sd-recurring-ticket.repository'

/**
 * Fábricas dos chamados recorrentes: fakes para os testes unitários (service
 * e processor) e seeds no banco para os de integração.
 */

const fixed = () => new Date('2026-10-01T12:00:00.000Z')

export function createFakeSdRecurringTicket(
  overrides?: Partial<SdRecurringTicketWithRelations>,
): SdRecurringTicketWithRelations {
  return {
    id: 'rec1',
    workspaceId: 'ws1',
    name: 'Backup semanal do ERP',
    description: 'Conferir o backup e registrar o resultado',
    active: true,
    ticketType: 'SERVICE_REQUEST',
    templateId: null,
    defaults: {},
    customerId: null,
    configItemId: null,
    departmentId: null,
    assigneeId: null,
    frequency: 'WEEKLY',
    interval: 1,
    byWeekday: [1],
    byMonthday: null,
    atTime: '08:00',
    timezone: 'America/Sao_Paulo',
    startsAt: new Date('2026-10-01T03:00:00.000Z'),
    endsAt: null,
    leadTimeMinutes: 0,
    skipIfOpen: true,
    lastRunAt: null,
    nextRunAt: new Date('2026-10-05T11:00:00.000Z'),
    createdById: 'u1',
    createdAt: fixed(),
    updatedAt: fixed(),
    deletedAt: null,
    template: null,
    customer: null,
    configItem: null,
    _count: { runs: 0 },
    ...overrides,
  }
}

export function createFakeSdRecurringRun(
  overrides?: Partial<SdRecurringTicketRunWithTicket>,
): SdRecurringTicketRunWithTicket {
  return {
    id: createId(),
    workspaceId: 'ws1',
    recurringId: 'rec1',
    scheduledFor: new Date('2026-10-05T11:00:00.000Z'),
    status: 'CREATED',
    ticketId: null,
    reason: null,
    createdAt: fixed(),
    ticket: null,
    ...overrides,
  }
}

/* --------------------------- seeds (integration) -------------------------- */

export async function seedSdRecurringTicket(
  workspaceId: string,
  createdById: string,
  overrides?: Partial<Prisma.SdRecurringTicketUncheckedCreateInput>,
) {
  return prisma.sdRecurringTicket.create({
    data: {
      workspaceId,
      createdById,
      name: `Rotina ${createId().slice(0, 6)}`,
      ticketType: 'SERVICE_REQUEST',
      frequency: 'MONTHLY',
      byMonthday: 5,
      startsAt: new Date('2026-10-01T03:00:00.000Z'),
      nextRunAt: new Date('2026-10-05T11:00:00.000Z'),
      ...overrides,
    },
  })
}

export async function seedSdRecurringRun(
  workspaceId: string,
  recurringId: string,
  overrides?: Partial<Prisma.SdRecurringTicketRunUncheckedCreateInput>,
) {
  return prisma.sdRecurringTicketRun.create({
    data: {
      workspaceId,
      recurringId,
      scheduledFor: new Date('2026-10-05T11:00:00.000Z'),
      ...overrides,
    },
  })
}
