import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFakeSdMailbox,
  createFakeSdMailMessage,
} from '@/src/__tests__/factories/sd-mailbox.factory'
import { createFakeSdTicket } from '@/src/__tests__/factories/sd-ticket.factory'
import { createFakeSdSettings } from '@/src/__tests__/factories/sd-ticket-context.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import { DEFAULT_SD_TICKET_PREFIXES } from '@/src/lib/servicedesk/ticket-code'

const { env, loggerMock } = vi.hoisted(() => ({
  env: { dryRun: 'false' },
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/env/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/env/server')>()),
  get MAIL_DRY_RUN() {
    return env.dryRun
  },
}))
vi.mock('@/lib/axiom/logger', () => ({ logger: loggerMock }))
vi.mock('@/src/repositories/sd-mailbox.repository')
vi.mock('@/src/repositories/sd-ticket.repository')
vi.mock('@/src/lib/mail/send', () => ({ sendEmail: vi.fn() }))
vi.mock('@/src/lib/mail/sd-mailbox-transport', () => ({
  sendSdSmtp: vi.fn(),
}))
vi.mock('@/src/lib/crypto', () => ({
  encryptConnectionSecret: vi.fn(async (value: string) => `enc:${value}`),
  decryptConnectionSecret: vi.fn(async (value: string) =>
    value.replace(/^enc:/, ''),
  ),
}))
vi.mock('../sd-ticket-engine', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../sd-ticket-engine')>()),
  SdTicketEngine: { loadConfig: vi.fn() },
}))

import { sendSdSmtp } from '@/src/lib/mail/sd-mailbox-transport'
import { sendEmail } from '@/src/lib/mail/send'
import {
  SdMailboxRepository,
  SdMailMessageRepository,
} from '@/src/repositories/sd-mailbox.repository'
import { SdTicketRepository } from '@/src/repositories/sd-ticket.repository'
import { SdMailOutboundService } from '../sd-mail-outbound.service'
import { SdTicketEngine } from '../sd-ticket-engine'

const mailboxes = vi.mocked(SdMailboxRepository)
const messages = vi.mocked(SdMailMessageRepository)
const tickets = vi.mocked(SdTicketRepository)
const smtp = vi.mocked(sendSdSmtp)
const resend = vi.mocked(sendEmail)
const engine = vi.mocked(SdTicketEngine)

const WS = 'ws1'

const smtpMailbox = (overrides = {}) =>
  createFakeSdMailbox({
    smtpHost: 'smtp.empresa.com.br',
    smtpPort: 465,
    smtpUser: 'suporte',
    encryptedSmtpPassword: 'enc:smtp-segredo',
    ...overrides,
  })

const reply = {
  workspaceId: WS,
  ticketId: 't1',
  ticketMessageId: 'tm1',
  body: 'Já trocamos o toner.',
}

beforeEach(() => {
  env.dryRun = 'false'
  messages.findMailboxIdForTicket.mockResolvedValue(ok('mb1'))
  messages.hasOutboundFor.mockResolvedValue(ok(false))
  messages.findLastInbound.mockResolvedValue(
    ok(
      createFakeSdMailMessage({
        messageId: '<inbound@cliente.com>',
        references: ['<raiz@cliente.com>'],
        subject: 'Re: [INC-000007] Impressora parada',
      }),
    ),
  )
  messages.create.mockImplementation(async (data) =>
    ok(createFakeSdMailMessage(data as never)),
  )
  mailboxes.findByIdUnscoped.mockResolvedValue(ok(smtpMailbox()))
  tickets.findById.mockResolvedValue(
    ok(createFakeSdTicket({ id: 't1', number: 7, title: 'Impressora' })),
  )
  engine.loadConfig.mockResolvedValue(
    ok({
      settings: createFakeSdSettings(),
      prefixes: DEFAULT_SD_TICKET_PREFIXES,
    }),
  )
  smtp.mockResolvedValue('<out@empresa.com.br>')
  resend.mockResolvedValue({ id: 'resend-1' } as never)
})

