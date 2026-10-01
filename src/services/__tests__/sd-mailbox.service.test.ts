import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSdMailbox } from '@/src/__tests__/factories/sd-mailbox.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { actAs } from '@/src/__tests__/helpers/sd-access.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import {
  type CreateSdMailboxDTO,
  CreateSdMailboxSchema,
} from '@/src/schemas/sd-mailbox.schema'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/sd-access.repository')
vi.mock('@/src/repositories/sd-mailbox.repository')
vi.mock('@/lib/axiom/audit')
vi.mock('@/src/lib/crypto', () => ({
  encryptConnectionSecret: vi.fn(async (value: string) => `enc:${value}`),
  decryptConnectionSecret: vi.fn(async (value: string) =>
    value.replace(/^enc:/, ''),
  ),
}))
vi.mock('@/src/lib/mail/sd-mailbox-transport', () => ({
  verifySdImap: vi.fn(),
  verifySdSmtp: vi.fn(),
}))
vi.mock('@/src/lib/servicedesk/mail-queue', () => ({
  enqueueSdMailboxSync: vi.fn(async () => undefined),
}))
vi.mock('@/src/services/sd-ticket-tab-support', () => ({
  loadSdTicketTab: vi.fn(),
}))

import { auditMutation } from '@/lib/axiom/audit'
import { verifySdImap, verifySdSmtp } from '@/src/lib/mail/sd-mailbox-transport'
import { enqueueSdMailboxSync } from '@/src/lib/servicedesk/mail-queue'
import {
  SdMailboxRepository,
  SdMailMessageRepository,
} from '@/src/repositories/sd-mailbox.repository'
import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
import { SdMailboxService } from '../sd-mailbox.service'
import { loadSdTicketTab } from '../sd-ticket-tab-support'

const mailboxes = vi.mocked(SdMailboxRepository)
const messages = vi.mocked(SdMailMessageRepository)
const moduleAccess = vi.mocked(WorkspaceModuleAccessRepository)
const imap = vi.mocked(verifySdImap)
const smtp = vi.mocked(verifySdSmtp)
const audit = vi.mocked(auditMutation)
const enqueue = vi.mocked(enqueueSdMailboxSync)
const loadTab = vi.mocked(loadSdTicketTab)

const WS = 'ws1'
const ADMIN = 'admin-1'

const createDto: CreateSdMailboxDTO = {
  name: 'Suporte',
  address: 'suporte@empresa.com.br',
  imapHost: 'imap.empresa.com.br',
  imapPort: 993,
  imapSecure: true,
  imapUser: 'suporte',
  imapPassword: 'segredo',
  folder: 'INBOX',
  processedFolder: 'Processados',
  smtpHost: 'smtp.empresa.com.br',
  smtpPort: 465,
  smtpSecure: true,
  smtpUser: 'suporte',
  smtpPassword: 'smtp-segredo',
  defaultType: 'SERVICE_REQUEST',
  defaultDepartmentId: 'dep1',
  defaultCategoryId: null,
  defaultPriorityId: null,
  allowedSenders: ['@cliente.com.br'],
  blockedSenders: [],
  createUnknownContacts: true,
  sendAcknowledgement: true,
}

const withSmtp = (overrides = {}) =>
  createFakeSdMailbox({
    smtpHost: 'smtp.empresa.com.br',
    smtpPort: 465,
    smtpUser: 'suporte',
    encryptedSmtpPassword: 'enc:smtp-segredo',
    ...overrides,
  })

beforeEach(() => {
  moduleAccess.isEnabled.mockResolvedValue(ok(true))
  actAs('admin')
  mailboxes.listByWorkspace.mockResolvedValue(ok([]))
  mailboxes.findByAddress.mockResolvedValue(ok(null))
  mailboxes.findById.mockResolvedValue(ok(createFakeSdMailbox()))
  mailboxes.create.mockResolvedValue(ok(createFakeSdMailbox()))
  mailboxes.update.mockResolvedValue(ok(createFakeSdMailbox()))
  mailboxes.softDelete.mockResolvedValue(ok(undefined))
  imap.mockResolvedValue(7)
  smtp.mockResolvedValue(true)
})

