import { describe, expect, it } from 'vitest'
import { seedSdContact } from '@/src/__tests__/factories/sd-contact.factory'
import { seedSdCustomer } from '@/src/__tests__/factories/sd-customer.factory'
import { seedSdPortalAccess } from '@/src/__tests__/factories/sd-portal.factory'
import { seedSdTicket } from '@/src/__tests__/factories/sd-ticket.factory'
import {
  seedSdCategory,
  seedSdCustomField,
  seedSdPhaseFlow,
  seedSdSettings,
  seedSdTemplate,
} from '@/src/__tests__/factories/sd-ticket-context.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { hashSdPortalToken } from '@/src/lib/servicedesk/portal-session'
import {
  SdPortalRepository,
  sdPortalTicketWhere,
} from '../sd-portal.repository'

const DAY = 24 * 60 * 60 * 1000

/**
 * Um workspace com o módulo liberado, portal ligado, o contato `ana`
 * vinculado à empresa `acme`, e um segundo contato (`bruno`) de outra
 * empresa — a base dos testes de acesso cruzado.
 */
async function setup(options?: { portalEnabled?: boolean }) {
  const [workspace, other, user] = await Promise.all([
    seedWorkspace(),
    seedWorkspace(),
    seedUser(),
  ])
  await prisma.workspaceModuleAccess.create({
    data: {
      workspaceId: workspace.id,
      module: 'SERVICE_DESK',
      enabled: true,
      grantedById: user.id,
    },
  })
  await seedSdSettings(workspace.id, {
    portalEnabled: options?.portalEnabled ?? true,
  })
  const flow = await seedSdPhaseFlow(workspace.id, 'INCIDENT')
  const acme = await seedSdCustomer(workspace.id, user.id, { name: 'Acme' })
  const outra = await seedSdCustomer(workspace.id, user.id, { name: 'Outra' })
  const ana = await seedSdContact(
    workspace.id,
    user.id,
    { name: 'Ana', email: 'ana@acme.com.br' },
    [acme.id],
  )
  const bruno = await seedSdContact(
    workspace.id,
    user.id,
    { name: 'Bruno', email: 'bruno@outra.com.br' },
    [outra.id],
  )
  return { workspace, other, user, flow, acme, outra, ana, bruno }
}

describe('sdPortalTicketWhere', () => {
  it('scopes by contact alone when there is no company', () => {
    expect(
      sdPortalTicketWhere({
        workspaceId: 'ws1',
        contactId: 'c1',
        customerIds: [],
      }),
    ).toEqual({
      workspaceId: 'ws1',
      deletedAt: null,
      OR: [{ contactId: 'c1' }],
    })
  })

  it('adds the companies of the contact when the scope is on', () => {
    const where = sdPortalTicketWhere({
      workspaceId: 'ws1',
      contactId: 'c1',
      customerIds: ['a', 'b'],
    })
    expect(where.OR).toEqual([
      { contactId: 'c1' },
      { customerId: { in: ['a', 'b'] } },
      { companyId: { in: ['a', 'b'] } },
    ])
  })
})

