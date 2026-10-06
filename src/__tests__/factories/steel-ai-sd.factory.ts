import type { AiToolContext, SteelAiTool } from '@/src/lib/ai/tools/types'
import type { Result } from '@/src/lib/result'
import type {
  SdAgentDTO,
  SdCategoryTreeDTO,
  SdConfigBootstrapDTO,
  SdDepartmentTreeDTO,
  SdPhaseDTO,
  SdScaleItemDTO,
} from '@/types/sd-config'
import type { SdConfigItemDetailDTO } from '@/types/sd-config-item'
import type { SdContactDTO } from '@/types/sd-contact'
import type { SdCustomerDTO } from '@/types/sd-customer'
import type { SdTicketDashboardRow } from '@/types/sd-dashboard'
import type { SdKbArticleDTO, SdKbSearchResultDTO } from '@/types/sd-kb-article'
import type { SdTicketDTO } from '@/types/sd-ticket'
import type { SdTicketApprovalDTO } from '@/types/sd-ticket-approval'
import type { SdTicketMessageDTO } from '@/types/sd-ticket-message'
import type { SdTicketTaskDTO } from '@/types/sd-ticket-task'
import type { AiToolPreviewDTO } from '@/types/steel-ai'

/**
 * DTO fixtures for the ServiceDesk Steel AI tools (unit tests mock the SD
 * services, so the tools only ever see DTOs).
 */

const AT = '2026-10-01T12:00:00.000Z'

const noSla = {
  dueAt: null,
  remainingMinutes: null,
  percentUsed: null,
  state: 'none' as const,
}

export const SD_USER_ME = {
  id: 'user-me',
  name: 'Ana Agente',
  email: 'ana@acme.com',
  image: null,
}

export function sdTicketDTO(overrides: Partial<SdTicketDTO> = {}): SdTicketDTO {
  return {
    id: 'ticket-1',
    workspaceId: 'ws1',
    number: 42,
    code: 'INC-000042',
    type: 'INCIDENT',
    title: 'Servidor de e-mail fora do ar',
    description: '<p>Ninguém recebe e-mail</p>',
    channel: 'AGENT',
    phaseId: 'ph-inc-new',
    phase: {
      id: 'ph-inc-new',
      name: 'Novo',
      color: null,
      category: 'NEW',
      completionPercent: 0,
      position: 0,
      wipLimit: 0,
    },
    completionPercent: 0,
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
    sla: { firstResponse: noSla, resolution: noSla },
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
    lastActivityAt: AT,
    createdAt: AT,
    updatedAt: AT,
    ...overrides,
  }
}

function scale(
  kind: SdScaleItemDTO['kind'],
  id: string,
  name: string,
  level: number,
): SdScaleItemDTO {
  return {
    id,
    kind,
    name,
    description: null,
    color: null,
    level,
    isDefault: false,
    createdAt: AT,
    updatedAt: AT,
  }
}

export function sdPhase(overrides: Partial<SdPhaseDTO>): SdPhaseDTO {
  return {
    id: 'ph',
    ticketType: 'INCIDENT',
    name: 'Fase',
    description: null,
    color: null,
    category: 'IN_PROGRESS',
    completionPercent: 50,
    position: 1,
    isInitial: false,
    pausesSla: false,
    requiresApproval: false,
    requiredFields: [],
    wipLimit: 0,
    active: true,
    createdAt: AT,
    updatedAt: AT,
    ...overrides,
  }
}

function category(
  id: string,
  level: SdCategoryTreeDTO['level'],
  name: string,
  children: SdCategoryTreeDTO[] = [],
  overrides: Partial<SdCategoryTreeDTO> = {},
): SdCategoryTreeDTO {
  return {
    id,
    parentId: null,
    level,
    name,
    description: null,
    icon: null,
    ticketTypes: [],
    departmentId: null,
    slaPolicyId: null,
    portalVisible: true,
    active: true,
    position: 0,
    createdAt: AT,
    updatedAt: AT,
    children,
    ...overrides,
  }
}

function department(
  id: string,
  name: string,
  children: SdDepartmentTreeDTO['children'] = [],
): SdDepartmentTreeDTO {
  return {
    id,
    parentId: null,
    name,
    description: null,
    email: null,
    color: null,
    calendarId: null,
    active: true,
    position: 0,
    members: [],
    createdAt: AT,
    updatedAt: AT,
    children,
  }
}

/**
 * Incident flow: Novo → Em andamento → Resolvido, plus Cancelado; Novo →
 * Resolvido is not allowed. Service requests have a free flow.
 */