describe('sendTicketReply', () => {
  it('sends through the mailbox SMTP, threaded, and records the row', async () => {
    expect(expectOk(await SdMailOutboundService.sendTicketReply(reply))).toBe(
      'sent',
    )

    expect(smtp).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'smtp.empresa.com.br', port: 465 }),
      expect.objectContaining({
        to: 'cliente@cliente.com',
        subject: 'Re: [INC-000007] Impressora parada',
        inReplyTo: '<inbound@cliente.com>',
        references: ['<raiz@cliente.com>', '<inbound@cliente.com>'],
        from: { name: 'Suporte', address: 'suporte@empresa.com.br' },
      }),
    )
    expect(smtp.mock.calls[0][1].text).toContain('Já trocamos o toner.')
    expect(smtp.mock.calls[0][1].text).toContain(
      '-- Responda acima desta linha --',
    )
    expect(resend).not.toHaveBeenCalled()
    expect(messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: 'OUTBOUND',
        ticketId: 't1',
        ticketMessageId: 'tm1',
        messageId: '<out@empresa.com.br>',
        toAddresses: ['cliente@cliente.com'],
        automatic: false,
      }),
    )
  })

  it('falls back to the app mail layer when there is no SMTP', async () => {
    mailboxes.findByIdUnscoped.mockResolvedValue(ok(createFakeSdMailbox()))

    expect(expectOk(await SdMailOutboundService.sendTicketReply(reply))).toBe(
      'sent',
    )
    expect(smtp).not.toHaveBeenCalled()
    expect(resend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'cliente@cliente.com',
        replyTo: 'suporte@empresa.com.br',
        headers: {
          'In-Reply-To': '<inbound@cliente.com>',
          References: '<raiz@cliente.com> <inbound@cliente.com>',
        },
      }),
    )
    expect(messages.create).toHaveBeenCalledWith(
      expect.objectContaining({ messageId: '<resend-1@resend>' }),
    )
  })

  it('sends without threading headers when there is no previous e-mail', async () => {
    mailboxes.findByIdUnscoped.mockResolvedValue(ok(createFakeSdMailbox()))
    messages.findLastInbound.mockResolvedValue(ok(null))
    tickets.findById.mockResolvedValue(
      ok(
        createFakeSdTicket({
          id: 't1',
          number: 7,
          title: 'Impressora',
          contact: {
            id: 'c1',
            name: 'Cliente',
            email: 'Contato@Cliente.com',
            phone: null,
            userId: null,
          } as never,
        }),
      ),
    )

    expect(expectOk(await SdMailOutboundService.sendTicketReply(reply))).toBe(
      'sent',
    )
    const payload = resend.mock.calls[0][0] as Record<string, unknown>
    expect(payload.to).toBe('contato@cliente.com')
    expect(payload.headers).toBeUndefined()
    expect(messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Re: [INC-000007] Impressora',
        inReplyTo: null,
        references: [],
      }),
    )
  })

  it('does not send in MAIL_DRY_RUN but still records the row', async () => {
    env.dryRun = 'true'
    expect(expectOk(await SdMailOutboundService.sendTicketReply(reply))).toBe(
      'sent',
    )
    expect(smtp).not.toHaveBeenCalled()
    expect(resend).not.toHaveBeenCalled()
    expect(loggerMock.info).toHaveBeenCalledWith(
      'servicedesk.mail.dry_run',
      expect.objectContaining({ mailboxId: 'mb1' }),
    )
    expect(messages.create).toHaveBeenCalled()
  })

  it('synthesises a Message-ID even for a mailbox address without a domain', async () => {
    env.dryRun = 'true'
    mailboxes.findByIdUnscoped.mockResolvedValue(
      ok(createFakeSdMailbox({ address: 'caixa-sem-dominio' })),
    )
    expectOk(await SdMailOutboundService.sendTicketReply(reply))
    expect(messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: expect.stringContaining('@steel.local>'),
      }),
    )
  })

  it.each([
    [
      'the ticket never came by e-mail',
      () => messages.findMailboxIdForTicket.mockResolvedValue(ok(null)),
    ],
    [
      'the message was already answered by e-mail',
      () => messages.hasOutboundFor.mockResolvedValue(ok(true)),
    ],
    [
      'the mailbox was removed',
      () => mailboxes.findByIdUnscoped.mockResolvedValue(ok(null)),
    ],
  ])('skips when %s', async (_label, arrange) => {
    arrange()
    expect(expectOk(await SdMailOutboundService.sendTicketReply(reply))).toBe(
      'skipped',
    )
    expect(smtp).not.toHaveBeenCalled()
    expect(messages.create).not.toHaveBeenCalled()
  })

  it('skips when there is nobody to answer', async () => {
    messages.findLastInbound.mockResolvedValue(ok(null))
    expect(expectOk(await SdMailOutboundService.sendTicketReply(reply))).toBe(
      'skipped',
    )
  })

  it('skips when the recipient is the mailbox itself (loop guard)', async () => {
    messages.findLastInbound.mockResolvedValue(
      ok(createFakeSdMailMessage({ fromAddress: 'Suporte@Empresa.com.BR' })),
    )
    expect(expectOk(await SdMailOutboundService.sendTicketReply(reply))).toBe(
      'skipped',
    )
    expect(smtp).not.toHaveBeenCalled()
  })

  it.each([
    ['the SMTP throws', () => smtp.mockRejectedValue(new Error('timeout'))],
    ['the SMTP throws a non-Error', () => smtp.mockRejectedValue('boom')],
  ])('skips and logs when %s', async (_label, arrange) => {
    arrange()
    expect(expectOk(await SdMailOutboundService.sendTicketReply(reply))).toBe(
      'skipped',
    )
    expect(loggerMock.error).toHaveBeenCalledWith(
      'servicedesk.mail.send_failed',
      expect.objectContaining({ mailboxId: 'mb1' }),
    )
    expect(messages.create).not.toHaveBeenCalled()
  })

  it('skips and logs when the credentials cannot be decrypted', async () => {
    const { decryptConnectionSecret } = await import('@/src/lib/crypto')
    vi.mocked(decryptConnectionSecret).mockRejectedValueOnce(
      new Error('chave trocada'),
    )
    expect(expectOk(await SdMailOutboundService.sendTicketReply(reply))).toBe(
      'skipped',
    )
    expect(loggerMock.warn).toHaveBeenCalledWith(
      'servicedesk.mail.credentials_failed',
      expect.objectContaining({
        reason: 'SD_MAILBOX_CONNECTION_FAILED',
      }),
    )
  })

  it.each([
    [
      'findMailboxIdForTicket',
      () =>
        messages.findMailboxIdForTicket.mockResolvedValue(err(databaseError())),
    ],
    [
      'hasOutboundFor',
      () => messages.hasOutboundFor.mockResolvedValue(err(databaseError())),
    ],
    [
      'findByIdUnscoped',
      () => mailboxes.findByIdUnscoped.mockResolvedValue(err(databaseError())),
    ],
    [
      'ticket findById',
      () => tickets.findById.mockResolvedValue(err(databaseError())),
    ],
    [
      'findLastInbound',
      () => messages.findLastInbound.mockResolvedValue(err(databaseError())),
    ],
    [
      'loadConfig',
      () => engine.loadConfig.mockResolvedValue(err(databaseError())),
    ],
    ['create', () => messages.create.mockResolvedValue(err(databaseError()))],
  ])('propagates the %s failure', async (_label, arrange) => {
    arrange()
    expectErr(
      await SdMailOutboundService.sendTicketReply(reply),
      'DATABASE_ERROR',
    )
  })
})