describe('SdPortalRepository — links de acesso', () => {
  it('creates a link with the hash and loads it back by token hash', async () => {
    const { workspace, user, ana } = await setup()
    const hash = hashSdPortalToken('tok-1')

    const created = expectOk(
      await SdPortalRepository.createAccess({
        workspaceId: workspace.id,
        contactId: ana.id,
        tokenHash: hash,
        email: 'ana@acme.com.br',
        requestedById: user.id,
        expiresAt: new Date(Date.now() + 7 * DAY),
      }),
    )
    expect(created.requestedBy?.id).toBe(user.id)
    expect(created.usedAt).toBeNull()
    expect(created.sessionHash).toBeNull()

    const found = expectOk(await SdPortalRepository.findByTokenHash(hash))
    expect(found?.id).toBe(created.id)
    expect(found?.contact.name).toBe('Ana')
    expect(found?.workspace.status).toBe('ACTIVE')
    expect(found?.contact.customers[0].customer.name).toBe('Acme')

    expect(
      expectOk(
        await SdPortalRepository.findByTokenHash(hashSdPortalToken('nope')),
      ),
    ).toBeNull()
  })

  it('consumes the link only once, even under a race', async () => {
    const { workspace, ana } = await setup()
    const { access } = await seedSdPortalAccess(workspace.id, ana.id)
    const sessionHash = hashSdPortalToken('session-1')
    const now = new Date()

    expect(
      expectOk(
        await SdPortalRepository.consume({
          id: access.id,
          usedAt: now,
          sessionHash,
          sessionExpiresAt: new Date(now.getTime() + 12 * 60 * 60 * 1000),
        }),
      ),
    ).toBe(true)

    // Segunda tentativa com o mesmo link: `usedAt` já preenchido.
    expect(
      expectOk(
        await SdPortalRepository.consume({
          id: access.id,
          usedAt: now,
          sessionHash: hashSdPortalToken('session-2'),
          sessionExpiresAt: new Date(now.getTime() + 60_000),
        }),
      ),
    ).toBe(false)

    const session = expectOk(
      await SdPortalRepository.findBySessionHash(sessionHash),
    )
    expect(session?.id).toBe(access.id)
    expect(session?.contact.id).toBe(ana.id)
  })

  it('refuses to consume a revoked link', async () => {
    const { workspace, ana } = await setup()
    const { access } = await seedSdPortalAccess(workspace.id, ana.id, {
      revokedAt: new Date(),
    })
    expect(
      expectOk(
        await SdPortalRepository.consume({
          id: access.id,
          usedAt: new Date(),
          sessionHash: hashSdPortalToken('s'),
          sessionExpiresAt: new Date(),
        }),
      ),
    ).toBe(false)
  })

  it('closes the session without revoking the link', async () => {
    const { workspace, ana } = await setup()
    const { access } = await seedSdPortalAccess(workspace.id, ana.id, {
      usedAt: new Date(),
      sessionHash: hashSdPortalToken('s1'),
      sessionExpiresAt: new Date(Date.now() + 60_000),
    })

    expectOk(await SdPortalRepository.closeSession(access.id))

    const row = await prisma.sdPortalAccess.findUniqueOrThrow({
      where: { id: access.id },
    })
    expect(row.sessionHash).toBeNull()
    expect(row.sessionExpiresAt).toBeNull()
    expect(row.revokedAt).toBeNull()
    expect(row.usedAt).not.toBeNull()
    expect(
      expectOk(
        await SdPortalRepository.findBySessionHash(hashSdPortalToken('s1')),
      ),
    ).toBeNull()
  })

  it('revokes a link and drops its live session', async () => {
    const { workspace, ana } = await setup()
    const { access } = await seedSdPortalAccess(workspace.id, ana.id, {
      usedAt: new Date(),
      sessionHash: hashSdPortalToken('s2'),
      sessionExpiresAt: new Date(Date.now() + 60_000),
    })
    const at = new Date()

    const revoked = expectOk(
      await SdPortalRepository.revoke(access.id, workspace.id, at),
    )
    expect(revoked?.revokedAt?.getTime()).toBe(at.getTime())
    expect(revoked?.sessionHash).toBeNull()

    // Já revogado: nada a fazer.
    expect(
      expectOk(await SdPortalRepository.revoke(access.id, workspace.id, at)),
    ).toBeNull()
  })

  it('never revokes a link of another workspace', async () => {
    const { workspace, other, ana } = await setup()
    const { access } = await seedSdPortalAccess(workspace.id, ana.id)
    expect(
      expectOk(
        await SdPortalRepository.revoke(access.id, other.id, new Date()),
      ),
    ).toBeNull()
    const row = await prisma.sdPortalAccess.findUniqueOrThrow({
      where: { id: access.id },
    })
    expect(row.revokedAt).toBeNull()
  })

  it('revokes only the pending links of the contact', async () => {
    const { workspace, ana, bruno } = await setup()
    await seedSdPortalAccess(workspace.id, ana.id)
    await seedSdPortalAccess(workspace.id, ana.id, { usedAt: new Date() })
    await seedSdPortalAccess(workspace.id, ana.id, { revokedAt: new Date() })
    await seedSdPortalAccess(workspace.id, bruno.id)

    expect(
      expectOk(await SdPortalRepository.revokePending(ana.id, new Date())),
    ).toBe(1)
    expect(
      await prisma.sdPortalAccess.count({
        where: { contactId: bruno.id, revokedAt: null },
      }),
    ).toBe(1)
  })

  it('lists the links of a contact, newest first and capped', async () => {
    const { workspace, ana, bruno } = await setup()
    await seedSdPortalAccess(workspace.id, ana.id, {
      createdAt: new Date('2026-09-01T00:00:00.000Z'),
    })
    const newer = await seedSdPortalAccess(workspace.id, ana.id, {
      createdAt: new Date('2026-09-20T00:00:00.000Z'),
    })
    await seedSdPortalAccess(workspace.id, bruno.id)

    const rows = expectOk(
      await SdPortalRepository.listByContact(workspace.id, ana.id, 20),
    )
    expect(rows.map((row) => row.id)).toEqual([
      newer.access.id,
      expect.any(String),
    ])

    expect(
      expectOk(
        await SdPortalRepository.listByContact(workspace.id, ana.id, 1),
      ),
    ).toHaveLength(1)
  })
})