describe('list()', () => {
  it('lists the workspace mailboxes without the secrets', async () => {
    mailboxes.listByWorkspace.mockResolvedValue(ok([withSmtp()]))
    const rows = expectOk(await SdMailboxService.list(ADMIN, WS))
    expect(mailboxes.listByWorkspace).toHaveBeenCalledWith(WS)
    expect(rows[0]).toMatchObject({ smtpConfigured: true })
    expect(JSON.stringify(rows)).not.toContain('enc:')
  })

  it.each([
    ['agent without the settings permission', 'agent' as const],
    ['requester', 'requester' as const],
    ['non-member', 'non-member' as const],
  ])('refuses %s', async (_label, kind) => {
    actAs(kind)
    expectErr(await SdMailboxService.list('other-1', WS), 'FORBIDDEN')
    expect(mailboxes.listByWorkspace).not.toHaveBeenCalled()
  })

  it('refuses when the module is disabled and propagates db errors', async () => {
    moduleAccess.isEnabled.mockResolvedValue(ok(false))
    expectErr(await SdMailboxService.list(ADMIN, WS), 'MODULE_DISABLED')

    moduleAccess.isEnabled.mockResolvedValue(ok(true))
    mailboxes.listByWorkspace.mockResolvedValue(err(databaseError()))
    expectErr(await SdMailboxService.list(ADMIN, WS), 'DATABASE_ERROR')
  })
})

describe('create()', () => {
  it('encrypts both passwords, lowercases the address and kicks off a read', async () => {
    const created = expectOk(
      await SdMailboxService.create(ADMIN, WS, {
        ...createDto,
        address: 'Suporte@Empresa.com.BR',
      }),
    )

    expect(mailboxes.create).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: WS,
        createdById: ADMIN,
        address: 'suporte@empresa.com.br',
        encryptedImapPassword: 'enc:segredo',
        encryptedSmtpPassword: 'enc:smtp-segredo',
        processedFolder: 'Processados',
        defaultType: 'SERVICE_REQUEST',
        allowedSenders: ['@cliente.com.br'],
      }),
    )
    expect(enqueue).toHaveBeenCalledWith(created.id)
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'sd_mailbox', action: 'create' }),
    )
  })

  it('stores no SMTP password when the mailbox has no SMTP', async () => {
    await SdMailboxService.create(ADMIN, WS, {
      ...createDto,
      smtpHost: null,
      smtpPort: null,
      smtpUser: null,
      smtpPassword: null,
    })
    expect(mailboxes.create).toHaveBeenCalledWith(
      expect.objectContaining({
        smtpHost: null,
        smtpPort: null,
        smtpUser: null,
        encryptedSmtpPassword: null,
      }),
    )
  })

  it('keeps the omitted optional fields null', async () => {
    await SdMailboxService.create(
      ADMIN,
      WS,
      CreateSdMailboxSchema.parse({
        name: 'Suporte',
        address: 'suporte@empresa.com.br',
        imapHost: 'imap.empresa.com.br',
        imapUser: 'suporte',
        imapPassword: 'segredo',
      }),
    )
    expect(mailboxes.create).toHaveBeenCalledWith(
      expect.objectContaining({
        processedFolder: null,
        smtpHost: null,
        smtpPort: null,
        smtpUser: null,
        encryptedSmtpPassword: null,
        defaultDepartmentId: null,
        defaultCategoryId: null,
        defaultPriorityId: null,
      }),
    )
  })

  it('refuses a second active mailbox on the same address', async () => {
    mailboxes.findByAddress.mockResolvedValue(ok(createFakeSdMailbox()))
    expectErr(
      await SdMailboxService.create(ADMIN, WS, createDto),
      'SD_MAILBOX_CONFLICT',
    )
    expect(mailboxes.create).not.toHaveBeenCalled()
  })

  it('revives a deleted mailbox instead of hitting the unique index', async () => {
    mailboxes.findByAddress.mockResolvedValue(
      ok(createFakeSdMailbox({ id: 'old', deletedAt: new Date() })),
    )
    expectOk(await SdMailboxService.create(ADMIN, WS, createDto))

    expect(mailboxes.create).not.toHaveBeenCalled()
    expect(mailboxes.update).toHaveBeenCalledWith(
      'old',
      expect.objectContaining({
        deletedAt: null,
        status: 'ACTIVE',
        statusError: null,
        lastSeenUid: null,
        lastSyncAt: null,
        encryptedImapPassword: 'enc:segredo',
      }),
    )
    // Reviver não reenvia workspaceId/createdById (campos de criação).
    const data = mailboxes.update.mock.calls[0][1]
    expect(data).not.toHaveProperty('workspaceId')
    expect(data).not.toHaveProperty('createdById')
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'sd_mailbox',
        meta: expect.objectContaining({ revived: true }),
      }),
    )
  })

  it('audits and refuses a non-admin, and propagates db errors', async () => {
    actAs('agent')
    expectErr(
      await SdMailboxService.create('agent-1', WS, createDto),
      'FORBIDDEN',
    )
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'failure', reason: 'FORBIDDEN' }),
    )

    actAs('admin')
    mailboxes.findByAddress.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdMailboxService.create(ADMIN, WS, createDto),
      'DATABASE_ERROR',
    )

    mailboxes.findByAddress.mockResolvedValue(ok(null))
    mailboxes.create.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdMailboxService.create(ADMIN, WS, createDto),
      'DATABASE_ERROR',
    )
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'failure', reason: 'DATABASE_ERROR' }),
    )
  })
})

