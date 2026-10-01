import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFakeFetchedMail,
  createFakeSdMailbox,
  createFakeSdMailMessage,
} from '@/src/__tests__/factories/sd-mailbox.factory'
import { createFakeSdTicket } from '@/src/__tests__/factories/sd-ticket.factory'
import { createFakeSdSettings } from '@/src/__tests__/factories/sd-ticket-context.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { actAs } from '@/src/__tests__/helpers/sd-access.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import { DEFAULT_SD_TICKET_PREFIXES } from '@/src/lib/servicedesk/ticket-code'

const { loggerMock } = vi.hoisted(() => ({
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/axiom/logger', () => ({ logger: loggerMock }))
vi.mock('@/lib/axiom/audit')
vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/sd-access.repository')
vi.mock('@/src/repositories/sd-mailbox.repository')
vi.mock('@/src/repositories/sd-contact.repository')
vi.mock('@/src/repositories/sd-ticket.repository')
vi.mock('@/src/lib/storage/s3', () => ({
  ensureBucket: vi.fn(async () => undefined),
  putObject: vi.fn(async () => undefined),
}))
vi.mock('@/src/lib/mail/sd-mailbox-transport', () => ({
  fetchSdMailbox: vi.fn(),
}))
vi.mock('@/src/lib/crypto', () => ({
  encryptConnectionSecret: vi.fn(async (value: string) => `enc:${value}`),
  decryptConnectionSecret: vi.fn(async (value: string) =>
    value.replace(/^enc:/, ''),
  ),
}))
vi.mock('@/src/lib/servicedesk/realtime', () => ({
  publishSdTicketEvent: vi.fn(async () => undefined),
}))
vi.mock('../sd-automation-engine', () => ({
  fireSdAutomations: vi.fn(async () => undefined),
}))
vi.mock('../sd-ticket-event-recorder', () => ({
  recordSdTicketEvent: vi.fn(async () => undefined),
}))
vi.mock('../sd-mail-outbound.service', () => ({
  SdMailOutboundService: { sendAcknowledgement: vi.fn() },
}))
vi.mock('../sd-ticket-engine', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../sd-ticket-engine')>()),
  SdTicketEngine: {
    loadConfig: vi.fn(),
    create: vi.fn(),
    touchActivity: vi.fn(async () => ({ ok: true, value: undefined })),
    reopen: vi.fn(),
  },
}))

import { auditMutation } from '@/lib/axiom/audit'
import { fetchSdMailbox } from '@/src/lib/mail/sd-mailbox-transport'
import { publishSdTicketEvent } from '@/src/lib/servicedesk/realtime'
import { putObject } from '@/src/lib/storage/s3'
import { SdContactRepository } from '@/src/repositories/sd-contact.repository'
import {
  SdMailboxRepository,
  SdMailMessageRepository,
} from '@/src/repositories/sd-mailbox.repository'
import { SdTicketRepository } from '@/src/repositories/sd-ticket.repository'
import { fireSdAutomations } from '../sd-automation-engine'
import {
  SD_MAIL_HOURLY_LIMIT,
  SdMailInboundService,
  sdMailBodyOf,
} from '../sd-mail-inbound.service'
import { SdMailOutboundService } from '../sd-mail-outbound.service'
import { SdTicketEngine } from '../sd-ticket-engine'
import { recordSdTicketEvent } from '../sd-ticket-event-recorder'

const mailboxes = vi.mocked(SdMailboxRepository)
const messages = vi.mocked(SdMailMessageRepository)
const contacts = vi.mocked(SdContactRepository)
const tickets = vi.mocked(SdTicketRepository)
const engine = vi.mocked(SdTicketEngine)
const fetchMail = vi.mocked(fetchSdMailbox)
const upload = vi.mocked(putObject)
const publish = vi.mocked(publishSdTicketEvent)
const automations = vi.mocked(fireSdAutomations)
const events = vi.mocked(recordSdTicketEvent)
const audit = vi.mocked(auditMutation)
const ack = vi.mocked(SdMailOutboundService.sendAcknowledgement)

const WS = 'ws1'
const config = () => ({
  settings: createFakeSdSettings({ workspaceId: WS }),
  prefixes: DEFAULT_SD_TICKET_PREFIXES,
})

const mailbox = (overrides = {}) =>
  createFakeSdMailbox({ workspaceId: WS, ...overrides })

const openTicket = (overrides = {}) =>
  createFakeSdTicket({
    id: 't1',
    workspaceId: WS,
    number: 7,
    phase: {
      id: 'p1',
      name: 'Em atendimento',
      color: null,
      category: 'IN_PROGRESS',
      completionPercent: 50,
      position: 1,
      wipLimit: null,
      pausesSla: false,
    } as never,
    requesterId: 'req-1',
    participants: [{ userId: 'guest-1', user: null }] as never,
    ...overrides,
  })

beforeEach(() => {
  messages.findByMessageId.mockResolvedValue(ok(null))
  messages.findThreadTicketId.mockResolvedValue(ok(null))
  messages.findTicketIdByNumber.mockResolvedValue(ok(null))
  messages.findContactIdByEmail.mockResolvedValue(ok(null))
  messages.countInboundSince.mockResolvedValue(ok(0))
  messages.create.mockImplementation(async (data) =>
    ok(createFakeSdMailMessage(data as never)),
  )
  messages.createTicketMessage.mockResolvedValue(ok({ id: 'tm1' }))
  mailboxes.findByIdUnscoped.mockResolvedValue(ok(mailbox()))
  mailboxes.findById.mockResolvedValue(ok(mailbox()))
  mailboxes.listPollable.mockResolvedValue(ok([mailbox()]))
  mailboxes.markSync.mockResolvedValue(ok(undefined))
  contacts.create.mockResolvedValue(ok({ id: 'c-new', userId: null } as never))
  tickets.findById.mockResolvedValue(ok(openTicket()))
  engine.loadConfig.mockResolvedValue(ok(config()))
  engine.create.mockResolvedValue(ok(openTicket()))
  engine.reopen.mockResolvedValue(ok(openTicket()))
  fetchMail.mockResolvedValue({ messages: [], lastUid: null })
  ack.mockResolvedValue(ok('sent'))
})

describe('sdMailBodyOf', () => {
  it('prefers the plain text part', () => {
    expect(
      sdMailBodyOf(
        createFakeFetchedMail({ text: 'texto puro', html: '<p>ignorado</p>' }),
      ),
    ).toBe('texto puro')
  })

  it('falls back to the HTML part', () => {
    expect(
      sdMailBodyOf(createFakeFetchedMail({ text: '', html: '<p>só html</p>' })),
    ).toBe('só html')
  })

  it('returns an empty string with neither part', () => {
    expect(sdMailBodyOf(createFakeFetchedMail({ text: '', html: null }))).toBe(
      '',
    )
  })
})

describe('processMessage · guards', () => {
  it('skips a Message-ID already processed in this mailbox', async () => {
    messages.findByMessageId.mockResolvedValue(ok(createFakeSdMailMessage()))
    expect(
      await SdMailInboundService.processMessage(
        mailbox(),
        config(),
        createFakeFetchedMail(),
      ),
    ).toBe('skipped')
    expect(messages.create).not.toHaveBeenCalled()
  })

  it('fails when the dedupe lookup breaks', async () => {
    messages.findByMessageId.mockResolvedValue(err(databaseError()))
    expect(
      await SdMailInboundService.processMessage(
        mailbox(),
        config(),
        createFakeFetchedMail(),
      ),
    ).toBe('failed')
  })

  it('refuses an e-mail the mailbox sent to itself (loop guard)', async () => {
    expect(
      await SdMailInboundService.processMessage(
        mailbox(),
        config(),
        createFakeFetchedMail({ fromAddress: 'Suporte@Empresa.com.BR' }),
      ),
    ).toBe('skipped')
    expect(messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        automatic: true,
        ticketId: null,
        error: 'Mensagem da própria caixa (laço)',
      }),
    )
    expect(engine.create).not.toHaveBeenCalled()
  })

  it('refuses a sender outside the allow list', async () => {
    expect(
      await SdMailInboundService.processMessage(
        mailbox({ allowedSenders: ['@parceiro.com'] }),
        config(),
        createFakeFetchedMail(),
      ),
    ).toBe('skipped')
    expect(messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Remetente fora das listas da caixa',
      }),
    )
  })

  it('refuses a blocked sender', async () => {
    expect(
      await SdMailInboundService.processMessage(
        mailbox({ blockedSenders: ['cliente@cliente.com'] }),
        config(),
        createFakeFetchedMail(),
      ),
    ).toBe('skipped')
    expect(engine.create).not.toHaveBeenCalled()
  })

  it('records an auto-reply without opening a ticket', async () => {
    expect(
      await SdMailInboundService.processMessage(
        mailbox(),
        config(),
        createFakeFetchedMail({
          headers: { 'auto-submitted': 'auto-replied' },
          subject: 'Resposta automática',
        }),
      ),
    ).toBe('skipped')
    expect(messages.create).toHaveBeenCalledWith(
      expect.objectContaining({ automatic: true, ticketId: null }),
    )
    expect(engine.create).not.toHaveBeenCalled()
    expect(messages.createTicketMessage).not.toHaveBeenCalled()
  })

  it('links an auto-reply to the thread ticket but never reopens it', async () => {
    messages.findThreadTicketId.mockResolvedValue(ok('t1'))
    tickets.findById.mockResolvedValue(
      ok(openTicket({ phase: { category: 'RESOLVED' } as never })),
    )

    expect(
      await SdMailInboundService.processMessage(
        mailbox(),
        config(),
        createFakeFetchedMail({ headers: { precedence: 'bulk' } }),
      ),
    ).toBe('skipped')
    expect(messages.create).toHaveBeenCalledWith(
      expect.objectContaining({ automatic: true, ticketId: 't1' }),
    )
    expect(engine.reopen).not.toHaveBeenCalled()
    expect(messages.createTicketMessage).not.toHaveBeenCalled()
  })

  it('fails when the thread lookup breaks', async () => {
    messages.findThreadTicketId.mockResolvedValue(err(databaseError()))
    expect(
      await SdMailInboundService.processMessage(
        mailbox(),
        config(),
        createFakeFetchedMail(),
      ),
    ).toBe('failed')
  })

  it('refuses a new ticket past the hourly limit of the mailbox', async () => {
    messages.countInboundSince.mockResolvedValue(ok(SD_MAIL_HOURLY_LIMIT))
    expect(
      await SdMailInboundService.processMessage(
        mailbox(),
        config(),
        createFakeFetchedMail(),
      ),
    ).toBe('skipped')
    expect(messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Limite de e-mails por hora da caixa atingido',
      }),
    )
    expect(engine.create).not.toHaveBeenCalled()
  })

  it('fails when the hourly counter breaks', async () => {
    messages.countInboundSince.mockResolvedValue(err(databaseError()))
    expect(
      await SdMailInboundService.processMessage(
        mailbox(),
        config(),
        createFakeFetchedMail(),
      ),
    ).toBe('failed')
  })

  it('logs when the mail row cannot be recorded', async () => {
    messages.create.mockResolvedValue(err(databaseError()))
    await SdMailInboundService.processMessage(
      mailbox(),
      config(),
      createFakeFetchedMail({ fromAddress: 'suporte@empresa.com.br' }),
    )
    expect(loggerMock.error).toHaveBeenCalledWith(
      'servicedesk.mail.record_failed',
      expect.objectContaining({ mailboxId: 'mb1' }),
    )
  })
})

