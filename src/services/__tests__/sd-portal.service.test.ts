import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSdPortalTicket } from '@/src/__tests__/factories/sd-portal.factory'
import { createFakeSdTicket } from '@/src/__tests__/factories/sd-ticket.factory'
import { createFakeSdSettings } from '@/src/__tests__/factories/sd-ticket-context.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError, sdTicketNotFound } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import { DEFAULT_SD_TICKET_PREFIXES } from '@/src/lib/servicedesk/ticket-code'
import type { SdTicketMessageWithRelations } from '@/src/repositories/sd-ticket-message.repository'
import type { SdPortalSessionContext } from '../sd-portal-access.service'

vi.mock('@/src/repositories/sd-portal.repository')
vi.mock('@/src/repositories/sd-ticket.repository')
vi.mock('@/src/repositories/sd-ticket-csat.repository')
vi.mock('@/src/repositories/sd-kb-article.repository')
vi.mock('@/src/repositories/sd-kb-catalog.repository')
vi.mock('@/src/services/sd-ticket-engine', () => ({
  SdTicketEngine: {
    create: vi.fn(),
    touchActivity: vi.fn(async () => ok(undefined)),
    reopen: vi.fn(),
  },
  sdContactActor: (contact: { id: string; name: string }) => ({
    kind: 'contact',
    contactId: contact.id,
    contactName: contact.name,
  }),
}))
vi.mock('@/src/services/sd-ticket-event-recorder', () => ({
  recordSdTicketEvent: vi.fn(async () => ok(1)),
}))
vi.mock('@/src/services/sd-ticket-notifier', () => ({
  SdTicketNotifier: { notify: vi.fn(async () => ok(1)) },
}))
vi.mock('@/src/services/sd-automation-engine', () => ({
  fireSdAutomations: vi.fn(async () => ok({ matched: 0 })),
}))
vi.mock('@/src/lib/servicedesk/realtime', () => ({
  publishSdTicketEvent: vi.fn(async () => undefined),
}))
vi.mock('@/src/lib/storage/s3', () => ({
  ensureBucket: vi.fn(async () => undefined),
  putObject: vi.fn(async () => undefined),
  getObject: vi.fn(async () => Buffer.from('arquivo')),
}))
vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))
vi.mock('@/lib/axiom/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

import { auditMutation } from '@/lib/axiom/audit'
import { publishSdTicketEvent } from '@/src/lib/servicedesk/realtime'
import { getObject, putObject } from '@/src/lib/storage/s3'
import { SdKbArticleRepository } from '@/src/repositories/sd-kb-article.repository'
import { SdKbCatalogRepository } from '@/src/repositories/sd-kb-catalog.repository'
import { SdPortalRepository } from '@/src/repositories/sd-portal.repository'
import { SdTicketRepository } from '@/src/repositories/sd-ticket.repository'
import { SdTicketCsatRepository } from '@/src/repositories/sd-ticket-csat.repository'
import { fireSdAutomations } from '../sd-automation-engine'
import { SdPortalService, sdPortalTextToHtml } from '../sd-portal.service'
import { SdTicketEngine } from '../sd-ticket-engine'
import { recordSdTicketEvent } from '../sd-ticket-event-recorder'
import { SdTicketNotifier } from '../sd-ticket-notifier'

const repo = vi.mocked(SdPortalRepository)
const ticketRepo = vi.mocked(SdTicketRepository)
const csatRepo = vi.mocked(SdTicketCsatRepository)
const kbRepo = vi.mocked(SdKbArticleRepository)
const kbCatalog = vi.mocked(SdKbCatalogRepository)
const engine = vi.mocked(SdTicketEngine)
const notifier = vi.mocked(SdTicketNotifier)
const audit = vi.mocked(auditMutation)
const realtime = vi.mocked(publishSdTicketEvent)
const recordEvent = vi.mocked(recordSdTicketEvent)
const automations = vi.mocked(fireSdAutomations)

/** Sessão do portal: contato `contact1`, empresa `cus1` no workspace `ws1`. */
function session(
  overrides: Partial<SdPortalSessionContext> = {},
): SdPortalSessionContext {
  return {
    accessId: 'access1',
    contact: { id: 'contact1', name: 'Ana Souza', email: 'ana@acme.com.br' },
    workspace: { id: 'ws1', name: 'Stratus Telecom', slug: 'stratus' },
    customers: [{ id: 'cus1', name: 'ACME Ltda', isPrimary: true }],
    customerIds: ['cus1'],
    companyScope: true,
    settings: createFakeSdSettings(),
    prefixes: DEFAULT_SD_TICKET_PREFIXES,
    expiresAt: new Date('2026-10-02T00:00:00.000Z'),
    ...overrides,
  }
}

function message(
  overrides?: Partial<SdTicketMessageWithRelations>,
): SdTicketMessageWithRelations {
  return {
    id: 'm1',
    workspaceId: 'ws1',
    ticketId: 'ticket1',
    authorKind: 'CONTACT',
    authorUserId: null,
    authorContactId: 'contact1',
    visibility: 'PUBLIC',
    channel: 'PLATFORM',
    body: 'Obrigada!',
    whatsappMessageId: null,
    editedAt: null,
    createdAt: new Date('2026-10-01T13:00:00.000Z'),
    deletedAt: null,
    authorUser: null,
    authorContact: { id: 'contact1', name: 'Ana Souza' },
    attachments: [],
    ...overrides,
  } as SdTicketMessageWithRelations
}

const PNG: Buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47])

