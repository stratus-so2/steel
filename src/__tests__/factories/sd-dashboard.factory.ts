import { createId } from '@paralleldrive/cuid2'
import { Prisma } from '@prisma/client'
import type {
  SdDashboardCost,
  SdDashboardEvent,
  SdDashboardKbArticle,
  SdDashboardTicket,
} from '@/src/repositories/sd-dashboard-source.repository'

const fixed = () => new Date('2026-09-21T12:00:00.000Z')

/** Chamado no formato de `SD_DASHBOARD_TICKET_SELECT` (testes unitários). */
export function createFakeSdDashboardTicket(
  overrides?: Partial<SdDashboardTicket>,
): SdDashboardTicket {
  return {
    id: createId(),
    number: 1,
    type: 'INCIDENT',
    title: 'Impressora parada',
    channel: 'PORTAL',
    completionPercent: 0,
    assigneeId: null,
    escalationLevel: 0,
    tags: [],
    customFields: {},
    firstResponseDueAt: null,
    resolutionDueAt: null,
    firstRespondedAt: null,
    slaPausedAt: null,
    slaPausedMinutes: 0,
    firstResponseBreached: false,
    resolutionBreached: false,
    resolvedAt: null,
    closedAt: null,
    reopenCount: 0,
    csatScore: null,
    lastActivityAt: fixed(),
    createdAt: fixed(),
    phase: { name: 'Novo', category: 'NEW' },
    priority: null,
    severity: null,
    impact: null,
    urgency: null,
    department: null,
    assignee: null,
    requester: null,
    customer: null,
    company: null,
    contact: null,
    category: null,
    subcategory: null,
    service: null,
    classification: null,
    solutionClassification: null,
    slaPolicy: null,
    ...overrides,
  }
}

const ticketRef = (): SdDashboardCost['ticket'] => ({
  number: 7,
  type: 'SERVICE_REQUEST',
  title: 'Novo notebook',
  category: { name: 'Hardware' },
  priority: { name: 'P3' },
  department: { name: 'Suporte' },
  customer: { name: 'ACME' },
})

export function createFakeSdDashboardCost(
  overrides?: Partial<SdDashboardCost>,
): SdDashboardCost {
  return {
    id: createId(),
    ticketId: 't1',
    category: 'LABOR',
    description: 'Visita técnica',
    quantity: new Prisma.Decimal(2),
    unitCost: new Prisma.Decimal('150.5'),
    billable: true,
    incurredAt: fixed(),
    createdAt: fixed(),
    user: { name: 'Téc. Ana' },
    ticket: ticketRef(),
    ...overrides,
  }
}

export function createFakeSdDashboardEvent(
  overrides?: Partial<SdDashboardEvent>,
): SdDashboardEvent {
  return {
    id: createId(),
    ticketId: 't1',
    actorKind: 'AGENT',
    action: 'ticket.created',
    meta: null,
    createdAt: fixed(),
    actor: { name: 'Ana' },
    ticket: ticketRef(),
    ...overrides,
  }
}

export function createFakeSdDashboardKbArticle(
  overrides?: Partial<SdDashboardKbArticle>,
): SdDashboardKbArticle {
  return {
    id: createId(),
    title: 'Como configurar a VPN',
    status: 'PUBLISHED',
    visibility: 'PORTAL',
    tags: ['vpn'],
    viewCount: 10,
    helpfulCount: 3,
    notHelpfulCount: 1,
    publishedAt: fixed(),
    createdAt: fixed(),
    updatedAt: fixed(),
    category: { name: 'Acesso' },
    createdBy: { name: 'Ana' },
    ...overrides,
  }
}