describe('SdPortalRepository.findContact', () => {
  it('loads the contact with its live companies', async () => {
    const { workspace, ana, acme } = await setup()
    const contact = expectOk(
      await SdPortalRepository.findContact(ana.id, workspace.id),
    )
    expect(contact.name).toBe('Ana')
    expect(contact.customers).toEqual([
      {
        isPrimary: true,
        customer: { id: acme.id, name: 'Acme', deletedAt: null },
      },
    ])
  })

  it('404s a contact of another workspace or already deleted', async () => {
    const { workspace, other, user, ana } = await setup()
    expectErr(
      await SdPortalRepository.findContact(ana.id, other.id),
      'SD_CONTACT_NOT_FOUND',
    )

    const gone = await seedSdContact(workspace.id, user.id, {
      deletedAt: new Date(),
    })
    expectErr(
      await SdPortalRepository.findContact(gone.id, workspace.id),
      'SD_CONTACT_NOT_FOUND',
    )
  })
})

describe('SdPortalRepository.findActiveContactsByEmail', () => {
  it('matches case-insensitively, only where the portal is on', async () => {
    const { workspace, ana } = await setup()

    const found = expectOk(
      await SdPortalRepository.findActiveContactsByEmail('ANA@ACME.COM.BR'),
    )
    expect(found.map((contact) => contact.id)).toEqual([ana.id])
  })

  it('skips inactive, deleted, portal-off and module-off workspaces', async () => {
    const { workspace, user } = await setup()
    await seedSdContact(workspace.id, user.id, {
      name: 'Inativa',
      email: 'dup@acme.com.br',
      active: false,
    })
    await seedSdContact(workspace.id, user.id, {
      name: 'Removida',
      email: 'dup@acme.com.br',
      deletedAt: new Date(),
    })
    expect(
      expectOk(
        await SdPortalRepository.findActiveContactsByEmail('dup@acme.com.br'),
      ),
    ).toEqual([])

    // Portal desligado: o e-mail não gera link.
    const off = await setup({ portalEnabled: false })
    await seedSdContact(off.workspace.id, off.user.id, {
      name: 'Off',
      email: 'off@acme.com.br',
    })
    expect(
      expectOk(
        await SdPortalRepository.findActiveContactsByEmail('off@acme.com.br'),
      ),
    ).toEqual([])

    // Sem o módulo liberado: idem.
    const noModule = await seedWorkspace()
    const noModuleUser = await seedUser()
    await seedSdSettings(noModule.id, { portalEnabled: true })
    await seedSdContact(noModule.id, noModuleUser.id, {
      name: 'Sem módulo',
      email: 'nomodule@acme.com.br',
    })
    expect(
      expectOk(
        await SdPortalRepository.findActiveContactsByEmail(
          'nomodule@acme.com.br',
        ),
      ),
    ).toEqual([])
  })

  it('returns one contact per workspace for the same e-mail', async () => {
    const first = await setup()
    const second = await setup()
    await seedSdContact(first.workspace.id, first.user.id, {
      name: 'Multi aqui',
      email: 'multi@acme.com.br',
    })
    await seedSdContact(second.workspace.id, second.user.id, {
      name: 'Multi na outra',
      email: 'multi@acme.com.br',
    })

    const found = expectOk(
      await SdPortalRepository.findActiveContactsByEmail('multi@acme.com.br'),
    )
    expect(found).toHaveLength(2)
    expect(new Set(found.map((c) => c.workspaceId))).toEqual(
      new Set([first.workspace.id, second.workspace.id]),
    )
  })

  it('skips a suspended workspace', async () => {
    const suspended = await seedWorkspace({ status: 'SUSPENDED' })
    const user = await seedUser()
    await prisma.workspaceModuleAccess.create({
      data: {
        workspaceId: suspended.id,
        module: 'SERVICE_DESK',
        enabled: true,
        grantedById: user.id,
      },
    })
    await seedSdSettings(suspended.id, { portalEnabled: true })
    await seedSdContact(suspended.id, user.id, {
      email: 'susp@acme.com.br',
    })
    expect(
      expectOk(
        await SdPortalRepository.findActiveContactsByEmail('susp@acme.com.br'),
      ),
    ).toEqual([])
  })
})