beforeEach(() => {
  vi.clearAllMocks()
  repo.listTickets.mockResolvedValue(
    ok({ items: [createFakeSdPortalTicket()], total: 1 }),
  )
  repo.findTicketByNumber.mockResolvedValue(ok(createFakeSdPortalTicket()))
  repo.listPublicMessages.mockResolvedValue(ok([message()]))
  repo.createContactMessage.mockResolvedValue(ok(message()))
  repo.findPublicAttachment.mockResolvedValue(
    ok({
      fileName: 'ordem.pdf',
      mimeType: 'application/pdf',
      storageKey: 'ws1/tickets/ticket1/a-ordem.pdf',
    }),
  )
  repo.formOptions.mockResolvedValue(
    ok({ categories: [], templates: [], urgencies: [], customFields: [] }),
  )
  ticketRepo.findById.mockResolvedValue(
    ok(createFakeSdTicket({ id: 'ticket1', assigneeId: 'u1' })),
  )
  csatRepo.submit.mockResolvedValue(ok(true))
  engine.create.mockResolvedValue(
    ok(createFakeSdTicket({ id: 'ticket1', number: 12, channel: 'PORTAL' })),
  )
  engine.reopen.mockResolvedValue(ok(createFakeSdTicket()))
  kbCatalog.listCategoriesWithCounts.mockResolvedValue(ok([]))
  kbRepo.listByWorkspace.mockResolvedValue(ok([]))
  kbRepo.search.mockResolvedValue(ok([]))
  kbRepo.incrementViews.mockResolvedValue(ok(1))
})

describe('sdPortalTextToHtml', () => {
  it('turns plain text into sanitized paragraphs', () => {
    expect(sdPortalTextToHtml('linha 1\nlinha 2\n\npar 2')).toBe(
      '<p>linha 1<br>linha 2</p><p>par 2</p>',
    )
  })

  it('strips anything active the contact may paste', () => {
    const html = sdPortalTextToHtml('<script>alert(1)</script> oi')
    expect(html).not.toContain('<script')
    expect(html).toContain('oi')
  })

  it('returns an empty string for blank text', () => {
    expect(sdPortalTextToHtml('   \n  ')).toBe('')
  })
})

describe('SdPortalService.listTickets', () => {
  it('always scopes the query by the session contact and companies', async () => {
    const page = expectOk(
      await SdPortalService.listTickets(session(), {
        status: 'open',
        page: 1,
        pageSize: 20,
      }),
    )

    expect(repo.listTickets).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: {
          workspaceId: 'ws1',
          contactId: 'contact1',
          customerIds: ['cus1'],
        },
        status: 'open',
      }),
    )
    expect(page.items[0].code).toBe('INC-000012')
    expect(page.total).toBe(1)
  })

  it('narrows to the contact alone when the company scope is off', async () => {
    await SdPortalService.listTickets(
      session({ customerIds: [], companyScope: false }),
      { status: 'all', page: 2, pageSize: 10 },
    )
    expect(repo.listTickets.mock.calls[0][0].scope.customerIds).toEqual([])
  })

  it('parses a pasted ticket code into the number filter', async () => {
    await SdPortalService.listTickets(session(), {
      status: 'open',
      q: 'INC-000012',
      page: 1,
      pageSize: 20,
    })
    expect(repo.listTickets.mock.calls[0][0].qNumber).toBe(12)
  })

  it('leaves the number filter empty for a free-text search', async () => {
    await SdPortalService.listTickets(session(), {
      status: 'open',
      q: 'impressora',
      page: 1,
      pageSize: 20,
    })
    expect(repo.listTickets.mock.calls[0][0].qNumber).toBeUndefined()
  })

  it('propagates database failures', async () => {
    repo.listTickets.mockResolvedValue(err(databaseError('x')))
    expectErr(
      await SdPortalService.listTickets(session(), {
        status: 'open',
        page: 1,
        pageSize: 20,
      }),
      'DATABASE_ERROR',
    )
  })
})