export function sdConfigDTO(
  overrides: Partial<SdConfigBootstrapDTO> = {},
): SdConfigBootstrapDTO {
  const net = department('dep-net', 'Redes')
  const support = department('dep-sup', 'Suporte', [
    { ...department('dep-sup-n2', 'Suporte N2'), parentId: 'dep-sup' },
  ])
  return {
    me: {
      userId: SD_USER_ME.id,
      isAgent: true,
      isAdmin: false,
      departmentIds: ['dep-sup'],
      leadDepartmentIds: [],
    },
    settings: {
      ticketPrefixes: {
        INCIDENT: 'INC',
        SERVICE_REQUEST: 'REQ',
        CHANGE: 'CHG',
        PROBLEM: 'PRB',
      },
      portalEnabled: true,
      portalTicketTypes: ['INCIDENT', 'SERVICE_REQUEST'],
      portalCompanyScope: false,
      requireSignatureOnClose: false,
      requireSolutionOnResolve: true,
      reopenOnRequesterReply: true,
      slaAtRiskPercent: 80,
      defaultDepartmentId: null,
      aiEnabled: false,
      aiPreServiceEnabled: false,
    } as SdConfigBootstrapDTO['settings'],
    departments: [net, support],
    categories: [
      category('cat-net', 'CATEGORY', 'Rede', [
        category(
          'sub-wifi',
          'SUBCATEGORY',
          'Wi-Fi',
          [
            category('svc-wifi-access', 'SERVICE', 'Liberar acesso', [], {
              departmentId: 'dep-net',
            }),
          ],
          { parentId: 'cat-net' },
        ),
        category(
          'sub-vpn',
          'SUBCATEGORY',
          'VPN',
          [category('svc-vpn-access', 'SERVICE', 'Liberar acesso')],
          { parentId: 'cat-net' },
        ),
      ]),
      category('cat-old', 'CATEGORY', 'Legado', [], { active: false }),
      category('cat-chg', 'CATEGORY', 'Infra', [], {
        ticketTypes: ['CHANGE'],
      }),
    ],
    classifications: [
      {
        id: 'cls-fix',
        kind: 'SOLUTION',
        name: 'Correção aplicada',
        description: null,
        color: null,
        ticketTypes: [],
        active: true,
        position: 0,
        createdAt: AT,
        updatedAt: AT,
      },
    ],
    impacts: [
      scale('impact', 'imp-low', 'Baixo', 1),
      scale('impact', 'imp-high', 'Alto', 3),
    ],
    urgencies: [
      scale('urgency', 'urg-low', 'Baixa', 1),
      scale('urgency', 'urg-high', 'Alta', 3),
    ],
    priorities: [
      scale('priority', 'pri-low', 'Baixa', 1),
      scale('priority', 'pri-crit', 'Crítica', 4),
    ],
    severities: [scale('severity', 'sev-1', 'Sev 1', 1)],
    priorityMatrix: [
      { impactId: 'imp-high', urgencyId: 'urg-high', priorityId: 'pri-crit' },
      { impactId: 'imp-low', urgencyId: 'urg-low', priorityId: 'pri-low' },
    ],
    phases: [
      {
        ticketType: 'INCIDENT',
        phases: [
          sdPhase({
            id: 'ph-inc-new',
            name: 'Novo',
            category: 'NEW',
            position: 0,
          }),
          sdPhase({ id: 'ph-inc-prog', name: 'Em andamento', position: 1 }),
          sdPhase({
            id: 'ph-inc-res',
            name: 'Resolvido',
            category: 'RESOLVED',
            position: 2,
          }),
          sdPhase({
            id: 'ph-inc-cancel',
            name: 'Cancelado',
            category: 'CANCELED',
            position: 3,
          }),
        ],
        transitions: [
          {
            id: 't1',
            fromPhaseId: 'ph-inc-new',
            toPhaseId: 'ph-inc-prog',
            allowedDepartmentIds: [],
          },
          {
            id: 't2',
            fromPhaseId: 'ph-inc-prog',
            toPhaseId: 'ph-inc-res',
            allowedDepartmentIds: [],
          },
          {
            id: 't3',
            fromPhaseId: 'ph-inc-new',
            toPhaseId: 'ph-inc-cancel',
            allowedDepartmentIds: ['dep-net'],
          },
        ],
      },
      {
        ticketType: 'SERVICE_REQUEST',
        phases: [
          sdPhase({
            id: 'ph-req-new',
            ticketType: 'SERVICE_REQUEST',
            name: 'Novo',
            category: 'NEW',
          }),
          sdPhase({
            id: 'ph-req-prog',
            ticketType: 'SERVICE_REQUEST',
            name: 'Em andamento',
            pausesSla: true,
            requiresApproval: true,
            requiredFields: ['categoryId'],
          }),
        ],
        transitions: [],
      },
    ],
    customFields: [
      {
        id: 'cf-1',
        entity: 'TICKET',
        key: 'asset_tag',
        label: 'Patrimônio',
        description: null,
        type: 'TEXT',
        options: [],
        ticketTypes: [],
        categoryIds: [],
        required: false,
        visibleInPortal: false,
        defaultValue: null,
        active: true,
        position: 0,
        createdAt: AT,
        updatedAt: AT,
      },
    ],
    templates: [],
    cannedResponses: [],
    slaPolicies: [],
    ...overrides,
  }
}

