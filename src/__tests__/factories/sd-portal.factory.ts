import { createId } from '@paralleldrive/cuid2'
import type { Prisma, SdPortalAccess } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import { hashSdPortalToken } from '@/src/lib/servicedesk/portal-session'
import type {
  SdPortalAccessRow,
  SdPortalAccessWithContact,
  SdPortalContactRow,
  SdPortalTicketRow,
} from '@/src/repositories/sd-portal.repository'

/** Fábricas do portal do contato externo (`SdPortalAccess` e o escopo dele). */

const fixed = () => new Date('2026-10-01T12:00:00.000Z')

export function createFakeSdPortalContact(
  overrides?: Partial<SdPortalContactRow>,
): SdPortalContactRow {
  return {
    id: 'contact1',
    workspaceId: 'ws1',
    name: 'Ana Souza',
    email: 'ana@acme.com.br',
    active: true,
    deletedAt: null,
    customers: [
      {
        isPrimary: true,
        customer: { id: 'cus1', name: 'ACME Ltda', deletedAt: null },
      },
    ],
    ...overrides,
  }
}

export function createFakeSdPortalAccess(
  overrides?: Partial<SdPortalAccessRow>,
): SdPortalAccessRow {
  return {
    id: 'access1',
    workspaceId: 'ws1',
    contactId: 'contact1',
    tokenHash: hashSdPortalToken('token-fake'),
    email: 'ana@acme.com.br',
    requestedById: 'u1',
    // Relative, not fixed: a fixed date turns every fake link "expired" the
    // moment the calendar passes it (it broke CI on 2026-10-08).
    expiresAt: new Date(Date.now() + 7 * 86_400_000),
    usedAt: null,
    sessionHash: null,
    sessionExpiresAt: null,
    revokedAt: null,
    createdAt: fixed(),
    requestedBy: { id: 'u1', name: 'Carlos Agente' },
    ...overrides,
  }
}

export function createFakeSdPortalAccessWithContact(
  overrides?: Partial<SdPortalAccessWithContact>,
): SdPortalAccessWithContact {
  return {
    ...createFakeSdPortalAccess(),
    contact: createFakeSdPortalContact(),
    workspace: {
      id: 'ws1',
      name: 'Stratus Telecom',
      slug: 'stratus',
      status: 'ACTIVE',
    },
    ...overrides,
  }
}

export function createFakeSdPortalTicket(
  overrides?: Partial<SdPortalTicketRow>,
): SdPortalTicketRow {
  return {
    id: 'ticket1',
    workspaceId: 'ws1',
    number: 12,
    type: 'INCIDENT',
    title: 'Impressora não imprime',
    description: '<p>Papel atolado no andar 3</p>',
    completionPercent: 30,
    solution: null,
    resolvedAt: null,
    closedAt: null,
    csatScore: null,
    csatComment: null,
    lastActivityAt: fixed(),
    createdAt: fixed(),
    contactId: 'contact1',
    customerId: 'cus1',
    companyId: 'cus1',
    phase: {
      id: 'phase1',
      name: 'Em atendimento',
      color: '#2563eb',
      category: 'IN_PROGRESS',
    },
    urgency: { id: 'urg1', name: 'Alta' },
    category: { id: 'cat1', name: 'Infraestrutura' },
    subcategory: null,
    service: null,
    company: { id: 'cus1', name: 'ACME Ltda' },
    customer: { id: 'cus1', name: 'ACME Ltda' },
    assignee: { id: 'u1', name: 'Carlos Atendimento' },
    ...overrides,
  }
}

/** Grava um link de acesso (integração/e2e). Devolve o token em claro. */
export async function seedSdPortalAccess(
  workspaceId: string,
  contactId: string,
  overrides?: Partial<Omit<Prisma.SdPortalAccessUncheckedCreateInput, 'id'>>,
): Promise<{ access: SdPortalAccess; token: string }> {
  const token = overrides?.tokenHash
    ? ''
    : `tok-${createId()}${createId()}`.slice(0, 43)
  const access = await prisma.sdPortalAccess.create({
    data: {
      workspaceId,
      contactId,
      email: 'ana@acme.com.br',
      tokenHash: hashSdPortalToken(token),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ...overrides,
    },
  })
  return { access, token }
}