describe('SdPortalService.getTicket — cross-tenant access', () => {
  it('returns the ticket of the scope with its public history', async () => {
    const dto = expectOk(
      await SdPortalService.getTicket(session(), 'INC-000012'),
    )
    expect(repo.findTicketByNumber).toHaveBeenCalledWith(
      { workspaceId: 'ws1', contactId: 'contact1', customerIds: ['cus1'] },
      12,
    )
    expect(dto.messages).toHaveLength(1)
    expect(repo.listPublicMessages).toHaveBeenCalledWith('ticket1', 200)
  })

  it('accepts a bare number as well', async () => {
    expectOk(await SdPortalService.getTicket(session(), '12'))
    expect(repo.findTicketByNumber.mock.calls[0][1]).toBe(12)
  })

  it('refuses a ticket id — the portal navigates by code only (no IDOR)', async () => {
    expectErr(
      await SdPortalService.getTicket(session(), 'ckt1abcdefghijklmnop'),
      'SD_TICKET_NOT_FOUND',
    )
    expect(repo.findTicketByNumber).not.toHaveBeenCalled()
  })

  it('404s a ticket of another company (the scope is in the WHERE)', async () => {
    repo.findTicketByNumber.mockResolvedValue(err(sdTicketNotFound()))
    expectErr(
      await SdPortalService.getTicket(session(), 'INC-000999'),
      'SD_TICKET_NOT_FOUND',
    )
  })

  it('404s when the code prefix does not match the ticket type', async () => {
    repo.findTicketByNumber.mockResolvedValue(
      ok(createFakeSdPortalTicket({ type: 'CHANGE' })),
    )
    expectErr(
      await SdPortalService.getTicket(session(), 'INC-000012'),
      'SD_TICKET_NOT_FOUND',
    )
  })

  it('propagates a failure of the message listing', async () => {
    repo.listPublicMessages.mockResolvedValue(err(databaseError('x')))
    expectErr(
      await SdPortalService.getTicket(session(), 'INC-000012'),
      'DATABASE_ERROR',
    )
  })
})

describe('SdPortalService.createTicket', () => {
  it('opens with channel PORTAL, the contact as author and its company', async () => {
    const dto = expectOk(
      await SdPortalService.createTicket(session(), {
        type: 'INCIDENT',
        title: 'Impressora parada',
        description: 'Começou hoje',
        urgencyId: 'urg1',
      }),
    )

    const [workspaceId, input, actor, config] = engine.create.mock.calls[0]
    expect(workspaceId).toBe('ws1')
    expect(input.channel).toBe('PORTAL')
    expect(input.portal).toBe(true)
    expect(input.contactId).toBe('contact1')
    expect(input.customerId).toBe('cus1')
    expect(input.companyId).toBe('cus1')
    expect(input.description).toBe('<p>Começou hoje</p>')
    expect(input).not.toHaveProperty('requesterId')
    expect(input).not.toHaveProperty('assigneeId')
    expect(actor).toEqual({
      kind: 'contact',
      contactId: 'contact1',
      contactName: 'Ana Souza',
    })
    expect(config.prefixes).toBe(DEFAULT_SD_TICKET_PREFIXES)
    expect(dto.code).toBe('INC-000012')
    expect(automations).toHaveBeenCalledWith('TICKET_CREATED', 'ticket1', {})
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'sd_ticket',
        action: 'create',
        actorId: null,
        meta: expect.objectContaining({
          contactId: 'contact1',
          channel: 'PORTAL',
        }),
      }),
    )
  })

  it('refuses a type the workspace did not allow in the portal', async () => {
    const error = expectErr(
      await SdPortalService.createTicket(session(), {
        type: 'CHANGE',
        title: 'Mudança',
      }),
      'SD_TICKET_FORBIDDEN',
    )
    expect(error.message).toContain('portal')
    expect(engine.create).not.toHaveBeenCalled()
  })

  it('omits the company when the contact has none', async () => {
    await SdPortalService.createTicket(
      session({ customers: [], customerIds: [] }),
      { type: 'INCIDENT', title: 'x' },
    )
    const input = engine.create.mock.calls[0][1]
    expect(input).not.toHaveProperty('customerId')
    expect(input).not.toHaveProperty('companyId')
  })

  it('uses the first company when none is marked primary', async () => {
    await SdPortalService.createTicket(
      session({
        customers: [{ id: 'cus9', name: 'Outra', isPrimary: false }],
        customerIds: ['cus9'],
      }),
      { type: 'INCIDENT', title: 'x' },
    )
    expect(engine.create.mock.calls[0][1].customerId).toBe('cus9')
  })

  it('forwards the template, catalog and custom fields it was given', async () => {
    await SdPortalService.createTicket(session(), {
      type: 'SERVICE_REQUEST',
      title: 'Troca de toner',
      templateId: 't1',
      categoryId: 'c1',
      subcategoryId: 's1',
      serviceId: 'v1',
      customFields: { andar: '3' },
    })
    expect(engine.create.mock.calls[0][1]).toMatchObject({
      templateId: 't1',
      categoryId: 'c1',
      subcategoryId: 's1',
      serviceId: 'v1',
      customFields: { andar: '3' },
    })
  })

  it('audits the failure when the engine refuses', async () => {
    engine.create.mockResolvedValue(err(databaseError('x')))
    expectErr(
      await SdPortalService.createTicket(session(), {
        type: 'INCIDENT',
        title: 'x',
      }),
      'DATABASE_ERROR',
    )
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'failure', actorId: null }),
    )
  })

  it('propagates a failure of the read-back', async () => {
    repo.findTicketByNumber.mockResolvedValue(err(databaseError('x')))
    expectErr(
      await SdPortalService.createTicket(session(), {
        type: 'INCIDENT',
        title: 'x',
      }),
      'DATABASE_ERROR',
    )
  })
})