export function sdAgentDTO(overrides: Partial<SdAgentDTO> = {}): SdAgentDTO {
  return {
    id: SD_USER_ME.id,
    name: SD_USER_ME.name,
    email: SD_USER_ME.email,
    image: null,
    isAdmin: false,
    isAgent: true,
    departments: [{ departmentId: 'dep-sup', isLead: false }],
    ...overrides,
  }
}

export function sdAgents(): SdAgentDTO[] {
  return [
    sdAgentDTO(),
    sdAgentDTO({
      id: 'user-bruno',
      name: 'Bruno Lima',
      email: 'bruno@acme.com',
    }),
    sdAgentDTO({
      id: 'user-bruna',
      name: 'Bruna Souza',
      email: 'bruna@acme.com',
    }),
    sdAgentDTO({
      id: 'user-req',
      name: 'Carlos Cliente',
      email: 'carlos@cliente.com',
      isAgent: false,
      departments: [],
    }),
  ]
}

export function sdTaskDTO(
  overrides: Partial<SdTicketTaskDTO> = {},
): SdTicketTaskDTO {
  return {
    id: 'task-1',
    ticketId: 'ticket-1',
    title: 'Reiniciar o serviço',
    description: null,
    status: 'TODO',
    assignee: null,
    dueDate: null,
    completedAt: null,
    position: 0,
    overdue: false,
    createdBy: null,
    createdAt: AT,
    updatedAt: AT,
    ...overrides,
  }
}

export function sdApprovalDTO(
  overrides: Partial<SdTicketApprovalDTO> = {},
): SdTicketApprovalDTO {
  return {
    id: 'appr-1',
    ticketId: 'ticket-1',
    approverName: 'Bruno Lima',
    approverEmail: 'bruno@acme.com',
    approver: null,
    status: 'PENDING',
    message: null,
    comment: null,
    requestedBy: null,
    sentAt: AT,
    respondedAt: null,
    expiresAt: AT,
    createdAt: AT,
    updatedAt: AT,
    ...overrides,
  }
}

export function sdMessageDTO(
  overrides: Partial<SdTicketMessageDTO> = {},
): SdTicketMessageDTO {
  return {
    id: 'msg-1',
    ticketId: 'ticket-1',
    authorKind: 'AGENT',
    author: SD_USER_ME,
    contact: null,
    visibility: 'PUBLIC',
    channel: 'PORTAL',
    body: 'Estamos verificando.',
    attachments: [],
    mentionedUserIds: [],
    editedAt: null,
    createdAt: AT,
    canEdit: true,
    editableUntil: null,
    ...overrides,
  } as SdTicketMessageDTO
}

export function sdKbArticleDTO(
  overrides: Partial<SdKbArticleDTO> = {},
): SdKbArticleDTO {
  return {
    id: 'kb-1',
    workspaceId: 'ws1',
    parentId: null,
    title: 'Como reiniciar o servidor de e-mail',
    icon: null,
    coverImage: null,
    status: 'PUBLISHED',
    visibility: 'INTERNAL',
    categoryId: null,
    tags: ['email'],
    position: 0,
    viewCount: 3,
    helpfulCount: 2,
    notHelpfulCount: 0,
    reuseCount: 5,
    sourceTicketId: null,
    reviewIntervalDays: null,
    reviewDueAt: null,
    lastReviewedAt: null,
    publishedAt: AT,
    archivedAt: null,
    createdAt: AT,
    updatedAt: AT,
    content: [{ type: 'p', children: [{ text: 'Passo 1: reinicie.' }] }],
    readingMinutes: 1,
    createdById: null,
    updatedById: null,
    createdBy: null,
    updatedBy: null,
    category: null,
    myVote: null,
    ...overrides,
  } as SdKbArticleDTO
}

export function sdKbSearchDTO(
  overrides: Partial<SdKbSearchResultDTO> = {},
): SdKbSearchResultDTO {
  const {
    content: _c,
    readingMinutes: _r,
    createdById: _a,
    updatedById: _b,
    createdBy: _d,
    updatedBy: _e,
    category: _f,
    myVote: _g,
    ...summary
  } = sdKbArticleDTO()
  return { ...summary, excerpt: 'reinicie o serviço', rank: 1, ...overrides }
}

