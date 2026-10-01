import { describe, expect, it } from 'vitest'
import { seedSdPhaseFlow } from '@/src/__tests__/factories/sd-ticket-context.factory'
import {
  addMember,
  authenticatedOwner,
  createAuthenticatedUser,
  deleteJson,
  getJson,
  patchJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'

/**
 * Rotas do canal de e-mail do ServiceDesk. Não há rede nos e2e: o servidor
 * de IMAP/SMTP aponta para uma porta fechada de propósito, então "testar" e
 * "ler agora" exercitam o caminho de falha — o que se verifica é o
 * contrato (acesso, cifra das senhas, padrões, pausa e os números da
 * leitura).
 */

const api = (ws: string) => `/api/workspaces/${ws}/servicedesk`
const mailboxes = (ws: string) => `${api(ws)}/mailboxes`

async function setup() {
  const { user: owner, workspace } = await authenticatedOwner()
  await seedSdPhaseFlow(workspace.id, 'INCIDENT')
  return { owner, workspace }
}

/** Host inalcançável: o IMAP falha na hora, sem depender de rede. */
const MAILBOX = {
  name: 'Suporte',
  address: 'suporte@empresa.test',
  imapHost: '127.0.0.1',
  imapPort: 1,
  imapUser: 'suporte',
  imapPassword: 'segredo',
  smtpHost: '127.0.0.1',
  smtpPort: 2,
  smtpUser: 'suporte',
  smtpPassword: 'smtp-segredo',
}

async function createMailbox(
  workspaceId: string,
  cookie: string,
  overrides: Record<string, unknown> = {},
) {
  const res = await postJson(
    mailboxes(workspaceId),
    { ...MAILBOX, ...overrides },
    cookie,
  )
  expect(res.status).toBe(201)
  return (await res.json()).data as {
    id: string
    address: string
    smtpConfigured: boolean
    status: string
  }
}

describe('/api/workspaces/[id]/servicedesk/mailboxes', () => {
  it('refuses a non-member, a requester and an agent without the settings permission', async () => {
    const { workspace } = await setup()

    const stranger = await createAuthenticatedUser()
    expect(
      (await getJson(mailboxes(workspace.id), stranger.cookie)).status,
    ).toBe(403)

    const requester = await addMember(workspace.id, 'MEMBER')
    const asRequester = await getJson(mailboxes(workspace.id), requester.cookie)
    expect(asRequester.status).toBe(403)
    expect((await asRequester.json()).error.code).toBe('FORBIDDEN')

    expect((await getJson(mailboxes(workspace.id))).status).toBe(401)
  })

  it('creates a mailbox without ever returning the passwords', async () => {
    const { owner, workspace } = await setup()
    const mailbox = await createMailbox(workspace.id, owner.cookie)

    expect(mailbox).toMatchObject({
      address: 'suporte@empresa.test',
      status: 'ACTIVE',
      imapPort: 1,
      folder: 'INBOX',
      smtpConfigured: true,
      defaultType: 'INCIDENT',
      createUnknownContacts: true,
      sendAcknowledgement: true,
      lastSyncAt: null,
      lastSeenUid: null,
    })
    const body = JSON.stringify(mailbox)
    expect(body).not.toContain('segredo')
    expect(body).not.toContain('Password')

    const list = await getJson(mailboxes(workspace.id), owner.cookie)
    expect((await list.json()).data).toHaveLength(1)
  })

  it('refuses a duplicated address and an invalid body', async () => {
    const { owner, workspace } = await setup()
    await createMailbox(workspace.id, owner.cookie)

    const again = await postJson(mailboxes(workspace.id), MAILBOX, owner.cookie)
    expect(again.status).toBe(409)
    expect((await again.json()).error.code).toBe('SD_MAILBOX_CONFLICT')

    const invalid = await postJson(
      mailboxes(workspace.id),
      { ...MAILBOX, address: 'nao-e-email' },
      owner.cookie,
    )
    expect(invalid.status).toBe(400)
    expect((await invalid.json()).error.code).toBe('VALIDATION_ERROR')
  })

  it('updates the defaults, the sender lists and pauses the reading', async () => {
    const { owner, workspace } = await setup()
    const mailbox = await createMailbox(workspace.id, owner.cookie)

    const updated = await patchJson(
      `${mailboxes(workspace.id)}/${mailbox.id}`,
      {
        name: 'Central de serviços',
        defaultType: 'SERVICE_REQUEST',
        allowedSenders: ['@cliente.com.br', 'Ana@X.com'],
        blockedSenders: ['spam@x.com'],
        sendAcknowledgement: false,
        status: 'PAUSED',
      },
      owner.cookie,
    )
    expect(updated.status).toBe(200)
    expect((await updated.json()).data).toMatchObject({
      name: 'Central de serviços',
      defaultType: 'SERVICE_REQUEST',
      allowedSenders: ['@cliente.com.br', 'ana@x.com'],
      blockedSenders: ['spam@x.com'],
      sendAcknowledgement: false,
      status: 'PAUSED',
    })

    const empty = await patchJson(
      `${mailboxes(workspace.id)}/${mailbox.id}`,
      {},
      owner.cookie,
    )
    expect(empty.status).toBe(400)
  })

  it('reports SD_MAILBOX_NOT_FOUND for another workspace mailbox', async () => {
    const { owner, workspace } = await setup()
    const mailbox = await createMailbox(workspace.id, owner.cookie)
    const { owner: other, workspace: otherWs } = await setup()

    for (const res of [
      await patchJson(
        `${mailboxes(otherWs.id)}/${mailbox.id}`,
        { name: 'x' },
        other.cookie,
      ),
      await deleteJson(`${mailboxes(otherWs.id)}/${mailbox.id}`, other.cookie),
      await postJson(
        `${mailboxes(otherWs.id)}/${mailbox.id}/test`,
        {},
        other.cookie,
      ),
      await postJson(
        `${mailboxes(otherWs.id)}/${mailbox.id}/sync`,
        {},
        other.cookie,
      ),
    ]) {
      expect(res.status).toBe(404)
      expect((await res.json()).error.code).toBe('SD_MAILBOX_NOT_FOUND')
    }
  })

  it('reports the IMAP failure on "test" and marks the mailbox as ERROR', async () => {
    const { owner, workspace } = await setup()
    const mailbox = await createMailbox(workspace.id, owner.cookie)

    const res = await postJson(
      `${mailboxes(workspace.id)}/${mailbox.id}/test`,
      {},
      owner.cookie,
    )
    expect(res.status).toBe(200)
    const result = (await res.json()).data
    expect(result).toMatchObject({
      connected: false,
      status: 'ERROR',
      messages: null,
      smtp: null,
    })
    expect(result.error).toBeTruthy()

    const list = await getJson(mailboxes(workspace.id), owner.cookie)
    expect((await list.json()).data[0]).toMatchObject({ status: 'ERROR' })
  })

  it('reports the read of an unreachable mailbox as failed', async () => {
    const { owner, workspace } = await setup()
    const mailbox = await createMailbox(workspace.id, owner.cookie)

    const res = await postJson(
      `${mailboxes(workspace.id)}/${mailbox.id}/sync`,
      {},
      owner.cookie,
    )
    expect(res.status).toBe(200)
    expect((await res.json()).data).toEqual({
      fetched: 0,
      opened: 0,
      appended: 0,
      skipped: 0,
      failed: 1,
    })
  })

  it('removes the mailbox and lets the same address be registered again', async () => {
    const { owner, workspace } = await setup()
    const mailbox = await createMailbox(workspace.id, owner.cookie)

    const removed = await deleteJson(
      `${mailboxes(workspace.id)}/${mailbox.id}`,
      owner.cookie,
    )
    expect(removed.status).toBe(200)
    const list = await getJson(mailboxes(workspace.id), owner.cookie)
    expect((await list.json()).data).toHaveLength(0)

    const revived = await createMailbox(workspace.id, owner.cookie)
    expect(revived.id).toBe(mailbox.id)
    expect(revived.status).toBe('ACTIVE')
  })
})

describe('/api/workspaces/[id]/servicedesk/mail/tickets/[ticketId]/messages', () => {
  const ticketMail = (ws: string, ref: string) =>
    `${api(ws)}/mail/tickets/${ref}/messages`

  it('lists the ticket mail (empty for a ticket opened by an agent)', async () => {
    const { owner, workspace } = await setup()
    const created = await postJson(
      `${api(workspace.id)}/tickets`,
      { type: 'INCIDENT', title: 'Sem acesso ao sistema' },
      owner.cookie,
    )
    expect(created.status).toBe(201)
    const ticket = (await created.json()).data as {
      id: string
      number: number
      code: string
    }

    for (const ref of [ticket.id, String(ticket.number), ticket.code]) {
      const res = await getJson(ticketMail(workspace.id, ref), owner.cookie)
      expect(res.status).toBe(200)
      expect((await res.json()).data).toEqual([])
    }
  })

  it('refuses an unknown ticket, a requester of someone else and a non-member', async () => {
    const { owner, workspace } = await setup()
    const created = await postJson(
      `${api(workspace.id)}/tickets`,
      { type: 'INCIDENT', title: 'Sem acesso ao sistema' },
      owner.cookie,
    )
    const ticket = (await created.json()).data as { id: string }

    const missing = await getJson(
      ticketMail(workspace.id, 'INC-999999'),
      owner.cookie,
    )
    expect(missing.status).toBe(404)
    expect((await missing.json()).error.code).toBe('SD_TICKET_NOT_FOUND')

    const requester = await addMember(workspace.id, 'MEMBER')
    const forbidden = await getJson(
      ticketMail(workspace.id, ticket.id),
      requester.cookie,
    )
    expect(forbidden.status).toBe(403)
    expect((await forbidden.json()).error.code).toBe('SD_TICKET_FORBIDDEN')

    const stranger = await createAuthenticatedUser()
    expect(
      (await getJson(ticketMail(workspace.id, ticket.id), stranger.cookie))
        .status,
    ).toBe(403)
  })
})