describe('SdPortalRepository — escopo dos chamados', () => {
  async function tickets() {
    const base = await setup()
    const { workspace, other, user, flow, acme, outra, ana, bruno } = base
    const mine = await seedSdTicket(workspace.id, flow.initial.id, {
      title: 'Meu chamado',
      contactId: ana.id,
      customerId: acme.id,
      companyId: acme.id,
    })
    const sameCompany = await seedSdTicket(workspace.id, flow.initial.id, {
      title: 'Da minha empresa, de outro contato',
      contactId: bruno.id,
      customerId: acme.id,
      companyId: acme.id,
    })
    const otherCompany = await seedSdTicket(workspace.id, flow.initial.id, {
      title: 'De outra empresa',
      contactId: bruno.id,
      customerId: outra.id,
      companyId: outra.id,
    })
    const closed = await seedSdTicket(workspace.id, flow.closed.id, {
      title: 'Encerrado',
      contactId: ana.id,
      customerId: acme.id,
    })
    const deleted = await seedSdTicket(workspace.id, flow.initial.id, {
      title: 'Excluído',
      contactId: ana.id,
      deletedAt: new Date(),
    })
    const otherWorkspaceFlow = await seedSdPhaseFlow(other.id, 'INCIDENT')
    const crossWorkspace = await seedSdTicket(
      other.id,
      otherWorkspaceFlow.initial.id,
      { title: 'De outro workspace', contactId: ana.id },
    )
    return {
      ...base,
      mine,
      sameCompany,
      otherCompany,
      closed,
      deleted,
      crossWorkspace,
      scope: {
        workspaceId: workspace.id,
        contactId: ana.id,
        customerIds: [acme.id],
      },
      contactOnlyScope: {
        workspaceId: workspace.id,
        contactId: ana.id,
        customerIds: [],
      },
    }
  }

  it('lists the open tickets of the contact and of its company', async () => {
    const { scope, mine, sameCompany } = await tickets()
    const page = expectOk(
      await SdPortalRepository.listTickets({
        scope,
        status: 'open',
        page: 1,
        pageSize: 20,
      }),
    )
    expect(page.total).toBe(2)
    expect(new Set(page.items.map((t) => t.id))).toEqual(
      new Set([mine.id, sameCompany.id]),
    )
  })

  it('never lists a ticket of another company or another workspace', async () => {
    const { scope, otherCompany, crossWorkspace, deleted } = await tickets()
    const page = expectOk(
      await SdPortalRepository.listTickets({
        scope,
        status: 'all',
        page: 1,
        pageSize: 50,
      }),
    )
    const ids = page.items.map((t) => t.id)
    expect(ids).not.toContain(otherCompany.id)
    expect(ids).not.toContain(crossWorkspace.id)
    expect(ids).not.toContain(deleted.id)
  })

  it('narrows to the contact own tickets when the company scope is off', async () => {
    const { contactOnlyScope, mine, closed, sameCompany } = await tickets()
    const page = expectOk(
      await SdPortalRepository.listTickets({
        scope: contactOnlyScope,
        status: 'all',
        page: 1,
        pageSize: 50,
      }),
    )
    expect(new Set(page.items.map((t) => t.id))).toEqual(
      new Set([mine.id, closed.id]),
    )
    expect(page.items.map((t) => t.id)).not.toContain(sameCompany.id)
  })

  it('splits open and closed and paginates', async () => {
    const { scope, closed } = await tickets()
    const done = expectOk(
      await SdPortalRepository.listTickets({
        scope,
        status: 'closed',
        page: 1,
        pageSize: 20,
      }),
    )
    expect(done.items.map((t) => t.id)).toEqual([closed.id])

    const firstPage = expectOk(
      await SdPortalRepository.listTickets({
        scope,
        status: 'all',
        page: 1,
        pageSize: 1,
      }),
    )
    expect(firstPage.items).toHaveLength(1)
    expect(firstPage.total).toBe(3)
  })

  it('searches by title and by ticket number', async () => {
    const { scope, mine } = await tickets()
    const byTitle = expectOk(
      await SdPortalRepository.listTickets({
        scope,
        status: 'all',
        q: 'MEU CHAMADO',
        page: 1,
        pageSize: 20,
      }),
    )
    expect(byTitle.items.map((t) => t.id)).toEqual([mine.id])

    const byNumber = expectOk(
      await SdPortalRepository.listTickets({
        scope,
        status: 'all',
        q: String(mine.number),
        qNumber: mine.number,
        page: 1,
        pageSize: 20,
      }),
    )
    expect(byNumber.items.map((t) => t.id)).toEqual([mine.id])
  })

  it('finds a ticket by number inside the scope only', async () => {
    const { scope, contactOnlyScope, mine, otherCompany, sameCompany } =
      await tickets()

    const found = expectOk(
      await SdPortalRepository.findTicketByNumber(scope, mine.number),
    )
    expect(found.id).toBe(mine.id)
    expect(found).not.toHaveProperty('slaPolicyId')
    expect(found).not.toHaveProperty('departmentId')
    expect(found).not.toHaveProperty('rootCause')
    expect(found).not.toHaveProperty('aiSummary')

    // Chamado de outra empresa: 404 mesmo sabendo o número.
    expectErr(
      await SdPortalRepository.findTicketByNumber(scope, otherCompany.number),
      'SD_TICKET_NOT_FOUND',
    )
    // Sem escopo de empresa, nem o da própria empresa aparece.
    expectErr(
      await SdPortalRepository.findTicketByNumber(
        contactOnlyScope,
        sameCompany.number,
      ),
      'SD_TICKET_NOT_FOUND',
    )
  })

  it('404s a deleted ticket', async () => {
    const { scope, deleted } = await tickets()
    expectErr(
      await SdPortalRepository.findTicketByNumber(scope, deleted.number),
      'SD_TICKET_NOT_FOUND',
    )
  })

  it('never reaches a ticket of another workspace with the same number', async () => {
    const { scope, crossWorkspace } = await tickets()
    // Os números são sequenciais **por workspace**, então o mesmo número
    // existe nos dois: o `workspaceId` do escopo é o que separa.
    const result = await SdPortalRepository.findTicketByNumber(
      scope,
      crossWorkspace.number,
    )
    if (result.ok) {
      expect(result.value.id).not.toBe(crossWorkspace.id)
      expect(result.value.workspaceId).toBe(scope.workspaceId)
    } else {
      expect(result.error.code).toBe('SD_TICKET_NOT_FOUND')
    }
  })
})