describe('sendAcknowledgement', () => {
  const ack = {
    mailbox: smtpMailbox(),
    ticketId: 't1',
    code: 'INC-000007',
    title: 'Impressora parada',
    to: 'Cliente@Cliente.com',
    inReplyTo: '<inbound@cliente.com>',
    references: ['<inbound@cliente.com>'],
    subject: 'Impressora parada',
  }

  it('answers the opening with the ticket code and records it as automatic', async () => {
    expect(expectOk(await SdMailOutboundService.sendAcknowledgement(ack))).toBe(
      'sent',
    )

    expect(smtp.mock.calls[0][1]).toMatchObject({
      to: 'cliente@cliente.com',
      subject: 'Re: [INC-000007] Impressora parada',
      inReplyTo: '<inbound@cliente.com>',
    })
    expect(smtp.mock.calls[0][1].text).toContain('abrimos o chamado INC-000007')
    expect(messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: 'OUTBOUND',
        automatic: true,
        ticketMessageId: null,
      }),
    )
  })

  it('falls back to the ticket title when the e-mail had no subject', async () => {
    await SdMailOutboundService.sendAcknowledgement({ ...ack, subject: null })
    expect(smtp.mock.calls[0][1].subject).toBe(
      'Re: [INC-000007] Impressora parada',
    )
  })

  it.each([
    [
      'the mailbox does not acknowledge',
      { ...ack, mailbox: smtpMailbox({ sendAcknowledgement: false }) },
    ],
    ['the recipient is empty', { ...ack, to: '   ' }],
    [
      'the recipient is the mailbox itself',
      { ...ack, to: 'SUPORTE@empresa.com.br' },
    ],
  ])('skips when %s', async (_label, input) => {
    expect(
      expectOk(await SdMailOutboundService.sendAcknowledgement(input)),
    ).toBe('skipped')
    expect(smtp).not.toHaveBeenCalled()
  })

  it('skips when the delivery fails', async () => {
    smtp.mockRejectedValue(new Error('timeout'))
    expect(expectOk(await SdMailOutboundService.sendAcknowledgement(ack))).toBe(
      'skipped',
    )
    expect(messages.create).not.toHaveBeenCalled()
  })

  it('propagates a failure recording the row', async () => {
    messages.create.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdMailOutboundService.sendAcknowledgement(ack),
      'DATABASE_ERROR',
    )
  })
})
