import { describe, expect, it } from 'vitest'
import { seedSdContact } from '@/src/__tests__/factories/sd-contact.factory'
import {
  seedSdMailbox,
  seedSdMailMessage,
} from '@/src/__tests__/factories/sd-mailbox.factory'
import { seedSdTicket } from '@/src/__tests__/factories/sd-ticket.factory'
import { seedSdPhase } from '@/src/__tests__/factories/sd-ticket-context.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import {
  SdMailboxRepository,
  SdMailMessageRepository,
} from '../sd-mailbox.repository'

async function setup() {
  const [workspace, other, user] = await Promise.all([
    seedWorkspace(),
    seedWorkspace(),
    seedUser(),
  ])
  return { workspace, other, user }
}

async function setupTicket() {
  const { workspace, other, user } = await setup()
  const phase = await seedSdPhase(workspace.id, { isInitial: true })
  const ticket = await seedSdTicket(workspace.id, phase.id)
  return { workspace, other, user, ticket }
}

const data = (workspaceId: string, createdById: string, address: string) => ({
  workspaceId,
  createdById,
  name: 'Suporte',
  address,
  imapHost: 'imap.empresa.com.br',
  imapPort: 993,
  imapSecure: true,
  imapUser: 'suporte',
  encryptedImapPassword: 'enc:imap',
  folder: 'INBOX',
  processedFolder: null,
  smtpHost: null,
  smtpPort: null,
  smtpSecure: true,
  smtpUser: null,
  encryptedSmtpPassword: null,
  defaultType: 'INCIDENT' as const,
  defaultDepartmentId: null,
  defaultCategoryId: null,
  defaultPriorityId: null,
  allowedSenders: [],
  blockedSenders: [],
  createUnknownContacts: true,
  sendAcknowledgement: true,
})