describe('SdPortalService.reply', () => {
  it('posts a public CONTACT message, notifies the team and traces it', async () => {
    const dto = expectOk(
      await SdPortalService.reply(
        session(),
        'INC-000012',
        {
          body: 'Obrigada!',
          attachmentCount: 0,
        },
        [],
      ),
    )

    const written = repo.createContactMessage.mock.calls[0][0]
    expect(written).toMatchObject({
      workspaceId: 'ws1',
      ticketId: 'ticket1',
      contactId: 'contact1',
      body: 'Obrigada!',
      attachments: [],
    })
    expect(dto.mine).toBe(true)
    expect(engine.touchActivity).toHaveBeenCalledWith(
      'ticket1',
      expect.any(Date),
    )
    expect(recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorKind: 'CONTACT',
        actorUserId: null,
        action: 'message.posted',
      }),
    )
    expect(notifier.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Nova resposta do cliente em INC-000012',
      }),
    )
    expect(realtime).toHaveBeenCalledWith(
      'ws1',
      expect.objectContaining({ type: 'ticket.message' }),
      expect.anything(),
    )
    expect(automations).toHaveBeenCalledWith('MESSAGE_RECEIVED', 'ticket1', {})
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'sd_ticket_message',
        actorId: null,
      }),
    )
  })

  it('stores the attachments in the private bucket and links them', async () => {
    await SdPortalService.reply(
      session(),
      'INC-000012',
      { body: '', attachmentCount: 1 },
      [{ buffer: PNG, contentType: 'image/png', fileName: '../foto.png' }],
    )
    expect(putObject).toHaveBeenCalledTimes(1)
    const attachment = repo.createContactMessage.mock.calls[0][0].attachments[0]
    expect(attachment.kind).toBe('IMAGE')
    expect(attachment.fileName).toBe('foto.png')
    expect(attachment.size).toBe(PNG.byteLength)
    expect(attachment.storageKey).toContain('ws1/tickets/ticket1/')
  })

  it('names an unnamed upload instead of trusting the client', async () => {
    await SdPortalService.reply(
      session(),
      'INC-000012',
      { body: '', attachmentCount: 1 },
      [{ buffer: PNG, contentType: 'image/png', fileName: '  ' }],
    )
    expect(
      repo.createContactMessage.mock.calls[0][0].attachments[0].fileName,
    ).toBe('arquivo')
  })

  it('refuses a disallowed type, an empty file and an oversized file', async () => {
    expectErr(
      await SdPortalService.reply(
        session(),
        'INC-000012',
        { body: '', attachmentCount: 1 },
        [
          {
            buffer: PNG,
            contentType: 'application/x-msdownload',
            fileName: 'a.exe',
          },
        ],
      ),
      'SD_ATTACHMENT_INVALID',
    )
    expectErr(
      await SdPortalService.reply(
        session(),
        'INC-000012',
        { body: '', attachmentCount: 1 },
        [
          {
            buffer: Buffer.alloc(0),
            contentType: 'image/png',
            fileName: 'a.png',
          },
        ],
      ),
      'SD_ATTACHMENT_INVALID',
    )
    expectErr(
      await SdPortalService.reply(
        session(),
        'INC-000012',
        { body: '', attachmentCount: 1 },
        [
          {
            buffer: Buffer.alloc(26 * 1024 * 1024),
            contentType: 'image/png',
            fileName: 'a.png',
          },
        ],
      ),
      'SD_ATTACHMENT_INVALID',
    )
    expect(repo.createContactMessage).not.toHaveBeenCalled()
  })

  it('reports a storage failure instead of writing a dangling message', async () => {
    vi.mocked(putObject).mockRejectedValueOnce(new Error('minio down'))
    expectErr(
      await SdPortalService.reply(
        session(),
        'INC-000012',
        { body: '', attachmentCount: 1 },
        [{ buffer: PNG, contentType: 'image/png', fileName: 'a.png' }],
      ),
      'STORAGE_ERROR',
    )
    expect(repo.createContactMessage).not.toHaveBeenCalled()
  })

  it('refuses to reply on a canceled ticket', async () => {
    repo.findTicketByNumber.mockResolvedValue(
      ok(
        createFakeSdPortalTicket({
          phase: {
            id: 'p',
            name: 'Cancelado',
            color: null,
            category: 'CANCELED',
          },
        }),
      ),
    )
    expectErr(
      await SdPortalService.reply(
        session(),
        'INC-000012',
        { body: 'oi', attachmentCount: 0 },
        [],
      ),
      'SD_TICKET_FORBIDDEN',
    )
  })

  it('404s a ticket outside the contact scope', async () => {
    repo.findTicketByNumber.mockResolvedValue(err(sdTicketNotFound()))
    expectErr(
      await SdPortalService.reply(
        session(),
        'INC-000999',
        { body: 'oi', attachmentCount: 0 },
        [],
      ),
      'SD_TICKET_NOT_FOUND',
    )
    expect(repo.createContactMessage).not.toHaveBeenCalled()
  })

  it('reopens a resolved ticket when the workspace asks for it', async () => {
    repo.findTicketByNumber.mockResolvedValue(
      ok(
        createFakeSdPortalTicket({
          phase: {
            id: 'p',
            name: 'Resolvido',
            color: null,
            category: 'RESOLVED',
          },
        }),
      ),
    )
    await SdPortalService.reply(
      session(),
      'INC-000012',
      { body: 'voltou', attachmentCount: 0 },
      [],
    )
    expect(engine.reopen).toHaveBeenCalledTimes(1)
    expect(engine.reopen.mock.calls[0][1]).toEqual({
      kind: 'contact',
      contactId: 'contact1',
      contactName: 'Ana Souza',
    })
  })

  it('does not reopen when the setting is off', async () => {
    repo.findTicketByNumber.mockResolvedValue(
      ok(
        createFakeSdPortalTicket({
          phase: {
            id: 'p',
            name: 'Resolvido',
            color: null,
            category: 'RESOLVED',
          },
        }),
      ),
    )
    await SdPortalService.reply(
      session({
        settings: createFakeSdSettings({ reopenOnRequesterReply: false }),
      }),
      'INC-000012',
      { body: 'voltou', attachmentCount: 0 },
      [],
    )
    expect(engine.reopen).not.toHaveBeenCalled()
  })

  it('keeps the message when the reopen fails or the ticket cannot be reloaded', async () => {
    repo.findTicketByNumber.mockResolvedValue(
      ok(
        createFakeSdPortalTicket({
          phase: {
            id: 'p',
            name: 'Resolvido',
            color: null,
            category: 'RESOLVED',
          },
        }),
      ),
    )
    engine.reopen.mockResolvedValue(err(databaseError('x')))
    expectOk(
      await SdPortalService.reply(
        session(),
        'INC-000012',
        { body: 'voltou', attachmentCount: 0 },
        [],
      ),
    )

    ticketRepo.findById.mockResolvedValue(err(databaseError('x')))
    expectOk(
      await SdPortalService.reply(
        session(),
        'INC-000012',
        { body: 'voltou', attachmentCount: 0 },
        [],
      ),
    )
  })

  it('propagates a failure of the insert', async () => {
    repo.createContactMessage.mockResolvedValue(err(databaseError('x')))
    expectErr(
      await SdPortalService.reply(
        session(),
        'INC-000012',
        { body: 'oi', attachmentCount: 0 },
        [],
      ),
      'DATABASE_ERROR',
    )
  })

  it('still answers when the ticket cannot be reloaded for the notification', async () => {
    ticketRepo.findById.mockResolvedValue(err(databaseError('x')))
    expectOk(
      await SdPortalService.reply(
        session(),
        'INC-000012',
        { body: 'oi', attachmentCount: 0 },
        [],
      ),
    )
    expect(notifier.notify).not.toHaveBeenCalled()
  })

  it('previews the attachment count when the body is empty', async () => {
    repo.createContactMessage.mockResolvedValue(
      ok(
        message({
          body: '',
          attachments: [
            {
              id: 'a1',
              workspaceId: 'ws1',
              ticketId: 'ticket1',
              messageId: 'm1',
              uploadedById: null,
              kind: 'IMAGE',
              fileName: 'a.png',
              mimeType: 'image/png',
              size: 4,
              storageKey: 'k',
              createdAt: new Date(),
              deletedAt: null,
              uploadedBy: null,
            },
          ] as SdTicketMessageWithRelations['attachments'],
        }),
      ),
    )
    await SdPortalService.reply(
      session(),
      'INC-000012',
      { body: '', attachmentCount: 1 },
      [{ buffer: PNG, contentType: 'image/png', fileName: 'a.png' }],
    )
    expect(notifier.notify.mock.calls[0][0].body).toBe('1 anexo(s)')
  })

  it('trims a very long preview', async () => {
    repo.createContactMessage.mockResolvedValue(
      ok(message({ body: 'a'.repeat(300) })),
    )
    await SdPortalService.reply(
      session(),
      'INC-000012',
      { body: 'a'.repeat(300), attachmentCount: 0 },
      [],
    )
    expect(notifier.notify.mock.calls[0][0].body.endsWith('…')).toBe(true)
    expect(notifier.notify.mock.calls[0][0].body).toHaveLength(140)
  })
})

