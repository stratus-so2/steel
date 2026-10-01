import { describe, expect, it } from 'vitest'
import {
  createFakeSdPortalAccess,
  createFakeSdPortalContact,
  createFakeSdPortalTicket,
} from '@/src/__tests__/factories/sd-portal.factory'
import { DEFAULT_SD_TICKET_PREFIXES } from '@/src/lib/servicedesk/ticket-code'
import type { SdTicketMessageWithRelations } from '@/src/repositories/sd-ticket-message.repository'
import {
  sdPortalAccessStatus,
  sdPortalShortName,
  sdPortalSubject,
  toSdPortalAccessDTO,
  toSdPortalCatalogTree,
  toSdPortalCustomerDTOs,
  toSdPortalCustomFieldDTO,
  toSdPortalMessageDTO,
  toSdPortalTemplateDTO,
  toSdPortalTicketDetailDTO,
  toSdPortalTicketSummaryDTO,
} from '../sd-portal.mapper'

const PREFIXES = DEFAULT_SD_TICKET_PREFIXES

function message(
  overrides?: Partial<SdTicketMessageWithRelations>,
): SdTicketMessageWithRelations {
  return {
    id: 'm1',
    workspaceId: 'ws1',
    ticketId: 'ticket1',
    authorKind: 'AGENT',
    authorUserId: 'u1',
    authorContactId: null,
    visibility: 'PUBLIC',
    channel: 'PLATFORM',
    body: 'Já estamos olhando',
    whatsappMessageId: null,
    editedAt: null,
    createdAt: new Date('2026-10-01T13:00:00.000Z'),
    deletedAt: null,
    authorUser: {
      id: 'u1',
      name: 'Carlos Atendimento Silva',
      email: 'carlos@stratus.com.br',
      image: null,
    },
    authorContact: null,
    attachments: [],
    ...overrides,
  } as SdTicketMessageWithRelations
}

describe('sdPortalShortName', () => {
  it('keeps the first name and abbreviates the surname', () => {
    expect(sdPortalShortName('Carlos Atendimento Silva')).toBe('Carlos A.')
    expect(sdPortalShortName('Ana')).toBe('Ana')
    expect(sdPortalShortName('  ')).toBe('')
  })
})

describe('sdPortalSubject', () => {
  it('joins the catalog chain and falls back to null', () => {
    expect(
      sdPortalSubject(
        createFakeSdPortalTicket({
          category: { id: 'c', name: 'Infra' },
          subcategory: { id: 's', name: 'Impressão' },
          service: { id: 'v', name: 'Impressora' },
        }),
      ),
    ).toBe('Infra › Impressão › Impressora')
    expect(
      sdPortalSubject(
        createFakeSdPortalTicket({ category: null, subcategory: null }),
      ),
    ).toBeNull()
  })
})

describe('toSdPortalCustomerDTOs', () => {
  it('drops deleted companies and keeps the primary flag', () => {
    const dtos = toSdPortalCustomerDTOs(
      createFakeSdPortalContact({
        customers: [
          {
            isPrimary: true,
            customer: { id: 'a', name: 'ACME', deletedAt: null },
          },
          {
            isPrimary: false,
            customer: { id: 'b', name: 'Antiga', deletedAt: new Date() },
          },
        ],
      }),
    )
    expect(dtos).toEqual([{ id: 'a', name: 'ACME', isPrimary: true }])
  })
})

describe('toSdPortalTicketSummaryDTO', () => {
  it('exposes only the customer-facing slice', () => {
    const dto = toSdPortalTicketSummaryDTO(createFakeSdPortalTicket(), PREFIXES)
    expect(dto).toEqual({
      id: 'ticket1',
      number: 12,
      code: 'INC-000012',
      type: 'INCIDENT',
      title: 'Impressora não imprime',
      phase: {
        name: 'Em atendimento',
        color: '#2563eb',
        category: 'IN_PROGRESS',
      },
      completionPercent: 30,
      companyName: 'ACME Ltda',
      assigneeName: 'Carlos A.',
      closed: false,
      csatScore: null,
      lastActivityAt: '2026-10-01T12:00:00.000Z',
      createdAt: '2026-10-01T12:00:00.000Z',
    })
    expect(dto).not.toHaveProperty('departmentId')
    expect(dto).not.toHaveProperty('slaPolicyId')
    expect(dto).not.toHaveProperty('resolutionDueAt')
    expect(dto).not.toHaveProperty('aiSummary')
    expect(dto).not.toHaveProperty('rootCause')
  })

  it('marks closed tickets and falls back to the customer name', () => {
    const dto = toSdPortalTicketSummaryDTO(
      createFakeSdPortalTicket({
        company: null,
        assignee: null,
        phase: {
          id: 'p',
          name: 'Fechado',
          color: null,
          category: 'CLOSED',
        },
      }),
      PREFIXES,
    )
    expect(dto.closed).toBe(true)
    expect(dto.companyName).toBe('ACME Ltda')
    expect(dto.assigneeName).toBeNull()
  })

  it('shows no company when the ticket has none', () => {
    const dto = toSdPortalTicketSummaryDTO(
      createFakeSdPortalTicket({ company: null, customer: null }),
      PREFIXES,
    )
    expect(dto.companyName).toBeNull()
  })
})