export function sdCustomerDTO(
  overrides: Partial<SdCustomerDTO> = {},
): SdCustomerDTO {
  return {
    id: 'cust-1',
    workspaceId: 'ws1',
    kind: 'CLIENT',
    personType: 'LEGAL',
    name: 'Acme Ltda',
    tradeName: 'Acme',
    document: '11222333000181',
    email: 'contato@acme.com',
    phone: '551133334444',
    whatsapp: null,
    zipCode: '01001000',
    street: 'Praça da Sé',
    number: '1',
    complement: null,
    district: 'Sé',
    city: 'São Paulo',
    state: 'SP',
    country: 'BR',
    ibgeCode: null,
    notes: null,
    customFields: {},
    active: true,
    contactsCount: 2,
    configItemsCount: 1,
    createdById: 'user-me',
    createdAt: AT,
    updatedAt: AT,
    ...overrides,
  }
}

export function sdContactDTO(
  overrides: Partial<SdContactDTO> = {},
): SdContactDTO {
  return {
    id: 'contact-1',
    workspaceId: 'ws1',
    name: 'Joana Contato',
    jobTitle: 'TI',
    email: 'joana@acme.com',
    phone: '5511999990000',
    whatsapp: null,
    userId: null,
    user: null,
    notes: null,
    customFields: {},
    active: true,
    customers: [
      { id: 'cust-1', name: 'Acme Ltda', kind: 'CLIENT', isPrimary: true },
    ],
    createdById: 'user-me',
    createdAt: AT,
    updatedAt: AT,
    ...overrides,
  }
}

export function sdConfigItemDTO(
  overrides: Partial<SdConfigItemDetailDTO> = {},
): SdConfigItemDetailDTO {
  return {
    id: 'ci-1',
    workspaceId: 'ws1',
    name: 'srv-mail-01',
    code: 'CI-001',
    status: 'ACTIVE',
    criticality: 'HIGH',
    typeId: null,
    type: { id: 'type-1', name: 'Servidor', icon: null, color: null },
    parentId: null,
    parent: null,
    customerId: null,
    customer: { id: 'cust-1', name: 'Acme Ltda', kind: 'CLIENT' },
    departmentId: null,
    department: { id: 'dep-net', name: 'Redes' },
    ownerId: null,
    owner: {
      id: 'user-me',
      name: 'Ana Agente',
      email: 'ana@acme.com',
      image: null,
    },
    serialNumber: null,
    manufacturer: 'Dell',
    model: null,
    location: 'DC1',
    ipAddress: '10.0.0.5',
    purchasedAt: null,
    warrantyUntil: null,
    attributes: {},
    customFields: {},
    notes: null,
    childrenCount: 0,
    createdById: 'user-me',
    createdAt: AT,
    updatedAt: AT,
    ancestors: [{ id: 'ci-0', name: 'rack-01', code: null }],
    children: [
      {
        id: 'ci-2',
        name: 'disk-01',
        code: null,
        status: 'ACTIVE',
        typeName: null,
        childrenCount: 0,
      },
    ],
    recentTickets: [
      {
        id: 'ticket-1',
        number: 42,
        type: 'INCIDENT',
        title: 'Servidor de e-mail fora do ar',
        phaseName: 'Novo',
        phaseCategory: 'NEW',
      } as SdConfigItemDetailDTO['recentTickets'][number],
    ],
    ...overrides,
  }
}

export function sdDashboardRow(
  overrides: Partial<SdTicketDashboardRow> = {},
): SdTicketDashboardRow {
  return {
    id: 'ticket-1',
    number: 42,
    code: 'INC-000042',
    title: 'Servidor de e-mail fora do ar',
    type: 'Incidente',
    phase: 'Novo',
    phaseCategory: 'Novo',
    completionPercent: 0,
    priority: 'Alta',
    priorityLevel: 3,
    severity: null,
    impact: null,
    urgency: null,
    department: 'Suporte',
    assignee: null,
    assigneeId: null,
    requester: null,
    customer: null,
    company: null,
    contact: null,
    category: null,
    subcategory: null,
    service: null,
    classification: null,
    solutionClassification: null,
    channel: 'Agente',
    tags: [],
    isOpen: true,
    isUnassigned: true,
    isCritical: false,
    slaAtRisk: false,
    slaBreached: false,
    firstResponseBreached: false,
    resolutionBreached: false,
    createdAt: AT,
    resolvedAt: null,
    ...overrides,
  } as SdTicketDashboardRow
}

/** Calls a write tool's `preview` (always present on write tools). */
export function sdPreview<A>(
  tool: SteelAiTool<A>,
  ctx: AiToolContext,
  args: A,
): Promise<Result<AiToolPreviewDTO>> {
  if (!tool.preview) throw new Error(`${tool.name} has no preview`)
  return tool.preview(ctx, args)
}