describe('update()', () => {
  it('maps the plain fields and re-encrypts the passwords', async () => {
    expectOk(
      await SdMailboxService.update(ADMIN, WS, 'mb1', {
        name: 'Central',
        folder: 'Entrada',
        imapPassword: 'nova',
        smtpPassword: 'nova-smtp',
        allowedSenders: ['a@x.com'],
        sendAcknowledgement: false,
      }),
    )
    expect(mailboxes.update).toHaveBeenCalledWith('mb1', {
      name: 'Central',
      folder: 'Entrada',
      allowedSenders: ['a@x.com'],
      sendAcknowledgement: false,
      encryptedImapPassword: 'enc:nova',
      encryptedSmtpPassword: 'enc:nova-smtp',
    })
  })

  it('clears the SMTP password with null', async () => {
    await SdMailboxService.update(ADMIN, WS, 'mb1', { smtpPassword: null })
    expect(mailboxes.update).toHaveBeenCalledWith('mb1', {
      encryptedSmtpPassword: null,
    })
  })

  it('clears the last error when the mailbox is resumed', async () => {
    await SdMailboxService.update(ADMIN, WS, 'mb1', { status: 'ACTIVE' })
    expect(mailboxes.update).toHaveBeenCalledWith('mb1', {
      status: 'ACTIVE',
      statusError: null,
    })

    mailboxes.update.mockClear()
    await SdMailboxService.update(ADMIN, WS, 'mb1', { status: 'PAUSED' })
    expect(mailboxes.update).toHaveBeenCalledWith('mb1', { status: 'PAUSED' })
  })

  it('refuses a missing mailbox, a non-admin and propagates db errors', async () => {
    mailboxes.findById.mockResolvedValue(ok(null))
    expectErr(
      await SdMailboxService.update(ADMIN, WS, 'nope', { name: 'x' }),
      'SD_MAILBOX_NOT_FOUND',
    )

    mailboxes.findById.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdMailboxService.update(ADMIN, WS, 'mb1', { name: 'x' }),
      'DATABASE_ERROR',
    )

    mailboxes.findById.mockResolvedValue(ok(createFakeSdMailbox()))
    mailboxes.update.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdMailboxService.update(ADMIN, WS, 'mb1', { name: 'x' }),
      'DATABASE_ERROR',
    )

    actAs('requester')
    expectErr(
      await SdMailboxService.update('req-1', WS, 'mb1', { name: 'x' }),
      'FORBIDDEN',
    )
  })
})