describe('SdMailboxRepository', () => {
  it('creates, scopes by workspace and hides the deleted ones', async () => {
    const { workspace, other, user } = await setup()
    const created = expectOk(
      await SdMailboxRepository.create(
        data(workspace.id, user.id, 'suporte@empresa.com.br'),
      ),
    )
    await seedSdMailbox(workspace.id, user.id, {
      address: 'antiga@empresa.com.br',
      deletedAt: new Date(),
    })
    await seedSdMailbox(other.id, user.id)

    const rows = expectOk(
      await SdMailboxRepository.listByWorkspace(workspace.id),
    )
    expect(rows.map((r) => r.id)).toEqual([created.id])
    expect(rows[0]).toMatchObject({
      status: 'ACTIVE',
      protocol: 'IMAP',
      lastSeenUid: null,
    })
  })

  it('refuses two mailboxes on the same address of a workspace', async () => {
    const { workspace, user } = await setup()
    expectOk(
      await SdMailboxRepository.create(
        data(workspace.id, user.id, 'suporte@empresa.com.br'),
      ),
    )
    expectErr(
      await SdMailboxRepository.create(
        data(workspace.id, user.id, 'suporte@empresa.com.br'),
      ),
      'SD_CONFIG_CONFLICT',
    )
  })

  it('finds by id only inside the workspace and only when alive', async () => {
    const { workspace, other, user } = await setup()
    const mailbox = await seedSdMailbox(workspace.id, user.id)
    const removed = await seedSdMailbox(workspace.id, user.id, {
      deletedAt: new Date(),
    })

    expect(
      expectOk(await SdMailboxRepository.findById(mailbox.id, workspace.id))
        ?.id,
    ).toBe(mailbox.id)
    expect(
      expectOk(await SdMailboxRepository.findById(mailbox.id, other.id)),
    ).toBeNull()
    expect(
      expectOk(await SdMailboxRepository.findById(removed.id, workspace.id)),
    ).toBeNull()
    expect(
      expectOk(await SdMailboxRepository.findByIdUnscoped(mailbox.id))?.id,
    ).toBe(mailbox.id)
    expect(
      expectOk(await SdMailboxRepository.findByIdUnscoped(removed.id)),
    ).toBeNull()
  })

  it('finds by address including the deleted one (so it can be revived)', async () => {
    const { workspace, user } = await setup()
    const removed = await seedSdMailbox(workspace.id, user.id, {
      address: 'suporte@empresa.com.br',
      deletedAt: new Date(),
    })

    expect(
      expectOk(
        await SdMailboxRepository.findByAddress(
          workspace.id,
          'suporte@empresa.com.br',
        ),
      )?.id,
    ).toBe(removed.id)
    expect(
      expectOk(
        await SdMailboxRepository.findByAddress(workspace.id, 'outra@x.com'),
      ),
    ).toBeNull()
  })

  it('lists the pollable mailboxes oldest-read first and skips paused/deleted', async () => {
    const { workspace, other, user } = await setup()
    const never = await seedSdMailbox(workspace.id, user.id, {
      address: 'a@empresa.com.br',
    })
    const old = await seedSdMailbox(workspace.id, user.id, {
      address: 'b@empresa.com.br',
      status: 'ERROR',
      lastSyncAt: new Date('2026-01-01T00:00:00.000Z'),
    })
    const recent = await seedSdMailbox(other.id, user.id, {
      address: 'c@empresa.com.br',
      lastSyncAt: new Date('2026-09-01T00:00:00.000Z'),
    })
    await seedSdMailbox(workspace.id, user.id, {
      address: 'd@empresa.com.br',
      status: 'PAUSED',
    })
    await seedSdMailbox(workspace.id, user.id, {
      address: 'e@empresa.com.br',
      deletedAt: new Date(),
    })

    const rows = expectOk(await SdMailboxRepository.listPollable(10))
    expect(rows.map((r) => r.id)).toEqual([never.id, old.id, recent.id])
    expect(
      expectOk(await SdMailboxRepository.listPollable(1)).map((r) => r.id),
    ).toEqual([never.id])
  })

  it('updates, soft deletes and stamps the sync result', async () => {
    const { workspace, user } = await setup()
    const mailbox = await seedSdMailbox(workspace.id, user.id)

    expectOk(
      await SdMailboxRepository.update(mailbox.id, {
        name: 'Central',
        allowedSenders: ['@cliente.com'],
      }),
    )
    const syncedAt = new Date('2026-10-01T10:00:00.000Z')
    expectOk(
      await SdMailboxRepository.markSync(mailbox.id, {
        status: 'ERROR',
        statusError: 'Login recusado',
        lastSeenUid: 21,
        lastSyncAt: syncedAt,
      }),
    )
    expect(
      expectOk(await SdMailboxRepository.findByIdUnscoped(mailbox.id)),
    ).toMatchObject({
      name: 'Central',
      allowedSenders: ['@cliente.com'],
      status: 'ERROR',
      statusError: 'Login recusado',
      lastSeenUid: 21,
      lastSyncAt: syncedAt,
    })

    // Sem `lastSeenUid` o UID guardado não é mexido.
    expectOk(
      await SdMailboxRepository.markSync(mailbox.id, {
        status: 'ACTIVE',
        statusError: null,
        lastSyncAt: new Date(),
      }),
    )
    expect(
      expectOk(await SdMailboxRepository.findByIdUnscoped(mailbox.id))
        ?.lastSeenUid,
    ).toBe(21)

    expectOk(await SdMailboxRepository.softDelete(mailbox.id))
    expect(
      expectOk(await SdMailboxRepository.findByIdUnscoped(mailbox.id)),
    ).toBeNull()
    const row = await prisma.sdMailbox.findUnique({
      where: { id: mailbox.id },
    })
    expect(row?.status).toBe('PAUSED')
  })

  it('reports SD_CONFIG_NOT_FOUND when the row is gone', async () => {
    expectErr(
      await SdMailboxRepository.update('nao-existe', { name: 'x' }),
      'SD_CONFIG_NOT_FOUND',
    )
    expectErr(
      await SdMailboxRepository.softDelete('nao-existe'),
      'SD_CONFIG_NOT_FOUND',
    )
    expectErr(
      await SdMailboxRepository.markSync('nao-existe', {
        status: 'ACTIVE',
        statusError: null,
        lastSyncAt: new Date(),
      }),
      'SD_CONFIG_NOT_FOUND',
    )
  })
})