describe('toSdPortalMessageDTO', () => {
  it('shows the short agent name and builds the portal attachment url', () => {
    const dto = toSdPortalMessageDTO(
      message({
        attachments: [
          {
            id: 'att1',
            workspaceId: 'ws1',
            ticketId: 'ticket1',
            messageId: 'm1',
            uploadedById: 'u1',
            kind: 'DOCUMENT',
            fileName: 'ordem.pdf',
            mimeType: 'application/pdf',
            size: 2048,
            storageKey: 'ws1/tickets/ticket1/att1-ordem.pdf',
            createdAt: new Date('2026-10-01T13:00:00.000Z'),
            deletedAt: null,
            uploadedBy: null,
          },
        ] as SdTicketMessageWithRelations['attachments'],
      }),
      { contactId: 'contact1', ticketNumber: 12 },
    )
    expect(dto.authorName).toBe('Carlos A.')
    expect(dto.mine).toBe(false)
    expect(dto.attachments[0].url).toBe(
      '/api/servicedesk/portal/tickets/12/attachments/att1',
    )
    expect(dto.attachments[0]).not.toHaveProperty('storageKey')
  })

  it('labels the contact own messages as "Você"', () => {
    const dto = toSdPortalMessageDTO(
      message({
        authorKind: 'CONTACT',
        authorUserId: null,
        authorUser: null,
        authorContactId: 'contact1',
        authorContact: { id: 'contact1', name: 'Ana Souza' },
      }),
      { contactId: 'contact1', ticketNumber: 12 },
    )
    expect(dto.mine).toBe(true)
    expect(dto.authorName).toBe('Você')
  })

  it('names another contact and falls back for system messages', () => {
    const other = toSdPortalMessageDTO(
      message({
        authorKind: 'CONTACT',
        authorUserId: null,
        authorUser: null,
        authorContactId: 'contact9',
        authorContact: { id: 'contact9', name: 'João Outro' },
      }),
      { contactId: 'contact1', ticketNumber: 12 },
    )
    expect(other.authorName).toBe('João Outro')

    const system = toSdPortalMessageDTO(
      message({
        authorKind: 'SYSTEM',
        authorUserId: null,
        authorUser: null,
      }),
      { contactId: 'contact1', ticketNumber: 12 },
    )
    expect(system.authorName).toBe('Equipe de atendimento')
  })
})

describe('toSdPortalTicketDetailDTO', () => {
  it('allows replying and hides rating until it is resolved', () => {
    const dto = toSdPortalTicketDetailDTO(
      createFakeSdPortalTicket(),
      [message()],
      { prefixes: PREFIXES, contactId: 'contact1' },
    )
    expect(dto.canReply).toBe(true)
    expect(dto.canRate).toBe(false)
    expect(dto.subject).toBe('Infraestrutura')
    expect(dto.urgencyName).toBe('Alta')
    expect(dto.messages).toHaveLength(1)
  })

  it('allows rating a resolved ticket that has no score yet', () => {
    const dto = toSdPortalTicketDetailDTO(
      createFakeSdPortalTicket({
        phase: {
          id: 'p',
          name: 'Resolvido',
          color: null,
          category: 'RESOLVED',
        },
        resolvedAt: new Date('2026-10-01T18:00:00.000Z'),
        solution: '<p>Trocamos o fusor</p>',
      }),
      [],
      { prefixes: PREFIXES, contactId: 'contact1' },
    )
    expect(dto.canRate).toBe(true)
    expect(dto.solution).toBe('<p>Trocamos o fusor</p>')
    expect(dto.resolvedAt).toBe('2026-10-01T18:00:00.000Z')
  })

  it('blocks replying and rating on a canceled or already rated ticket', () => {
    const canceled = toSdPortalTicketDetailDTO(
      createFakeSdPortalTicket({
        phase: {
          id: 'p',
          name: 'Cancelado',
          color: null,
          category: 'CANCELED',
        },
      }),
      [],
      { prefixes: PREFIXES, contactId: 'contact1' },
    )
    expect(canceled.canReply).toBe(false)
    expect(canceled.canRate).toBe(false)

    const rated = toSdPortalTicketDetailDTO(
      createFakeSdPortalTicket({
        phase: { id: 'p', name: 'Fechado', color: null, category: 'CLOSED' },
        csatScore: 5,
        csatComment: 'Ótimo',
        closedAt: new Date('2026-10-02T10:00:00.000Z'),
      }),
      [],
      { prefixes: PREFIXES, contactId: 'contact1' },
    )
    expect(rated.canRate).toBe(false)
    expect(rated.csatComment).toBe('Ótimo')
    expect(rated.closedAt).toBe('2026-10-02T10:00:00.000Z')
  })
})