describe('remove()', () => {
  it('soft deletes and audits', async () => {
    expectOk(await SdMailboxService.remove(ADMIN, WS, 'mb1'))
    expect(mailboxes.softDelete).toHaveBeenCalledWith('mb1')
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'sd_mailbox', action: 'delete' }),
    )
  })

  it('refuses a missing mailbox, a non-admin and propagates db errors', async () => {
    mailboxes.findById.mockResolvedValue(ok(null))
    expectErr(
      await SdMailboxService.remove(ADMIN, WS, 'nope'),
      'SD_MAILBOX_NOT_FOUND',
    )

    mailboxes.findById.mockResolvedValue(ok(createFakeSdMailbox()))
    mailboxes.softDelete.mockResolvedValue(err(databaseError()))
    expectErr(await SdMailboxService.remove(ADMIN, WS, 'mb1'), 'DATABASE_ERROR')

    actAs('agent')
    expectErr(await SdMailboxService.remove('agent-1', WS, 'mb1'), 'FORBIDDEN')
  })
})

describe('test()', () => {
  it('reports IMAP and SMTP as healthy and turns the mailbox ACTIVE', async () => {
    mailboxes.findById.mockResolvedValue(ok(withSmtp({ status: 'ERROR' })))
    const result = expectOk(await SdMailboxService.test(ADMIN, WS, 'mb1'))

    expect(result).toEqual({
      connected: true,
      status: 'ACTIVE',
      error: null,
      messages: 7,
      smtp: true,
    })
    expect(imap).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'imap.empresa.com.br',
        password: 'imap',
        folder: 'INBOX',
      }),
    )
    expect(smtp).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'smtp.empresa.com.br', port: 465 }),
    )
    expect(mailboxes.update).toHaveBeenCalledWith('mb1', {
      status: 'ACTIVE',
      statusError: null,
    })
  })

  it('reports smtp as null when the mailbox has no SMTP', async () => {
    const result = expectOk(await SdMailboxService.test(ADMIN, WS, 'mb1'))
    expect(result).toMatchObject({ connected: true, smtp: null, messages: 7 })
    expect(smtp).not.toHaveBeenCalled()
  })

  it('turns the mailbox into ERROR when IMAP fails, without touching SMTP', async () => {
    mailboxes.findById.mockResolvedValue(ok(withSmtp()))
    imap.mockRejectedValue(new Error('Login recusado'))

    const result = expectOk(await SdMailboxService.test(ADMIN, WS, 'mb1'))
    expect(result).toEqual({
      connected: false,
      status: 'ERROR',
      error: 'Login recusado',
      messages: null,
      smtp: null,
    })
    expect(smtp).not.toHaveBeenCalled()
    expect(mailboxes.update).toHaveBeenCalledWith('mb1', {
      status: 'ERROR',
      statusError: 'Login recusado',
    })
  })

  it('uses a generic message when the IMAP failure is not an Error', async () => {
    imap.mockRejectedValue('boom')
    const result = expectOk(await SdMailboxService.test(ADMIN, WS, 'mb1'))
    expect(result.error).toBe('Não foi possível conectar à caixa de e-mail')
  })

  it('reports an SMTP refusal and an SMTP exception', async () => {
    mailboxes.findById.mockResolvedValue(ok(withSmtp()))

    smtp.mockResolvedValue(false)
    expect(
      expectOk(await SdMailboxService.test(ADMIN, WS, 'mb1')),
    ).toMatchObject({
      connected: false,
      smtp: false,
      error: 'O servidor SMTP recusou as credenciais',
    })

    smtp.mockRejectedValue(new Error('porta fechada'))
    expect(
      expectOk(await SdMailboxService.test(ADMIN, WS, 'mb1')),
    ).toMatchObject({ connected: false, smtp: false, error: 'porta fechada' })

    smtp.mockRejectedValue('boom')
    expect(
      expectOk(await SdMailboxService.test(ADMIN, WS, 'mb1')),
    ).toMatchObject({ error: 'Falha ao testar o envio SMTP' })
  })

  it.each([
    [true, 465],
    [false, 587],
  ])('falls back to the implicit SMTP port and user (secure=%s)', async (smtpSecure, port) => {
    mailboxes.findById.mockResolvedValue(
      ok(
        createFakeSdMailbox({
          smtpHost: 'smtp.empresa.com.br',
          smtpPort: null,
          smtpUser: null,
          smtpSecure,
          encryptedSmtpPassword: 'enc:smtp-segredo',
          imapUser: 'caixa@empresa.com.br',
        }),
      ),
    )
    expectOk(await SdMailboxService.test(ADMIN, WS, 'mb1'))
    expect(smtp).toHaveBeenCalledWith(
      expect.objectContaining({ port, user: 'caixa@empresa.com.br' }),
    )
  })

  it('keeps a paused mailbox paused', async () => {
    mailboxes.findById.mockResolvedValue(
      ok(createFakeSdMailbox({ status: 'PAUSED' })),
    )
    const result = expectOk(await SdMailboxService.test(ADMIN, WS, 'mb1'))
    expect(result.status).toBe('PAUSED')
    expect(mailboxes.update).toHaveBeenCalledWith('mb1', {
      status: 'PAUSED',
      statusError: null,
    })
  })

  it('fails when the credentials cannot be decrypted', async () => {
    const { decryptConnectionSecret } = await import('@/src/lib/crypto')
    vi.mocked(decryptConnectionSecret).mockRejectedValueOnce(
      new Error('chave trocada'),
    )
    expectErr(
      await SdMailboxService.test(ADMIN, WS, 'mb1'),
      'SD_MAILBOX_CONNECTION_FAILED',
    )
    expect(imap).not.toHaveBeenCalled()
  })

  it('refuses a missing mailbox, a non-admin and propagates db errors', async () => {
    mailboxes.findById.mockResolvedValue(ok(null))
    expectErr(
      await SdMailboxService.test(ADMIN, WS, 'nope'),
      'SD_MAILBOX_NOT_FOUND',
    )

    mailboxes.findById.mockResolvedValue(ok(createFakeSdMailbox()))
    mailboxes.update.mockResolvedValue(err(databaseError()))
    expectErr(await SdMailboxService.test(ADMIN, WS, 'mb1'), 'DATABASE_ERROR')

    actAs('requester')
    expectErr(await SdMailboxService.test('req-1', WS, 'mb1'), 'FORBIDDEN')
  })
})

