import type {
  SdPortalFormOptionsDTO,
  SdPortalSessionDTO,
  SdPortalTicketDetailDTO,
  SdPortalTicketSummaryDTO,
} from '@/types/sd-portal'

/** Base das rotas públicas do portal do contato externo. */
export const API = '/api/servicedesk/portal'

export const extSession: SdPortalSessionDTO = {
  contact: { id: 'contact1', name: 'Ana Souza', email: 'ana@acme.com.br' },
  workspace: { id: 'ws1', name: 'Stratus Telecom', slug: 'stratus' },
  customers: [{ id: 'cus1', name: 'ACME Ltda', isPrimary: true }],
  expiresAt: '2026-10-02T00:00:00.000Z',
  companyScope: true,
  ticketTypes: ['INCIDENT', 'SERVICE_REQUEST'],
}

export function extTicket(
  overrides: Partial<SdPortalTicketSummaryDTO> = {},
): SdPortalTicketSummaryDTO {
  return {
    id: 'ticket1',
    number: 12,
    code: 'INC-000012',
    type: 'INCIDENT',
    title: 'Impressora não imprime',
    phase: { name: 'Em atendimento', color: '#2563eb', category: 'IN_PROGRESS' },
    completionPercent: 40,
    companyName: 'ACME Ltda',
    assigneeName: 'Carlos A.',
    closed: false,
    csatScore: null,
    lastActivityAt: '2026-10-01T12:00:00.000Z',
    createdAt: '2026-10-01T10:00:00.000Z',
    ...overrides,
  }
}

export function extTicketDetail(
  overrides: Partial<SdPortalTicketDetailDTO> = {},
): SdPortalTicketDetailDTO {
  return {
    ...extTicket(),
    description: '<p>Papel atolado no andar 3</p>',
    subject: 'Infraestrutura › Impressão',
    urgencyName: 'Alta',
    solution: null,
    resolvedAt: null,
    closedAt: null,
    csatComment: null,
    canReply: true,
    canRate: false,
    messages: [
      {
        id: 'm1',
        authorKind: 'AGENT',
        authorName: 'Carlos A.',
        mine: false,
        body: 'Já estamos olhando',
        attachments: [],
        createdAt: '2026-10-01T11:00:00.000Z',
      },
    ],
    ...overrides,
  }
}

export const extFormOptions: SdPortalFormOptionsDTO = {
  ticketTypes: ['INCIDENT', 'SERVICE_REQUEST'],
  catalog: [
    {
      id: 'cat1',
      name: 'Infraestrutura',
      ticketTypes: [],
      children: [
        { id: 'sub1', name: 'Impressão', ticketTypes: [], children: [] },
      ],
    },
  ],
  templates: [
    {
      id: 't1',
      name: 'Troca de toner',
      description: null,
      ticketType: 'SERVICE_REQUEST',
    },
  ],
  urgencies: [{ id: 'urg1', name: 'Alta' }],
  customFields: [
    {
      id: 'f1',
      key: 'andar',
      label: 'Andar',
      description: 'Onde você está',
      type: 'TEXT',
      required: false,
      options: [],
      ticketTypes: [],
      categoryIds: [],
    },
  ],
}

/** Página de chamados no formato da rota. */
export function extTicketPage(items: SdPortalTicketSummaryDTO[]) {
  return { items, total: items.length, page: 1, pageSize: 20 }
}