describe('sdPortalAccessStatus', () => {
  const now = new Date('2026-10-02T12:00:00.000Z')

  it('reads revoked, used, active, expired and pending', () => {
    expect(
      sdPortalAccessStatus(createFakeSdPortalAccess({ revokedAt: now }), now),
    ).toBe('revoked')
    expect(sdPortalAccessStatus(createFakeSdPortalAccess(), now)).toBe(
      'pending',
    )
    expect(
      sdPortalAccessStatus(
        createFakeSdPortalAccess({
          expiresAt: new Date('2026-10-01T00:00:00.000Z'),
        }),
        now,
      ),
    ).toBe('expired')
    expect(
      sdPortalAccessStatus(
        createFakeSdPortalAccess({
          usedAt: now,
          sessionExpiresAt: new Date('2026-10-02T23:00:00.000Z'),
        }),
        now,
      ),
    ).toBe('active')
    expect(
      sdPortalAccessStatus(
        createFakeSdPortalAccess({
          usedAt: now,
          sessionExpiresAt: new Date('2026-10-02T11:00:00.000Z'),
        }),
        now,
      ),
    ).toBe('used')
    expect(
      sdPortalAccessStatus(
        createFakeSdPortalAccess({ usedAt: now, sessionExpiresAt: null }),
        now,
      ),
    ).toBe('used')
  })
})

describe('toSdPortalAccessDTO', () => {
  it('never exposes the token or the session hash', () => {
    const dto = toSdPortalAccessDTO(
      createFakeSdPortalAccess({ sessionHash: 'deadbeef' }),
      new Date('2026-10-02T12:00:00.000Z'),
    )
    expect(dto).not.toHaveProperty('tokenHash')
    expect(dto).not.toHaveProperty('sessionHash')
    expect(JSON.stringify(dto)).not.toContain('deadbeef')
    expect(dto.requestedBy).toEqual({ id: 'u1', name: 'Carlos Agente' })
    expect(dto.status).toBe('pending')
  })

  it('defaults the reference instant to now', () => {
    const dto = toSdPortalAccessDTO(
      createFakeSdPortalAccess({
        expiresAt: new Date('2020-01-01T00:00:00.000Z'),
      }),
    )
    expect(dto.status).toBe('expired')
  })
})

describe('toSdPortalCatalogTree', () => {
  it('nests the visible nodes and ignores orphans', () => {
    const tree = toSdPortalCatalogTree([
      {
        id: 'c1',
        name: 'Infra',
        parentId: null,
        ticketTypes: [],
        position: 0,
      },
      {
        id: 's1',
        name: 'Impressão',
        parentId: 'c1',
        ticketTypes: ['INCIDENT'],
        position: 0,
      },
      {
        id: 'x1',
        name: 'Filho de nó escondido',
        parentId: 'hidden',
        ticketTypes: [],
        position: 0,
      },
    ])
    expect(tree).toHaveLength(1)
    expect(tree[0].children.map((node) => node.id)).toEqual(['s1'])
    expect(tree[0].children[0].ticketTypes).toEqual(['INCIDENT'])
  })
})

describe('toSdPortalTemplateDTO / toSdPortalCustomFieldDTO', () => {
  it('keeps the template fields the form needs', () => {
    expect(
      toSdPortalTemplateDTO({
        id: 't1',
        name: 'Troca de toner',
        description: null,
        ticketType: 'SERVICE_REQUEST',
      }),
    ).toEqual({
      id: 't1',
      name: 'Troca de toner',
      description: null,
      ticketType: 'SERVICE_REQUEST',
    })
  })

  it('normalises the custom field options and skips malformed ones', () => {
    const dto = toSdPortalCustomFieldDTO({
      id: 'f1',
      key: 'andar',
      label: 'Andar',
      description: 'Onde você está',
      type: 'SELECT',
      options: [
        { value: '1', label: 'Primeiro' },
        { value: '2' },
        { label: 'sem valor' },
        'texto',
        null,
      ],
      required: true,
      ticketTypes: ['INCIDENT'],
      categoryIds: ['c1'],
    })
    expect(dto.options).toEqual([
      { value: '1', label: 'Primeiro' },
      { value: '2', label: '2' },
    ])
    expect(dto.required).toBe(true)
  })

  it('handles a non-array options payload', () => {
    const dto = toSdPortalCustomFieldDTO({
      id: 'f2',
      key: 'obs',
      label: 'Observação',
      description: null,
      type: 'TEXT',
      options: null,
      required: false,
      ticketTypes: [],
      categoryIds: [],
    })
    expect(dto.options).toEqual([])
  })
})