describe('listTicketMail()', () => {
  it('lists the ticket mail rows through the ticket visibility gate', async () => {
    loadTab.mockResolvedValue(ok({ ticket: { id: 't1' } } as never) as never)
    messages.listByTicket.mockResolvedValue(
      ok([
        {
          id: 'mm1',
          ticketMessageId: 'tm1',
          direction: 'INBOUND',
          fromAddress: 'cliente@cliente.com',
          fromName: null,
          toAddresses: [],
          ccAddresses: [],
          subject: 'Impressora',
          automatic: false,
          createdAt: new Date('2026-10-01T12:00:00.000Z'),
        },
      ] as never),
    )

    const rows = expectOk(
      await SdMailboxService.listTicketMail('ana-1', WS, 'INC-000001'),
    )
    expect(loadTab).toHaveBeenCalledWith('ana-1', WS, 'INC-000001', 'VIEW')
    expect(messages.listByTicket).toHaveBeenCalledWith('t1')
    expect(rows).toEqual([
      expect.objectContaining({ id: 'mm1', ticketMessageId: 'tm1' }),
    ])
  })

  it('propagates the ticket gate and db errors', async () => {
    loadTab.mockResolvedValue(err(databaseError()) as never)
    expectErr(
      await SdMailboxService.listTicketMail('ana-1', WS, 't1'),
      'DATABASE_ERROR',
    )

    loadTab.mockResolvedValue(ok({ ticket: { id: 't1' } } as never) as never)
    messages.listByTicket.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdMailboxService.listTicketMail('ana-1', WS, 't1'),
      'DATABASE_ERROR',
    )
  })
})