describe('SdPortalService.rate', () => {
  function resolved(csatScore: number | null = null) {
    return createFakeSdPortalTicket({
      csatScore,
      phase: { id: 'p', name: 'Resolvido', color: null, category: 'RESOLVED' },
    })
  }

  it('records the score with a CONTACT trace and audit', async () => {
    repo.findTicketByNumber.mockResolvedValue(ok(resolved()))

    const dto = expectOk(
      await SdPortalService.rate(session(), 'INC-000012', {
        score: 5,
        comment: '  Rápido!  ',
      }),
    )

    expect(dto).toEqual({ csatScore: 5, csatComment: 'Rápido!' })
    expect(csatRepo.submit).toHaveBeenCalledWith('ticket1', 'ws1', 5, 'Rápido!')
    expect(recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorKind: 'CONTACT',
        action: 'csat.submitted',
        toValue: 5,
      }),
    )
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'sd_ticket_csat', actorId: null }),
    )
  })

  it('keeps a blank comment as null', async () => {
    repo.findTicketByNumber.mockResolvedValue(ok(resolved()))
    const dto = expectOk(
      await SdPortalService.rate(session(), 'INC-000012', {
        score: 4,
        comment: '   ',
      }),
    )
    expect(dto.csatComment).toBeNull()
  })

  it('refuses before the ticket is resolved', async () => {
    expectErr(
      await SdPortalService.rate(session(), 'INC-000012', { score: 5 }),
      'SD_CSAT_NOT_AVAILABLE',
    )
  })

  it('refuses a second rating, including when it races', async () => {
    repo.findTicketByNumber.mockResolvedValue(ok(resolved(4)))
    expectErr(
      await SdPortalService.rate(session(), 'INC-000012', { score: 5 }),
      'SD_CSAT_ALREADY_SUBMITTED',
    )

    repo.findTicketByNumber.mockResolvedValue(ok(resolved()))
    csatRepo.submit.mockResolvedValue(ok(false))
    expectErr(
      await SdPortalService.rate(session(), 'INC-000012', { score: 5 }),
      'SD_CSAT_ALREADY_SUBMITTED',
    )
  })

  it('404s a ticket outside the scope and propagates database failures', async () => {
    repo.findTicketByNumber.mockResolvedValue(err(sdTicketNotFound()))
    expectErr(
      await SdPortalService.rate(session(), 'INC-000999', { score: 5 }),
      'SD_TICKET_NOT_FOUND',
    )

    repo.findTicketByNumber.mockResolvedValue(ok(resolved()))
    csatRepo.submit.mockResolvedValue(err(databaseError('x')))
    expectErr(
      await SdPortalService.rate(session(), 'INC-000012', { score: 5 }),
      'DATABASE_ERROR',
    )
  })
})