describe('SdPortalRepository — mensagens e anexos', () => {
  async function conversation() {
    const base = await setup()
    const { workspace, user, flow, ana, acme } = base
    const ticket = await seedSdTicket(workspace.id, flow.initial.id, {
      contactId: ana.id,
      customerId: acme.id,
    })
    const publicAgent = await prisma.sdTicketMessage.create({
      data: {
        workspaceId: workspace.id,
        ticketId: ticket.id,
        authorKind: 'AGENT',
        authorUserId: user.id,
        visibility: 'PUBLIC',
        body: 'Estamos olhando',
      },
    })
    const internal = await prisma.sdTicketMessage.create({
      data: {
        workspaceId: workspace.id,
        ticketId: ticket.id,
        authorKind: 'AGENT',
        authorUserId: user.id,
        visibility: 'INTERNAL',
        body: 'Cliente reclamou com o diretor',
      },
    })
    const removed = await prisma.sdTicketMessage.create({
      data: {
        workspaceId: workspace.id,
        ticketId: ticket.id,
        authorKind: 'AGENT',
        authorUserId: user.id,
        visibility: 'PUBLIC',
        body: 'Mensagem apagada',
        deletedAt: new Date(),
      },
    })
    return { ...base, ticket, publicAgent, internal, removed }
  }

  it('lists only public, live messages, oldest first', async () => {
    const { ticket, publicAgent } = await conversation()
    const rows = expectOk(
      await SdPortalRepository.listPublicMessages(ticket.id, 200),
    )
    expect(rows.map((row) => row.id)).toEqual([publicAgent.id])
    expect(rows[0].body).toBe('Estamos olhando')
  })

  it('respects the limit', async () => {
    const { ticket } = await conversation()
    expect(
      expectOk(await SdPortalRepository.listPublicMessages(ticket.id, 0)),
    ).toHaveLength(0)
  })

  it('creates a CONTACT message with its attachments in one transaction', async () => {
    const { workspace, ticket, ana } = await conversation()

    const created = expectOk(
      await SdPortalRepository.createContactMessage({
        workspaceId: workspace.id,
        ticketId: ticket.id,
        contactId: ana.id,
        body: 'Segue a foto',
        attachments: [
          {
            id: 'att-portal-1',
            kind: 'IMAGE',
            fileName: 'foto.png',
            mimeType: 'image/png',
            size: 4,
            storageKey: `${workspace.id}/tickets/${ticket.id}/att-portal-1-foto.png`,
          },
        ],
      }),
    )

    expect(created.authorKind).toBe('CONTACT')
    expect(created.authorContactId).toBe(ana.id)
    expect(created.authorUserId).toBeNull()
    expect(created.visibility).toBe('PUBLIC')
    expect(created.channel).toBe('PLATFORM')
    expect(created.attachments).toHaveLength(1)
    expect(created.attachments[0].uploadedById).toBeNull()
    expect(created.attachments[0].messageId).toBe(created.id)
  })

  it('creates a message with no attachment', async () => {
    const { workspace, ticket, ana } = await conversation()
    const created = expectOk(
      await SdPortalRepository.createContactMessage({
        workspaceId: workspace.id,
        ticketId: ticket.id,
        contactId: ana.id,
        body: 'Só texto',
        attachments: [],
      }),
    )
    expect(created.attachments).toEqual([])
  })

  it('serves only an attachment of a public, live message', async () => {
    const { workspace, ticket, publicAgent, internal, removed } =
      await conversation()
    const make = (id: string, messageId: string | null) =>
      prisma.sdTicketAttachment.create({
        data: {
          id,
          workspaceId: workspace.id,
          ticketId: ticket.id,
          messageId,
          kind: 'DOCUMENT',
          fileName: `${id}.pdf`,
          mimeType: 'application/pdf',
          size: 10,
          storageKey: `k/${id}`,
        },
      })
    await make('att-public', publicAgent.id)
    await make('att-internal', internal.id)
    await make('att-removed', removed.id)
    await make('att-loose', null)

    expect(
      expectOk(
        await SdPortalRepository.findPublicAttachment('att-public', ticket.id),
      )?.fileName,
    ).toBe('att-public.pdf')

    for (const id of ['att-internal', 'att-removed', 'att-loose', 'nope']) {
      expect(
        expectOk(await SdPortalRepository.findPublicAttachment(id, ticket.id)),
      ).toBeNull()
    }
  })

  it('never serves an attachment of another ticket', async () => {
    const { workspace, flow, ticket, publicAgent, ana } = await conversation()
    await prisma.sdTicketAttachment.create({
      data: {
        id: 'att-x',
        workspaceId: workspace.id,
        ticketId: ticket.id,
        messageId: publicAgent.id,
        kind: 'DOCUMENT',
        fileName: 'x.pdf',
        mimeType: 'application/pdf',
        size: 1,
        storageKey: 'k/x',
      },
    })
    const another = await seedSdTicket(workspace.id, flow.initial.id, {
      contactId: ana.id,
    })
    expect(
      expectOk(await SdPortalRepository.findPublicAttachment('att-x', another.id)),
    ).toBeNull()
  })
})