describe('processMessage · threading', () => {
  it('appends to the thread ticket as the matched contact', async () => {
    messages.findThreadTicketId.mockResolvedValue(ok('t1'))
    messages.findContactIdByEmail.mockResolvedValue(
      ok({ id: 'c1', userId: 'u9' }),
    )

    expect(
      await SdMailInboundService.processMessage(
        mailbox(),
        config(),
        createFakeFetchedMail({
          inReplyTo: '<raiz@empresa.com.br>',
          references: ['<raiz@empresa.com.br>'],
        }),
      ),
    ).toBe('appended')

    expect(messages.findThreadTicketId).toHaveBeenCalledWith(WS, [
      '<raiz@empresa.com.br>',
    ])
    expect(messages.createTicketMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: 't1',
        authorKind: 'CONTACT',
        authorContactId: 'c1',
        authorUserId: 'u9',
        body: 'A impressora do 3º andar não liga.',
      }),
    )
    expect(engine.touchActivity).toHaveBeenCalledWith('t1')
    expect(events).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'message.posted' }),
    )
    expect(automations).toHaveBeenCalledWith('MESSAGE_RECEIVED', 't1')
    expect(publish).toHaveBeenCalledWith(
      WS,
      expect.objectContaining({ type: 'ticket.message', ticketId: 't1' }),
      {
        requesterId: 'req-1',
        participantIds: ['guest-1'],
        contactUserId: null,
      },
    )
    expect(engine.create).not.toHaveBeenCalled()
    expect(messages.create).toHaveBeenCalledWith(
      expect.objectContaining({ ticketId: 't1', ticketMessageId: 'tm1' }),
    )
  })

  it('falls back to the ticket code in the subject', async () => {
    messages.findTicketIdByNumber.mockResolvedValue(ok('t1'))

    expect(
      await SdMailInboundService.processMessage(
        mailbox({ createUnknownContacts: false }),
        config(),
        createFakeFetchedMail({ subject: 'Re: [INC-000007] Impressora' }),
      ),
    ).toBe('appended')
    expect(messages.findTicketIdByNumber).toHaveBeenCalledWith(WS, 7)
    expect(messages.createTicketMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        authorKind: 'REQUESTER',
        authorContactId: null,
      }),
    )
  })

  it('opens a new ticket when the subject code points nowhere', async () => {
    tickets.findById.mockResolvedValue(err(databaseError()))
    messages.findThreadTicketId.mockResolvedValue(ok('apagado'))

    expect(
      await SdMailInboundService.processMessage(
        mailbox(),
        config(),
        createFakeFetchedMail(),
      ),
    ).toBe('opened')
    expect(engine.create).toHaveBeenCalled()
  })

  it('fails when the subject lookup breaks', async () => {
    messages.findTicketIdByNumber.mockResolvedValue(err(databaseError()))
    expect(
      await SdMailInboundService.processMessage(
        mailbox(),
        config(),
        createFakeFetchedMail({ subject: '[INC-000007] teste' }),
      ),
    ).toBe('failed')
  })

  it('reopens a RESOLVED ticket on the requester reply', async () => {
    messages.findThreadTicketId.mockResolvedValue(ok('t1'))
    tickets.findById.mockResolvedValue(
      ok(openTicket({ phase: { category: 'RESOLVED' } as never })),
    )

    expect(
      await SdMailInboundService.processMessage(
        mailbox(),
        config(),
        createFakeFetchedMail(),
      ),
    ).toBe('appended')
    expect(engine.reopen).toHaveBeenCalled()
  })

  it('logs when reopening fails but still appends', async () => {
    messages.findThreadTicketId.mockResolvedValue(ok('t1'))
    tickets.findById.mockResolvedValue(
      ok(openTicket({ phase: { category: 'RESOLVED' } as never })),
    )
    engine.reopen.mockResolvedValue(err(databaseError()))

    expect(
      await SdMailInboundService.processMessage(
        mailbox(),
        config(),
        createFakeFetchedMail(),
      ),
    ).toBe('appended')
    expect(loggerMock.warn).toHaveBeenCalledWith(
      'servicedesk.mail.reopen_failed',
      expect.objectContaining({ ticketId: 't1' }),
    )
  })

  it('does not reopen when the setting is off', async () => {
    messages.findThreadTicketId.mockResolvedValue(ok('t1'))
    tickets.findById.mockResolvedValue(
      ok(openTicket({ phase: { category: 'RESOLVED' } as never })),
    )

    await SdMailInboundService.processMessage(
      mailbox(),
      {
        settings: createFakeSdSettings({ reopenOnRequesterReply: false }),
        prefixes: DEFAULT_SD_TICKET_PREFIXES,
      },
      createFakeFetchedMail(),
    )
    expect(engine.reopen).not.toHaveBeenCalled()
  })

  it('skips an empty reply with no attachment', async () => {
    messages.findThreadTicketId.mockResolvedValue(ok('t1'))
    expect(
      await SdMailInboundService.processMessage(
        mailbox(),
        config(),
        createFakeFetchedMail({ text: '> tudo citado\n> mesmo', html: null }),
      ),
    ).toBe('skipped')
    expect(messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: 't1',
        error: 'Mensagem sem conteúdo aproveitável',
      }),
    )
    expect(messages.createTicketMessage).not.toHaveBeenCalled()
  })

  it('fails when the ticket message cannot be created', async () => {
    messages.findThreadTicketId.mockResolvedValue(ok('t1'))
    messages.createTicketMessage.mockResolvedValue(err(databaseError()))
    expect(
      await SdMailInboundService.processMessage(
        mailbox(),
        config(),
        createFakeFetchedMail(),
      ),
    ).toBe('failed')
    expect(messages.create).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(String) }),
    )
  })
})