describe('SdPortalService.attachment', () => {
  it('serves an attachment of a public message of a ticket in scope', async () => {
    const file = expectOk(
      await SdPortalService.attachment(session(), 'INC-000012', 'att1'),
    )
    expect(file.fileName).toBe('ordem.pdf')
    expect(file.contentType).toBe('application/pdf')
    expect(repo.findPublicAttachment).toHaveBeenCalledWith('att1', 'ticket1')
    expect(getObject).toHaveBeenCalledWith({
      bucket: 'servicedesk',
      key: 'ws1/tickets/ticket1/a-ordem.pdf',
    })
  })

  it('404s an attachment of an internal note or of another ticket', async () => {
    repo.findPublicAttachment.mockResolvedValue(ok(null))
    expectErr(
      await SdPortalService.attachment(session(), 'INC-000012', 'att-internal'),
      'SD_ATTACHMENT_NOT_FOUND',
    )
  })

  it('404s when the ticket itself is out of scope', async () => {
    repo.findTicketByNumber.mockResolvedValue(err(sdTicketNotFound()))
    expectErr(
      await SdPortalService.attachment(session(), 'INC-000999', 'att1'),
      'SD_TICKET_NOT_FOUND',
    )
    expect(repo.findPublicAttachment).not.toHaveBeenCalled()
  })

  it('reports a storage failure and propagates database failures', async () => {
    vi.mocked(getObject).mockRejectedValueOnce(new Error('gone'))
    expectErr(
      await SdPortalService.attachment(session(), 'INC-000012', 'att1'),
      'STORAGE_ERROR',
    )

    repo.findPublicAttachment.mockResolvedValue(err(databaseError('x')))
    expectErr(
      await SdPortalService.attachment(session(), 'INC-000012', 'att1'),
      'DATABASE_ERROR',
    )
  })
})