describe('SdMailMessageRepository', () => {
  it('dedupes by mailbox and Message-ID', async () => {
    const { workspace, user } = await setup()
    const mailbox = await seedSdMailbox(workspace.id, user.id)
    const otherBox = await seedSdMailbox(workspace.id, user.id, {
      address: 'outra@empresa.com.br',
    })
    const row = await seedSdMailMessage(workspace.id, mailbox.id, {
      messageId: '<a@cliente.com>',
    })

    expect(
      expectOk(
        await SdMailMessageRepository.findByMessageId(
          mailbox.id,
          '<a@cliente.com>',
        ),
      )?.id,
    ).toBe(row.id)
    expect(
      expectOk(
        await SdMailMessageRepository.findByMessageId(
          otherBox.id,
          '<a@cliente.com>',
        ),
      ),
    ).toBeNull()

    expectErr(
      await SdMailMessageRepository.create({
        workspaceId: workspace.id,
        mailboxId: mailbox.id,
        ticketId: null,
        messageId: '<a@cliente.com>',
        inReplyTo: null,
        references: [],
        direction: 'INBOUND',
        fromAddress: 'cliente@cliente.com',
        fromName: null,
        toAddresses: [],
        ccAddresses: [],
        subject: null,
        bodyText: null,
        automatic: false,
        processedAt: null,
        error: null,
      }),
      'SD_CONFIG_CONFLICT',
    )
  })

  it('resolves the thread ticket from the candidate Message-IDs', async () => {
    const { workspace, other, user, ticket } = await setupTicket()
    const mailbox = await seedSdMailbox(workspace.id, user.id)
    await seedSdMailMessage(workspace.id, mailbox.id, {
      messageId: '<sem-chamado@cliente.com>',
    })
    await seedSdMailMessage(workspace.id, mailbox.id, {
      messageId: '<com-chamado@cliente.com>',
      ticketId: ticket.id,
    })

    expect(
      expectOk(
        await SdMailMessageRepository.findThreadTicketId(workspace.id, [
          '<sem-chamado@cliente.com>',
          '<com-chamado@cliente.com>',
        ]),
      ),
    ).toBe(ticket.id)
    expect(
      expectOk(
        await SdMailMessageRepository.findThreadTicketId(workspace.id, [
          '<sem-chamado@cliente.com>',
        ]),
      ),
    ).toBeNull()
    expect(
      expectOk(
        await SdMailMessageRepository.findThreadTicketId(workspace.id, []),
      ),
    ).toBeNull()
    // Outro workspace nunca encontra a thread.
    expect(
      expectOk(
        await SdMailMessageRepository.findThreadTicketId(other.id, [
          '<com-chamado@cliente.com>',
        ]),
      ),
    ).toBeNull()
  })

  it('lists a ticket mail chronologically and finds its mailbox and last inbound', async () => {
    const { workspace, user, ticket } = await setupTicket()
    const mailbox = await seedSdMailbox(workspace.id, user.id)
    const first = await seedSdMailMessage(workspace.id, mailbox.id, {
      ticketId: ticket.id,
      createdAt: new Date('2026-10-01T10:00:00.000Z'),
    })
    const out = await seedSdMailMessage(workspace.id, mailbox.id, {
      ticketId: ticket.id,
      direction: 'OUTBOUND',
      createdAt: new Date('2026-10-01T11:00:00.000Z'),
    })
    const last = await seedSdMailMessage(workspace.id, mailbox.id, {
      ticketId: ticket.id,
      createdAt: new Date('2026-10-01T12:00:00.000Z'),
      subject: 'último recebido',
    })

    expect(
      expectOk(await SdMailMessageRepository.listByTicket(ticket.id)).map(
        (r) => r.id,
      ),
    ).toEqual([first.id, out.id, last.id])
    expect(
      expectOk(await SdMailMessageRepository.findMailboxIdForTicket(ticket.id)),
    ).toBe(mailbox.id)
    expect(
      expectOk(await SdMailMessageRepository.findLastInbound(ticket.id))
        ?.subject,
    ).toBe('último recebido')

    expect(
      expectOk(
        await SdMailMessageRepository.findMailboxIdForTicket('sem-email'),
      ),
    ).toBeNull()
    expect(
      expectOk(await SdMailMessageRepository.findLastInbound('sem-email')),
    ).toBeNull()
  })

  it('counts the inbound mail of the window and knows an answered message', async () => {
    const { workspace, user, ticket } = await setupTicket()
    const mailbox = await seedSdMailbox(workspace.id, user.id)
    await seedSdMailMessage(workspace.id, mailbox.id, {
      createdAt: new Date('2026-10-01T12:00:00.000Z'),
    })
    await seedSdMailMessage(workspace.id, mailbox.id, {
      createdAt: new Date('2026-09-01T12:00:00.000Z'),
    })
    await seedSdMailMessage(workspace.id, mailbox.id, {
      direction: 'OUTBOUND',
      ticketId: ticket.id,
      ticketMessageId: 'tm1',
      createdAt: new Date('2026-10-01T12:30:00.000Z'),
    })

    expect(
      expectOk(
        await SdMailMessageRepository.countInboundSince(
          mailbox.id,
          new Date('2026-10-01T00:00:00.000Z'),
        ),
      ),
    ).toBe(1)
    expect(expectOk(await SdMailMessageRepository.hasOutboundFor('tm1'))).toBe(
      true,
    )
    expect(expectOk(await SdMailMessageRepository.hasOutboundFor('tm9'))).toBe(
      false,
    )
  })

  it('writes the ticket message with its attachments in one transaction', async () => {
    const { workspace, ticket } = await setupTicket()
    const created = expectOk(
      await SdMailMessageRepository.createTicketMessage({
        workspaceId: workspace.id,
        ticketId: ticket.id,
        authorKind: 'REQUESTER',
        body: 'segue o print',
        attachments: [
          {
            id: 'att-1',
            kind: 'IMAGE',
            fileName: 'print.png',
            mimeType: 'image/png',
            size: 120,
            storageKey: `${workspace.id}/tickets/${ticket.id}/att-1-print.png`,
          },
        ],
      }),
    )

    const message = await prisma.sdTicketMessage.findUnique({
      where: { id: created.id },
      include: { attachments: true },
    })
    expect(message).toMatchObject({
      channel: 'EMAIL',
      visibility: 'PUBLIC',
      authorKind: 'REQUESTER',
      authorUserId: null,
      authorContactId: null,
      body: 'segue o print',
    })
    expect(message?.attachments).toHaveLength(1)
    expect(message?.attachments[0]).toMatchObject({
      id: 'att-1',
      uploadedById: null,
      kind: 'IMAGE',
    })
  })

  it('writes a message with no attachment and attributes it to the contact', async () => {
    const { workspace, user, ticket } = await setupTicket()
    const contact = await seedSdContact(workspace.id, user.id, {
      name: 'Cliente',
      email: 'cliente@cliente.com',
    })
    const created = expectOk(
      await SdMailMessageRepository.createTicketMessage({
        workspaceId: workspace.id,
        ticketId: ticket.id,
        authorKind: 'CONTACT',
        authorContactId: contact.id,
        authorUserId: null,
        body: 'obrigado',
        attachments: [],
      }),
    )
    const message = await prisma.sdTicketMessage.findUnique({
      where: { id: created.id },
      include: { attachments: true },
    })
    expect(message?.authorContactId).toBe(contact.id)
    expect(message?.attachments).toHaveLength(0)
  })

  it('reports a database error when the ticket does not exist', async () => {
    const { workspace } = await setup()
    expectErr(
      await SdMailMessageRepository.createTicketMessage({
        workspaceId: workspace.id,
        ticketId: 'nao-existe',
        authorKind: 'REQUESTER',
        body: 'oi',
        attachments: [],
      }),
    )
  })

  it('finds a contact by e-mail, case-insensitively and scoped', async () => {
    const { workspace, other, user } = await setup()
    const contact = await seedSdContact(workspace.id, user.id, {
      name: 'Cliente',
      email: 'Cliente@Cliente.com',
    })
    await seedSdContact(workspace.id, user.id, {
      name: 'Removido',
      email: 'removido@cliente.com',
      deletedAt: new Date(),
    })

    expect(
      expectOk(
        await SdMailMessageRepository.findContactIdByEmail(
          workspace.id,
          'cliente@cliente.com',
        ),
      ),
    ).toEqual({ id: contact.id, userId: null })
    expect(
      expectOk(
        await SdMailMessageRepository.findContactIdByEmail(
          workspace.id,
          'removido@cliente.com',
        ),
      ),
    ).toBeNull()
    expect(
      expectOk(
        await SdMailMessageRepository.findContactIdByEmail(
          other.id,
          'cliente@cliente.com',
        ),
      ),
    ).toBeNull()
  })

  it('finds a ticket by number inside the workspace', async () => {
    const { workspace, other, ticket } = await setupTicket()
    expect(
      expectOk(
        await SdMailMessageRepository.findTicketIdByNumber(
          workspace.id,
          ticket.number,
        ),
      ),
    ).toBe(ticket.id)
    expect(
      expectOk(
        await SdMailMessageRepository.findTicketIdByNumber(
          other.id,
          ticket.number,
        ),
      ),
    ).toBeNull()

    await prisma.sdTicket.update({
      where: { id: ticket.id },
      data: { deletedAt: new Date() },
    })
    expect(
      expectOk(
        await SdMailMessageRepository.findTicketIdByNumber(
          workspace.id,
          ticket.number,
        ),
      ),
    ).toBeNull()
  })
})