describe('processMessage · opening a ticket', () => {
  it('opens with the mailbox defaults and acknowledges the sender', async () => {
    const box = mailbox({
      defaultType: 'SERVICE_REQUEST',
      defaultDepartmentId: 'dep1',
      defaultCategoryId: 'cat1',
      defaultPriorityId: 'pri1',
    })

    expect(
      await SdMailInboundService.processMessage(
        box,
        config(),
        createFakeFetchedMail({ subject: 'Re: Impressora parada' }),
      ),
    ).toBe('opened')

    expect(engine.create).toHaveBeenCalledWith(
      WS,
      expect.objectContaining({
        type: 'SERVICE_REQUEST',
        title: 'Impressora parada',
        channel: 'EMAIL',
        contactId: 'c-new',
        departmentId: 'dep1',
        categoryId: 'cat1',
        priorityId: 'pri1',
        description: '<p>A impressora do 3º andar não liga.</p>',
      }),
      { kind: 'system', source: 'email' },
      expect.anything(),
    )
    expect(automations).toHaveBeenCalledWith('TICKET_CREATED', 't1')
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'sd_ticket',
        action: 'create',
        meta: expect.objectContaining({
          channel: 'EMAIL',
          contactMatched: true,
        }),
      }),
    )
    expect(ack).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: 't1',
        code: 'INC-000007',
        to: 'cliente@cliente.com',
        inReplyTo: '<abc@cliente.com>',
        references: ['<abc@cliente.com>'],
      }),
    )
  })

  it('creates the unknown contact with the sender name', async () => {
    await SdMailInboundService.processMessage(
      mailbox(),
      config(),
      createFakeFetchedMail(),
    )
    expect(contacts.create).toHaveBeenCalledWith(
      {
        workspaceId: WS,
        createdById: 'u1',
        name: 'Cliente Silva',
        email: 'cliente@cliente.com',
      },
      [],
    )
  })

  it('uses the address as the contact name when there is no display name', async () => {
    await SdMailInboundService.processMessage(
      mailbox(),
      config(),
      createFakeFetchedMail({ fromName: null }),
    )
    expect(contacts.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'cliente@cliente.com' }),
      [],
    )
  })

  it('opens without a contact when creating one is off', async () => {
    expect(
      await SdMailInboundService.processMessage(
        mailbox({ createUnknownContacts: false }),
        config(),
        createFakeFetchedMail(),
      ),
    ).toBe('opened')
    expect(contacts.create).not.toHaveBeenCalled()
    expect(engine.create).toHaveBeenCalledWith(
      WS,
      expect.objectContaining({ contactId: undefined, requesterId: null }),
      expect.anything(),
      expect.anything(),
    )
  })

  it('opens without a contact and logs when creating one fails', async () => {
    contacts.create.mockResolvedValue(err(databaseError()))
    expect(
      await SdMailInboundService.processMessage(
        mailbox(),
        config(),
        createFakeFetchedMail(),
      ),
    ).toBe('opened')
    expect(loggerMock.warn).toHaveBeenCalledWith(
      'servicedesk.mail.contact_create_failed',
      expect.objectContaining({ workspaceId: WS }),
    )
  })

  it('logs when the contact lookup breaks and still opens', async () => {
    messages.findContactIdByEmail.mockResolvedValue(err(databaseError()))
    expect(
      await SdMailInboundService.processMessage(
        mailbox(),
        config(),
        createFakeFetchedMail(),
      ),
    ).toBe('opened')
    expect(loggerMock.warn).toHaveBeenCalledWith(
      'servicedesk.mail.contact_lookup_failed',
      expect.objectContaining({ workspaceId: WS }),
    )
  })

  it('opens without a description when the body is empty', async () => {
    await SdMailInboundService.processMessage(
      mailbox(),
      config(),
      createFakeFetchedMail({ text: '', html: null, subject: null }),
    )
    expect(engine.create).toHaveBeenCalledWith(
      WS,
      expect.objectContaining({
        description: undefined,
        title: 'Chamado aberto por e-mail',
      }),
      expect.anything(),
      expect.anything(),
    )
  })

  it('records the failure when the engine refuses to open', async () => {
    engine.create.mockResolvedValue(err(databaseError()))
    expect(
      await SdMailInboundService.processMessage(
        mailbox(),
        config(),
        createFakeFetchedMail(),
      ),
    ).toBe('failed')
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'failure',
        reason: 'DATABASE_ERROR',
      }),
    )
    expect(ack).not.toHaveBeenCalled()
  })

  it('still opens when the first history message cannot be written', async () => {
    messages.createTicketMessage.mockResolvedValue(err(databaseError()))
    expect(
      await SdMailInboundService.processMessage(
        mailbox(),
        config(),
        createFakeFetchedMail(),
      ),
    ).toBe('opened')
    expect(events).not.toHaveBeenCalled()
    expect(messages.create).toHaveBeenCalledWith(
      expect.objectContaining({ ticketMessageId: null }),
    )
  })

  it('logs when the acknowledgement fails', async () => {
    ack.mockResolvedValue(err(databaseError()))
    expect(
      await SdMailInboundService.processMessage(
        mailbox(),
        config(),
        createFakeFetchedMail(),
      ),
    ).toBe('opened')
    expect(loggerMock.warn).toHaveBeenCalledWith(
      'servicedesk.mail.acknowledgement_failed',
      expect.objectContaining({ ticketId: 't1' }),
    )
  })
})