describe('SdPortalService.formOptions', () => {
  it('offers only what the portal released', async () => {
    repo.formOptions.mockResolvedValue(
      ok({
        categories: [
          {
            id: 'c1',
            name: 'Infra',
            parentId: null,
            level: 'CATEGORY',
            ticketTypes: [],
            position: 0,
          },
        ],
        templates: [
          {
            id: 't1',
            name: 'Toner',
            description: null,
            ticketType: 'SERVICE_REQUEST',
            position: 0,
          },
          {
            id: 't2',
            name: 'Janela de mudança',
            description: null,
            ticketType: 'CHANGE',
            position: 1,
          },
        ],
        urgencies: [{ id: 'u1', name: 'Alta', level: 3 }],
        customFields: [
          {
            id: 'f1',
            key: 'andar',
            label: 'Andar',
            description: null,
            type: 'TEXT',
            options: [],
            required: false,
            ticketTypes: [],
            categoryIds: [],
            position: 0,
          },
        ],
      }) as never,
    )

    const dto = expectOk(await SdPortalService.formOptions(session()))

    expect(dto.ticketTypes).toEqual(['INCIDENT', 'SERVICE_REQUEST'])
    // O modelo de CHANGE sai: o tipo não está liberado no portal.
    expect(dto.templates.map((t) => t.id)).toEqual(['t1'])
    expect(dto.catalog[0].id).toBe('c1')
    expect(dto.urgencies).toEqual([{ id: 'u1', name: 'Alta' }])
    expect(dto.customFields[0].key).toBe('andar')
  })

  it('propagates database failures', async () => {
    repo.formOptions.mockResolvedValue(err(databaseError('x')))
    expectErr(await SdPortalService.formOptions(session()), 'DATABASE_ERROR')
  })
})