describe('SdPortalRepository.formOptions', () => {
  it('returns only what the portal released, in order', async () => {
    const { workspace } = await setup()
    const visible = await seedSdCategory(workspace.id, {
      name: 'Visível',
      portalVisible: true,
      position: 0,
    })
    await seedSdCategory(workspace.id, {
      name: 'Interna',
      portalVisible: false,
      position: 1,
    })
    await seedSdCategory(workspace.id, {
      name: 'Inativa',
      portalVisible: true,
      active: false,
      position: 2,
    })
    const child = await seedSdCategory(workspace.id, {
      name: 'Subcategoria',
      level: 'SUBCATEGORY',
      parentId: visible.id,
      portalVisible: true,
      position: 0,
    })
    await seedSdTemplate(workspace.id, {
      name: 'No portal',
      portalVisible: true,
    })
    await seedSdTemplate(workspace.id, { name: 'Interno' })
    await prisma.sdUrgency.createMany({
      data: [
        { workspaceId: workspace.id, name: 'Baixa', level: 1 },
        { workspaceId: workspace.id, name: 'Alta', level: 3 },
      ],
    })
    await seedSdCustomField(workspace.id, {
      key: 'andar',
      label: 'Andar',
      visibleInPortal: true,
    })
    await seedSdCustomField(workspace.id, {
      key: 'custo',
      label: 'Centro de custo',
    })
    await seedSdCustomField(workspace.id, {
      entity: 'CUSTOMER',
      key: 'segmento',
      label: 'Segmento',
      visibleInPortal: true,
    })

    const options = expectOk(
      await SdPortalRepository.formOptions(workspace.id),
    )

    expect(new Set(options.categories.map((node) => node.name))).toEqual(
      new Set(['Visível', 'Subcategoria']),
    )
    expect(
      options.categories.find((node) => node.name === 'Subcategoria')?.parentId,
    ).toBe(visible.id)
    expect(child.parentId).toBe(visible.id)
    expect(options.templates.map((t) => t.name)).toEqual(['No portal'])
    expect(options.urgencies.map((u) => u.name)).toEqual(['Baixa', 'Alta'])
    expect(options.customFields.map((f) => f.key)).toEqual(['andar'])
  })

  it('answers with empty lists for a bare workspace', async () => {
    const workspace = await seedWorkspace()
    const options = expectOk(
      await SdPortalRepository.formOptions(workspace.id),
    )
    expect(options).toEqual({
      categories: [],
      templates: [],
      urgencies: [],
      customFields: [],
    })
  })
})