describe('processMessage · attachments', () => {
  const pdf = {
    fileName: 'nota.pdf',
    mimeType: 'application/pdf',
    content: Buffer.from('conteudo'),
  }

  it('uploads the allowed attachments to the ticket bucket', async () => {
    messages.findThreadTicketId.mockResolvedValue(ok('t1'))

    expect(
      await SdMailInboundService.processMessage(
        mailbox(),
        config(),
        createFakeFetchedMail({ attachments: [pdf] }),
      ),
    ).toBe('appended')

    expect(upload).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: 'servicedesk',
        contentType: 'application/pdf',
        key: expect.stringContaining('ws1/tickets/t1/'),
      }),
    )
    expect(messages.createTicketMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          expect.objectContaining({
            kind: 'DOCUMENT',
            fileName: 'nota.pdf',
            mimeType: 'application/pdf',
            size: 8,
          }),
        ],
      }),
    )
  })

  it('accepts an attachment-only reply (empty body)', async () => {
    messages.findThreadTicketId.mockResolvedValue(ok('t1'))
    expect(
      await SdMailInboundService.processMessage(
        mailbox(),
        config(),
        createFakeFetchedMail({ text: '', html: null, attachments: [pdf] }),
      ),
    ).toBe('appended')
    expect(messages.createTicketMessage).toHaveBeenCalledWith(
      expect.objectContaining({ body: '' }),
    )
  })

  it('drops a MIME type outside the allow list', async () => {
    messages.findThreadTicketId.mockResolvedValue(ok('t1'))
    await SdMailInboundService.processMessage(
      mailbox(),
      config(),
      createFakeFetchedMail({
        attachments: [{ ...pdf, mimeType: 'application/x-msdownload' }],
      }),
    )
    expect(upload).not.toHaveBeenCalled()
    expect(messages.createTicketMessage).toHaveBeenCalledWith(
      expect.objectContaining({ attachments: [] }),
    )
  })

  it('drops an attachment over the 25 MB limit', async () => {
    messages.findThreadTicketId.mockResolvedValue(ok('t1'))
    await SdMailInboundService.processMessage(
      mailbox(),
      config(),
      createFakeFetchedMail({
        attachments: [{ ...pdf, content: Buffer.alloc(25 * 1024 * 1024 + 1) }],
      }),
    )
    expect(upload).not.toHaveBeenCalled()
  })

  it('logs and skips an attachment the storage refuses', async () => {
    messages.findThreadTicketId.mockResolvedValue(ok('t1'))
    upload.mockRejectedValueOnce(new Error('minio fora'))
    expect(
      await SdMailInboundService.processMessage(
        mailbox(),
        config(),
        createFakeFetchedMail({ attachments: [pdf] }),
      ),
    ).toBe('appended')
    expect(loggerMock.warn).toHaveBeenCalledWith(
      'servicedesk.mail.attachment_failed',
      expect.objectContaining({ ticketId: 't1' }),
    )
    expect(messages.createTicketMessage).toHaveBeenCalledWith(
      expect.objectContaining({ attachments: [] }),
    )
  })

  it('logs a non-Error storage failure too', async () => {
    messages.findThreadTicketId.mockResolvedValue(ok('t1'))
    upload.mockRejectedValueOnce('boom')
    await SdMailInboundService.processMessage(
      mailbox(),
      config(),
      createFakeFetchedMail({ attachments: [pdf] }),
    )
    expect(loggerMock.warn).toHaveBeenCalledWith(
      'servicedesk.mail.attachment_failed',
      expect.objectContaining({ message: 'boom' }),
    )
  })
})

