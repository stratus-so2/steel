import { vi } from 'vitest'
import type { SdAgentDTO, SdMeDTO } from '@/types/sd-config'
import type { SdTicketDTO } from '@/types/sd-ticket'
import type { SdTicketTabProps } from '../tabs/types'

export const WS = 'ws-1'
export const TICKET_ID = 't1'

const sla = {
  dueAt: null,
  remainingMinutes: null,
  percentUsed: null,
  state: 'none' as const,
}

export function ticketDTO(overrides: Partial<SdTicketDTO> = {}): SdTicketDTO {
  return {
    id: TICKET_ID,
    workspaceId: WS,
    number: 1,
    code: 'INC-000001',
    type: 'INCIDENT',
    title: 'Servidor fora do ar',
    description: null,
    channel: 'AGENT',
    phaseId: 'p1',
    phase: {
      id: 'p1',
      name: 'Em andamento',
      color: null,
      category: 'IN_PROGRESS',
      completionPercent: 50,
      position: 1,
      wipLimit: 0,
    },
    completionPercent: 50,
    impact: null,
    urgency: null,
    priority: null,
    severity: null,
    category: null,
    subcategory: null,
    service: null,
    classification: null,
    solutionClassification: null,
    solution: null,
    customer: null,
    company: null,
    contact: null,
    configItem: null,
    department: null,
    assignee: null,
    requester: null,
    createdBy: null,
    participants: [],
    parent: null,
    childrenCount: 0,
    templateId: null,
    whatsappConversationId: null,
    escalationLevel: 0,
    tags: [],
    customFields: {},
    slaPolicyId: null,
    firstResponseDueAt: null,
    resolutionDueAt: null,
    firstRespondedAt: null,
    slaPausedAt: null,
    slaPausedMinutes: 0,
    firstResponseBreached: false,
    resolutionBreached: false,
    sla: { firstResponse: sla, resolution: sla },
    resolvedAt: null,
    closedAt: null,
    reopenCount: 0,
    changeType: null,
    changeRisk: null,
    plannedStartAt: null,
    plannedEndAt: null,
    implementationPlan: null,
    rollbackPlan: null,
    testPlan: null,
    rootCause: null,
    workaround: null,
    knownError: false,
    risk: null,
    aiSummary: null,
    aiTriage: null,
    csatScore: null,
    csatComment: null,
    lastActivityAt: '2026-09-21T12:00:00.000Z',
    createdAt: '2026-09-21T12:00:00.000Z',
    updatedAt: '2026-09-21T12:00:00.000Z',
    ...overrides,
  }
}

export const agentMe: SdMeDTO = {
  userId: 'u-agent',
  isAgent: true,
  isAdmin: false,
  departmentIds: ['d1'],
  leadDepartmentIds: [],
}

export const requesterMe: SdMeDTO = {
  userId: 'u-req',
  isAgent: false,
  isAdmin: false,
  departmentIds: [],
  leadDepartmentIds: [],
}

export function tabProps(
  mode: 'agent' | 'requester' = 'agent',
  ticket: Partial<SdTicketDTO> = {},
): SdTicketTabProps {
  return {
    workspaceId: WS,
    slug: 'acme',
    ticket: ticketDTO(ticket),
    me: mode === 'agent' ? agentMe : requesterMe,
    mode,
  }
}

export const user = (id: string, name: string) => ({
  id,
  name,
  email: `${id}@example.com`,
  image: null,
})

export const AGENTS: SdAgentDTO[] = [
  {
    ...user('u-agent', 'Ana Agente'),
    isAdmin: false,
    isAgent: true,
    departments: [{ departmentId: 'd1', isLead: false }],
  },
  {
    ...user('u-req', 'Rui Solicitante'),
    isAdmin: false,
    isAgent: false,
    departments: [],
  },
]

/** `useSdTicketRealtime` abre um EventSource — jsdom não tem. */
export function stubEventSource() {
  const instances: { url: string; close: () => void }[] = []
  class FakeEventSource {
    onmessage: ((e: MessageEvent) => void) | null = null
    url: string
    constructor(url: string) {
      this.url = url
      instances.push(this)
    }
    close() {}
  }
  vi.stubGlobal('EventSource', FakeEventSource)
  return instances
}

export const TAB_URL = `/api/workspaces/${WS}/servicedesk/tickets/${TICKET_ID}`