describe('SdPortalService.knowledge', () => {
  const article = {
    id: 'a1',
    workspaceId: 'ws1',
    parentId: null,
    title: 'Trocar a senha',
    icon: null,
    coverImage: null,
    status: 'PUBLISHED' as const,
    visibility: 'PORTAL' as const,
    categoryId: 'cat1',
    tags: ['senha'],
    position: 0,
    viewCount: 3,
    helpfulCount: 1,
    notHelpfulCount: 0,
    plainText: 'abra o portal e troque a senha',
    publishedAt: new Date('2026-09-01T00:00:00.000Z'),
    archivedAt: null,
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
  }

  it('lists only the portal articles of the session workspace', async () => {
    kbRepo.listByWorkspace.mockResolvedValue(ok([article]) as never)
    kbCatalog.listCategoriesWithCounts.mockResolvedValue(
      ok([
        {
          id: 'cat1',
          name: 'Acessos',
          icon: null,
          description: null,
          parentId: null,
          portalVisible: true,
          articleCount: 1,
        },
      ]),
    )

    const dto = expectOk(
      await SdPortalService.knowledge(session(), { limit: 20 }),
    )

    expect(kbRepo.listByWorkspace).toHaveBeenCalledWith('ws1', {
      portalOnly: true,
      archived: false,
    })
    expect(kbCatalog.listCategoriesWithCounts).toHaveBeenCalledWith('ws1', true)
    expect(dto.articles).toHaveLength(1)
    expect(dto.categories).toEqual([
      { id: 'cat1', name: 'Acessos', icon: null },
    ])
  })

  it('filters the listing by category', async () => {
    kbRepo.listByWorkspace.mockResolvedValue(
      ok([article, { ...article, id: 'a2', categoryId: 'other' }]) as never,
    )
    const dto = expectOk(
      await SdPortalService.knowledge(session(), {
        categoryId: 'cat1',
        limit: 20,
      }),
    )
    expect(dto.articles.map((a) => a.id)).toEqual(['a1'])
  })

  it('searches with portalOnly and keeps the excerpt', async () => {
    kbRepo.search.mockResolvedValue(ok([{ ...article, rank: 0.8 }]) as never)
    const dto = expectOk(
      await SdPortalService.knowledge(session(), { q: 'senha', limit: 10 }),
    )
    expect(kbRepo.search).toHaveBeenCalledWith('ws1', {
      q: 'senha',
      portalOnly: true,
      limit: 10,
    })
    expect(dto.articles[0]).toHaveProperty('excerpt')
    expect(kbRepo.listByWorkspace).not.toHaveBeenCalled()
  })

  it('passes the category along to the search', async () => {
    await SdPortalService.knowledge(session(), {
      q: 'senha',
      categoryId: 'cat1',
      limit: 10,
    })
    expect(kbRepo.search.mock.calls[0][1]).toMatchObject({
      categoryId: 'cat1',
    })
  })

  it('propagates database failures of the categories, list and search', async () => {
    kbCatalog.listCategoriesWithCounts.mockResolvedValue(
      err(databaseError('x')),
    )
    expectErr(
      await SdPortalService.knowledge(session(), { limit: 20 }),
      'DATABASE_ERROR',
    )

    kbCatalog.listCategoriesWithCounts.mockResolvedValue(ok([]))
    kbRepo.listByWorkspace.mockResolvedValue(err(databaseError('x')))
    expectErr(
      await SdPortalService.knowledge(session(), { limit: 20 }),
      'DATABASE_ERROR',
    )

    kbRepo.search.mockResolvedValue(err(databaseError('x')))
    expectErr(
      await SdPortalService.knowledge(session(), { q: 'x', limit: 20 }),
      'DATABASE_ERROR',
    )
  })
})

describe('SdPortalService.article', () => {
  const full = {
    id: 'a1',
    workspaceId: 'ws1',
    parentId: null,
    title: 'Trocar a senha',
    icon: null,
    coverImage: null,
    status: 'PUBLISHED' as const,
    visibility: 'PORTAL' as const,
    categoryId: null,
    tags: [],
    position: 0,
    viewCount: 3,
    helpfulCount: 0,
    notHelpfulCount: 0,
    content: [{ type: 'p', children: [{ text: 'oi' }] }],
    plainText: 'oi',
    publishedAt: new Date('2026-09-01T00:00:00.000Z'),
    archivedAt: null,
    createdById: 'u1',
    updatedById: null,
    createdBy: null,
    updatedBy: null,
    category: null,
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
  }

  it('returns a published portal article and counts the view', async () => {
    kbRepo.findById.mockResolvedValue(ok(full) as never)
    const dto = expectOk(await SdPortalService.article(session(), 'a1'))
    expect(dto.title).toBe('Trocar a senha')
    expect(dto.myVote).toBeNull()
    expect(kbRepo.incrementViews).toHaveBeenCalledWith('a1')
  })

  it('404s a draft, an internal article and an archived one', async () => {
    kbRepo.findById.mockResolvedValue(ok({ ...full, status: 'DRAFT' }) as never)
    expectErr(
      await SdPortalService.article(session(), 'a1'),
      'SD_KB_ARTICLE_NOT_FOUND',
    )

    kbRepo.findById.mockResolvedValue(
      ok({ ...full, visibility: 'INTERNAL' }) as never,
    )
    expectErr(
      await SdPortalService.article(session(), 'a1'),
      'SD_KB_ARTICLE_NOT_FOUND',
    )

    kbRepo.findById.mockResolvedValue(
      ok({ ...full, archivedAt: new Date() }) as never,
    )
    expectErr(
      await SdPortalService.article(session(), 'a1'),
      'SD_KB_ARTICLE_NOT_FOUND',
    )
    expect(kbRepo.incrementViews).not.toHaveBeenCalled()
  })

  it('scopes the lookup to the session workspace and propagates failures', async () => {
    kbRepo.findById.mockResolvedValue(ok(full) as never)
    await SdPortalService.article(session(), 'a1')
    expect(kbRepo.findById).toHaveBeenCalledWith('a1', 'ws1')

    kbRepo.findById.mockResolvedValue(err(databaseError('x')))
    expectErr(await SdPortalService.article(session(), 'a1'), 'DATABASE_ERROR')
  })
})