describe('syncMailbox', () => {
  it('reads from the last UID, processes and stamps the sync', async () => {
    mailboxes.findByIdUnscoped.mockResolvedValue(
      ok(mailbox({ lastSeenUid: 9, processedFolder: 'Processados' })),
    )
    fetchMail.mockResolvedValue({
      messages: [
        createFakeFetchedMail({ uid: 10, messageId: '<a@c.com>' }),
        createFakeFetchedMail({
          uid: 11,
          messageId: '<b@c.com>',
          headers: { 'x-autoreply': 'yes' },
        }),
      ],
      lastUid: 11,
    })

    const result = expectOk(await SdMailInboundService.syncMailbox('mb1'))
    expect(fetchMail).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'imap.empresa.com.br', folder: 'INBOX' }),
      expect.objectContaining({
        sinceUid: 9,
        processedFolder: 'Processados',
        maxAttachmentBytes: 25 * 1024 * 1024,
      }),
    )
    expect(result).toEqual({
      fetched: 2,
      opened: 1,
      appended: 0,
      skipped: 1,
      failed: 0,
    })
    expect(mailboxes.markSync).toHaveBeenCalledWith('mb1', {
      status: 'ACTIVE',
      statusError: null,
      lastSeenUid: 11,
      lastSyncAt: expect.any(Date),
    })
  })

  it('counts appended and failed messages', async () => {
    messages.findThreadTicketId.mockResolvedValue(ok('t1'))
    fetchMail.mockResolvedValue({
      messages: [
        createFakeFetchedMail({ uid: 1, messageId: '<a@c.com>' }),
        createFakeFetchedMail({ uid: 2, messageId: '<b@c.com>' }),
      ],
      lastUid: 2,
    })
    messages.createTicketMessage
      .mockResolvedValueOnce(ok({ id: 'tm1' }))
      .mockResolvedValueOnce(err(databaseError()))

    const result = expectOk(await SdMailInboundService.syncMailbox('mb1'))
    expect(result).toMatchObject({ appended: 1, failed: 1 })
  })

  it('keeps the stored UID when the fetch saw nothing new', async () => {
    mailboxes.findByIdUnscoped.mockResolvedValue(
      ok(mailbox({ lastSeenUid: 4 })),
    )
    expectOk(await SdMailInboundService.syncMailbox('mb1'))
    expect(mailboxes.markSync).toHaveBeenCalledWith(
      'mb1',
      expect.objectContaining({ lastSeenUid: 4 }),
    )
  })

  it('returns zeros for a mailbox that no longer exists', async () => {
    mailboxes.findByIdUnscoped.mockResolvedValue(ok(null))
    expect(expectOk(await SdMailInboundService.syncMailbox('mb9'))).toEqual({
      fetched: 0,
      opened: 0,
      appended: 0,
      skipped: 0,
      failed: 0,
    })
    expect(fetchMail).not.toHaveBeenCalled()
  })

  it('propagates the mailbox lookup failure', async () => {
    mailboxes.findByIdUnscoped.mockResolvedValue(err(databaseError()))
    expectErr(await SdMailInboundService.syncMailbox('mb1'), 'DATABASE_ERROR')
  })

  it('marks ERROR when the credentials cannot be decrypted', async () => {
    const { decryptConnectionSecret } = await import('@/src/lib/crypto')
    vi.mocked(decryptConnectionSecret).mockRejectedValueOnce(
      new Error('chave trocada'),
    )
    expect(
      expectOk(await SdMailInboundService.syncMailbox('mb1')),
    ).toMatchObject({ failed: 1 })
    expect(mailboxes.markSync).toHaveBeenCalledWith(
      'mb1',
      expect.objectContaining({ status: 'ERROR' }),
    )
    expect(fetchMail).not.toHaveBeenCalled()
  })

  it.each([
    [new Error('conexão recusada'), 'conexão recusada'],
    ['boom', 'Falha ao ler a caixa'],
  ])('marks ERROR when the IMAP read fails', async (cause, statusError) => {
    fetchMail.mockRejectedValue(cause)
    expect(
      expectOk(await SdMailInboundService.syncMailbox('mb1')),
    ).toMatchObject({ failed: 1 })
    expect(mailboxes.markSync).toHaveBeenCalledWith('mb1', {
      status: 'ERROR',
      statusError,
      lastSyncAt: expect.any(Date),
    })
    expect(loggerMock.error).toHaveBeenCalledWith(
      'servicedesk.mail.fetch_failed',
      expect.objectContaining({ mailboxId: 'mb1' }),
    )
  })

  it('keeps a paused mailbox paused on a manual read', async () => {
    mailboxes.findByIdUnscoped.mockResolvedValue(
      ok(mailbox({ status: 'PAUSED' })),
    )
    expectOk(await SdMailInboundService.syncMailbox('mb1'))
    expect(mailboxes.markSync).toHaveBeenCalledWith(
      'mb1',
      expect.objectContaining({ status: 'PAUSED', statusError: null }),
    )
  })

  it.each([
    [
      'the credentials fail',
      async () => {
        const { decryptConnectionSecret } = await import('@/src/lib/crypto')
        vi.mocked(decryptConnectionSecret).mockRejectedValueOnce(
          new Error('chave trocada'),
        )
      },
    ],
    [
      'the IMAP read fails',
      async () => {
        fetchMail.mockRejectedValue(new Error('conexão recusada'))
      },
    ],
  ])('keeps a paused mailbox paused when %s', async (_label, arrange) => {
    mailboxes.findByIdUnscoped.mockResolvedValue(
      ok(mailbox({ status: 'PAUSED' })),
    )
    await arrange()
    expectOk(await SdMailInboundService.syncMailbox('mb1'))
    expect(mailboxes.markSync).toHaveBeenCalledWith(
      'mb1',
      expect.objectContaining({ status: 'PAUSED' }),
    )
  })

  it('propagates a configuration failure', async () => {
    engine.loadConfig.mockResolvedValue(err(databaseError()))
    expectErr(await SdMailInboundService.syncMailbox('mb1'), 'DATABASE_ERROR')
  })
})

describe('runTick', () => {
  it('sums the result of every pollable mailbox', async () => {
    mailboxes.listPollable.mockResolvedValue(
      ok([mailbox({ id: 'mb1' }), mailbox({ id: 'mb2' })]),
    )
    mailboxes.findByIdUnscoped.mockImplementation(async (id) =>
      ok(mailbox({ id })),
    )
    fetchMail.mockResolvedValue({
      messages: [createFakeFetchedMail()],
      lastUid: 3,
    })

    expect(await SdMailInboundService.runTick()).toEqual({
      mailboxes: 2,
      fetched: 2,
      opened: 2,
      appended: 0,
      skipped: 0,
      failed: 0,
    })
  })

  it('counts a mailbox whose sync failed outright', async () => {
    mailboxes.findByIdUnscoped.mockResolvedValue(err(databaseError()))
    expect(await SdMailInboundService.runTick()).toMatchObject({
      mailboxes: 1,
      failed: 1,
    })
  })

  it('logs and returns zeros when the mailbox list breaks', async () => {
    mailboxes.listPollable.mockResolvedValue(err(databaseError()))
    expect(await SdMailInboundService.runTick()).toEqual({
      mailboxes: 0,
      fetched: 0,
      opened: 0,
      appended: 0,
      skipped: 0,
      failed: 0,
    })
    expect(loggerMock.error).toHaveBeenCalledWith(
      'servicedesk.mail.tick_failed',
      expect.objectContaining({ reason: 'DATABASE_ERROR' }),
    )
  })
})

describe('syncNow', () => {
  it('reads the mailbox for a module admin', async () => {
    actAs('admin')
    expectOk(await SdMailInboundService.syncNow('admin-1', WS, 'mb1'))
    expect(mailboxes.findById).toHaveBeenCalledWith('mb1', WS)
    expect(fetchMail).toHaveBeenCalled()
  })

  it('refuses an agent, a requester and a non-member', async () => {
    for (const kind of ['agent', 'requester', 'non-member'] as const) {
      actAs(kind)
      expectErr(
        await SdMailInboundService.syncNow('user-1', WS, 'mb1'),
        'FORBIDDEN',
      )
    }
    expect(fetchMail).not.toHaveBeenCalled()
  })

  it('refuses a mailbox from another workspace and propagates db errors', async () => {
    actAs('admin')
    mailboxes.findById.mockResolvedValue(ok(null))
    expectErr(
      await SdMailInboundService.syncNow('admin-1', WS, 'mb9'),
      'SD_MAILBOX_NOT_FOUND',
    )

    mailboxes.findById.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdMailInboundService.syncNow('admin-1', WS, 'mb1'),
      'DATABASE_ERROR',
    )
  })
})
